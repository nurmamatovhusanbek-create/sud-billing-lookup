/**
 * Simple localStorage cache with TTL. Client-side only.
 *
 * Used to avoid re-fetching the same data (company info, stats, case lists,
 * upcoming hearings) within a 5-minute window. The bills tab is intentionally
 * NOT cached (it streams results progressively).
 *
 * The cache prefix `sb-cache:` keeps our keys isolated from other apps that
 * might share the same localStorage (e.g. the saved-companies list).
 */

const PREFIX = 'sb-cache:'
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Read a cached value by key. Returns null if the cache is missing, expired,
 * or if we're not in a browser environment.
 */
export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number }
    if (Date.now() - ts > ttl) return null
    return data
  } catch {
    return null
  }
}

/**
 * Store a value in the cache with the default TTL. The TTL is recorded at
 * read-time (getCached), so callers don't need to pass it here.
 */
export function setCached<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // Quota exceeded / private mode — silently ignore.
  }
}

/**
 * Remove a single cached key (e.g. when the user explicitly refreshes).
 */
export function clearCached(key: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

/** Cache key builders — keep them centralized so callers stay consistent. */
export const cacheKey = {
  companyInfo: (tin: string) => `company-info:${tin}`,
  stats: (tin: string) => `stats:${tin}`,
  cases: (courtType: string, mode: string, value: string) =>
    `cases:${courtType}:${mode}:${value}`,
  upcoming: (tin: string) => `upcoming:${tin}`,
}
