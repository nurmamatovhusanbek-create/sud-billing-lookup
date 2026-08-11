/**
 * v150 P3: Unified CF Worker proxy pool.
 *
 * Replaces 5 duplicate copies of the same CF_WORKER_URLS parsing + round-robin
 * logic across billing.ts, chamber.ts, court-case.ts, jadval2.ts, orginfo.ts.
 *
 * Each caller gets its own independent round-robin counter via createWorkerPool(),
 * preserving the current behavior where each module rotates independently.
 */

// Hardcoded fallback workers — used if .env CF_WORKER_URLS is missing.
export const FALLBACK_WORKERS = [
  'https://broad-field-f2b0.uzwebfox.workers.dev/',
  'https://wild-hall-04ae.uzwebfox.workers.dev/',
  'https://orange-darkness-8843.najimsheikh071.workers.dev/',
  'https://wandering-wind-1d3d.najimsheikh071.workers.dev/',
]

/** Parse CF_WORKER_URLS (comma-separated) + CF_WORKER_URL (single, backward compat). */
export function getCfWorkerUrls(): string[] {
  const urls: string[] = []
  const multi = process.env.CF_WORKER_URLS
  if (multi) {
    for (const u of multi.split(',').map(s => s.trim()).filter(Boolean)) {
      urls.push(u.endsWith('/') ? u : u + '/')
    }
  }
  const single = process.env.CF_WORKER_URL
  if (single) {
    const normalized = single.endsWith('/') ? single : single + '/'
    if (!urls.includes(normalized)) urls.push(normalized)
  }
  return urls.length > 0 ? urls : [...FALLBACK_WORKERS]
}

/** Create an independent worker pool with its own round-robin counter. */
export function createWorkerPool() {
  let counter = 0

  /** Get the next worker URL (round-robin) prepended to the target URL. */
  function nextProxyUrl(targetUrl: string): string {
    const workers = getCfWorkerUrls()
    const worker = workers[counter % workers.length]
    counter++
    return worker + targetUrl
  }

  /** Get ALL worker URLs for the target (for parallel race). */
  function getAllProxyUrls(targetUrl: string): string[] {
    const workers = getCfWorkerUrls()
    return workers.map(w => w + targetUrl)
  }

  return { nextProxyUrl, getAllProxyUrls, getCfWorkerUrls }
}
