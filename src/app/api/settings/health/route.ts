/**
 * v158: GET /api/settings/health
 *
 * Returns aggregated health stats from all registered OriginHealthPool instances.
 * Used by the Settings dashboard to show per-worker request counts, success
 * rates, response times, and dead/alive status.
 *
 * Response:
 *   {
 *     pools: [{ label, origins: [{ origin, workers: [...], totals }] }],
 *     summary: { totalRequests, totalSuccesses, totalFailures, overallSuccessRate, activeWorkers, deadWorkers },
 *     fetchedAt: ISO string
 *   }
 */

import { NextResponse } from 'next/server'
import { getAllHealthPools } from '@/lib/health-registry'

export async function GET() {
  const pools = getAllHealthPools()

  const poolsData = pools.map(({ label, pool }) => pool.snapshot())

  // Build summary
  let totalRequests = 0
  let totalSuccesses = 0
  let totalFailures = 0
  let activeWorkers = 0
  let deadWorkers = 0
  const allOrigins = new Set<string>()

  for (const pool of poolsData) {
    for (const originData of pool.origins) {
      allOrigins.add(originData.origin)
      totalRequests += originData.totals.requests
      totalSuccesses += originData.totals.successes
      totalFailures += originData.totals.failures
      for (const w of originData.workers) {
        if (w.status === 'dead') deadWorkers++
        else activeWorkers++
      }
    }
  }

  return NextResponse.json({
    pools: poolsData,
    summary: {
      totalRequests,
      totalSuccesses,
      totalFailures,
      overallSuccessRate: totalRequests > 0 ? totalSuccesses / totalRequests : 0,
      activeWorkers,
      deadWorkers,
      activeOrigins: [...allOrigins].sort(),
    },
    fetchedAt: new Date().toISOString(),
  })
}
