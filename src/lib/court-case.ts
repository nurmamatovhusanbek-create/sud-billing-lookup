import crypto from 'crypto'
import { execSync } from 'child_process'
import ZAI from 'z-ai-web-dev-sdk'

/**
 * my.sud.uz Court Case Search service.
 *
 * The court case search on my.sud.uz uses TWO API servers:
 * 1. jadval.sud.uz — older API, returns case list data
 * 2. jadvalapi.sud.uz — newer API, returns monitoring data with hearings
 *
 * Neither requires authentication or captcha — they are public endpoints!
 * The frontend calls BOTH and merges the results.
 *
 * Case number format: "4-1001-2605/14720" — the "/" is replaced with "@"
 * in the URL: "4-1001-2605@14720"
 */

const JADVAL_API = 'https://jadval.sud.uz'
const JADVALAPI = 'https://jadvalapi.sud.uz'

// ---- CF Worker proxy helper (avoids IP blocking, same as billing.ts) ----
let courtWorkerCounter = 0
// Hardcoded fallback workers — used if .env CF_WORKER_URLS is missing.
// This prevents "via direct" (IP blocking) when .env gets lost.
const FALLBACK_WORKERS = [
  'https://broad-field-f2b0.uzwebfox.workers.dev/',
  'https://wild-hall-04ae.uzwebfox.workers.dev/',
  'https://orange-darkness-8843.najimsheikh071.workers.dev/',
  'https://wandering-wind-1d3d.najimsheikh071.workers.dev/',
]

// v144: Removed all public CORS proxies (cors.sh, allorigins, corsproxy.io,
// codetabs). User requested: ONLY CF Workers, no other proxies.
const PUBLIC_CORS_PROXIES: { prefix: string; needsEncoding: boolean }[] = []

/**
 * Build the full list of proxy URLs to try for a given target URL.
 * v144: CF Workers ONLY (no public CORS proxies, no direct fetch).
 * Order: CF Workers (env or fallback) only.
 * The direct fetch is the last resort — it works when the sandbox has direct
 * connectivity to the origin (sometimes it does, sometimes it's IP-blocked).
 */
function buildProxyChain(targetUrl: string): { url: string; label: string }[] {
  const chain: { url: string; label: string }[] = []

  // 1. CF Workers
  const cfWorkerUrls: string[] = []
  const multi = process.env.CF_WORKER_URLS
  if (multi) {
    for (const u of multi.split(',').map(s => s.trim()).filter(Boolean)) {
      cfWorkerUrls.push(u.endsWith('/') ? u : u + '/')
    }
  }
  const single = process.env.CF_WORKER_URL
  if (single) {
    const normalized = single.endsWith('/') ? single : single + '/'
    if (!cfWorkerUrls.includes(normalized)) cfWorkerUrls.push(normalized)
  }
  const workers = cfWorkerUrls.length > 0 ? cfWorkerUrls : FALLBACK_WORKERS
  for (const w of workers) {
    chain.push({ url: w + targetUrl, label: 'CF Worker' })
  }

  // 2. Public CORS proxies (v144: empty list — removed per user request)
  for (const p of PUBLIC_CORS_PROXIES) {
    const proxiedUrl = p.needsEncoding ? p.prefix + encodeURIComponent(targetUrl) : p.prefix + targetUrl
    chain.push({ url: proxiedUrl, label: 'CORS proxy' })
  }

  // v144: Removed direct fetch — user wants ONLY CF Workers.
  // If all workers fail, the retry logic handles it.

  return chain
}

function getCfWorkerUrl(url: string): string {
  // Legacy helper kept for fetchJadvalApiDetails / fetchJadvalDetails.
  const chain = buildProxyChain(url)
  return chain[0].url
}

// ---- Types (re-exported from court-case-types.ts) ----
export type { CourtType, SearchMode, CourtCase, CaseDetail, Hearing, Decision, CaseDocument, InstanceData, FullCaseData } from './court-case-types'
import type { CourtType, SearchMode, CourtCase, FullCaseData } from './court-case-types'

