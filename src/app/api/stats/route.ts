import { NextRequest, NextResponse } from 'next/server'
import { getCompanyStats } from '@/lib/stats'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * GET /api/stats?tin=302678824
 *   Aggregates all court cases (economic + civil + administrative) for a TIN,
 *   classifies each as WIN / LOSE / NEUTRAL / PENDING, returns:
 *     { ok: true, company, cases, summary, errors? }
 *
 * Workflow:
 *   1. orginfo.uz       → company name (worker-routed)
 *   2. jadvalapi + jadval → ECONOMIC findByTin (worker-routed, merged)
 *   3. jadvalapi        → CIVIL findByTin (worker-routed)
 *   4. jadvalapi        → CONFLICT findByTin (administrative, worker-routed)
 *
 * All 3 court-type searches fire in parallel. If one fails, the response
 * still returns the cases from the court types that succeeded, with the
 * failure noted in `errors`.
 *
 * 30s overall timeout (next.js maxDuration=60 + AbortSignal safety).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tin = (searchParams.get('tin') || '').trim()

  // Validate TIN (9 digits)
  if (!tin || !/^\d{9}$/.test(tin)) {
    return NextResponse.json(
      { ok: false, error: "STIR aynan 9 ta raqamdan iborat bo'lishi kerak" },
      { status: 400 },
    )
  }

  // 60s overall timeout — gives the v140 parallel-race retry logic (10s first
  // attempt + 15s retry + 20s final retry = up to 45s per endpoint, all parallel)
  // room to complete. Was 45s in v139, but the multi-retry approach needs more.
  const timeout = new Promise<{ ok: false; error: string }>((resolve) => {
    setTimeout(
      () => resolve({ ok: false, error: "So'rov vaqti tugadi (60s). Qayta urinib ko'ring." }),
      60000,
    )
  })

  try {
    const result = await Promise.race([
      getCompanyStats(tin),
      timeout,
    ])

    // If the timeout fired first, return 504
    if ('ok' in result && result.ok === false) {
      return NextResponse.json(result, { status: 504 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Statistikani olib bo\'lmadi' },
      { status: 502 },
    )
  }
}
