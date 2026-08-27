'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Activity, Server, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

interface HealthData {
  pools: Array<{
    label: string
    origins: Array<{
      origin: string
      workers: Array<{
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
      }>
      totals: { requests: number; successes: number; failures: number; successRate: number }
    }>
  }>
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
    const interval = setInterval(fetchHealth, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchHealth])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.pools.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Activity className="w-8 h-8 mx-auto mb-2" />
        <p className="text-sm">Hozircha ma\'lumot yo\'q</p>
        <p className="text-xs mt-1">
          Bir nechta so\'rov amalga oshirilgandan keyin statistika paydo bo\'ladi
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
    if (diff < 60) return `${diff}s avval`
    if (diff < 3600) return `${Math.floor(diff / 60)}d avval`
    return d.toLocaleTimeString('uz-UZ')
  }

  return (
    <div className="space-y-4 py-2">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Umumiy so\'rovlar</p>
                <p className="text-2xl font-semibold mt-1">{data.summary.totalRequests}</p>
              </div>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Muvaffaqiyat %</p>
                <p className="text-2xl font-semibold mt-1">
                  {formatRate(data.summary.overallSuccessRate)}
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Faol workerlar</p>
                <p className="text-2xl font-semibold mt-1">{data.summary.activeWorkers}</p>
              </div>
              <Server className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">O\'lik workerlar</p>
                <p className="text-2xl font-semibold mt-1">{data.summary.deadWorkers}</p>
              </div>
              <XCircle className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auto-refresh toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
          {autoRefresh ? 'Avto-yangilanish (10s)' : 'Avto-yangilanish o\'chiq'}
        </Button>
        <span className="text-xs text-muted-foreground">
          {formatTime(data.fetchedAt)}
        </span>
      </div>

      {/* Per-pool, per-origin details */}
      {data.pools.map((pool) => (
        <div key={pool.label} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {pool.label}
          </h3>
          {pool.origins.map((originData) => (
            <Card key={`${pool.label}-${originData.origin}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-mono">{originData.origin}</CardTitle>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{originData.totals.requests} so\'rov</span>
                    <span>·</span>
                    <span>{formatRate(originData.totals.successRate)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5">
                  {originData.workers
                    .sort((a, b) => b.totalRequests - a.totalRequests)
                    .map((w) => (
                      <div
                        key={w.workerUrl}
                        className="flex items-center justify-between gap-2 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Badge
                            variant={w.status === 'alive' ? 'default' : 'destructive'}
                            className="shrink-0"
                          >
                            {w.status === 'alive' ? 'Tirik' : 'O\'lik'}
                          </Badge>
                          <code className="font-mono truncate text-muted-foreground">
                            {w.label}
                          </code>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                          <span title="Umumiy so'rovlar">{w.totalRequests}</span>
                          <span title="Muvaffaqiyat %" className="hidden sm:inline">
                            {formatRate(w.successRate)}
                          </span>
                          <span title="Oxirgi javob vaqti" className="hidden md:inline">
                            {formatMs(w.lastResponseTimeMs)}
                          </span>
                          <span title="Oxirgi ishlatilgan" className="hidden lg:inline">
                            {formatTime(w.lastUsedAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}