// ---- Status enums for UI ----
export { CASE_STATUSES, HEARING_STATUSES, COURT_TYPE_LABELS } from './court-case-types'

// ---- API calls (NO auth, NO captcha needed — these are public endpoints) ----

/**
 * v149: curl-based fetch for jadval.sud.uz.
 *
 * Problem: jadval.sud.uz does TLS fingerprinting (JA3/JA4). Node.js's fetch
 * (undici) and CF Workers both have non-browser TLS fingerprints, so
 * jadval.sud.uz returns "Ишлар топилмади" (not found) to them. Only real
 * browsers (Chrome) get data.
 *
 * Fix: Use system `curl` as a child process. curl uses OpenSSL which has a
 * different TLS fingerprint that's closer to a browser. The user's machine
 * can reach jadval.sud.uz (the browser proves it), so curl from the same
 * machine should also work.
 *
 * This is ONLY used for jadval.sud.uz (not jadvalapi.sud.uz, which doesn't
 * do TLS fingerprinting).
 */
function curlFetch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const args = [
        '--silent', '--show-error',
        '--max-time', '12',
        '--compressed',
        '-H', 'Accept: application/json, text/plain, */*',
        '-H', 'Accept-Language: en-GB,en;q=0.5',
        '-H', 'Origin: https://my.sud.uz',
        '-H', 'Referer: https://my.sud.uz/',
        '-H', 'Sec-Fetch-Dest: empty',
        '-H', 'Sec-Fetch-Mode: cors',
        '-H', 'Sec-Fetch-Site: same-site',
        '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        '-H', 'sec-ch-ua: "Not=A?Brand";v="99", "Brave";v="151", "Chromium";v="151"',
        '-H', 'sec-ch-ua-mobile: ?0',
        '-H', 'sec-ch-ua-platform: "Windows"',
        '--', url,
      ]
      const result = execSync(`curl ${args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')}`, {
        timeout: 15000,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
      })
      resolve(result)
    } catch (e: any) {
      reject(new Error(e?.message || 'curl failed'))
    }
  })
}

/**
 * v140: Server-side in-memory cache for court-case search results.
 *
 * Problem: When the user opens the Stats tab, it fires 3 searchCourtCases
 * calls (economic + civil + administrative). The Upcoming Hearings tab fires
 * the SAME 3 calls. The Watchlist tab fires them too. Without caching, that's
 * 9 identical fetches to jadvalapi.sud.uz within seconds — each taking 5-15s.
 *
 * Solution: Cache results for 60 seconds. The FIRST call fetches and caches;
 * concurrent + subsequent calls within 60s get the cached result instantly.
 * This cuts the total fetch time from 45s+ to ~5s when multiple tabs load
 * the same TIN.
 */
interface CourtCaseCacheEntry {
  result: Promise<CourtCase[]>
  ts: number
}
const courtCaseCache = new Map<string, CourtCaseCacheEntry>()
const COURT_CASE_CACHE_TTL = 60 * 1000 // 60 seconds

/**
 * Search court cases. Calls both jadval.sud.uz and jadvalapi.sud.uz and merges
 * the results (the Angular frontend does the same).
 *
 * - Economic: findByTin (by INN) or findByNumber (by case number)
 * - Civil: findByNumber (by case number) or findByPinfl (by PINFL)
 * - Criminal: findByCriminalNumber
 * - Administrative: findByAdmNumber or findByTin
 *
 * v140 ARCHITECTURE: PARALLEL RACE instead of sequential failover.
 * Fires ALL CF Workers + public CORS proxies + direct fetch SIMULTANEOUSLY.
 * First valid response wins (Promise.any). If ANY worker is alive, we get
 * data in 1-3s instead of 12-48s with sequential failover.
 */
