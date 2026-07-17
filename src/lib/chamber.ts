/**
 * chamber.uz — Chamber of Commerce contractor rating API client.
 *
 * Fetches company rating data from admin.chamber.uz/api/GetCompanyCriteries/{STIR}
 * Returns: rating score (0-100), category (AAA-D), taxpayer type, region, industry.
 *
 * No authentication required — completely free.
 */

import 'server-only'

// ---- Types ---------------------------------------------------------------

export interface ChamberRating {
  tin: string
  name: string
  nameRu: string
  nameLat: string
  /** Rating score 0-100 */
  criteriaAll: number
  /** Rating category: AAA, AA, A, BBB, BB, B, CCC, CC, C, D */
  type: string
  /** Taxpayer type ID */
  taxpayerType: number
  /** Taxpayer type name (e.g. "SDT" = Large Taxpayer) */
  taxpayername: string
  regionNameUz: string
  regionNameLat: string
  districtNameUz: string
  districtNameLat: string
  okedCode: string
  okedName: string
  okedNameRu: string
  okedSection: string
  okedShortName: string
  employeeLimitMf: number
  employeeLimitLf: number
}

// ---- CF Worker proxy helper ----------------------------------------------

let chamberWorkerCounter = 0
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
  if (urls.length === 0) return FALLBACK_WORKERS[0] + url
  const worker = urls[chamberWorkerCounter % urls.length]
  chamberWorkerCounter++
  return worker + url
}

// ---- API -----------------------------------------------------------------

/**
 * Fetch contractor rating for a company by STIR from chamber.uz.
 *
 * GET https://admin.chamber.uz/api/GetCompanyCriteries/{STIR}
 * Returns rating score, category, taxpayer type, region, industry info.
 */
export async function getCompanyRating(tin: string): Promise<ChamberRating | null> {
  const cleanTin = tin.trim()
  if (!/^\d{9}$/.test(cleanTin)) return null

  const url = `https://admin.chamber.uz/api/GetCompanyCriteries/${cleanTin}`
  const proxiedUrl = getCfWorkerUrl(url)

  try {
    console.log(`[chamber] fetching rating for TIN ${cleanTin}`)
    const res = await fetch(proxiedUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) {
      console.log(`[chamber] HTTP ${res.status} for TIN ${cleanTin}`)
      return null
    }
    const data = await res.json()

    // Check if we got actual company data (not an error/empty response)
    if (!data || !data.tin) {
      console.log(`[chamber] no data for TIN ${cleanTin}`)
      return null
    }

    return {
      tin: data.tin,
      name: data.name || data.nameUz || '',
      nameRu: data.nameRu || '',
      nameLat: data.nameLat || data.nameUz || '',
      criteriaAll: data.criteriaAll ?? 0,
      type: data.type || '—',
      taxpayerType: data.taxpayerType ?? 0,
      taxpayername: data.taxpayername || data.taxpayer_name_uz_latn || '',
      regionNameUz: data.regionNameUz || '',
      regionNameLat: data.regionNameLat || '',
      districtNameUz: data.districtNameUz || '',
      districtNameLat: data.districtNameLat || '',
      okedCode: data.okedDetail?.code || '',
      okedName: data.okedDetail?.name_uz_latn || data.okedDetail?.name || '',
      okedNameRu: data.okedDetail?.name_ru || '',
      okedSection: data.okedDetail?.section || '',
      okedShortName: data.okedDetail?.name_short_ru || '',
      employeeLimitMf: data.okedDetail?.employee_limit_mf ?? 0,
      employeeLimitLf: data.okedDetail?.employee_limit_lf ?? 0,
    }
  } catch (e) {
    console.log(`[chamber] error for TIN ${cleanTin}: ${e instanceof Error ? e.message : 'unknown'}`)
    return null
  }
}

/**
 * Get the rating category color based on score.
 * AAA-AA: green, A-BBB: blue, BB-B: amber, CCC-D: red
 */
export function getRatingColor(type: string): string {
  if (['AAA', 'AA', 'A'].includes(type)) return '#34d399' // emerald
  if (['BBB'].includes(type)) return '#38bdf8' // cyan
  if (['BB', 'B'].includes(type)) return '#f59e0b' // amber
  return '#f43f5e' // rose for CCC, CC, C, D
}

/**
 * Get the rating category label in Uzbek.
 */
export function getRatingLabel(type: string): string {
  const labels: Record<string, string> = {
    'AAA': 'Yuqori',
    'AA': 'Yuqori',
    'A': 'Yuqori',
    'BBB': "O'rta",
    'BB': "O'rta",
    'B': "O'rta",
    'CCC': 'Qoniqarli',
    'CC': 'Qoniqarli',
    'C': 'Qoniqarli',
    'D': 'Quyi',
  }
  return labels[type] || 'Noma\'lum'
}
