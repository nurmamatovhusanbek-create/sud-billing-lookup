/**
 * v158: GET/POST/DELETE /api/settings/workers
 *
 * GET: List all configured worker URLs with metadata
 * POST: Add a new worker URL { url: string }
 * DELETE: Remove a worker URL { url: string } or ?url=...
 */

import { NextResponse } from 'next/server'
import {
  getWorkerEntries,
  getWorkerSource,
  addWorker,
  removeWorker,
  normalizeWorkerUrl,
  getWorkerUrls,
} from '@/lib/workers-config'
import { getCfWorkerUrls } from '@/lib/cf-worker-pool'
import { pruneAllPools } from '@/lib/health-registry'

// GET — list all workers
export async function GET() {
  const source = getWorkerSource()
  const entries = getWorkerEntries()

  // If no workers.json, show the env/fallback workers with empty metadata
  if (entries.length === 0) {
    const urls = getCfWorkerUrls()
    return NextResponse.json({
      source,
      workers: urls.map(url => ({
        url,
        addedAt: null,
        lastTestedAt: null,
        lastTestResult: null,
      })),
    })
  }

  return NextResponse.json({
    source,
    workers: entries,
  })
}

// POST — add a new worker
export async function POST(request: Request) {
  let body: { url?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_body' },
      { status: 400 },
    )
  }

  const url = body.url?.trim()
  if (!url) {
    return NextResponse.json(
      { ok: false, error: 'missing_url' },
      { status: 400 },
    )
  }

  const normalized = normalizeWorkerUrl(url)
  if (!normalized) {
    return NextResponse.json(
      { ok: false, error: 'invalid_url', detail: 'URL must be https:// and have no path' },
      { status: 400 },
    )
  }

  const entry = addWorker(normalized)
  if (!entry) {
    return NextResponse.json(
      { ok: false, error: 'duplicate', detail: 'This worker URL already exists' },
      { status: 409 },
    )
  }

  return NextResponse.json(
    { ok: true, worker: entry },
    { status: 201 },
  )
}

// DELETE — remove a worker
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const urlFromQuery = searchParams.get('url')

  let url: string
  let body: { url?: string } = {}
  if (urlFromQuery) {
    url = urlFromQuery
  } else {
    try {
      body = await request.json()
      url = body.url || ''
    } catch {
      return NextResponse.json(
        { ok: false, error: 'missing_url' },
        { status: 400 },
      )
    }
  }

  if (!url) {
    return NextResponse.json(
      { ok: false, error: 'missing_url' },
      { status: 400 },
    )
  }

  const removed = removeWorker(url)
  if (!removed) {
    return NextResponse.json(
      { ok: false, error: 'not_found' },
      { status: 404 },
    )
  }

  // Prune stale health entries for the removed worker
  const remaining = getWorkerUrls()
  pruneAllPools(remaining)

  return NextResponse.json({ ok: true, removed: true })
}
