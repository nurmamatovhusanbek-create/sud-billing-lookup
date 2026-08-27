'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, Activity, Server, CheckCircle2, XCircle, RefreshCw, Clock, Zap, AlertTriangle, Globe } from 'lucide-react'

interface WorkerHealth {
  workerUrl: string
  label: string
  totalRequests: number
  totalSuccesses: number
  totalFailures: number
  consecutiveFailures: number
  successRate: number
  lastResponseTimeMs: number | null
  lastUsedAt: string | null
  lastFailureAt: string | null
  lastFailureReason: string | null
  deadUntil: string | null
  status: 'alive' | 'dead'
}

interface OriginData {
  origin: string
  workers: WorkerHealth[]
  totals: { requests: number; successes: number; failures: number; successRate: number }
}

interface PoolData {
  label: string
  origins: OriginData[]
}

interface AllSource {
  origin: string
  label: string
  hasData: boolean
}

interface HealthData {
  pools: PoolData[]
  allSources: AllSource[]
  configuredWorkerCount: number
  summary: {
    totalRequests: number
    totalSuccesses: number
    totalFailures: number
    overallSuccessRate: number
    activeWorkers: number
    deadWorkers: number
    totalWorkers: number
  }
  fetchedAt: string
}

export function HealthTab() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set())

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/health')
      const json = await res.json()
      setData(json)
    } catch {
      console.error('Failed to fetch health')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchHealth, 5000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchHealth])

  const toggleWorker = (key: string) => {
    setExpandedWorkers(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Ma'lumot yuklanmadi</p>
      </div>
    )
  }

  const formatRate = (rate: number) => `${(rate * 100).toFixed(1)}%`
  const formatMs = (ms: number | null) => (ms !== null ? `${ms}ms` : '—')
  const formatTime = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    const now = Date.now()
    const diff = Math.floor((now - d.getTime()) / 1000)
    if (diff < 5) return 'hozir'
    if (diff < 60) return `${diff}s avval`
    if (diff < 3600) return `${Math.floor(diff / 60)}d avval`
    return d.toLocaleTimeString('uz-UZ')
  }

  const getSuccessColor = (rate: number) => {
    if (rate >= 0.9) return 'text-foreground'
    if (rate >= 0.5) return 'text-muted-foreground'
    return 'text-muted-foreground'
  }

  // Get max requests for bar scaling
  const maxWorkerRequests = Math.max(
    1,
    ...data.pools.flatMap(p => p.origins.flatMap(o => o.workers.map(w => w.totalRequests)))
  )

  return (
    <div className="space-y-4 py-2">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Umumiy so'rovlar</p>
                <p className="text-2xl font-semibold mt-1">{data.summary.totalRequests}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.summary.totalSuccesses} muvaffaqiyatli
                </p>
              </div>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Muvaffaqiyat darajasi</p>
                <p className="text-2xl font-semibold mt-1">
                  {formatRate(data.summary.overallSuccessRate)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.summary.totalFailures} xato
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Faol workerlar</p>
                <p className="text-2xl font-semibold mt-1 text-foreground">{data.summary.activeWorkers}</p>
                <p className="text-xs text-muted-foreground mt-0.5">ishlayapti</p>
              </div>
              <Server className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">O'lik workerlar</p>
                <p className="text-2xl font-semibold mt-1">{data.summary.deadWorkers}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.summary.deadWorkers > 0 ? 'tiklanish kutilmoqda' : 'hammasi joyida'}
                </p>
              </div>
              <XCircle className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall request distribution bar (Cloudflare-style) */}
      {data.summary.totalRequests > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">So'rovlar taqsimoti</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 h-3 rounded-full overflow-hidden bg-muted flex">
                <div
                  className="bg-foreground transition-all duration-500"
                  style={{ width: `${data.summary.overallSuccessRate * 100}%` }}
                  title={`Muvaffaqiyat: ${data.summary.totalSuccesses}`}
                />
                <div
                  className="bg-muted-foreground/40 transition-all duration-500"
                  style={{ width: `${(1 - data.summary.overallSuccessRate) * 100}%` }}
                  title={`Xato: ${data.summary.totalFailures}`}
                />
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-foreground inline-block" />
                Muvaffaqiyat: {data.summary.totalSuccesses} ({formatRate(data.summary.overallSuccessRate)})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 inline-block" />
                Xato: {data.summary.totalFailures} ({formatRate(1 - data.summary.overallSuccessRate)})
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All known sources */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Barcha manbalar ({data.allSources.length})
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {data.allSources.filter(s => s.hasData).length} faol
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.allSources.map(source => (
              <div
                key={source.origin}
                className="flex items-center justify-between gap-2 p-2 rounded border text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      source.hasData ? 'bg-foreground' : 'bg-muted-foreground/30'
                    }`}
                  />
                  <div className="min-w-0">
                    <code className="font-mono truncate block">{source.origin}</code>
                    <span className="text-muted-foreground truncate block">{source.label}</span>
                  </div>
                </div>
                <Badge variant={source.hasData ? 'default' : 'outline'} className="shrink-0 text-xs">
                  {source.hasData ? 'Faol' : 'Foydalanilmagan'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Auto-refresh toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Worker statistikasi</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-1.5 h-7"
          >
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} />
            <span className="text-xs">{autoRefresh ? 'Avto (5s)' : 'Off'}</span>
          </Button>
          <span className="text-xs text-muted-foreground">
            {formatTime(data.fetchedAt)}
          </span>
        </div>
      </div>

      <Separator />

      {/* Per-pool, per-origin details */}
      {data.pools.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Hozircha so'rov ma'lumoti yo'q</p>
          <p className="text-xs mt-1">
            So'rovlar amalga oshirilgandan keyin statistika paydo bo'ladi
          </p>
        </div>
      ) : (
        data.pools.map((pool) => (
          <div key={pool.label} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {pool.label}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {pool.origins.length} manba
              </Badge>
            </div>

            {pool.origins.map((originData) => {
              // Filter to only show configured CF Workers (exclude "direct" and proxies)
              const configuredWorkers = new Set(getConfiguredWorkerUrls(data))
              const workers = originData.workers.filter(w => configuredWorkers.has(w.workerUrl))

              if (workers.length === 0) return null

              return (
                <Card key={`${pool.label}-${originData.origin}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <CardTitle className="text-sm font-mono">{originData.origin}</CardTitle>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">So'rovlar:</span>
                          <span className="font-medium">{originData.totals.requests}</span>
                        </div>
                        <Separator orientation="vertical" className="h-3" />
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Muvaffaqiyat:</span>
                          <span className={`font-medium ${getSuccessColor(originData.totals.successRate)}`}>
                            {formatRate(originData.totals.successRate)}
                          </span>
                        </div>
                        {originData.totals.failures > 0 && (
                          <>
                            <Separator orientation="vertical" className="h-3" />
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">Xato:</span>
                              <span className="font-medium">{originData.totals.failures}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Cloudflare-style linear bars for each worker */}
                    <div className="space-y-2 mb-3">
                      {workers
                        .sort((a, b) => b.totalRequests - a.totalRequests)
                        .map((w) => {
                          const barWidth = (w.totalRequests / maxWorkerRequests) * 100
                          const successWidth = w.totalRequests > 0 ? (w.totalSuccesses / w.totalRequests) * barWidth : 0
                          const failWidth = w.totalRequests > 0 ? (w.totalFailures / w.totalRequests) * barWidth : 0

                          return (
                            <div key={`bar-${w.workerUrl}`} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <code className="font-mono text-muted-foreground truncate">{w.label}</code>
                                <span className="text-muted-foreground shrink-0 ml-2">
                                  {w.totalRequests} so'rov
                                </span>
                              </div>
                              <div className="h-2 rounded-full overflow-hidden bg-muted flex">
                                <div
                                  className="bg-foreground transition-all duration-300"
                                  style={{ width: `${successWidth}%` }}
                                  title={`Muvaffaqiyat: ${w.totalSuccesses}`}
                                />
                                <div
                                  className="bg-muted-foreground/40 transition-all duration-300"
                                  style={{ width: `${failWidth}%` }}
                                  title={`Xato: ${w.totalFailures}`}
                                />
                              </div>
                            </div>
                          )
                        })}
                    </div>

                    {/* Worker details (expandable) */}
                    <div className="space-y-1">
                      {workers
                        .sort((a, b) => b.totalRequests - a.totalRequests)
                        .map((w) => {
                          const workerKey = `${pool.label}-${originData.origin}-${w.workerUrl}`
                          const isExpanded = expandedWorkers.has(workerKey)
                          const failureRate = w.totalRequests > 0 ? w.totalFailures / w.totalRequests : 0
                          const hasDetails = w.lastFailureReason || w.lastResponseTimeMs !== null || w.lastUsedAt

                          return (
                            <div key={w.workerUrl} className="border rounded-md">
                              <button
                                className="w-full flex items-center justify-between gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors"
                                onClick={() => hasDetails && toggleWorker(workerKey)}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <Badge
                                    variant={w.status === 'alive' ? 'default' : 'destructive'}
                                    className="shrink-0 text-xs"
                                  >
                                    {w.status === 'alive' ? 'Tirik' : "O'lik"}
                                  </Badge>
                                  <code className="text-xs font-mono truncate text-muted-foreground">
                                    {w.label}
                                  </code>
                                  {w.consecutiveFailures > 0 && w.status === 'alive' && (
                                    <Badge variant="outline" className="shrink-0 text-xs">
                                      {w.consecutiveFailures} ketma-ket xato
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0 text-xs">
                                  <div className="flex items-center gap-1" title="Umumiy so'rovlar">
                                    <Activity className="w-3 h-3 text-muted-foreground" />
                                    <span className="font-medium">{w.totalRequests}</span>
                                  </div>
                                  <div className={`flex items-center gap-1 ${getSuccessColor(w.successRate)}`} title="Muvaffaqiyat %">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span className="font-medium">{formatRate(w.successRate)}</span>
                                  </div>
                                  {w.lastResponseTimeMs !== null && (
                                    <div className="flex items-center gap-1 text-muted-foreground" title="Oxirgi javob vaqti">
                                      <Zap className="w-3 h-3" />
                                      <span>{formatMs(w.lastResponseTimeMs)}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 text-muted-foreground" title="Oxirgi ishlatilgan">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatTime(w.lastUsedAt)}</span>
                                  </div>
                                  {hasDetails && (
                                    <span className="text-muted-foreground text-xs">
                                      {isExpanded ? '▲' : '▼'}
                                    </span>
                                  )}
                                </div>
                              </button>

                              {isExpanded && hasDetails && (
                                <div className="px-3 pb-3 pt-1 space-y-2 border-t bg-muted/30">
                                  {w.lastResponseTimeMs !== null && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Oxirgi javob:</span>
                                      <span className="font-mono">{formatMs(w.lastResponseTimeMs)}</span>
                                    </div>
                                  )}
                                  {w.lastUsedAt && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Oxirgi ishlatilgan:</span>
                                      <span>{formatTime(w.lastUsedAt)}</span>
                                    </div>
                                  )}
                                  {w.lastFailureAt && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Oxirgi xato:</span>
                                      <span>{formatTime(w.lastFailureAt)}</span>
                                    </div>
                                  )}
                                  {w.deadUntil && (
                                    <div className="flex justify-between text-xs">
                                      <span className="text-muted-foreground">Tiklanish vaqti:</span>
                                      <span>{formatTime(w.deadUntil)}</span>
                                    </div>
                                  )}
                                  {w.lastFailureReason && (
                                    <div className="flex items-start gap-2 p-2 rounded bg-muted text-xs">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                                      <div className="min-w-0">
                                        <span className="text-muted-foreground">Oxirgi xato sababi: </span>
                                        <code className="font-mono break-all">{w.lastFailureReason}</code>
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-start gap-2 text-xs">
                                    <span className="text-muted-foreground shrink-0">To'liq URL:</span>
                                    <code className="font-mono break-all text-muted-foreground">{w.workerUrl}</code>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ))
      )}
    </div>
  )
}

// Helper: extract worker URLs from the data (client-side)
// Since we don't have getCfWorkerUrls on the client, we infer from the health data
function getConfiguredWorkerUrls(_data: HealthData): string[] {
  // The health API returns configuredWorkerCount but not the actual URLs.
  // We collect all unique worker URLs from the pools data.
  // This is filtered server-side already, but we also filter client-side
  // to exclude "direct" and CORS proxy entries.
  const urls = new Set<string>()
  for (const pool of _data.pools) {
    for (const origin of pool.origins) {
      for (const w of origin.workers) {
        // Exclude "direct" (no worker URL) and non-https entries
        if (w.workerUrl.startsWith('https://') && w.workerUrl.includes('.workers.dev/')) {
          urls.add(w.workerUrl)
        }
      }
    }
  }
  return [...urls]
}
