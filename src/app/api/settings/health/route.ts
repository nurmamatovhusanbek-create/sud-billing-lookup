/**
 * v158: GET /api/settings/health
 *
 * Returns aggregated health stats from all registered OriginHealthPool instances.
 * Used by the Settings dashboard to show per-worker request counts, success
 * rates, response times, and dead/alive status.
 *
 * v161: Now also returns ALL known sources (not just ones that have been hit),
 * and excludes "direct" / non-worker entries from the worker count.
 *
 * Response:
 *   {
 *     pools: [{ label, origins: [{ origin, workers: [...], totals }] }],
 *     allSources: [{ origin, label, hasData }],
 *     summary: { totalRequests, totalSuccesses, totalFailures, overallSuccessRate, activeWorkers, deadWorkers, totalWorkers },
 *     fetchedAt: ISO string
 *   }
 */

import { NextResponse } from 'next/server'
import { getAllHealthPools } from '@/lib/health-registry'
import { getCfWorkerUrls } from '@/lib/cf-worker-pool'

// v161: All known sud.uz API sources that the app talks to (not just active ones)
const ALL_KNOWN_SOURCES = [
  { origin: 'jadvalapi.sud.uz', label: 'Sud ishlari API (online monitoring)' },
  { origin: 'jadval.sud.uz', label: 'Sud ishlari API (eski)' },
  { origin: 'admin.chamber.uz', label: 'Chamber.uz reyting' },
  { origin: 'orginfo.uz', label: 'Orginfo.uz kompaniya' },
  { origin: 'billing.sud.uz', label: 'Billing.sud.uz kvitansiyalar' },
  { origin: 'recaptcha.sud.uz', label: 'Recaptcha.sud.uz' },
  { origin: 'mib.uz', label: 'Mib.uz majburiy ijro' },
  { origin: 'jadval2.sud.uz', label: 'Jadval2.sud.uz jadval' },
]

export async function GET() {
  const pools = getAllHealthPools()
  const poolsData = pools.map(({ label, pool }) => pool.snapshot())

  // Get all configured worker URLs (to filter out non-worker entries)
  const configuredWorkers = new Set(getCfWorkerUrls())

  // Build summary — only count actual CF Workers (exclude "direct" and CORS proxies)
  let totalRequests = 0
  let totalSuccesses = 0
  let totalFailures = 0
  let activeWorkers = 0
  let deadWorkers = 0
  const allOriginsWithData = new Set<string>()

  for (const pool of poolsData) {
    for (const originData of pool.origins) {
      allOriginsWithData.add(originData.origin)
      totalRequests += originData.totals.requests
      totalSuccesses += originData.totals.successes
      totalFailures += originData.totals.failures
      for (const w of originData.workers) {
        // v161: Only count configured CF Workers, not "direct" or CORS proxies
        if (!configuredWorkers.has(w.workerUrl)) continue
        if (w.status === 'dead') deadWorkers++
        else activeWorkers++
      }
    }
  }

  // Build all sources list — includes ALL known sources, not just ones with data
  const allSources = ALL_KNOWN_SOURCES.map(s => ({
    ...s,
    hasData: allOriginsWithData.has(s.origin),
  }))

  return NextResponse.json({
    pools: poolsData,
    allSources,
    configuredWorkerCount: configuredWorkers.size,
    summary: {
      totalRequests,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalRequests > 0 ? totalSuccesses / totalRequests : 0,
      activeWorkers,
      deadWorkers,
      totalWorkers: activeWorkers + deadWorkers,
    },
    fetchedAt: new Date().toISOString(),
  })
}
