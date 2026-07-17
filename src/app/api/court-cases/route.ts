import { NextRequest, NextResponse } from 'next/server'
import { searchCourtCases, getCaseDetails, type CourtType, type SearchMode } from '@/lib/court-case'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/court-cases?courtType=economic&mode=tin&value=302678824
 *   -> searches court cases on my.sud.uz
 *
 * GET /api/court-cases?courtType=economic&detail=4-1001-2605/14720
 *   -> gets full case details (Умумий маълумотлар, Биринчи инстанция, etc.)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const courtType = searchParams.get('courtType') as CourtType | null
  const mode = searchParams.get('mode') as SearchMode | null
  const value = searchParams.get('value')
  const detail = searchParams.get('detail')

  // Case detail mode
  if (detail && courtType) {
    try {
      const data = await getCaseDetails(courtType, detail)
      return NextResponse.json({ ok: true, ...data })
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Ish tafsilotlarini olib bo'lmadi" },
        { status: 502 },
      )
    }
  }

  // Search mode
  if (!courtType || !mode || !value) {
    return NextResponse.json(
      { ok: false, error: 'Missing parameters. Required: courtType, mode, value' },
      { status: 400 },
    )
  }

  // Validate inputs
  if (mode === 'tin' && !/^\d{9}$/.test(value)) {
    return NextResponse.json({ ok: false, error: "STIR aynan 9 ta raqamdan iborat bo'lishi kerak" }, { status: 400 })
  }
  if (mode === 'pinfl' && !/^\d{14}$/.test(value)) {
    return NextResponse.json({ ok: false, error: "PINFL aynan 14 ta raqamdan iborat bo'lishi kerak" }, { status: 400 })
  }
  if (mode === 'caseNumber' && !/^\d+-[\d-]+\/\d+$/.test(value)) {
    return NextResponse.json(
      { ok: false, error: 'Ish raqami formati: X-XXXX-XXXX/XXXXX (masalan, 4-1001-2605/14720 yoki 4-10-2514/671)' },
      { status: 400 },
    )
  }

  try {
    const cases = await searchCourtCases(courtType, mode, value)
    return NextResponse.json({ ok: true, cases })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Sud ishlarini qidirib bo\'lmadi' },
      { status: 502 },
    )
  }
}
