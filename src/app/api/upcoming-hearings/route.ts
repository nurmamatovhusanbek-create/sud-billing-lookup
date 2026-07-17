import { NextRequest, NextResponse } from 'next/server'
import { searchCourtCases, type CourtType } from '@/lib/court-case'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 20

/**
 * GET /api/upcoming-hearings?tin=302678824
 *   -> Searches ALL 4 court types (economic, civil, criminal, administrative)
 *      for cases linked to this TIN, filters for upcoming hearings
 *      (hearing_date >= today), and returns them sorted by date.
 *
 * The search API (jadvalapi.sud.uz) returns hearing_date + hearing_time +
 * judge + court + plaintiff + defendant for each case — no need to fetch
 * details for each case individually. This is fast (4 parallel API calls).
 *
 * Improvement (v121): for company TINs (9 digits), skip the criminal search
 * — criminal cases can't be searched by TIN (companies can't be criminal
 * defendants, only individuals by PINFL). For PINFL (14 digits), all 4 court
 * types are searched including criminal.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tin = searchParams.get('tin')?.trim()

  if (!tin || !/^\d{9}$/.test(tin)) {
    return NextResponse.json(
      { ok: false, error: "STIR aynan 9 ta raqamdan iborat bo'lishi kerak" },
      { status: 400 },
    )
  }

  // Company TINs (9 digits) — skip criminal search (companies can't be
  // criminal defendants; the criminal endpoint requires PINFL only).
  // PINFLs (14 digits) would search all 4, but this endpoint only accepts TINs
  // (the validation regex above enforces 9 digits), so we always skip criminal.
  const courtTypes: CourtType[] = ['economic', 'civil', 'administrative']
  console.log(`[upcoming-hearings] searching ${courtTypes.length} court types (criminal skipped for TIN) for TIN ${tin}`)

  const results = await Promise.allSettled(
    courtTypes.map(async (ct) => {
      try {
        const cases = await searchCourtCases(ct, 'tin', tin)
        return { courtType: ct, cases }
      } catch (e) {
        console.log(`[upcoming-hearings] ${ct} failed: ${e instanceof Error ? e.message : e}`)
        return { courtType: ct, cases: [] }
      }
    }),
  )

  // Collect all cases with upcoming hearings
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10) // YYYY-MM-DD for comparison

  const allHearings: any[] = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { courtType, cases } = result.value
    for (const c of cases) {
      if (!c.hearingDate || c.hearingDate === '—' || c.hearingDate === 'null') continue
      // Parse DD.MM.YYYY
      const m = c.hearingDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      if (!m) continue
      const isoDate = `${m[3]}-${m[2]}-${m[1]}` // YYYY-MM-DD
      if (isoDate < todayStr) continue // skip past hearings
      allHearings.push({
        ...c,
        courtType,
        isoDate,
        courtTypeLabel: courtType.charAt(0).toUpperCase() + courtType.slice(1),
      })
    }
  }

  // Sort by date+time (upcoming first)
  allHearings.sort((a, b) => {
    const dateA = a.isoDate + (a.hearingTime || '00:00')
    const dateB = b.isoDate + (b.hearingTime || '00:00')
    return dateA.localeCompare(dateB)
  })

  console.log(`[upcoming-hearings] found ${allHearings.length} upcoming hearings for TIN ${tin}`)

  return NextResponse.json({
    ok: true,
    tin,
    count: allHearings.length,
    hearings: allHearings,
  })
}
