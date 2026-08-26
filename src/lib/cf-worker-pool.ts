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

// ---- OriginHealthPool: health-tracked worker selection for PARALLEL races ----
//
// billing.ts has a `ProxyPool` that tracks per-proxy success/failure and skips
// proxies that have failed repeatedly — proven to cut a 60-bill lookup from
// ~800s to ~150s by not wasting time retrying known-dead proxies. That pool is
// built for a SEQUENTIAL "pick one proxy, retry on fail" strategy (best for
// high-volume loops).
//
// court-case.ts instead fires ALL workers in PARALLEL for a single company
// lookup (best for latency + completeness on one request), so the same idea
// is adapted here: instead of picking ONE proxy, getRaceCandidates() returns
// the SUBSET of workers worth firing in parallel this time, excluding ones
// currently in a cooldown against THIS SPECIFIC origin (a worker can be fine
// for jadvalapi.sud.uz but blocked by jadval.sud.uz, or vice versa — health is
// tracked per origin+worker pair, not just per worker).
//
// Skipping known-dead workers doesn't change how many requests happen (they'd
// have failed anyway), it changes how LONG the race waits: Promise.allSettled
// waits for the slowest entrant, so a doomed worker burning its full 10/15/20s
// timeout was previously costing every request that time for nothing. Freeing
// that time gives the existing 3-tier retry more real headroom within the
// route's 60s deadline. A confirmed "not found" (404) is treated as a health
// SUCCESS, not a failure — it proves the worker reached the origin, it just
// found no data. Only transport-level failures (timeouts, 5xx, 521, parse
// errors) count against a worker. If every worker for an origin is currently
// in cooldown, this fails OPEN (revives and returns all of them) — a single
// company lookup should never just give up on a worker because of a stale
// cooldown; if the origin itself is down they'll all fail fast anyway.
interface WorkerHealthState {
  label: string
  failures: number
  successes: number
  lastFailureAt: number
  deadUntil: number // 0 = alive; timestamp = retry allowed after this time
}

export class OriginHealthPool {
  private states = new Map<string, WorkerHealthState>()
  private static readonly DEAD_THRESHOLD = 3 // mark dead after 3 consecutive failures
  private static readonly DEAD_COOLDOWN_MS = 45_000 // skip dead workers for 45s

  constructor(private readonly poolLabel: string) {}

  private key(originKey: string, workerUrl: string): string {
    return `${originKey}::${workerUrl}`
  }

  private stateFor(originKey: string, workerUrl: string): WorkerHealthState {
    const k = this.key(originKey, workerUrl)
    let s = this.states.get(k)
    if (!s) {
      let label: string
      try { label = new URL(workerUrl).hostname } catch { label = workerUrl.slice(0, 30) }
      s = { label, failures: 0, successes: 0, lastFailureAt: 0, deadUntil: 0 }
      this.states.set(k, s)
    }
    return s
  }

  /** The workers worth firing in parallel for `originKey` right now. Never
   *  returns an empty array — see class doc for the fail-open rationale. */
  getRaceCandidates(originKey: string, workerUrls: string[]): string[] {
    const now = Date.now()
    const withState = workerUrls.map(u => ({ url: u, state: this.stateFor(originKey, u) }))
    for (const { state } of withState) {
      if (state.deadUntil > 0 && state.deadUntil < now) {
        state.deadUntil = 0
        state.failures = 0
      }
    }
    const alive = withState.filter(w => w.state.deadUntil === 0)
    if (alive.length > 0) return alive.map(w => w.url)
    console.log(`[${this.poolLabel}] all ${workerUrls.length} workers were in cooldown for ${originKey} — reviving all for this lookup`)
    for (const { state } of withState) { state.deadUntil = 0; state.failures = 0 }
    return workerUrls
  }

  /** Call when a worker successfully reaches the origin — including a clean
   *  404 "not found", which proves the path works even with no data. */
  markSuccess(originKey: string, workerUrl: string): void {
    const s = this.stateFor(originKey, workerUrl)
    s.successes++
    s.failures = 0
    s.deadUntil = 0
  }

  /** Call on a transport-level failure (timeout, 5xx/521, parse error). */
  markFailed(originKey: string, workerUrl: string): void {
    const s = this.stateFor(originKey, workerUrl)
    s.failures++
    s.lastFailureAt = Date.now()
    if (s.failures >= OriginHealthPool.DEAD_THRESHOLD && s.deadUntil === 0) {
      s.deadUntil = Date.now() + OriginHealthPool.DEAD_COOLDOWN_MS
      console.log(`[${this.poolLabel}] ${s.label} marked DEAD for ${originKey} for ${OriginHealthPool.DEAD_COOLDOWN_MS / 1000}s (${s.failures} consecutive failures)`)
    }
  }

  /** Human-readable health snapshot for a given origin, for debug logging. */
  stats(originKey: string): string {
    const entries = [...this.states.entries()].filter(([k]) => k.startsWith(`${originKey}::`))
    if (entries.length === 0) return 'no data yet'
    return entries
      .map(([, s]) => `${s.label}:${s.successes}\u2713/${s.failures}\u2717${s.deadUntil > Date.now() ? ' DEAD' : ''}`)
      .join(' | ')
  }
}
