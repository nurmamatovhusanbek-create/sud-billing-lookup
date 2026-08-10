/**
 * Shared badge components — v146 §6 extraction.
 *
 * Extracted from page.tsx to reduce monolith size. These are the 5 badge
 * components used across all tabs: StatusBadge, CourtTypeBadge, CategoryBadge,
 * CaseStatusBadge, HearingStatusBadge.
 */
import { STATUS_META, COURT_TYPES, CASE_STATUS_TONES, HEARING_STATUS_TONES, CASE_STATUSES, HEARING_STATUSES } from '@/lib/court-case-types'
import { categoryMeta } from '@/lib/billing'

type InvoiceStatus = string

export function StatusBadge({ status }: { status: InvoiceStatus | null | undefined }) {
  if (!status) return <span className="badge b-neutral">Noma'lum</span>
  const m = STATUS_META[status]
  if (!m) return <span className="badge b-neutral">{status}</span>
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

export function CourtTypeBadge({ type }: { type: string | null | undefined }) {
  if (!type) return null
  const m = COURT_TYPES[type]
  if (!m) return <span className="badge b-neutral">{type}</span>
  return <span className={`badge ${m.cls}`}>{m.en}</span>
}

export function CategoryBadge({ payCategory, description }: { payCategory: string | null | undefined; description: string | null | undefined }) {
  const m = categoryMeta(payCategory, description)
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

export function CaseStatusBadge({ status }: { status: string | null | undefined }) {
  const cls = CASE_STATUS_TONES[status as keyof typeof CASE_STATUS_TONES] ?? 'b-neutral'
  const label = CASE_STATUSES[status as keyof typeof CASE_STATUSES]?.en ?? status
  return <span className={`badge ${cls}`}>{label}</span>
}

export function HearingStatusBadge({ status }: { status: string | null | undefined }) {
  const cls = HEARING_STATUS_TONES[status as keyof typeof HEARING_STATUS_TONES] ?? 'b-neutral'
  const label = HEARING_STATUSES[status as keyof typeof HEARING_STATUSES]?.en ?? status
  return <span className={`badge ${cls}`}>{label}</span>
}
