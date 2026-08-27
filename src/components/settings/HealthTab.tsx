'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Zap, AlertTriangle } from 'lucide-react'

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
  const [autoRefresh, setAutoRefresh] = useState(false) // v166: default OFF

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`/api/settings/health?_=${Date.now()}`)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
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
    if (diff < 60) return `${diff}s`
    if (diff < 3600) return `${Math.floor(diff / 60)}d`
    return d.toLocaleTimeString('uz-UZ')
  }

  const maxRequests = Math.max(1, ...data.workers.map(w => w.totalRequests))

  return (
    <div className="py-2">
      {/* Top bar: title + refresh controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium">Worker statistikasi</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-1.5 h-7 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Avto (5s)' : 'Avto-off'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchHealth}
            className="gap-1.5 h-7 text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            Yangilash
          </Button>
        </div>
      </div>

      {/* Summary row — 4 flat stat tiles (Cloudflare style) */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">So'rovlar</p>
          <p className="text-xl font-semibold mt-1">{data.summary.totalRequests}</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Muvaffaqiyat</p>
          <p className="text-xl font-semibold mt-1">{formatRate(data.summary.overallSuccessRate)}</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Faol</p>
          <p className="text-xl font-semibold mt-1">{data.summary.activeWorkers}</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Nofaol</p>
          <p className="text-xl font-semibold mt-1">{data.summary.deadWorkers}</p>
        </div>
      </div>

      {/* Overall distribution bar (single flat bar) */}
      {data.summary.totalRequests > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Muvaffaqiyat: {data.summary.totalSuccesses}</span>
            <span>Xato: {data.summary.totalFailures}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-muted flex">
            <div
              className="bg-foreground transition-all duration-500"
              style={{ width: `${data.summary.overallSuccessRate * 100}%` }}
            />
            <div
              className="bg-muted-foreground/30 transition-all duration-500"
              style={{ width: `${(1 - data.summary.overallSuccessRate) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Worker list — flat table, no nested cards */}
      <div className="border rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div className="col-span-4">Worker</div>
          <div className="col-span-2 text-right">So'rov</div>
          <div className="col-span-3">Bar</div>
          <div className="col-span-1 text-right">Javob</div>
          <div className="col-span-2 text-right">Holat</div>
        </div>

        {/* Table rows */}
        {data.workers.length === 0 ? (
          <div className="px-3 py-8 text-center text-muted-foreground text-sm">
            Hozircha ma'lumot yo'q. So'rovlar amalga oshirilgandan keyin statistika paydo bo'ladi.
          </div>
        ) : (
          data.workers.map((w) => {
            const barWidth = (w.totalRequests / maxRequests) * 100
            const successPortion = w.totalRequests > 0 ? (w.totalSuccesses / w.totalRequests) * barWidth : 0
            const failPortion = w.totalRequests > 0 ? (w.totalFailures / w.totalRequests) * barWidth : 0

            return (
              <div
                key={w.workerUrl}
                className="grid grid-cols-12 gap-2 px-3 py-2 border-t text-xs items-center hover:bg-muted/30 transition-colors"
                title={w.workerUrl}
              >
                {/* Worker name */}
                <div className="col-span-4 truncate">
                  <code className="font-mono text-muted-foreground">{w.label}</code>
                </div>
                {/* Request count */}
                <div className="col-span-2 text-right font-medium">
                  {w.totalRequests}
                </div>
                {/* Bar */}
                <div className="col-span-3">
                  <div className="h-1.5 rounded-full overflow-hidden bg-muted flex">
                    <div
                      className="bg-foreground transition-all duration-300"
                      style={{ width: `${successPortion}%` }}
                    />
                    <div
                      className="bg-muted-foreground/30 transition-all duration-300"
                      style={{ width: `${failPortion}%` }}
                    />
                  </div>
                </div>
                {/* Response time */}
                <div className="col-span-1 text-right text-muted-foreground">
                  {formatMs(w.lastResponseTimeMs)}
                </div>
                {/* Status badge */}
                <div className="col-span-2 text-right">
                  <Badge
                    variant={w.status === 'alive' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {w.status === 'alive' ? 'Faol' : 'Nofaol'}
                  </Badge>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Last updated */}
      <p className="text-xs text-muted-foreground mt-3 text-right">
        Oxirgi yangilanish: {formatTime(data.fetchedAt)}
      </p>
    </div>
  )
}
