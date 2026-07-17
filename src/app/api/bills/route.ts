import { NextRequest } from 'next/server'
import { getFullBillData, getBillStatus, type EnrichedBill, type Phase } from '@/lib/billing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * GET /api/bills?inn=XXXXXXXXX
 *   -> searches billing.sud.uz (Yuridik shaxs path) and returns every bill for
 *      the given company INN, enriched with amount / paid / status / court /
 *      category (davlat boji / pochta) / case numbers.
 *
 * The response is streamed as newline-delimited JSON (NDJSON):
 *   {"type":"meta","inn":"...","total":60}
 *   {"type":"bill","index":0,"bill":{...}}
 *   {"type":"bill","index":1,"bill":{...}}
 *   ...
 *   {"type":"done","inn":"...","totalElements":60}
 *
 * GET /api/bills?invoice=NUMBER
 *   -> returns the detailed status of a single bill (plain JSON).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const inn = searchParams.get('inn')?.trim()
  const invoice = searchParams.get('invoice')?.trim()

  // Single-bill detail lookup
  if (invoice) {
    try {
      const detail = await getBillStatus(invoice)
      return Response.json({ ok: true, bill: detail })
    } catch (e) {
      return Response.json(
        { ok: false, error: e instanceof Error ? e.message : 'Failed to fetch bill' },
        { status: 502 },
      )
    }
  }

  if (!inn) {
    return Response.json(
      { ok: false, error: 'Missing "inn" query parameter (company tax number, 9 digits)' },
      { status: 400 },
    )
  }
  if (!/^\d{9}$/.test(inn)) {
    return Response.json(
      { ok: false, error: 'INN must be exactly 9 digits (Yuridik shaxs company number)' },
      { status: 400 },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'))
      }
      try {
        // Stream phase events so the UI shows exactly what's happening.
        await getFullBillData(
          inn,
          (loaded, total, bill: EnrichedBill) => {
            if (loaded === 1) {
              send({ type: 'meta', inn, total })
            }
            send({ type: 'bill', index: loaded - 1, bill })
          },
          (phase: Phase, detail?: string) => {
            send({ type: 'phase', phase, detail })
          },
        )
        send({ type: 'done', inn })
      } catch (e) {
        send({
          type: 'error',
          error: e instanceof Error ? e.message : 'Failed to fetch bills',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