export async function searchCourtCases(
  courtType: CourtType,
  mode: SearchMode,
  value: string,
): Promise<CourtCase[]> {
  // Case numbers use "@" instead of "/" in the URL
  const encodedValue = mode === 'caseNumber' ? value.replace('/', '@') : value

  // v140: Check server-side cache first — deduplicates concurrent calls
  const cacheKey = `${courtType}:${mode}:${encodedValue}`
  const cached = courtCaseCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < COURT_CASE_CACHE_TTL) {
    console.log(`[court-case] cache hit for ${cacheKey} (age ${Math.round((Date.now() - cached.ts) / 1000)}s)`)
    return cached.result
  }

  // Fire the actual fetch and store the PROMISE so concurrent calls share it
  const fetchPromise = searchCourtCasesInternal(courtType, mode, value, encodedValue)
  courtCaseCache.set(cacheKey, { result: fetchPromise, ts: Date.now() })

  // Sweep old entries
  if (courtCaseCache.size > 30) {
    const now = Date.now()
    for (const [k, v] of courtCaseCache) {
      if (now - v.ts > COURT_CASE_CACHE_TTL * 5) courtCaseCache.delete(k)
    }
  }

  return fetchPromise
}

/**
 * Internal fetch logic — uses PARALLEL RACE to fetch from all proxies
 * simultaneously. First valid response wins.
 */
