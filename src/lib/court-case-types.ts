/**
 * Client-safe types and constants for the my.sud.uz court case service.
 *
 * This file is separated from court-case.ts so that client components
 * (page.tsx) can import types and status constants without pulling in
 * the Node-only z-ai-web-dev-sdk dependency that court-case.ts uses for
 * captcha solving.
 */

export type CourtType = 'economic' | 'civil' | 'criminal' | 'administrative'
export type SearchMode = 'tin' | 'caseNumber' | 'pinfl'

export interface CourtCase {
  caseNumber: string
  caseType: string
  caseStatus: string
  result: string
  courtName: string
  dateFiled: string
  plaintiff: string
  defendant: string
  claimAmount: string
  hearingDate: string
  hearingTime: string
  judge: string
}

export interface CaseDetail {
  caseNumber: string
  caseType: string
  caseStatus: string
  court: string
  judge: string
  secretary: string
  plaintiff: string
  plaintiffTin: string
  defendant: string
  defendantTin: string
  thirdParty: string
  claimSubject: string
  claimAmount: string
  applicationDate: string
  initiatedDate: string
  deadlineDate: string
  stateDuty: string
  representative: string
  prosecutor: string
}

export interface Hearing {
  date: string
  time: string
  status: string
  postponementReason: string
  courtroom: string
  judge: string
}

export interface Decision {
  date: string
  text: string
  type: string
  awardedAmount: string
  stateDutyRecovered: string
  enforcedDate: string
  appealDeadline: string
}

export interface CaseDocument {
  name: string
  date: string
  type: string
  fileUrl: string
}

export interface InstanceData {
  hearings: Hearing[]
  decision: Decision | null
  documents: CaseDocument[]
  appellant?: string
  appealFiledDate?: string
  appellateCourt?: string
  appellateOutcome?: string
}

export interface FullCaseData {
  general: CaseDetail | null
  firstInstance: InstanceData | null
  appellate: InstanceData | null
  cassation: InstanceData | null
}

// ---- Status enums for UI ----

export const CASE_STATUSES: Record<string, { en: string; color: string }> = {
  'Иш юритувда': { en: 'Ish yuritilmoqda', color: '#2563a8' },
  'Кўриб чиқилмоқда': { en: "Ko'rib chiqilmoqda", color: '#2563a8' },
  'Тугатилган': { en: 'Tugatilgan', color: '#1e7e44' },
  'Тўхтатилган': { en: "To'xtatilgan", color: '#c47d0e' },
  'Бекор қилинган': { en: 'Bekor qilingan', color: '#6b7280' },
  'Апелляцияда': { en: 'Apellyatsiyada', color: '#6d3db5' },
  'Кассацияда': { en: 'Kassatsiyada', color: '#4a1d96' },
  'Назоратда': { en: 'Nazoratda', color: '#b91c1c' },
  'Ижро этилмоқда': { en: 'Ijro etilmoqda', color: '#0e7490' },
}

export const HEARING_STATUSES: Record<string, { en: string; color: string }> = {
  'Тайинланган': { en: 'Tayinlangan', color: '#3b82f6' },
  'Кечиктирилган': { en: 'Kechiktirilgan', color: '#f59e0b' },
  'Ўтказилган': { en: "O'tkazilgan", color: '#10b981' },
  'Бекор қилинган': { en: 'Bekor qilingan', color: '#9ca3af' },
  'Якунланган': { en: 'Yakunlangan', color: '#1e7e44' },
}

export const COURT_TYPE_LABELS: Record<CourtType, { uz: string; en: string }> = {
  economic: { uz: 'Иқтисодий судлар', en: 'Economic Courts' },
  civil: { uz: 'Фуқаролик судлар', en: 'Civil Courts' },
  criminal: { uz: 'Жиноят ишлари', en: 'Criminal Courts' },
  administrative: { uz: 'Маъмурий ишлар', en: 'Administrative Courts' },
}
