'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, Activity, Server, CheckCircle2, XCircle, RefreshCw, Clock, Zap, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'

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
  origins: string[]
}

interface HealthData {
  workers: WorkerHealth[]
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

  // Workers are already aggregated by the API
  const aggregatedWorkers = data.workers
  const maxWorkerRequests = Math.max(1, ...aggregatedWorkers.map(w => w.totalRequests))

  // Donut chart calculations
  const successAngle = data.summary.totalRequests > 0 ? data.summary.overallSuccessRate * 360 : 0
  const errorAngle = 360 - successAngle

  return (
    <div className="space-y-4 py-2">
      {/* Cloudflare-style header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">Worker holati</h3>
          <Badge variant="outline" className="text-xs">
            {data.summary.totalWorkers} / {data.configuredWorkerCount} worker
          </Badge>
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

      {/* Summary stat cards (Cloudflare-style with sparklines) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Umumiy so'rovlar</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-2xl font-semibold">{data.summary.totalRequests}</p>
              {data.summary.totalRequests > 0 && (
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.summary.totalSuccesses} muvaffaqiyatli
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Muvaffaqiyat %</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-2xl font-semibold">{formatRate(data.summary.overallSuccessRate)}</p>
              {data.summary.overallSuccessRate >= 0.9 ? (
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.summary.totalFailures} xato
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Faol workerlar</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-2xl font-semibold">{data.summary.activeWorkers}</p>
              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">ishlayapti</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">O'lik workerlar</p>
            <div className="flex items-baseline gap-1 mt-1">
              <p className="text-2xl font-semibold">{data.summary.deadWorkers}</p>
              <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.summary.deadWorkers > 0 ? 'tiklanish kutilmoqda' : 'hammasi joyida'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Donut chart + Overall bar (Cloudflare-style distribution) */}
      {data.summary.totalRequests > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Donut chart */}
          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Muvaffaqiyat nisbati</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center pt-0">
              <div className="relative" style={{ width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--muted)" strokeWidth="12" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke="var(--foreground)" strokeWidth="12"
                    strokeDasharray={`${successAngle * 0.8727} 999`}
                    transform="rotate(-90 60 60)"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-semibold">{formatRate(data.summary.overallSuccessRate)}</span>
                  <span className="text-xs text-muted-foreground">muvaffaqiyat</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Request distribution bar */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">So'rovlar taqsimoti</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-4 rounded-full overflow-hidden bg-muted flex mb-3">
                <div
                  className="bg-foreground transition-all duration-500"
                  style={{ width: `${data.summary.overallSuccessRate * 100}%` }}
                />
                <div
                  className="bg-muted-foreground/40 transition-all duration-500"
                  style={{ width: `${(1 - data.summary.overallSuccessRate) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-foreground inline-block" />
                  <div>
                    <p className="font-medium">{data.summary.totalSuccesses} muvaffaqiyatli</p>
                    <p className="text-muted-foreground">{formatRate(data.summary.overallSuccessRate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-muted-foreground/40 inline-block" />
                  <div>
                    <p className="font-medium">{data.summary.totalFailures} xato</p>
                    <p className="text-muted-foreground">{formatRate(1 - data.summary.overallSuccessRate)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Per-worker breakdown (Cloudflare-style Top-N table) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Workerlar bo'yicha tahlil</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {aggregatedWorkers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Hozircha so'rov ma'lumoti yo'q</p>
              <p className="text-xs mt-1">
                So'rovlar amalga oshirilgandan keyin statistika paydo bo'ladi
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bar chart for each worker */}
              {aggregatedWorkers.map((w) => {
                const successWidth = (w.totalRequests / maxWorkerRequests) * 100
                const successPortion = w.totalRequests > 0 ? (w.totalSuccesses / w.totalRequests) * successWidth : 0
                const failPortion = w.totalRequests > 0 ? (w.totalFailures / w.totalRequests) * successWidth : 0
                const workerKey = w.workerUrl
                const isExpanded = expandedWorkers.has(workerKey)
                const hasDetails = w.lastFailureReason || w.lastResponseTimeMs !== null || w.lastUsedAt

                return (
                  <div key={w.url} className="border rounded-md">
                    {/* Worker bar */}
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
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
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className="font-medium">{w.totalRequests}</span>
                          <span className="text-muted-foreground">{formatRate(w.totalSuccesses / Math.max(1, w.totalRequests))}</span>
                          {w.lastResponseTimeMs !== null && (
                            <span className="text-muted-foreground">{formatMs(w.lastResponseTimeMs)}</span>
                          )}
                        </div>
                      </div>
                      {/* Stacked bar */}
                      <div className="h-2.5 rounded-full overflow-hidden bg-muted flex">
                        <div
                          className="bg-foreground transition-all duration-300"
                          style={{ width: `${successPortion}%` }}
                        />
                        <div
                          className="bg-muted-foreground/40 transition-all duration-300"
                          style={{ width: `${failPortion}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{w.totalSuccesses} muvaffaqiyat</span>
                        <span>{w.totalFailures} xato</span>
                      </div>
                    </div>

                    {/* Expand button */}
                    {hasDetails && (
                      <button
                        className="w-full flex items-center justify-center gap-1 py-1.5 border-t text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                        onClick={() => toggleWorker(workerKey)}
                      >
                        {isExpanded ? '▲ Yopish' : '▼ Batafsil'}
                      </button>
                    )}

                    {/* Expanded details */}
                    {isExpanded && hasDetails && (
                      <div className="px-3 pb-3 pt-1 space-y-2 border-t bg-muted/30">
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
                              <span className="text-muted-foreground">Tiklanish:</span>
                              <span>{formatTime(w.deadUntil)}</span>
                            </div>
                          )}
                        </div>
                        {w.lastFailureReason && (
                          <div className="flex items-start gap-2 p-2 rounded bg-muted text-xs">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                            <div className="min-w-0">
                              <span className="text-muted-foreground">Xato sababi: </span>
                              <code className="font-mono break-all">{w.lastFailureReason}</code>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0">Manbalar:</span>
                          <div className="flex flex-wrap gap-1">
                            {w.origins.map((o: string) => (
                              <Badge key={o} variant="outline" className="text-xs font-mono">
                                {o}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
