import { NextRequest } from 'next/server'
import { getCompanyByTin } from '@/lib/orginfo'
import { getCompanyRating } from '@/lib/chamber'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * GET /api/company-info?tin=XXXXXXXXX
 *   Fetches comprehensive company info from:
 *   - orginfo.uz (company details, address, founders, contacts)
 *   - chamber.uz (contractor rating, taxpayer type, industry)
 *   Returns combined data.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tin = searchParams.get('tin')?.trim()

  if (!tin || !/^\d{9}$/.test(tin)) {
    return Response.json(
      { ok: false, error: 'TIN must be exactly 9 digits' },
      { status: 400 },
    )
  }

  try {
    // Fetch from both sources in parallel
    const [orginfoResult, chamberResult] = await Promise.allSettled([
      getCompanyByTin(tin),
      getCompanyRating(tin),
    ])

    const company = orginfoResult.status === 'fulfilled' ? orginfoResult.value : null
    const rating = chamberResult.status === 'fulfilled' ? chamberResult.value : null

    if (!company && !rating) {
      return Response.json(
        { ok: false, error: 'Company not found on orginfo.uz or chamber.uz' },
        { status: 404 },
      )
    }

    return Response.json({
      ok: true,
      company: company ? {
        tin: company.tin,
        officialName: company.officialName || '',
        shortName: company.shortName || '',
        registeredDate: company.registeredDate || '',
        status: company.status || '',
        address: company.address || '',
        director: company.director || '',
        phone: company.phone || '',
        email: company.email || '',
        charterCapital: company.charterCapital || '',
        registeringAuthority: company.registeringAuthority || '',
        thsht: company.thsht || '',
        dbibt: company.dbibt || '',
        ifut: company.ifut || '',
        founders: company.founders || [],
        orgInfoUrl: company.orgInfoUrl || '',
      } : null,
      rating: rating ? {
        score: rating.criteriaAll,
        category: rating.type,
        taxpayerType: rating.taxpayername,
        region: rating.regionNameLat || rating.regionNameUz,
        district: rating.districtNameLat || rating.districtNameUz,
        okedCode: rating.okedCode,
        okedName: rating.okedName,
        okedNameRu: rating.okedNameRu,
        okedSection: rating.okedSection,
        okedShortName: rating.okedShortName,
        employeeLimitMf: rating.employeeLimitMf,
        employeeLimitLf: rating.employeeLimitLf,
      } : null,
    })
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed' },
      { status: 502 },
    )
  }
}
