import crypto from 'crypto'
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
function getCfWorkerUrl(url: string): string {
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
  if (urls.length === 0) return FALLBACK_WORKERS[0] + url // no workers — try direct
  const worker = urls[courtWorkerCounter % urls.length]
  courtWorkerCounter++
  return worker + url
}

// ---- Types (re-exported from court-case-types.ts) ----
export type { CourtType, SearchMode, CourtCase, CaseDetail, Hearing, Decision, CaseDocument, InstanceData, FullCaseData } from './court-case-types'
import type { CourtType, SearchMode, CourtCase, FullCaseData } from './court-case-types'

// ---- Status enums for UI ----
export { CASE_STATUSES, HEARING_STATUSES, COURT_TYPE_LABELS } from './court-case-types'

// ---- API calls (NO auth, NO captcha needed — these are public endpoints) ----

/**
 * Search court cases. Calls both jadval.sud.uz and jadvalapi.sud.uz and merges
 * the results (the Angular frontend does the same).
 *
 * - Economic: findByTin (by INN) or findByNumber (by case number)
 * - Civil: findByNumber (by case number) or findByPinfl (by PINFL)
 * - Criminal: findByCriminalNumber
 * - Administrative: findByAdmNumber or findByTin
 */
export async function searchCourtCases(
  courtType: CourtType,
  mode: SearchMode,
  value: string,
): Promise<CourtCase[]> {
  // Case numbers use "@" instead of "/" in the URL
  const encodedValue = mode === 'caseNumber' ? value.replace('/', '@') : value

  // Determine the API paths based on court type and search mode
  const apiConfig = getApiConfig(courtType, mode, encodedValue)

  console.log(`[court-case] searching ${courtType} by ${mode}=${value}`)

  // Build CF Worker URLs from env (same as billing.ts)
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

  /** Wrap a jadval/jadvalapi URL with a CF Worker (round-robin). */
  let courtRequestCounter = 0
  function proxyCourtUrl(url: string): string {
    if (cfWorkerUrls.length === 0) return url // no workers — try direct
    const worker = cfWorkerUrls[courtRequestCounter % cfWorkerUrls.length]
    courtRequestCounter++
    return worker + url
  }

  // Call both APIs in parallel and merge results.
  // Route through CF Workers to avoid IP blocking (same as billing.sud.uz).
  const promises = apiConfig.map(async ({ url, mapper }) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const proxyUrl = proxyCourtUrl(url)
        console.log(`[court-case] fetching ${url}${attempt > 0 ? ` (retry ${attempt + 1})` : ''} via ${proxyUrl.includes('workers.dev') ? 'CF Worker' : 'direct'}`)
        const res = await fetch(proxyUrl, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Referer: 'https://my.sud.uz/court-case',
          },
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) {
          console.log(`[court-case] ${url} returned HTTP ${res.status}`)
          return []
        }
        const text = await res.text()
        if (text === 'Иш топилмади' || text.includes('топилмади')) {
          return []
        }
        const data = JSON.parse(text)
        const items = Array.isArray(data) ? data : (data.data || [])
        return items.map(mapper)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`[court-case] ${url} attempt ${attempt + 1} failed: ${msg}`)
        // Only retry on 521 (origin temporarily down) — NOT on timeouts or connection errors.
        // Timeouts mean the origin is slow/unresponsive; retrying just wastes another 8s.
        if (attempt === 0 && msg.includes('521')) {
          await new Promise((r) => setTimeout(r, 500))
          continue
        }
        return []
      }
    }
    return []
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
    appellate: null,
    cassation: null,
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
      headers: { Accept: 'application/json', Referer: 'https://my.sud.uz/court-case' },
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
      headers: { Accept: 'application/json', Referer: 'https://my.sud.uz/court-case' },
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