async function searchCourtCasesInternal(
  courtType: CourtType,
  mode: SearchMode,
  value: string,
  encodedValue: string,
): Promise<CourtCase[]> {
  // Determine the API paths based on court type and search mode
  const apiConfig = getApiConfig(courtType, mode, encodedValue)

  console.log(`[court-case] searching ${courtType} by ${mode}=${value}`)

  // Build the full proxy chain: CF Workers + public CORS proxies + direct
  const cfWorkerUrls: string[] = []
  const multi = process.env.CF_WORKER_URLS
  if (multi) {
    for (const u of multi.split(',').map(s => s.trim()).filter(Boolean)) {
      cfWorkerUrls.push(u.endsWith('/') ? u : u + '/')
    }
  }
  const single = process.env.CF_WORKER_URL
  if (single) {
    const normalized = single.endsWith('/') ? single : single + '/'
    if (!cfWorkerUrls.includes(normalized)) cfWorkerUrls.push(normalized)
  }
  const allWorkers = cfWorkerUrls.length > 0 ? cfWorkerUrls : FALLBACK_WORKERS

  // v140: For each API endpoint, fire ALL proxies in PARALLEL.
  // First valid response wins (Promise.any). This eliminates the 12-48s
  // sequential failover delay — if ANY proxy is alive, we get data in 1-3s.
  const promises = apiConfig.map(async ({ url, mapper }) => {
    // Build all proxy URLs for this endpoint
    const proxyUrls: { url: string; label: string }[] = []
    for (const w of allWorkers) {
      proxyUrls.push({ url: w + url, label: 'CF Worker' })
    }
    for (const p of PUBLIC_CORS_PROXIES) {
      const proxiedUrl = p.needsEncoding ? p.prefix + encodeURIComponent(url) : p.prefix + url
      proxyUrls.push({ url: proxiedUrl, label: 'CORS proxy' })
    }
    // Direct fetch as last resort in the parallel race
    proxyUrls.push({ url, label: 'direct' })

    // v149: For jadval.sud.uz, ALSO add curl-based fetch (bypasses TLS fingerprinting)
    const isJadvalSudUz = url.includes('jadval.sud.uz')

    // v140: PARALLEL RACE with BEST-OF fallback.
    // Fire ALL proxies simultaneously. Take the first valid response.
    // 10s timeout per request.
    const fetchPromises = proxyUrls.map(async ({ url: proxyUrl, label }) => {
      try {
        const res = await fetch(proxyUrl, {
          headers: {
            Accept: 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            'Origin': 'https://my.sud.uz',
            'Referer': 'https://my.sud.uz/',
          },
          signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) {
          // v149: CONFLICT/findByTin returns 404 intermittently — don't treat
          // as definitive. Only treat 404 as definitive for non-CONFLICT URLs.
          const isConflict = url.includes('CONFLICT')
          if ((res.status === 404 || res.status === 410) && !isConflict) {
            throw new Error(`DEFINITIVE_NOT_FOUND:${res.status}`)
          }
          throw new Error(`HTTP ${res.status}`)
        }
        const text = await res.text()
        const data = JSON.parse(text)
        const items = Array.isArray(data) ? data : (data.data || [])
        return items.map(mapper)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(msg)
      }
    })

    // v149: For jadval.sud.uz, ALSO try curl (bypasses TLS fingerprinting)
    if (isJadvalSudUz) {
      fetchPromises.push((async () => {
        const text = await curlFetch(url)
        const data = JSON.parse(text)
        const items = Array.isArray(data) ? data : (data.data || [])
        console.log(`[court-case] curl fetch got ${items.length} cases from ${url}`)
        return items.map(mapper)
      })())
    }

    // v140: BEST-OF strategy — wait for all proxies to settle, then take the
    // result with the MOST cases. This handles the case where one proxy returns
    // 6 cases and another returns 100 (jadvalapi is inconsistent — sometimes
    // returns partial results due to rate limiting).
    const allSettled = await Promise.allSettled(fetchPromises)

    // Check for definitive not-found (overrides everything)
    for (const r of allSettled) {
      if (r.status === 'rejected' && r.reason?.message?.startsWith('DEFINITIVE_NOT_FOUND')) {
        console.log(`[court-case] ${url} — definitive not-found, returning []`)
        return []
      }
    }

    // Collect all successful results
    const successes: CourtCase[][] = allSettled
      .filter((r): r is PromiseFulfilledResult<CourtCase[]> => r.status === 'fulfilled')
      .map(r => r.value)

    if (successes.length === 0) {
      // All failed — retry
      console.log(`[court-case] ${url} — all ${proxyUrls.length} proxies failed, retrying with 15s timeout...`)
      await new Promise(r => setTimeout(r, 500))

      const retryPromises = proxyUrls.map(async ({ url: proxyUrl }) => {
        const res = await fetch(proxyUrl, {
          headers: {
            Accept: 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            'Origin': 'https://my.sud.uz',
            'Referer': 'https://my.sud.uz/',
            'Referer': 'https://my.sud.uz/',
          },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) {
          const isConflict = url.includes('CONFLICT')
          if ((res.status === 404 || res.status === 410) && !isConflict) throw new Error('DEFINITIVE_NOT_FOUND')
          throw new Error(`HTTP ${res.status}`)
        }
        const text = await res.text()
        // v140: Don't treat text 'not found' as definitive (IP blocking issue)
        const data = JSON.parse(text)
        const items = Array.isArray(data) ? data : (data.data || [])
        return items.map(mapper)
      })

      const retrySettled = await Promise.allSettled(retryPromises)
      for (const r of retrySettled) {
        if (r.status === 'rejected' && r.reason?.message?.startsWith('DEFINITIVE_NOT_FOUND')) {
          return []
        }
      }
      const retrySuccesses: CourtCase[][] = retrySettled
        .filter((r): r is PromiseFulfilledResult<CourtCase[]> => r.status === 'fulfilled')
        .map(r => r.value)

      if (retrySuccesses.length === 0) {
        // Final retry with 20s timeout
        console.log(`[court-case] ${url} — retry failed, final attempt with 20s timeout...`)
        await new Promise(r => setTimeout(r, 500))
        const finalPromises = allWorkers.map(async (w) => {
          const res = await fetch(w + url, {
            headers: {
              Accept: 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            'Origin': 'https://my.sud.uz',
            'Referer': 'https://my.sud.uz/',
              'Referer': 'https://my.sud.uz/',
            },
            signal: AbortSignal.timeout(20000),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const text = await res.text()
          // v140: Don't treat text 'not found' as definitive (IP blocking issue)
          const data = JSON.parse(text)
          const items = Array.isArray(data) ? data : (data.data || [])
          return items.map(mapper)
        })
        const finalSettled = await Promise.allSettled(finalPromises)
        const finalSuccesses: CourtCase[][] = finalSettled
          .filter((r): r is PromiseFulfilledResult<CourtCase[]> => r.status === 'fulfilled')
          .map(r => r.value)
        if (finalSuccesses.length > 0) {
          // Take the best (most cases)
          finalSuccesses.sort((a, b) => b.length - a.length)
          console.log(`[court-case] ${url} — final retry got ${finalSuccesses[0].length} cases`)
          return finalSuccesses[0]
        }
        console.log(`[court-case] ${url} — all retries failed, returning []`)
        return []
      }

      // Take the best (most cases)
      retrySuccesses.sort((a, b) => b.length - a.length)
      console.log(`[court-case] ${url} — retry got ${retrySuccesses[0].length} cases (best of ${retrySuccesses.length})`)
      return retrySuccesses[0]
    }

    // v140: BEST-OF — take the result with the MOST cases, not just the first.
    // This handles the case where one proxy returns 6 cases and another returns 100.
    successes.sort((a, b) => b.length - a.length)
    const best = successes[0]
    console.log(`[court-case] ${url} — got ${best.length} cases (best of ${successes.length} successful proxies)`)
    return best
  })

  const results = await Promise.all(promises)
  // Merge and deduplicate by case number
  const merged: CourtCase[] = []
  const seen = new Set<string>()
  for (const items of results) {
    for (const item of items) {
      if (item.caseNumber && !seen.has(item.caseNumber)) {
        seen.add(item.caseNumber)
        merged.push(item)
      }
    }
  }

  console.log(`[court-case] found ${merged.length} cases`)
  return merged
}

interface ApiConfig {
  url: string
  mapper: (raw: any) => CourtCase
}

function getApiConfig(courtType: CourtType, mode: SearchMode, value: string): ApiConfig[] {
  const configs: ApiConfig[] = []
  const courtTypeUpper = courtType.toUpperCase()

  // jadvalapi.sud.uz endpoints (newer API with hearings)
  if (courtType === 'economic') {
    if (mode === 'tin') {
      configs.push({
        url: `${JADVALAPI}/online-monitoring/ECONOMIC/findByTin/${value}`,
        mapper: mapJadvalApiCase,
      })
    } else {
      configs.push({
        url: `${JADVALAPI}/online-monitoring/ECONOMIC/findByNumber/${value}`,
        mapper: mapJadvalApiCase,
      })
    }
  } else if (courtType === 'civil') {
    if (mode === 'caseNumber') {
      configs.push({
        url: `${JADVALAPI}/online-monitoring/CIVIL/findByNumber/${value}`,
        mapper: mapJadvalApiCase,
      })
    } else if (mode === 'tin') {
      // CIVIL findByTin — verified working (returns civil cases by TIN with
      // `result` field in ~0.6s). Used by the Statistika tab.
      configs.push({
        url: `${JADVALAPI}/online-monitoring/CIVIL/findByTin/${value}`,
        mapper: mapJadvalApiCase,
      })
    }
  } else if (courtType === 'administrative') {
    if (mode === 'tin') {
      configs.push({
        url: `${JADVALAPI}/online-monitoring/CONFLICT/findByTin/${value}`,
        mapper: mapJadvalApiCase,
      })
    } else {
      configs.push({
        url: `${JADVALAPI}/online-monitoring/CONFLICT/findByNumber/${value}`,
        mapper: mapJadvalApiCase,
      })
    }
  }

  // jadval.sud.uz endpoints (older API with case details)
  if (courtType === 'economic') {
    if (mode === 'tin') {
      configs.push({
        url: `${JADVAL_API}/case/findByTin/${value}`,
        mapper: mapJadvalCase,
      })
    } else {
      configs.push({
        url: `${JADVAL_API}/case/findByNumber/${value}`,
        mapper: mapJadvalCase,
      })
    }
  } else if (courtType === 'civil') {
    if (mode === 'caseNumber') {
      configs.push({
        url: `${JADVAL_API}/case/findByCivilNumber/${value}`,
        mapper: mapJadvalCase,
      })
    }
  } else if (courtType === 'criminal') {
    if (mode === 'caseNumber') {
      configs.push({
        url: `${JADVAL_API}/case/findByCriminalNumber/${value}`,
        mapper: mapJadvalCase,
      })
    }
  } else if (courtType === 'administrative') {
    if (mode === 'caseNumber') {
      configs.push({
        url: `${JADVAL_API}/case/findByAdmNumber/${value}`,
        mapper: mapJadvalCase,
      })
    }
  }

  return configs
}

// ---- Mappers ----

function mapJadvalApiCase(raw: any): CourtCase {
  return {
    caseNumber: raw.casenumber || raw.caseNumber || '—',
    caseType: raw.category || raw.sub_category || '—',
    caseStatus: raw.status_name || raw.instance || '—',
    result: raw.result || '—',
    courtName: raw.court || '—',
    dateFiled: raw.reg_date || raw.hearing_date || '—',
    // jadvalapi has a typo: "claiment" instead of "claimant"
    plaintiff: raw.claiment || raw.claimant || raw.plaintiff || '—',
    defendant: raw.defendant || '—',
    claimAmount: raw.claim_amount || raw.amount || '—',
    hearingDate: raw.hearing_date || '',
    hearingTime: raw.hearing_time || '',
    judge: raw.responsible || '',
  }
}

function mapJadvalCase(raw: any): CourtCase {
  return {
    caseNumber: raw.casenumber || raw.caseNumber || '—',
    caseType: raw.category || raw.sub_category || '—',
    caseStatus: raw.status_name || raw.instance || '—',
    result: raw.result || '—',
    courtName: raw.court || '—',
    dateFiled: raw.reg_date || '—',
    plaintiff: raw.claimant || raw.claiment || raw.plaintiff || '—',
    defendant: raw.defendant || '—',
    claimAmount: raw.claim_amount || raw.amount || '—',
    hearingDate: raw.hearing_date || '',
    hearingTime: raw.hearing_time || '',
    judge: raw.responsible || '',
  }
}

/**
 * Get full case details. Calls BOTH jadvalapi.sud.uz and jadval.sud.uz and
 * merges the richest data from each.
 */
export async function getCaseDetails(
  courtType: CourtType,
  caseNumber: string,
): Promise<FullCaseData> {
  const encodedNumber = caseNumber.replace('/', '@')
  const courtTypeUpper = courtType.toUpperCase()

  console.log(`[court-case] fetching details for ${caseNumber}`)

  // Call both APIs in parallel
  const [jadvalApiData, jadvalData] = await Promise.all([
    fetchJadvalApiDetails(courtTypeUpper, encodedNumber),
    fetchJadvalDetails(courtType, encodedNumber),
  ])

  // Prefer jadval.sud.uz for BOTH parties and hearings — it returns the real
  // hearing_date / hearing_time / responsible (judge) fields per case, whereas
  // jadvalapi's findByNumber returns 400 for most court types.
  const raw = jadvalData?.[0] || jadvalApiData?.[0]
  if (!raw) {
    return { general: null, firstInstance: null, appellate: null, cassation: null }
  }

  const detailRaw = jadvalData?.[0] || jadvalApiData?.[0]
  // Hearings: prefer jadval.sud.uz (has hearing_date/hearing_time/responsible).
  // Fall back to jadvalapi only when jadval.sud.uz returned nothing.
  const hearingsRaw = jadvalData?.length ? jadvalData : (jadvalApiData || [])

  const hearings = hearingsRaw
    .map((h: any) => ({
      date: h.hearing_date || '',
      time: h.hearing_time || '',
      status: h.status_name || h.instance || '',
      postponementReason: h.postpone_reason || '',
      courtroom: h.courtroom || '',
      judge: h.responsible || '',
    }))
    // Drop phantom hearing entries where every key field is empty (the API
    // sometimes returns a bare {message, statusCode} object on errors, or a
    // case row with no scheduled hearing yet).
    .filter(
      (h: any) =>
        h.date || h.time || h.judge || h.status || h.courtroom,
    )
    // Normalise empty strings back to '—' for display consistency.
    .map((h: any) => ({
      date: h.date || '—',
      time: h.time || '—',
      status: h.status || '—',
      postponementReason: h.postponementReason,
      courtroom: h.courtroom,
      judge: h.judge || '—',
    }))

  const d = detailRaw || raw
  const decisionText = d.result || d.article || ''
  return {
    general: {
      caseNumber: d.casenumber || d.caseNumber || caseNumber,
      caseType: d.category || '—',
      caseStatus: d.status_name || d.instance || '—',
      court: d.court || '—',
      judge: d.responsible || '—',
      secretary: '—',
      plaintiff: d.claiment || d.claimant || d.plaintiff || '—',
      plaintiffTin: '—',
      defendant: d.defendant || '—',
      defendantTin: '—',
      thirdParty: '—',
      claimSubject: d.sub_category || d.category || '—',
      claimAmount: d.claim_amount || d.amount || '—',
      applicationDate: d.reg_date || '—',
      initiatedDate: d.reg_date || '—',
      deadlineDate: '—',
      stateDuty: '—',
      representative: d.representing_org || d.representor || '—',
      prosecutor: '—',
    },
    firstInstance: {
      hearings,
      decision: decisionText ? {
        date: d.reg_date || '—',
        text: d.result || '—',
        type: d.result || '—',
        awardedAmount: '—',
        stateDutyRecovered: '—',
        enforcedDate: '—',
        appealDeadline: '—',
      } : null,
      documents: [],
    },
    appellate: parseReviewInstance(raw, 'апелляция'),
    cassation: parseReviewInstance(raw, 'кассация'),
  }
}

/**
 * Parse a review entry from the API response as an appeal or cassation instance.
 * The jadvalapi findByNumber response includes a `reviews` array that contains
 * appeal/cassation instances. Each review has an `instance` field whose value
 * is the Cyrillic-Uzbek phrase "Apellyatsiya instansiyasi" or "Kassatsiya
 * instansiyasi" (written in Cyrillic in the API response). We match on the
 * Cyrillic lowercase fragments "apellyatsiya" / "kassatsiya" — those are the
 * only forms the API ever emits, so no Latin fallback is needed here.
 */
function parseReviewInstance(raw: any, type: 'апелляция' | 'кассация'): InstanceData | null {
  const reviews = raw?.reviews
  if (!Array.isArray(reviews) || reviews.length === 0) return null

  // Find the review matching this instance type
  const review = reviews.find((r: any) => {
    const inst = (r.instance || '').toLowerCase()
    return inst.includes(type)
  })
  if (!review) return null

  const reviewHearings = [
    {
      date: review.hearing_date || '—',
      time: review.hearing_time || '—',
      status: review.status_name || review.instance || '—',
      postponementReason: review.postpone_reason || '',
      courtroom: review.courtroom || '',
      judge: review.responsible || '—',
    },
  ]

  const reviewDecision = review.result && review.result !== '—' ? {
    date: review.reg_date || '—',
    text: review.result || '—',
    type: review.result || '—',
    awardedAmount: '—',
    stateDutyRecovered: '—',
    enforcedDate: '—',
    appealDeadline: '—',
  } : null

  return {
    hearings: reviewHearings,
    decision: reviewDecision,
    documents: [],
    appellant: review.claiment || review.claimant || undefined,
  }
}

async function fetchJadvalApiDetails(courtTypeUpper: string, encodedNumber: string): Promise<any[] | null> {
  // Map court types to jadvalapi's expected names:
  // economic → ECONOMIC, civil → CIVIL, administrative → CONFLICT, criminal → not supported
  const apiTypeMap: Record<string, string> = {
    ECONOMIC: 'ECONOMIC',
    CIVIL: 'CIVIL',
    ADMINISTRATIVE: 'CONFLICT',
    CRIMINAL: '', // jadvalapi doesn't support criminal — skip
  }
  const apiType = apiTypeMap[courtTypeUpper] || ''
  if (!apiType) return null // Criminal cases are only on jadval.sud.uz

  const url = `${JADVALAPI}/online-monitoring/${apiType}/findByNumber/${encodedNumber}`
  // Route through CF Worker to avoid IP blocking
  const workerUrl = getCfWorkerUrl(url)
  try {
    const res = await fetch(workerUrl, {
      headers: { Accept: 'application/json, text/plain, */*', 'Origin': 'https://my.sud.uz', 'Referer': 'https://my.sud.uz/' },
      signal: AbortSignal.timeout(8000),
    })
    // Guard against non-200 responses — jadvalapi returns 400 Bad Request for
    // most court types' findByNumber, and the body `{message, statusCode}` must
    // NOT be treated as a valid hearings array (it would produce phantom '—' rows).
    if (!res.ok) {
      console.log(`[court-case] jadvalapi details HTTP ${res.status} for ${url}`)
      return null
    }
    const text = await res.text()
    if (text === 'Иш топилмади' || text.includes('топилмади')) return null
    const data = JSON.parse(text)
    if (!data || (typeof data === 'object' && !Array.isArray(data) && data.message && data.statusCode)) {
      return null
    }
    return Array.isArray(data) ? data : [data]
  } catch (e) {
    console.log(`[court-case] jadvalapi details failed: ${e instanceof Error ? e.message : e}`)
    return null
  }
}

async function fetchJadvalDetails(courtType: CourtType, encodedNumber: string): Promise<any[] | null> {
  // Map court type to jadval.sud.uz endpoint
  let endpoint = ''
  if (courtType === 'economic') endpoint = `${JADVAL_API}/case/findByNumber/${encodedNumber}`
  else if (courtType === 'civil') endpoint = `${JADVAL_API}/case/findByCivilNumber/${encodedNumber}`
  else if (courtType === 'criminal') endpoint = `${JADVAL_API}/case/findByCriminalNumber/${encodedNumber}`
  else if (courtType === 'administrative') endpoint = `${JADVAL_API}/case/findByAdmNumber/${encodedNumber}`
  else return null

  // Route through CF Worker to avoid IP blocking
  const workerUrl = getCfWorkerUrl(endpoint)
  try {
    const res = await fetch(workerUrl, {
      headers: { Accept: 'application/json, text/plain, */*', 'Origin': 'https://my.sud.uz', 'Referer': 'https://my.sud.uz/' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.log(`[court-case] jadval details HTTP ${res.status} for ${endpoint}`)
      return null
    }
    const text = await res.text()
    if (text === 'Иш топилмади' || text.includes('топилмади')) return null
    const data = JSON.parse(text)
    if (!data || (typeof data === 'object' && !Array.isArray(data) && data.message && data.statusCode)) {
      return null
    }
    return Array.isArray(data) ? data : [data]
  } catch (e) {
    console.log(`[court-case] jadval details failed: ${e instanceof Error ? e.message : e}`)
    return null
  }
}

// ---- Captcha (kept for compatibility but NOT needed for jadval APIs) ----
// The jadval.sud.uz and jadvalapi.sud.uz endpoints are public — no captcha needed.
// This is kept in case future endpoints require it.

const MYSUD_SITE_KEY = 'site_835080654e60bd9283ac263c5ebbaaef'
const CAPTCHA_API = 'https://recaptcha.sud.uz'

export async function getCaptchaTokenMySud(): Promise<string> {
  // Not needed — jadval APIs are public
  return 'not-required'
}
