'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, Activity, Server, CheckCircle2, XCircle, RefreshCw, Clock, Zap, AlertTriangle } from 'lucide-react'

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

interface HealthData {
  pools: PoolData[]
  summary: {
    totalRequests: number
    totalSuccesses: number
    totalFailures: number
    overallSuccessRate: number
    activeWorkers: number
    deadWorkers: number
    activeOrigins: string[]
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

  if (!data || data.pools.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Activity className="w-10 h-10 mx-auto mb-3" />
        <p className="text-sm font-medium">Hozircha ma'lumot yo'q</p>
        <p className="text-xs mt-1">
          Bir nechta so'rov amalga oshirilgandan keyin statistika paydo bo'ladi
        </p>
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

      {/* Origins list */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Faol manbalar</h3>
          <div className="flex gap-1 flex-wrap">
            {data.summary.activeOrigins.map(origin => (
              <Badge key={origin} variant="outline" className="text-xs font-mono">
                {origin}
              </Badge>
            ))}
          </div>
        </div>
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
      {data.pools.map((pool) => (
        <div key={pool.label} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              {pool.label}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {pool.origins.length} manba
            </Badge>
          </div>

          {pool.origins.map((originData) => (
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
                <div className="space-y-1">
                  {originData.workers
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
                              {/* Mini stats */}
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

                          {/* Expanded details */}
                          {isExpanded && hasDetails && (
                            <div className="px-3 pb-3 pt-1 space-y-2 border-t bg-muted/30">
                              {/* Failure rate bar */}
                              {w.totalRequests > 0 && (
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-muted-foreground">Muvaffaqiyat / Xato nisbati</span>
                                    <span className="font-mono">
                                      {w.totalSuccesses} / {w.totalFailures}
                                    </span>
                                  </div>
                                  <div className="h-2 rounded-full overflow-hidden bg-muted flex">
                                    <div
                                      className="bg-foreground"
                                      style={{ width: `${w.successRate * 100}%` }}
                                    />
                                    <div
                                      className="bg-muted-foreground/30"
                                      style={{ width: `${failureRate * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Details grid */}
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                {w.lastResponseTimeMs !== null && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Oxirgi javob:</span>
                                    <span className="font-mono">{formatMs(w.lastResponseTimeMs)}</span>
                                  </div>
                                )}
                                {w.lastUsedAt && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Oxirgi ishlatilgan:</span>
                                    <span>{formatTime(w.lastUsedAt)}</span>
                                  </div>
                                )}
                                {w.lastFailureAt && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Oxirgi xato:</span>
                                    <span>{formatTime(w.lastFailureAt)}</span>
                                  </div>
                                )}
                                {w.deadUntil && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tiklanish vaqti:</span>
                                    <span>{formatTime(w.deadUntil)}</span>
                                  </div>
                                )}
                              </div>

                              {/* Failure reason */}
                              {w.lastFailureReason && (
                                <div className="flex items-start gap-2 p-2 rounded bg-muted text-xs">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                                  <div className="min-w-0">
                                    <span className="text-muted-foreground">Oxirgi xato sababi: </span>
                                    <code className="font-mono break-all">{w.lastFailureReason}</code>
                                  </div>
                                </div>
                              )}

                              {/* Full URL */}
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
          ))}
        </div>
      ))}
    </div>
  )
}
