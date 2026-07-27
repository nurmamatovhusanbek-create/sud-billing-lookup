'use client'

import {
  useState, useCallback, useRef, useEffect, useMemo,
} from 'react'
import {
  ChevronLeft, ChevronRight, Sun, Moon,
  Search, Receipt, Building2, Gavel, ShieldCheck, Link2, Award,
  Wallet, ArrowLeftRight, CheckCheck, Clock, CalendarDays, Copy,
  RefreshCw, FileText, FolderOpen, ExternalLink, Trash2, Users,
  LayoutGrid, Eye, ChevronDown, AlertCircle, Info, Scale, Loader2,
  Phone, Mail, MapPin, Zap, Layers, Factory, User,
  BarChart3, Megaphone, Shield, Tags, ArrowRight,
  Inbox, Trophy, XCircle, MinusCircle, Grid3x3, Building, Download,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  CASE_STATUSES,
  HEARING_STATUSES,
  COURT_TYPE_LABELS,
  type CourtType,
  type SearchMode,
  type CourtCase,
  type InstanceData,
  type FullCaseData,
} from '@/lib/court-case-types'
import { getCached, setCached, cacheKey } from '@/lib/cache'

// ---- SVG spinner (monochrome — uses var(--accent)) -------------------

function SvgSpinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`svg-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="3" style={{ stroke: 'var(--accent-dim)' }} />
      <path d="M12 2 A10 10 0 0 1 22 12" strokeWidth="3" strokeLinecap="round" style={{ stroke: 'var(--accent)' }} />
    </svg>
  )
}

// ---- Types (mirrors the API response) ---------------------------------

type InvoiceStatus = string

interface HistoryEntry {
  id: number | null
  caseId: number | null
  caseNumber: string | null
  amount: number | null
  invoiceId: number | null
  usedUserId: number | null
  rolledBackAt: number | null
  invoiceStatus: InvoiceStatus | null
  createdAt: number | null
}

interface CheckStatusResponse {
  requestStatus: { code: number; message: string }
  number: string | null
  invoiceStatus: InvoiceStatus | null
  amount: number | null
  paidAmount: number | null
  mustPayAmount: number | null
  balance: number | null
  overdue: number | null
  court: string | null
  courtId: number | null
  courtType: string | null
  payCategory: string | null
  payCategoryId: number | null
  description: string | null
  purpose: string | null
  purposeId: number | null
  instance: string | null
  payer: string | null
  payerId: number | null
  payerTin: string | null
  forAccount: string | null
  isInFavor: boolean | null
  claimCaseNumber: string | null
  decisionDate: number | null
  issued: number | null
  historyList: HistoryEntry[] | null
}

interface BillListItem {
  number: string
  invoiceStatus: InvoiceStatus
  issued: number | null
}

interface EnrichedBill extends BillListItem {
  detail: CheckStatusResponse | null
  error?: string
}

// ---- Status meta (monochrome — solid for paid, outline for unpaid) ----

const STATUS_META: Record<string, { label: string; cls: string }> = {
  CREATED:         { label: "To'lanmagan",        cls: 'b-unpaid' },
  PARTIALLY_PAID:  { label: "Qisman to'langan",   cls: 'b-unpaid' },
  PAID:            { label: "To'liq to'langan",   cls: 'b-paid' },
  CHECKING:        { label: 'Tasdiqlanmoqda',     cls: 'b-unpaid' },
  CANCELLED:       { label: 'Bekor qilingan',     cls: 'b-unpaid' },
  USED:            { label: 'Ishlatilgan',        cls: 'b-paid' },
  SENT_TO_MIB:     { label: 'BPIga yuborilgan',   cls: 'b-unpaid' },
}

function isPaidStatus(s: InvoiceStatus | null | undefined) {
  return s === 'PAID' || s === 'USED'
}
function isUnpaidStatus(s: InvoiceStatus | null | undefined) {
  return s === 'CREATED' || s === 'PARTIALLY_PAID' || s === 'CHECKING'
}

function StatusBadge({ status }: { status: InvoiceStatus | null | undefined }) {
  if (!status) return <span className="badge b-neutral">Noma&apos;lum</span>
  const m = STATUS_META[status]
  if (!m) return <span className="badge b-neutral">{status}</span>
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

// ---- Court types (monochrome — all neutral info badges) --------------

const COURT_TYPES: Record<string, { en: string; cls: string }> = {
  ECONOMIC:       { en: 'Iqtisodiy sud',   cls: 'b-court-econ' },
  CITIZEN:        { en: 'Fuqarolik sudi',  cls: 'b-court-civ' },
  CRIMINAL:       { en: 'Jinoyat sudi',    cls: 'b-court-crim' },
  ADMINISTRATIVE: { en: "Ma'muriy sud",    cls: 'b-court-adm' },
}

function CourtTypeBadge({ type }: { type: string | null | undefined }) {
  if (!type) return null
  const m = COURT_TYPES[type]
  if (!m) return <span className="badge b-neutral">{type}</span>
  return <span className={`badge ${m.cls}`}>{m.en}</span>
}

// ---- Category meta ----------------------------------------------------

function categoryMeta(payCategory: string | null | undefined, description: string | null | undefined) {
  const text = `${payCategory ?? ''} ${description ?? ''}`.toLowerCase()
  if (!text.trim()) return { label: '—', cls: 'b-neutral', kind: 'other' as const }
  if (text.includes('pochta') || text.includes('почта')) {
    return { label: 'Pochta', cls: 'b-duty', kind: 'pochta' as const }
  }
  if (text.includes('boj') || text.includes('boji') || text.includes('бож') || text.includes('пошлин')) {
    return { label: 'Davlat boji', cls: 'b-duty', kind: 'davlat_boji' as const }
  }
  const label = payCategory || description || '—'
  return { label, cls: 'b-neutral', kind: 'other' as const }
}

function CategoryBadge({
  payCategory, description,
}: {
  payCategory: string | null | undefined
  description: string | null | undefined
}) {
  const m = categoryMeta(payCategory, description)
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

// ---- Case status + hearing status badges (monochrome) ----------------
// The KEYS are Cyrillic because that's what the sud.uz APIs return in their
// `status_name` / `instance` fields. Latin-Uzbek keys are ALSO included so
// synthetic Latin status strings (e.g. the ones we set in StatsTab →
// CourtCase conversion) resolve to the right tone. Display always goes
// through CASE_STATUSES[status]?.en / HEARING_STATUSES[status]?.en which is
// Latin — never the raw Cyrillic key.

const CASE_STATUS_TONES: Record<string, string> = {
  // Cyrillic keys — match API responses
  'Иш юритувда':       'b-unpaid',
  'Кўриб чиқилмоқда':  'b-unpaid',
  'Тугатилган':        'b-paid',
  'Тўхтатилган':       'b-unpaid',
  'Бекор қилинган':    'b-unpaid',
  'Апелляцияда':       'b-unpaid',
  'Кассацияда':        'b-unpaid',
  'Назоратда':         'b-unpaid',
  'Ижро этилмоқда':    'b-paid',
  // Latin keys — match synthetic / Latin API responses
  'Ish yurituvda':       'b-unpaid',
  "Ko'rib chiqilmoqda":  'b-unpaid',
  'Tugatilgan':          'b-paid',
  "To'xtatilgan":        'b-unpaid',
  'Bekor qilingan':      'b-unpaid',
  'Apellyatsiyada':      'b-unpaid',
  'Kassatsiyada':        'b-unpaid',
  'Nazoratda':           'b-unpaid',
  'Ijro etilmoqda':      'b-paid',
}

const HEARING_STATUS_TONES: Record<string, string> = {
  // Cyrillic keys — match API responses
  'Тайинланган':    'b-unpaid',
  'Кечиктирилган':  'b-unpaid',
  'Ўтказилган':     'b-paid',
  'Бекор қилинган': 'b-unpaid',
  'Якунланган':     'b-paid',
  // Latin keys — match synthetic / Latin API responses
  'Tayinlangan':    'b-unpaid',
  'Kechiktirilgan': 'b-unpaid',
  "O'tkazilgan":    'b-paid',
  'Bekor qilingan': 'b-unpaid',
  'Yakunlangan':    'b-paid',
}

function CaseStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge b-neutral">Noma&apos;lum</span>
  const cls = CASE_STATUS_TONES[status] ?? 'b-neutral'
  const label = CASE_STATUSES[status]?.en ?? status
  return <span className={`badge ${cls}`}>{label}</span>
}

function HearingStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const cls = HEARING_STATUS_TONES[status] ?? 'b-neutral'
  const label = HEARING_STATUSES[status]?.en ?? status
  return <span className={`badge ${cls}`}>{label}</span>
}

// ---- Helpers ----------------------------------------------------------

function formatSum(t: number | null | undefined): string {
  const s = (t ?? 0) / 100
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(s)
}
function formatTin(tin: string): string {
  return (tin || '').replace(/(\d{3})(?=\d)/g, '$1 ')
}
function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
function parseCaseDate(s: string | null | undefined): number {
  if (!s) return 0
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime()
  const t = Date.parse(s)
  return Number.isNaN(t) ? 0 : t
}
function instanceLabel(s: string | null | undefined): string {
  if (!s) return ''
  const v = s.toLowerCase()
  if (v === 'first') return 'birinchi instansiya'
  if (v === 'appellate') return 'apellyatsiya'
  if (v === 'cassation') return 'kassatsiya'
  return `${v} instansiya`
}

function computeSummary(bills: EnrichedBill[]) {
  let paid = 0, partial = 0, unpaid = 0, other = 0
  let totalAmount = 0, totalPaid = 0, totalBalance = 0
  for (const b of bills) {
    const st = b.detail?.invoiceStatus ?? b.invoiceStatus
    if (st === 'PAID' || st === 'USED') paid++
    else if (st === 'PARTIALLY_PAID') partial++
    else if (st === 'CREATED') unpaid++
    else other++
    const d = b.detail
    if (d) {
      totalAmount += d.amount ?? 0
      totalPaid += d.paidAmount ?? 0
      totalBalance += d.balance ?? 0
    }
  }
  return {
    paid, partial, unpaid, other,
    totalAmount, totalPaid, totalBalance,
    unpaidTotal: unpaid + partial,
  }
}

/** Count-up animation hook — animates from 0 to target over `duration` ms. */
function useCountUp(target: number, opts: { duration?: number; delay?: number; money?: boolean; divisor?: number } = {}) {
  const { duration = 800, delay = 0, money = false, divisor = 1 } = opts
  const [value, setValue] = useState<number>(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    const start = performance.now() + delay
    function frame(now: number) {
      if (now < start) {
        rafRef.current = requestAnimationFrame(frame)
        return
      }
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(frame)
      else setValue(target)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, duration, delay])
  return money
    ? new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / divisor)
    : String(Math.round(value))
}

// ---- Copy button (small inline icon button) --------------------------

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) return null
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        toast.success(`${label ?? 'Qiymat'} nusxalandi`)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="copy-btn"
      aria-label={`Nusxalash: ${label ?? value}`}
    >
      {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  )
}

// ---- Recent searches --------------------------------------------------

const RECENT_KEY = 'sbl:recent-inns'
const RECENT_MAX = 5

function loadRecent(): { inn: string; lastSearchedAt: string }[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x) => x && typeof x.inn === 'string' && typeof x.lastSearchedAt === 'string')
      .slice(0, RECENT_MAX)
  } catch {
    return []
  }
}
function saveRecent(items: { inn: string; lastSearchedAt: string }[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, RECENT_MAX)))
  } catch { /* ignore */ }
}
function upsertRecent(inn: string) {
  if (typeof window === 'undefined') return
  const items = loadRecent().filter((x) => x.inn !== inn)
  items.unshift({ inn, lastSearchedAt: new Date().toISOString() })
  saveRecent(items.slice(0, RECENT_MAX))
}
function removeRecent(inn: string) {
  saveRecent(loadRecent().filter((x) => x.inn !== inn))
}

// ---- Tor status badge (monochrome) -----------------------------------

function TorStatusBadge({
  status, onInstall, installing,
}: {
  status: 'checking' | 'active' | 'inactive'
  onInstall: () => void
  installing: boolean
}) {
  if (status === 'checking') {
    return (
      <span className="tor-badge">
        <SvgSpinner className="h-4 w-4" />
        <span className="hidden sm:inline">Tor tekshirilmoqda…</span>
        <span className="sm:hidden">Tor…</span>
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="tor-badge" title="Tor proxy is active">
        <span className="dot" />
        Tor faol
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onInstall}
      disabled={installing}
      title="Tor expert bundle (.tar.gz) faylini tanlang va o'rnating"
      className="tor-badge"
      style={{ cursor: installing ? 'wait' : 'pointer' }}
    >
      {installing ? <SvgSpinner className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      <span className="hidden sm:inline">
        {installing ? "Tor o'rnatilmoqda…" : "Tor aniqlanmadi — o'rnatish"}
      </span>
      <span className="sm:hidden">{installing ? "O'rnatilmoqda…" : 'Tor'}</span>
    </button>
  )
}

// ---- Theme toggle (32px, 'mono-theme' localStorage key) --------------

function ThemeToggle() {
  const toggle = () => {
    const html = document.documentElement
    const current = html.getAttribute('data-theme') || 'light'
    const next = current === 'dark' ? 'light' : 'dark'
    html.setAttribute('data-theme', next)
    try { localStorage.setItem('mono-theme', next) } catch { /* ignore */ }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label="Mavzu o'zgartirish"
      title="Mavzu o'zgartirish"
    >
      <Sun className="theme-icon-dark" />
      <Moon className="theme-icon-light" />
    </button>
  )
}

// ---- Filter chips -----------------------------------------------------

type FilterKey = 'paid' | 'unpaid' | 'davlat_boji' | 'pochta'

const FILTER_DEFS: { key: FilterKey; label: string }[] = [
  { key: 'paid',        label: "To'langan"   },
  { key: 'unpaid',      label: "To'lanmagan" },
  { key: 'davlat_boji', label: 'Davlat boji' },
  { key: 'pochta',      label: 'Pochta'      },
]

// ---- Page size + pagination ------------------------------------------

type PageSize = 10 | 20 | 50 | 100

function PageNav({
  page, pageSize, total, onPageChange, label = 'to\'lov',
}: {
  page: number
  pageSize: PageSize
  total: number
  onPageChange: (p: number) => void
  label?: string
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const canPrev = page > 0
  const canNext = page < totalPages - 1
  if (totalPages <= 1) {
    return (
      <div className="pagination">
        <span className="mono tabular" style={{ color: 'var(--text-3)', fontSize: 11 }}>
          {total} ta {label} · {totalPages} sahifa
        </span>
      </div>
    )
  }
  return (
    <div className="pagination">
      <button
        type="button"
        onClick={() => canPrev && onPageChange(page - 1)}
        disabled={!canPrev}
        aria-label="Oldingi sahifa"
        className="page-btn"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      {Array.from({ length: totalPages }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPageChange(i)}
          className={`page-btn ${i === page ? 'is-active' : ''}`}
        >
          {i + 1}
        </button>
      ))}
      <button
        type="button"
        onClick={() => canNext && onPageChange(page + 1)}
        disabled={!canNext}
        aria-label="Keyingi sahifa"
        className="page-btn"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ---- Bill card (monochrome glass) ------------------------------------

function BillCard({
  bill, index, onViewCase,
}: {
  bill: EnrichedBill
  index: number
  onViewCase: (cn: string, courtType?: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const detail = bill.detail
  const effectiveStatus = detail?.invoiceStatus ?? bill.invoiceStatus
  const history = detail?.historyList ?? []
  const usedHistory = history.filter(
    (h) => h.invoiceStatus === 'USED' || h.rolledBackAt || h.caseNumber,
  )
  const hasCaseNumbers = usedHistory.length > 0 || !!detail?.claimCaseNumber
  const spentAmount = history.reduce((sum, h) => sum + (h.amount ?? 0), 0)

  return (
    <article className="panel bill-card panel-hover anim-fade-up">
      <div className="bill-head">
        <div className="bill-idx">
          <span className="idx-num">#{index + 1}</span>
          <div className="bill-title">
            <div className="receipt">
              <Receipt className="w-[18px] h-[18px]" style={{ color: 'var(--text-3)' }} />
              {bill.number}
              <CopyButton value={bill.number} label="Nusxalash" />
            </div>
            {detail?.payer && (
              <div className="company">
                <Building2 className="w-3.5 h-3.5 inline" style={{ color: 'var(--text-3)' }} /> {detail.payer}
              </div>
            )}
          </div>
        </div>
        <div className="badge-row">
          <CourtTypeBadge type={detail?.courtType} />
          <CategoryBadge payCategory={detail?.payCategory} description={detail?.description} />
          <StatusBadge status={effectiveStatus} />
        </div>
      </div>

      {/* Money cells */}
      <div className="money-grid">
        <div className="money-cell">
          <div className="lbl"><Wallet className="w-3 h-3" />Kvitansiya</div>
          <div className="val">{formatSum(detail?.amount)}</div>
          <div className="sub">so&apos;m</div>
        </div>
        <div className="money-cell is-paid">
          <div className="lbl"><CheckCheck className="w-3 h-3" />To&apos;langan</div>
          <div className="val">{formatSum(detail?.paidAmount)}</div>
          <div className="sub">so&apos;m</div>
        </div>
        <div className="money-cell is-unpaid">
          <div className="lbl"><Clock className="w-3 h-3" />To&apos;lanmagan</div>
          <div className="val">{formatSum(detail?.mustPayAmount)}</div>
          <div className="sub">so&apos;m</div>
        </div>
        <div className="money-cell">
          <div className="lbl"><Receipt className="w-3 h-3" />Sarflangan</div>
          <div className="val">{formatSum(spentAmount)}</div>
          <div className="sub">so&apos;m</div>
        </div>
        <div className="money-cell is-accent">
          <div className="lbl"><ArrowLeftRight className="w-3 h-3" />Qoldiq</div>
          <div className="val">{formatSum(detail?.balance)}</div>
          <div className="sub">so&apos;m</div>
        </div>
      </div>

      {/* Court + dates info grid */}
      <div className="info-grid">
        <div className="info-row">
          <p className="lbl"><Building2 className="w-3 h-3" />Sud</p>
          <p className="val">{detail?.court || '—'}</p>
        </div>
        <div className="info-row">
          <p className="lbl"><CalendarDays className="w-3 h-3" />Berilgan sana</p>
          <p className="val mono">{formatDate(detail?.issued ?? bill.issued)}</p>
        </div>
        <div className="info-row">
          <p className="lbl"><Award className="w-3 h-3" />Amal qilish muddati</p>
          <p className="val mono">{formatDate(detail?.overdue)}</p>
        </div>
      </div>

      {/* Purpose + description */}
      {(detail?.purpose || detail?.description || detail?.payCategory) && (
        <div className="info-grid" style={{ marginBottom: 12 }}>
          <div className="info-row" style={{ gridColumn: '1 / -1' }}>
            <p className="lbl"><FileText className="w-3 h-3" />Maqsad</p>
            <p className="val">
              {detail?.purpose || '—'}
              {detail?.description && (
                <span style={{ color: 'var(--text-3)' }}> · {detail.description}{detail.payCategory ? ` (${detail.payCategory})` : ''}</span>
              )}
            </p>
          </div>
        </div>
      )}

      {bill.error && (
        <div className="decision-bar">
          <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
          <div className="decision-text">
            <p className="t1">Tafsilot mavjud emas</p>
            <p className="t2">{bill.error}</p>
          </div>
        </div>
      )}

      {/* Expand: case numbers / court usage */}
      {hasCaseNumbers && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={`expand-btn ${expanded ? 'is-open' : ''}`}
            aria-expanded={expanded}
          >
            <span>
              {expanded ? 'Yashirish' : `Sud tomonidan ishlatilishi (${usedHistory.length})`}
            </span>
            <ChevronDown className="w-4 h-4" />
          </button>

          {expanded && (
            <div className="expand-content is-open">
              <div className="expand-inner">
                {detail?.claimCaseNumber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>№ Da'vo ish raqami:</span>
                    <span className="mono" style={{ fontWeight: 700 }}>{detail.claimCaseNumber}</span>
                    <CopyButton value={detail.claimCaseNumber} label="Nusxalash" />
                    <button
                      type="button"
                      className="korish-btn"
                      onClick={() => onViewCase(detail.claimCaseNumber!, detail.courtType || undefined)}
                    >
                      <Eye className="w-3.5 h-3.5" /> Ko&apos;rish
                    </button>
                  </div>
                )}
                <table className="usage-table">
                  <thead>
                    <tr>
                      <th>Ish / ariza raqami</th>
                      <th>Holati</th>
                      <th style={{ textAlign: 'right' }}>Summasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usedHistory.map((h, i) => (
                      <tr key={i}>
                        <td className="col-num">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--text-3)' }}>№</span>
                            {h.caseNumber || (h.caseId ? `#${h.caseId}` : '—')}
                            {h.caseNumber && <CopyButton value={h.caseNumber} label="Nusxalash" />}
                            {h.caseNumber && (
                              <button
                                type="button"
                                className="korish-btn"
                                onClick={() => onViewCase(h.caseNumber!, h.courtType || undefined)}
                              >
                                <Eye className="w-3.5 h-3.5" /> Ko&apos;rish
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          {h.rolledBackAt ? (
                            <span className="badge b-unpaid">Qaytarilgan</span>
                          ) : (
                            <span className="badge b-paid">Ishlatilgan</span>
                          )}
                        </td>
                        <td className="col-amt">
                          {formatSum(h.amount)}
                          <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 4 }}>so&apos;m</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </article>
  )
}

// ---- Summary cards with count-up animation (monochrome) --------------

function SummaryCard({
  label, value, sub, Icon, big, tone, money, divisor, idx,
}: {
  label: string
  value: number
  sub?: string
  Icon: LucideIcon
  big?: boolean
  tone?: 'paid' | 'unpaid' | 'accent' | 'red'
  money?: boolean
  divisor?: number
  idx: number
}) {
  const display = useCountUp(value, {
    duration: 800,
    delay: 100 + idx * 50,
    money: !!money,
    divisor: divisor ?? 1,
  })
  const cellCls = tone === 'paid' || tone === 'accent' ? 'summary-cell paid' : tone === 'unpaid' || tone === 'red' ? 'summary-cell unpaid' : 'summary-cell'
  return (
    <div className={`${cellCls} anim-fade-up`} style={{ animationDelay: `${idx * 0.05}s` }}>
      <div className="lbl" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{label}</span>
        <Icon style={{ width: 12, height: 12, opacity: 0.6 }} />
      </div>
      <div className="val" style={money ? { fontSize: 14 } : undefined}>{display}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 4, fontFamily: 'var(--font-jetbrains), monospace' }}>{sub}</div>}
    </div>
  )
}

function SummaryCards({ bills }: { bills: EnrichedBill[] }) {
  const s = useMemo(() => computeSummary(bills), [bills])
  const cards: {
    label: string; value: number; Icon: LucideIcon;
    big?: boolean; tone?: 'paid' | 'unpaid' | 'accent' | 'red';
    money?: boolean; divisor?: number; sub?: string;
  }[] = [
    { label: "Jami",         value: bills.length,    Icon: Receipt,    big: true },
    { label: "To'langan",    value: s.paid,          Icon: CheckCheck, big: true, tone: 'paid' },
    { label: "To'lanmagan",  value: s.unpaidTotal,   Icon: Clock,      big: true, tone: 'unpaid' },
    { label: 'Jami summa',   value: s.totalAmount,   Icon: Wallet,     money: true, divisor: 100, sub: "so'm" },
    { label: "To'langan",    value: s.totalPaid,     Icon: CheckCheck, money: true, divisor: 100, sub: "so'm", tone: 'paid' },
    { label: 'Qarzdorlik',   value: s.totalBalance,  Icon: AlertCircle, money: true, divisor: 100, sub: "so'm", tone: 'unpaid' },
  ]
  return (
    <div className="summary-grid is-split">
      {cards.map((c, i) => (
        <SummaryCard key={`${c.label}-${i}`} {...c} idx={i} />
      ))}
    </div>
  )
}

// ---- Bills loading state (monochrome glass) --------------------------

const PHASE_STEPS: { keys: string[]; label: string; Icon: LucideIcon }[] = [
  { keys: ['connecting'], label: 'Ulanmoqda', Icon: Link2 },
  { keys: ['captcha_pow', 'captcha_analyze', 'captcha_math'], label: 'Kirish', Icon: ShieldCheck },
  { keys: ['searching'], label: 'Qidirilmoqda', Icon: Search },
  { keys: ['enriching'], label: 'Tafsilotlar', Icon: Receipt },
]

function BillsLoadingState({
  inn, loaded, total, elapsed, phase,
}: {
  inn: string
  loaded: number
  total: number
  elapsed: number
  phase: { phase: string; detail?: string } | null
}) {
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0
  const currentStepIndex = phase
    ? PHASE_STEPS.findIndex((s) => s.keys.includes(phase.phase))
    : -1
  return (
    <div className="glass loading-box">
      <div className="loading-head">
        <SvgSpinner />
        <div>
          <div className="loading-title">
            {total > 0
              ? `STIR ${formatTin(inn)} uchun to'lovlar import qilinmoqda…`
              : `STIR ${formatTin(inn)} qidirilmoqda…`}
          </div>
          <div className="loading-sub">
            {phase?.detail ??
              (total > 0
                ? 'Har bir kvitansiya uchun batafsil holat billing.sud.uz saytidan olinmoqda.'
                : "billing.sud.uz saytida Yuridik shaxs bo'limi ochilmoqda.")}
          </div>
          <div className="loading-sub mono" style={{ marginTop: 4 }}>
            {elapsed}s o&apos;tdi
          </div>
        </div>
      </div>

      {/* 4-step phase timeline */}
      {total === 0 && phase && currentStepIndex >= 0 && (
        <div className="phase-row">
          {PHASE_STEPS.map((step, i) => {
            const isDone = currentStepIndex > i
            const isCurrent = currentStepIndex === i
            return (
              <div key={step.label} className={`phase-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
                {isDone ? (
                  <CheckCheck className="w-3 h-3" />
                ) : isCurrent ? (
                  <step.Icon className="w-3 h-3" />
                ) : (
                  <step.Icon className="w-3 h-3" style={{ opacity: 0.4 }} />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Progress bar (once bills stream) */}
      {total > 0 && (
        <div>
          <div className="progress-label">
            <span>{loaded} / {total} ta to&apos;lov yuklandi</span>
            <span>{pct}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="skeleton-grid">
          <div className="skel-card shimmer" style={{ height: 120 }} />
          <div className="skel-card shimmer" style={{ height: 120 }} />
          <div className="skel-card shimmer" style={{ height: 120 }} />
        </div>
      )}
    </div>
  )
}

// ---- Feature cards (monochrome — all use accent) ---------------------

const FEATURE_CARDS: {
  Icon: LucideIcon
  title: string
  desc: string
  tone: 'accent' | 'emerald' | 'indigo' | 'violet' | 'sky'
}[] = [
  {
    Icon: Receipt,
    title: 'Barcha kvitansiyalarni import',
    desc: "STIR bo'yicha yaratilgan har bir to'lov billing.sud.uz saytidan olinadi.",
    tone: 'accent',
  },
  {
    Icon: CheckCheck,
    title: 'Turi va holatini ko\'rish',
    desc: "Har bir to'lov davlat boji yoki pochta sifatida belgilanadi.",
    tone: 'accent',
  },
  {
    Icon: FolderOpen,
    title: 'Sud ish raqamlari',
    desc: 'Har bir kvitansiya uchun uni ishlatgan sud hamda ish raqami ko\'rsatiladi.',
    tone: 'accent',
  },
  {
    Icon: ShieldCheck,
    title: 'Maxfiy tarzda qidiriladi',
    desc: "So'rov Tor orqali amalga oshiriladi — qidiruvni qurilmangizga bog'lab bo'lmaydi.",
    tone: 'accent',
  },
]

function FeatureCard({ Icon, title, desc, idx }: { Icon: LucideIcon; title: string; desc: string; tone?: string; idx: number }) {
  return (
    <div className="quick-tile anim-fade-up" style={{ animationDelay: `${idx * 0.06}s` }}>
      <Icon style={{ color: 'var(--accent)' }} />
      <p className="lbl">{title}</p>
      <p className="action-card-desc">{desc}</p>
    </div>
  )
}

// ---- Court case loading state ----------------------------------------

const COURT_PHASE_STEPS: { label: string; Icon: LucideIcon }[] = [
  { label: 'Ulanmoqda', Icon: Link2 },
  { label: 'Kirish', Icon: ShieldCheck },
  { label: 'Qidirilmoqda', Icon: Search },
]

function CourtLoadingState({ value, elapsed }: { value: string; elapsed: number }) {
  const currentStepIndex = Math.min(
    COURT_PHASE_STEPS.length - 1,
    elapsed < 2 ? 0 : elapsed < 5 ? 1 : 2,
  )
  return (
    <div className="glass loading-box">
      <div className="loading-head">
        <SvgSpinner />
        <div>
          <div className="loading-title">
            &ldquo;{value}&rdquo; bo&apos;yicha sud ishlari qidirilmoqda…
          </div>
          <div className="loading-sub">
            my.sud.uz ochilmoqda, captcha yechilmoqda va so&apos;rov yuborilmoqda.
          </div>
          <div className="loading-sub mono" style={{ marginTop: 4 }}>{elapsed}s o&apos;tdi</div>
        </div>
      </div>
      <div className="phase-row">
        {COURT_PHASE_STEPS.map((step, i) => {
          const isDone = currentStepIndex > i
          const isCurrent = currentStepIndex === i
          return (
            <div key={step.label} className={`phase-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}>
              {isDone ? (
                <CheckCheck className="w-3 h-3" />
              ) : isCurrent ? (
                <step.Icon className="w-3 h-3" />
              ) : (
                <step.Icon className="w-3 h-3" style={{ opacity: 0.4 }} />
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Case detail view (definition list) -------------------------------

function InfoRow({
  label, value, mono, Icon, hideIfEmpty,
}: {
  label: string
  value: string | null | undefined
  mono?: boolean
  Icon?: LucideIcon
  hideIfEmpty?: boolean
}) {
  if (hideIfEmpty && (!value || value === '—')) return null
  return (
    <>
      <dt>
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </dt>
      <dd className={mono ? 'mono' : ''}>
        {value || '—'}
      </dd>
    </>
  )
}

function InstanceView({ title, data }: { title: string; data: InstanceData }) {
  const hearings = data.hearings ?? []
  const documents = data.documents ?? []
  const hearingCount = hearings.length
  const docCount = documents.length
  const hasAppellateMeta =
    !!(data.appellant || data.appellateCourt || data.appealFiledDate || data.appellateOutcome)
  const isEmpty =
    hearingCount === 0 && !data.decision && docCount === 0 && !hasAppellateMeta

  if (isEmpty) return null

  return (
    <div className="detail-section">
      <p className="detail-section-title">
        <FolderOpen className="w-3.5 h-3.5" />
        {title}
        <span style={{ color: 'var(--text-3)', fontWeight: 500, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
          · {hearingCount} ta majlis{docCount > 0 ? `, ${docCount} ta hujjat` : ''}
        </span>
      </p>

      {/* Appellate-specific metadata */}
      {hasAppellateMeta && (
        <div className="decision-bar">
          <div className="decision-icon"><Info className="w-4 h-4" /></div>
          <div className="decision-text">
            {data.appellant && (
              <p className="t2"><span style={{ color: 'var(--text-3)' }}>Apellyatsiya beruvchi: </span><span className="t1" style={{ fontSize: 12 }}>{data.appellant}</span></p>
            )}
            {data.appealFiledDate && (
              <p className="t2"><span style={{ color: 'var(--text-3)' }}>Berilgan sana: </span>{data.appealFiledDate}</p>
            )}
            {data.appellateCourt && (
              <p className="t2"><span style={{ color: 'var(--text-3)' }}>Apellyatsiya sudi: </span>{data.appellateCourt}</p>
            )}
            {data.appellateOutcome && (
              <p className="t2"><span style={{ color: 'var(--text-3)' }}>Natija: </span>{data.appellateOutcome}</p>
            )}
          </div>
        </div>
      )}

      {/* Hearings timeline */}
      {hearingCount > 0 && (
        <div className="hearing-timeline">
          {hearings.map((h, i) => (
            <div key={i} className="hearing-item">
              <div className="hearing-dot" />
              <div className="hearing-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span className="when">
                    {h.date}{h.time ? ` · ${h.time}` : ''}
                  </span>
                  <HearingStatusBadge status={h.status} />
                </div>
                {h.courtroom && (
                  <span className="where">Sud zali: {h.courtroom}</span>
                )}
                {h.judge && (
                  <span className="where">Sudya: {h.judge}</span>
                )}
                {h.postponementReason && (
                  <span className="where">Kechiktirildi: {h.postponementReason}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Decision bar */}
      {data.decision && (
        <div className="decision-bar">
          <div className="decision-icon"><Award className="w-4 h-4" /></div>
          <div className="decision-text">
            <p className="t1">Qaror: {data.decision.type || '—'}</p>
            {data.decision.date && (
              <p className="t2">
                Sana: {data.decision.date}
                {data.decision.enforcedDate && data.decision.enforcedDate !== '—' ? ` · Ijro: ${data.decision.enforcedDate}` : ''}
              </p>
            )}
            {data.decision.text && (
              <p className="t2" style={{ marginTop: 6 }}>{data.decision.text}</p>
            )}
            {data.decision.awardedAmount && data.decision.awardedAmount !== '—' && (
              <p className="t2">
                Undirilgan summa: <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>{data.decision.awardedAmount}</span>
              </p>
            )}
            {data.decision.stateDutyRecovered && data.decision.stateDutyRecovered !== '—' && (
              <p className="t2">Qaytarilgan davlat boji: <span className="mono">{data.decision.stateDutyRecovered}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Documents list */}
      {docCount > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="detail-section-title" style={{ fontSize: 10 }}>
            <FileText className="w-3 h-3" />
            Hujjatlar ({docCount})
          </p>
          {documents.map((d, i) => (
            <a
              key={i}
              href={d.fileUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!d.fileUrl) e.preventDefault() }}
              className="info-row"
              style={{ textDecoration: 'none', flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <ExternalLink className="w-3.5 h-3.5" style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-1)', fontSize: 13 }}>{d.name}</span>
              {d.date && (
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{d.date}</span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function CaseDetailView({
  caseNumber, courtType,
}: {
  caseNumber: string
  courtType: CourtType
}) {
  const [data, setData] = useState<FullCaseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [plaintiffTin, setPlaintiffTin] = useState<string | null>(null)
  const [defendantTin, setDefendantTin] = useState<string | null>(null)
  const [tinLoading, setTinLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timer = setInterval(() => {
      if (!cancelled) setElapsed((e) => e + 1)
    }, 1000)
    fetch(`/api/court-cases?courtType=${courtType}&detail=${encodeURIComponent(caseNumber)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.ok) {
          setData(d)
          const g = d.general
          if (g) {
            setTinLoading(true)
            if (g.plaintiff && g.plaintiff !== '—') {
              fetch(`/api/company?name=${encodeURIComponent(g.plaintiff)}&tinOnly=true`)
                .then((r) => r.json())
                .then((res) => {
                  if (!cancelled && res.ok && res.company?.tin) setPlaintiffTin(res.company.tin)
                })
                .catch(() => {})
            }
            if (g.defendant && g.defendant !== '—') {
              fetch(`/api/company?name=${encodeURIComponent(g.defendant)}&tinOnly=true`)
                .then((r) => r.json())
                .then((res) => {
                  if (!cancelled && res.ok && res.company?.tin) setDefendantTin(res.company.tin)
                })
                .catch(() => {})
                .finally(() => { if (!cancelled) setTinLoading(false) })
            }
          }
        } else {
          setError(d.error || "Ish tafsilotlarini olib bo'lmadi")
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Network error')
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          clearInterval(timer)
        }
      })
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [caseNumber, courtType])

  if (loading) {
    return (
      <div className="panel" style={{ padding: 16 }}>
        <div className="loading-head" style={{ marginBottom: 0 }}>
          <SvgSpinner />
          <div>
            <div className="loading-title" style={{ fontSize: 13 }}>Ish tafsilotlari yuklanmoqda…</div>
            <div className="loading-sub mono">{elapsed}s o&apos;tdi</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="decision-bar">
        <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
        <div className="decision-text">
          <p className="t1">Ish tafsilotlarini yuklab bo&apos;lmadi</p>
          <p className="t2">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null
  const g = data.general

  // ---- High-res PDF export (browser print engine) -----------------------
  // Opens a new window with a print-optimised HTML view of the full case
  // (general info + first instance + appellate + cassation). The user then
  // picks "Save as PDF" in the browser print dialog — this gives the highest
  // resolution output (vector text, no canvas rasterisation) with zero
  // client-side PDF libraries (no jspdf / html2canvas / puppeteer needed).
  const handlePrintPDF = () => {
    if (!data) return
    const esc = (s: string | null | undefined) =>
      (s == null ? '' : String(s))
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    const val = (s: string | null | undefined) =>
      s && s !== '—' ? s : ''
    const statusLabel = (s: string | null | undefined) => {
      if (!s) return ''
      return CASE_STATUSES[s]?.en ?? s
    }
    const hearingLabel = (s: string | null | undefined) => {
      if (!s) return ''
      return HEARING_STATUSES[s]?.en ?? s
    }
    const row = (label: string, value: string | null | undefined, mono = false) => {
      const v = val(value)
      if (!v) return ''
      return `<div class="info-row"><span class="lbl">${esc(label)}</span><div class="val${mono ? ' mono' : ''}">${esc(v)}</div></div>`
    }

    const renderInstance = (title: string, inst: InstanceData | null): string => {
      if (!inst) return ''
      const hearings = inst.hearings ?? []
      const decision = inst.decision
      const hasMeta = !!(inst.appellant || inst.appealFiledDate || inst.appellateCourt || inst.appellateOutcome)
      if (hearings.length === 0 && !decision && !hasMeta) return ''

      let html = `<h2>${esc(title)}</h2>`

      if (hasMeta) {
        html += '<div class="meta-block">'
        if (inst.appellant) html += `<div><span class="lbl">Apellyatsiya beruvchi</span><div class="val">${esc(inst.appellant)}</div></div>`
        if (inst.appealFiledDate) html += `<div><span class="lbl">Berilgan sana</span><div class="val mono">${esc(inst.appealFiledDate)}</div></div>`
        if (inst.appellateCourt) html += `<div><span class="lbl">Apellyatsiya sudi</span><div class="val">${esc(inst.appellateCourt)}</div></div>`
        if (inst.appellateOutcome) html += `<div><span class="lbl">Natija</span><div class="val">${esc(inst.appellateOutcome)}</div></div>`
        html += '</div>'
      }

      if (hearings.length > 0) {
        html += `<h3>Majlislar tarixi (${hearings.length})</h3><div class="timeline">`
        for (const h of hearings) {
          html += `<div class="ti">
            <div class="when">${esc(h.date)}${h.time && h.time !== '—' ? ' · ' + esc(h.time) : ''}</div>
            <div class="status">${esc(hearingLabel(h.status))}</div>
            ${h.courtroom && h.courtroom !== '—' ? `<div class="meta">Sud zali: ${esc(h.courtroom)}</div>` : ''}
            ${h.judge && h.judge !== '—' ? `<div class="meta">Sudya: ${esc(h.judge)}</div>` : ''}
            ${h.postponementReason ? `<div class="meta">Kechiktirildi: ${esc(h.postponementReason)}</div>` : ''}
          </div>`
        }
        html += '</div>'
      }

      if (decision) {
        html += '<div class="decision">'
        html += `<div class="decision-title">Qaror: ${esc(decision.type || '—')}</div>`
        if (decision.date) {
          let dateLine = `Sana: ${esc(decision.date)}`
          if (decision.enforcedDate && decision.enforcedDate !== '—') dateLine += ` · Ijro: ${esc(decision.enforcedDate)}`
          html += `<div class="meta">${dateLine}</div>`
        }
        if (decision.text && decision.text !== '—') {
          html += `<div class="decision-text">${esc(decision.text)}</div>`
        }
        if (decision.awardedAmount && decision.awardedAmount !== '—') {
          html += `<div class="meta">Undirilgan summa: <strong class="mono">${esc(decision.awardedAmount)}</strong></div>`
        }
        if (decision.stateDutyRecovered && decision.stateDutyRecovered !== '—') {
          html += `<div class="meta">Qaytarilgan davlat boji: <span class="mono">${esc(decision.stateDutyRecovered)}</span></div>`
        }
        if (decision.appealDeadline && decision.appealDeadline !== '—') {
          html += `<div class="meta">Apellyatsiya muddati: <span class="mono">${esc(decision.appealDeadline)}</span></div>`
        }
        html += '</div>'
      }

      return html
    }

    const generalRows = [
      row('Sud', g?.court),
      row('Ish raqami', g?.caseNumber, true),
      row('Ish turi', g?.caseType),
      row('Ish holati', statusLabel(g?.caseStatus)),
      row('Sudya', g?.judge),
      row('Kotib', g?.secretary),
      row("Da'vogar", g?.plaintiff),
      row("Da'vogar STIR", plaintiffTin || (g?.plaintiffTin && g.plaintiffTin !== '—' ? g.plaintiffTin : ''), true),
      row('Javobgar', g?.defendant),
      row('Javobgar STIR', defendantTin || (g?.defendantTin && g.defendantTin !== '—' ? g.defendantTin : ''), true),
      row("Da'vo predmeti", g?.claimSubject),
      row("Da'vo summasi", g?.claimAmount, true),
      row('Davlat boji', g?.stateDuty, true),
      row('Uchinchi shaxs', g?.thirdParty),
      row('Vakil', g?.representative),
      row('Prokuror', g?.prosecutor),
      row('Ariza berilgan sana', g?.applicationDate, true),
      row('Boshlangan sana', g?.initiatedDate, true),
      row('Muddat sanasi', g?.deadlineDate, true),
    ].join('')

    const now = new Date().toLocaleString('uz-UZ', {
      dateStyle: 'long',
      timeStyle: 'short',
    })

    const html = `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(g?.caseNumber || 'Ish')} — Sud Billing Lookup</title>
<style>
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    padding: 40px;
    color: #111;
    max-width: 900px;
    margin: 0 auto;
    line-height: 1.5;
    font-size: 13px;
  }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 28px 0 12px; border-bottom: 2px solid #111; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  h3 { font-size: 11px; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; color: #444; }
  .subtitle { color: #555; font-size: 12px; margin-bottom: 20px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #ddd; border: 1px solid #ddd; }
  .info-row { background: #fff; padding: 8px 10px; }
  .lbl { font-size: 8px; text-transform: uppercase; color: #666; font-weight: 700; letter-spacing: 0.6px; display: block; margin-bottom: 2px; }
  .val { font-size: 12px; font-weight: 500; word-break: break-word; }
  .mono { font-family: 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; }
  .timeline { margin: 8px 0; }
  .ti { padding: 8px 12px; border-left: 3px solid #111; margin-bottom: 6px; background: #f7f7f7; }
  .when { font-weight: 700; font-size: 12px; margin-bottom: 2px; }
  .status { font-size: 11px; color: #444; margin-bottom: 2px; font-weight: 600; }
  .meta { font-size: 11px; color: #555; }
  .decision { padding: 12px 14px; background: #f0f0f0; border-left: 3px solid #111; margin: 12px 0; }
  .decision-title { font-weight: 700; font-size: 12px; margin-bottom: 4px; }
  .decision-text { font-size: 11px; margin-top: 6px; }
  .meta-block { padding: 10px 12px; background: #f7f7f7; margin: 8px 0; border: 1px solid #e5e5e5; }
  .meta-block div { margin: 4px 0; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #888; text-align: center; }
  .print-btn {
    position: fixed; top: 16px; right: 16px;
    padding: 10px 18px; background: #111; color: #fff;
    border: none; cursor: pointer; font-size: 13px; font-weight: 600;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .print-btn:hover { background: #333; }
  @media print {
    body { padding: 0; max-width: none; font-size: 11px; }
    .no-print { display: none !important; }
    h2 { page-break-after: avoid; }
    .ti, .decision { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">PDF sifatida saqlash</button>
  <h1>${esc(g?.caseNumber || 'Ish')}</h1>
  <div class="subtitle">${esc(g?.court || '—')}${g?.caseStatus ? ' · ' + esc(statusLabel(g.caseStatus)) : ''}</div>
  ${generalRows ? `<h2>Umumiy ma'lumotlar</h2><div class="info-grid">${generalRows}</div>` : ''}
  ${renderInstance('Birinchi instansiya', data.firstInstance)}
  ${renderInstance('Apellyatsiya', data.appellate)}
  ${renderInstance('Kassatsiya', data.cassation)}
  <div class="footer">
    Sud Billing Lookup tomonidan yaratilgan · ${esc(now)} · ${esc(g?.caseNumber || '')}
  </div>
  <script>
    // Auto-trigger the print dialog once the document is fully rendered.
    // A short delay ensures fonts/styles are applied before printing.
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 400);
    });
  </script>
</body>
</html>`

    const printWindow = window.open('', '_blank', 'width=1000,height=720')
    if (!printWindow) {
      toast.error("PDF oynasini ochib bo'lmadi — brauzer pop-up'larni bloklamoqda")
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="detail-panel">
      {/* PDF / print export toolbar */}
      <div className="detail-toolbar">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handlePrintPDF}
          aria-label="Ish tafsilotlarini PDF sifatida yuklab olish"
          title="PDF sifatida saqlash"
        >
          <FileText className="w-3 h-3" />
          <span>PDF</span>
        </button>
      </div>
      {/* General info — definition list panel */}
      <div className="detail-section">
        <p className="detail-section-title">
          <FileText className="w-3.5 h-3.5" />
          Umumiy ma&apos;lumotlar
        </p>
        <dl className="detail-grid">
          <InfoRow label="Sud" value={g?.court} Icon={Building2} />
          <InfoRow label="Ish raqami" value={g?.caseNumber} mono Icon={FolderOpen} />
          <InfoRow label="Ish turi" value={g?.caseType} Icon={FileText} />
          <InfoRow
            label="Ish holati"
            value={g?.caseStatus ? CASE_STATUSES[g.caseStatus]?.en ?? g.caseStatus : null}
            Icon={Award}
          />
          <InfoRow label="Sudya" value={g?.judge} Icon={Gavel} />
          <InfoRow label="Da'vo predmeti" value={g?.claimSubject} Icon={FileText} />
          <InfoRow label="Kotib" value={g?.secretary} Icon={Gavel} hideIfEmpty />
          <InfoRow label="Da'vogar" value={g?.plaintiff} Icon={Building2} />
          <InfoRow
            label="Da'vogar STIR"
            value={
              plaintiffTin
                ? plaintiffTin
                : tinLoading
                  ? 'Qidirilmoqda...'
                  : g?.plaintiffTin && g.plaintiffTin !== '—'
                    ? g.plaintiffTin
                    : null
            }
            mono
            Icon={Building2}
          />
          <InfoRow label="Javobgar" value={g?.defendant} Icon={Building2} />
          <InfoRow
            label="Javobgar STIR"
            value={
              defendantTin
                ? defendantTin
                : tinLoading
                  ? 'Qidirilmoqda...'
                  : g?.defendantTin && g.defendantTin !== '—'
                    ? g.defendantTin
                    : null
            }
            mono
            Icon={Building2}
          />
          <InfoRow label="Uchinchi shaxs" value={g?.thirdParty} Icon={Users} hideIfEmpty />
          <InfoRow label="Vakil" value={g?.representative} Icon={Users} hideIfEmpty />
          <InfoRow label="Prokuror" value={g?.prosecutor} Icon={Users} hideIfEmpty />
          <InfoRow label="Da'vo summasi" value={g?.claimAmount} mono Icon={Wallet} hideIfEmpty />
          <InfoRow label="Davlat boji" value={g?.stateDuty} mono Icon={Wallet} hideIfEmpty />
          <InfoRow label="Ariza berilgan sana" value={g?.applicationDate} mono Icon={CalendarDays} />
          <InfoRow label="Muddat sanasi" value={g?.deadlineDate} mono Icon={CalendarDays} hideIfEmpty />
        </dl>
      </div>

      {data.firstInstance && (
        <InstanceView title="Birinchi instansiya" data={data.firstInstance} />
      )}
      {data.appellate && (
        <InstanceView title="Apellyatsiya" data={data.appellate} />
      )}
      {data.cassation && (
        <InstanceView title="Kassatsiya" data={data.cassation} />
      )}
    </div>
  )
}

// ---- Court case card (monochrome glass) ------------------------------

function CourtCaseCard({
  caseData, courtType, index, expanded, onToggle,
}: {
  caseData: CourtCase
  courtType: CourtType
  index: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <article className="panel case-card panel-hover anim-fade-up">
      <div className="bill-head">
        <div className="bill-idx">
          <span className="idx-num">#{index + 1}</span>
          <div className="bill-title">
            <div className="receipt">
              <FolderOpen className="w-[18px] h-[18px]" style={{ color: 'var(--text-3)' }} />
              {caseData.caseNumber}
              <CopyButton value={caseData.caseNumber} label="Nusxalash" />
            </div>
            {caseData.caseType && (
              <div className="company">
                <FileText className="w-3.5 h-3.5 inline" style={{ color: 'var(--text-3)' }} /> {caseData.caseType}
              </div>
            )}
          </div>
        </div>
        <div className="badge-row">
          <CaseStatusBadge status={caseData.caseStatus} />
        </div>
      </div>

      <div className="info-grid">
        <div className="info-row">
          <p className="lbl"><Building2 className="w-3 h-3" />Sud</p>
          <p className="val">{caseData.courtName || '—'}</p>
        </div>
        <div className="info-row">
          <p className="lbl"><CalendarDays className="w-3 h-3" />Ariza berilgan sana</p>
          <p className="val mono">{caseData.dateFiled || '—'}</p>
        </div>
        <div className="info-row">
          <p className="lbl"><Building2 className="w-3 h-3" />Da&apos;vogar</p>
          <p className="val">{caseData.plaintiff || '—'}</p>
        </div>
        <div className="info-row">
          <p className="lbl"><Building2 className="w-3 h-3" />Javobgar</p>
          <p className="val">{caseData.defendant || '—'}</p>
        </div>
      </div>

      {caseData.result && caseData.result !== '—' && (
        <div className="decision-bar" style={{ marginTop: 20 }}>
          <div className="decision-icon"><Award className="w-4 h-4" /></div>
          <div className="decision-text">
            <p className="t1">Natija: <span className="accent">{caseData.result}</span></p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className={`expand-btn ${expanded ? 'is-open' : ''}`}
        style={{ marginTop: 24 }}
        aria-expanded={expanded}
      >
        <span>
          {expanded ? 'Tafsilotlarni yashirish' : "Tafsilotlarni ko'rish"}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {expanded && (
        <div className="expand-content is-open">
          <div className="expand-inner">
            <CaseDetailView
              key={`${courtType}:${caseData.caseNumber}`}
              caseNumber={caseData.caseNumber}
              courtType={courtType}
            />
          </div>
        </div>
      )}
    </article>
  )
}

// ---- Court cases feature cards (default state) -----------------------

const COURT_FEATURE_CARDS: {
  Icon: LucideIcon
  title: string
  desc: string
  tone: 'accent' | 'emerald' | 'indigo' | 'violet' | 'sky'
}[] = [
  {
    Icon: FolderOpen,
    title: 'STIR / PINFL bo\'yicha',
    desc: "Iqtisodiy va fuqarolik sudlarida kompaniya yoki jismoniy shaxs bilan bog'liq barcha ishlar.",
    tone: 'accent',
  },
  {
    Icon: Search,
    title: 'Ish raqami bo\'yicha',
    desc: "Muayyan ishni raqami bo'yicha qidirib, to'liq tafsilotlarni ko'ring.",
    tone: 'accent',
  },
  {
    Icon: CalendarDays,
    title: 'Sud majlislari jadvali',
    desc: "Belgilangan, kechiktirilgan va o'tkazilgan majlislarni har bir instansiya uchun ko'ring.",
    tone: 'accent',
  },
  {
    Icon: FileText,
    title: 'Qarorlar va hujjatlar',
    desc: 'Qaror matni, undirilgan summa, davlat boji va ish hujjatlarini yuklab oling.',
    tone: 'accent',
  },
]

// ---- Saved companies (localStorage) ----------------------------------

interface SavedCompany {
  tin: string
  name: string
  savedAt: number
}

const SAVED_COMPANIES_KEY = 'sud-saved-companies'

function loadSavedCompanies(): SavedCompany[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(SAVED_COMPANIES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveCompany(company: SavedCompany) {
  const list = loadSavedCompanies()
  if (!list.find((c) => c.tin === company.tin)) {
    list.unshift(company)
    localStorage.setItem(SAVED_COMPANIES_KEY, JSON.stringify(list))
  }
}

function removeSavedCompanyFn(tin: string) {
  const list = loadSavedCompanies().filter((c) => c.tin !== tin)
  localStorage.setItem(SAVED_COMPANIES_KEY, JSON.stringify(list))
}

// ---- Upcoming Hearings tab ------------------------------------------

interface UpcomingHearing {
  caseNumber: string
  caseType: string
  caseStatus: string
  result: string
  courtName: string
  plaintiff: string
  defendant: string
  hearingDate: string
  hearingTime: string
  judge: string
  courtType: string
  courtTypeLabel: string
  isoDate: string
}

function UpcomingHearingsTab({ onViewCase }: { onViewCase: (cn: string, courtType?: string) => void }) {
  const [savedCompanies, setSavedCompanies] = useState<SavedCompany[]>([])
  const [selectedTin, setSelectedTin] = useState<string | null>(null)
  const [hearings, setHearings] = useState<UpcomingHearing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [addTin, setAddTin] = useState('')
  const [addName, setAddName] = useState('')

  useEffect(() => {
    setSavedCompanies(loadSavedCompanies())
  }, [])

  const fetchHearings = useCallback(async (tin: string) => {
    // 5-min client cache — saved-companies list is re-clicked often; the
    // upcoming-hearings API hits 3 court types in parallel (~3-6s).
    const cacheK = cacheKey.upcoming(tin)
    const cached = getCached<UpcomingHearing[]>(cacheK)
    if (cached) {
      setHearings(cached)
      setSelectedTin(tin)
      toast.success("Majlislar keshdan yuklandi")
      return
    }
    setLoading(true)
    setError(null)
    setElapsed(0)
    setHearings([])
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000)
    try {
      const res = await fetch(`/api/upcoming-hearings?tin=${tin}`)
      const data = await res.json()
      if (data.ok) {
        setHearings(data.hearings)
        if (data.hearings.length > 0) setCached(cacheK, data.hearings as UpcomingHearing[])
      } else {
        setError(data.error || "Majlislarni olib bo'lmadi")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setLoading(false)
      clearInterval(timer)
    }
  }, [])

  const handleAddCompany = () => {
    const tin = addTin.replace(/\D/g, '').slice(0, 9)
    if (tin.length !== 9) {
      toast.error("STIR aynan 9 ta raqamdan iborat bo'lishi kerak")
      return
    }
    const name = addName.trim() || `STIR ${formatTin(tin)}`
    saveCompany({ tin, name, savedAt: Date.now() })
    setSavedCompanies(loadSavedCompanies())
    setAddTin('')
    setAddName('')
  }

  const handleRemoveCompany = (tin: string) => {
    removeSavedCompanyFn(tin)
    setSavedCompanies(loadSavedCompanies())
    if (selectedTin === tin) {
      setSelectedTin(null)
      setHearings([])
    }
  }

  const handleSelectCompany = (tin: string) => {
    setSelectedTin(tin)
    fetchHearings(tin)
  }

  return (
    <>
      {/* Search hero */}
      <section className="glass anim-fade-up tab-section">
        <div className="eyebrow">
          <CalendarDays className="w-3 h-3" />
          <span>O'ZBEKISTON · MY.SUD.UZ</span>
        </div>
        <h2 className="h-display">Rejalashtirilgan <span className="accent">sud majlislari</span></h2>
        <p className="lede">
          Kompaniyalaringizni saqlang va ularning barcha 4 ta sud turi (iqtisodiy,
          fuqarolik, jinoyat, ma&apos;muriy) bo&apos;yicha rejalashtirilgan sud majlislarini
          kuzating.
        </p>

        <form
          className="search-row"
          onSubmit={(e) => { e.preventDefault(); handleAddCompany() }}
        >
          <div className="input-wrap">
            <Building2 className="w-4 h-4" />
            <input
              inputMode="numeric"
              maxLength={9}
              value={addTin}
              onChange={(e) => setAddTin(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="STIR (9 raqam)"
              className="console-input"
              style={{ paddingLeft: 48 }}
            />
          </div>
          <input
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="Kompaniya nomi (ixtiyoriy)"
            className="console-input"
            style={{ paddingLeft: 20, flex: 1, minWidth: 120 }}
          />
          <button type="submit" className="btn-primary" disabled={addTin.length !== 9} style={{ flexShrink: 0 }}>
            <Building2 className="w-4 h-4" />
            <span>Saqlash</span>
          </button>
        </form>
      </section>

      {/* Saved companies list */}
      <div className="tab-section">
        <div className="h-section">
          <FolderOpen className="w-3.5 h-3.5" />
          Saqlangan kompaniyalar ({savedCompanies.length})
        </div>
        {savedCompanies.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, borderStyle: 'dashed' }}>
            Saqlangan kompaniyalar yo&apos;q.
          </div>
        ) : (
          <div className="company-list">
            {savedCompanies.map((c) => (
              <div
                key={c.tin}
                className={`company-tile ${selectedTin === c.tin ? 'is-selected' : ''}`}
                onClick={() => handleSelectCompany(c.tin)}
              >
                <div className="name">{c.name}</div>
                <div className="stir">{formatTin(c.tin)}</div>
                {selectedTin === c.tin && (
                  <div className="sel">
                    {loading ? (
                      <><SvgSpinner className="h-3 w-3" /> {`Yuklanmoqda… ${elapsed}s`}</>
                    ) : (
                      <>● {hearings.length} ta rejalashtirilgan</>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="trash"
                  onClick={(e) => { e.stopPropagation(); handleRemoveCompany(c.tin) }}
                  aria-label="O'chirish"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="decision-bar tab-section">
          <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
          <div className="decision-text">
            <p className="t1">Majlislarni olib bo&apos;lmadi</p>
            <p className="t2">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="glass loading-box tab-section">
          <div className="loading-head">
            <SvgSpinner />
            <div>
              <div className="loading-title">
                STIR {selectedTin ? formatTin(selectedTin) : ''} uchun 4 ta sud turi qidirilmoqda…
              </div>
              <div className="loading-sub">
                Iqtisodiy, fuqarolik, jinoyat va ma&apos;muriy sudlardan so&apos;rov yuborilmoqda.
              </div>
              <div className="loading-sub mono" style={{ marginTop: 4 }}>{elapsed}s o&apos;tdi</div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && !error && hearings.length > 0 && (
        <section className="tab-section">
          <div className="h-section">
            <CalendarDays className="w-3.5 h-3.5" />
            Rejalashtirilgan majlislar ({hearings.length})
          </div>
          <div className="panel anim-fade-up tab-section-sm" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="inn-bar" style={{ flex: 1, minWidth: 0 }}>
              <div className="inn-left">
                <div className="inn-icon"><CalendarDays className="w-5 h-5" /></div>
                <div>
                  <div className="inn-label">Rejalashtirilgan sud majlislari</div>
                  <div className="inn-value">{selectedTin ? formatTin(selectedTin) : ''} · {hearings.length} ta</div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => selectedTin && fetchHearings(selectedTin)}
              className="btn-ghost"
              aria-label="Yangilash"
              title="Yangilash"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div id="hearings-list">
            {hearings.map((h, i) => (
              <UpcomingHearingCard
                key={h.caseNumber + i}
                hearing={h}
                onViewCase={onViewCase}
                index={i}
              />
            ))}
          </div>
        </section>
      )}

      {/* No results */}
      {!loading && !error && selectedTin && hearings.length === 0 && (
        <div className="panel tab-section" style={{ textAlign: 'center', borderStyle: 'dashed', maxWidth: 560, margin: '0 auto 20px' }}>
          <CalendarDays className="w-7 h-7" style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: '8px 0' }}>Rejalashtirilgan majlislar yo&apos;q</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
            STIR <span className="mono" style={{ fontWeight: 700 }}>{selectedTin ? formatTin(selectedTin) : ''}</span> uchun barcha 4 ta sud turi bo&apos;yicha rejalashtirilgan majlislar topilmadi.
          </p>
        </div>
      )}

      {/* Default state */}
      {!loading && !error && !selectedTin && savedCompanies.length === 0 && (
        <section className="quick-grid">
          {[
            { Icon: Building2,    title: 'Kompaniyalarni saqlash',   desc: "Rejalashtirilgan majlislarni kuzatmoqchi bo'lgan kompaniyalaringizning STIR raqamlarini qo'shing.", idx: 0 },
            { Icon: CalendarDays, title: 'Barcha 4 ta sud turi',     desc: "Iqtisodiy, fuqarolik, jinoyat va ma'muriy sudlarni bir vaqtning o'zida qidiradi.", idx: 1 },
            { Icon: Gavel,        title: "To'liq ish ma'lumoti",      desc: "Har bir majlis uchun sudya, sud, sana, vaqt, da'vogar va javobgarni ko'rsatadi.", idx: 2 },
            { Icon: RefreshCw,    title: 'Istalgan vaqtda yangilash', desc: "So'nggi rejalashtirilgan majlislarni ko'rish uchun saqlangan kompaniyani bosing.", idx: 3 },
          ].map((f) => (
            <FeatureCard key={f.title} Icon={f.Icon} title={f.title} desc={f.desc} idx={f.idx} />
          ))}
        </section>
      )}
    </>
  )
}

function UpcomingHearingCard({
  hearing, onViewCase, index,
}: {
  hearing: UpcomingHearing
  onViewCase: (cn: string, courtType?: string) => void
  index: number
}) {
  const courtMeta = COURT_TYPES[hearing.courtType?.toUpperCase()]
  return (
    <article className="panel case-card panel-hover anim-fade-up">
      <div className="bill-head">
        <div className="bill-idx">
          <span className="idx-num">#{index + 1}</span>
          <div className="bill-title">
            <div className="receipt">
              <FolderOpen className="w-[18px] h-[18px]" style={{ color: 'var(--text-3)' }} />
              {hearing.caseNumber}
              <CopyButton value={hearing.caseNumber} label="Nusxalash" />
            </div>
            <div className="company">
              {hearing.caseType} · {CASE_STATUSES[hearing.caseStatus]?.en ?? hearing.caseStatus}
            </div>
          </div>
        </div>
        <div className="badge-row">
          {courtMeta ? (
            <span className={`badge ${courtMeta.cls}`}>{hearing.courtTypeLabel}</span>
          ) : (
            <span className="badge b-neutral">{hearing.courtTypeLabel}</span>
          )}
          <button
            type="button"
            className="korish-btn"
            onClick={() => onViewCase(hearing.caseNumber, hearing.courtType)}
          >
            <Eye className="w-3 h-3" /> Ko&apos;rish
          </button>
        </div>
      </div>

      <div className="info-grid">
        <div className="info-row">
          <p className="lbl"><CalendarDays className="w-3 h-3" />Majlis sanasi</p>
          <p className="val mono">{hearing.hearingDate}{hearing.hearingTime ? ` · ${hearing.hearingTime}` : ''}</p>
        </div>
        <div className="info-row">
          <p className="lbl"><Gavel className="w-3 h-3" />Sudya</p>
          <p className="val">{hearing.judge || '—'}</p>
        </div>
        <div className="info-row" style={{ gridColumn: '1 / -1' }}>
          <p className="lbl"><Building2 className="w-3 h-3" />Sud</p>
          <p className="val">{hearing.courtName || '—'}</p>
        </div>
      </div>

      {/* Tomonlar (parties) — full-width row with plaintiff + defendant side by side */}
      <div className="info-grid" style={{ marginTop: 12 }}>
        <div className="info-row">
          <p className="lbl"><Users className="w-3 h-3" />Da&apos;vogar</p>
          <p className="val">{hearing.plaintiff || '—'}</p>
        </div>
        <div className="info-row">
          <p className="lbl"><Users className="w-3 h-3" />Javobgar</p>
          <p className="val">{hearing.defendant || '—'}</p>
        </div>
      </div>
    </article>
  )
}

// ---- Court cases tab -------------------------------------------------

function CourtCasesTab({
  onViewCase,
  pendingCaseNumber,
  pendingCourtType,
  pendingCaseData,
  onCaseNumberConsumed,
}: {
  onViewCase: (cn: string) => void
  pendingCaseNumber: string | null
  pendingCourtType: CourtType | null
  /** When set (passed from Stats tab), rendered INSTANTLY without re-fetching. */
  pendingCaseData: CourtCase | null
  onCaseNumberConsumed: () => void
}) {
  const [courtType, setCourtType] = useState<CourtType>('economic')
  const [mode, setMode] = useState<SearchMode>('tin')
  const [value, setValue] = useState('302678824')
  const [loading, setLoading] = useState(false)
  const [cases, setCases] = useState<CourtCase[]>([])
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [expandedCase, setExpandedCase] = useState<string | null>(null)
  const [courtSortBy, setCourtSortBy] = useState<'newest' | 'oldest' | 'type' | 'status'>('newest')
  const [courtStatusFilter, setCourtStatusFilter] = useState<string | null>(null)
  const [casePage, setCasePage] = useState(0)
  const [casePageSize, setCasePageSize] = useState<PageSize>(10)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const modeRef = useRef(mode)
  modeRef.current = mode
  const courtTypeRef = useRef(courtType)
  courtTypeRef.current = courtType

  const handleCourtTypeChange = (next: CourtType) => {
    setCourtType(next)
    setMode(next === 'economic' || next === 'administrative' ? 'tin' : 'pinfl')
    setValue('')
    setCases([])
    setSearched(false)
    setExpandedCase(null)
    setError(null)
    setCourtSortBy('newest')
    setCourtStatusFilter(null)
    setCasePage(0)
  }

  const modeOptions: { value: SearchMode; label: string; placeholder: string }[] = useMemo(() => {
    if (courtType === 'economic' || courtType === 'administrative') {
      return [
        { value: 'tin',        label: "STIR bo'yicha",        placeholder: '9 xonali STIR raqamini kiriting' },
        { value: 'caseNumber', label: "Ish raqami bo'yicha",  placeholder: 'masalan, 4-1001-2605/14720' },
      ]
    }
    return [
      { value: 'pinfl',      label: "PINFL bo'yicha",        placeholder: '14 xonali PINFL raqamini kiriting' },
      { value: 'caseNumber', label: "Ish raqami bo'yicha",  placeholder: courtType === 'civil' ? 'masalan, 2-1005-2611/33772' : 'masalan, 1-0001-2601/12345' },
    ]
  }, [courtType])

  const runSearchWith = useCallback(async (rawValue: string, modeVal: SearchMode, courtVal: CourtType) => {
    const clean = rawValue.trim()
    if (!clean) { toast.error('Qidiruv qiymatini kiriting'); return }
    if (modeVal === 'tin' && !/^\d{9}$/.test(clean)) {
      toast.error("STIR aynan 9 ta raqamdan iborat bo'lishi kerak"); return
    }
    if (modeVal === 'pinfl' && !/^\d{14}$/.test(clean)) {
      toast.error("PINFL aynan 14 ta raqamdan iborat bo'lishi kerak"); return
    }
    if (modeVal === 'caseNumber' && !/^\d+-[\d-]+\/\d+$/.test(clean)) {
      toast.error('Ish raqami formati: X-XXXX-XXXX/XXXXX'); return
    }
    // 5-min client cache — searching by TIN/PINFL re-fetches the same list
    // across cross-tab navigations. Skip cache for caseNumber lookups (those
    // return the same single case every time but the user usually wants fresh).
    const isCacheable = modeVal !== 'caseNumber'
    const cacheK = isCacheable ? cacheKey.cases(courtVal, modeVal, clean) : null
    if (cacheK) {
      const cached = getCached<CourtCase[]>(cacheK)
      if (cached) {
        setCases(cached)
        setError(null)
        setSearched(true)
        setExpandedCase(null)
        if (cached.length === 0) toast.info('Sud ishlari topilmadi')
        else toast.success(`${cached.length} ta ish topildi (keshdan)`)
        return
      }
    }
    setLoading(true)
    setCases([])
    setError(null)
    setSearched(true)
    setElapsed(0)
    setExpandedCase(null)
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    try {
      const res = await fetch(
        `/api/court-cases?courtType=${courtVal}&mode=${modeVal}&value=${encodeURIComponent(clean)}`,
      )
      const data = (await res.json()) as { ok: boolean; error?: string; cases?: CourtCase[] }
      if (!data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      const list = data.cases || []
      setCases(list)
      if (cacheK && list.length > 0) setCached(cacheK, list)
      if (list.length === 0) toast.info('Sud ishlari topilmadi')
      else toast.success(`${list.length} ta ish topildi`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setError(msg)
      toast.error(msg)
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      setLoading(false)
    }
  }, [])

  const runSearch = useCallback(() => {
    return runSearchWith(value, mode, courtType)
  }, [value, mode, courtType, runSearchWith])

  // Improvement 2: if a pendingCaseData object was passed (from Stats tab),
  // render it INSTANTLY in the results list — no fetch needed. The pending case
  // number is also set so the form reflects the right case-number mode. Then
  // optionally trigger a background fetch to fill in any missing fields
  // (caseStatus, hearingDate, judge) that StatsCase didn't carry over.
  useEffect(() => {
    if (!pendingCaseNumber) return
    const targetCourt = pendingCourtType || 'economic'
    if (courtTypeRef.current !== targetCourt) setCourtType(targetCourt)
    if (modeRef.current !== 'caseNumber') setMode('caseNumber')
    setValue(pendingCaseNumber)

    // Instant display path — pre-populate the list with the data we already have.
    if (pendingCaseData) {
      setCases([pendingCaseData])
      setSearched(true)
      setExpandedCase(null)
      setError(null)
      setElapsed(0)
      onCaseNumberConsumed()
      toast.success('Ish ma\'lumotlari yuklandi (Stats dan)')
      return
    }

    // No pre-loaded data — fall back to the search-by-case-number fetch.
    setTimeout(() => {
      void runSearchWith(pendingCaseNumber, 'caseNumber', targetCourt)
      onCaseNumberConsumed()
    }, 50)
  }, [pendingCaseNumber, pendingCourtType, pendingCaseData, runSearchWith, onCaseNumberConsumed])

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch()
  }

  const courtTypeMeta = COURT_TYPE_LABELS[courtType]
  const currentMode = modeOptions.find((o) => o.value === mode)

  const sortedCases = useMemo(() => {
    let display = [...cases]
    if (courtStatusFilter) {
      display = display.filter((c) => c.caseStatus === courtStatusFilter)
    }
    display.sort((a, b) => {
      if (courtSortBy === 'newest') return parseCaseDate(b.dateFiled) - parseCaseDate(a.dateFiled)
      if (courtSortBy === 'oldest') return parseCaseDate(a.dateFiled) - parseCaseDate(b.dateFiled)
      if (courtSortBy === 'type')   return (a.caseType || '').localeCompare(b.caseType || '')
      if (courtSortBy === 'status') return (a.caseStatus || '').localeCompare(b.caseStatus || '')
      return 0
    })
    return display
  }, [cases, courtStatusFilter, courtSortBy])

  // Reset to first page when filters / sort / page-size change.
  useEffect(() => { setCasePage(0) }, [courtStatusFilter, courtSortBy, casePageSize, courtType])

  const caseTotalPages = Math.max(1, Math.ceil(sortedCases.length / casePageSize))
  const safeCasePage = Math.min(casePage, caseTotalPages - 1)
  const pagedCases = sortedCases.slice(
    safeCasePage * casePageSize,
    safeCasePage * casePageSize + casePageSize,
  )

  const uniqueStatuses = useMemo(
    () => [...new Set(cases.map((c) => c.caseStatus).filter((s) => s && s !== '—'))],
    [cases],
  )

  return (
    <>
      {/* Search hero */}
      <section className="glass anim-fade-up tab-section">
        <div className="eyebrow">
          <Gavel className="w-3 h-3" />
          <span>O'ZBEKISTON · MY.SUD.UZ</span>
        </div>
        <h2 className="h-display">Kompaniya ishtirokidagi <span className="accent">sud ishlarini</span> ko'ring</h2>
        <p className="lede">
          jadval.sud.uz orqali ochiq va yopiq sud ishlarini, majlislar tarixini va qarorlarni toping.
        </p>

        <form onSubmit={onSubmit} className="search-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="toggle-pair" style={{ marginTop: 0, marginBottom: 12 }}>
            {(['economic', 'civil', 'criminal', 'administrative'] as CourtType[]).map((ct) => (
              <button
                key={ct}
                type="button"
                className={`toggle-btn ${courtType === ct ? 'is-active' : ''}`}
                onClick={() => handleCourtTypeChange(ct)}
                disabled={loading}
              >
                {{ economic: 'Iqtisodiy', civil: 'Fuqarolik', criminal: 'Jinoyat', administrative: "Ma'muriy" }[ct]}
              </button>
            ))}
          </div>

          <div className="toggle-pair" style={{ marginTop: 0, marginBottom: 12 }}>
            {modeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`toggle-btn ${mode === opt.value ? 'is-active' : ''}`}
                onClick={() => setMode(opt.value)}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <div className="input-wrap" style={{ flex: 1, minWidth: 200 }}>
              <Search className="w-4 h-4" />
              <input
                value={value}
                onChange={(e) => {
                  const v = e.target.value
                  if (mode === 'tin') setValue(v.replace(/\D/g, '').slice(0, 9))
                  else if (mode === 'pinfl') setValue(v.replace(/\D/g, '').slice(0, 14))
                  else setValue(v.slice(0, 30))
                }}
                placeholder={currentMode?.placeholder ?? 'Qidiruv qiymatini kiriting'}
                className="console-input"
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading || !value.trim()}>
              {loading ? <SvgSpinner className="w-4 h-4" /> : <Search className="w-4 h-4" />}
              {loading ? `${elapsed}s` : 'Qidirish'}
            </button>
          </div>
        </form>
      </section>

      {/* Loading */}
      {loading && <div className="tab-section"><CourtLoadingState value={value} elapsed={elapsed} /></div>}

      {/* Error */}
      {!loading && error && (
        <div className="decision-bar tab-section">
          <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
          <div className="decision-text">
            <p className="t1">Qidiruv muvaffaqiyatsiz tugadi</p>
            <p className="t2">
              {error.toLowerCase().includes('fetch failed') ||
              error.toLowerCase().includes('econnrefused') ||
              error.toLowerCase().includes('unreachable')
                ? "my.sud.uz vaqtincha ishlamayapti. Server ishdan chiqqan yoki so'rovlar sonini cheklagan bo'lishi mumkin."
                : error}
            </p>
            <button
              type="button"
              onClick={runSearch}
              className="btn-ghost"
              style={{ marginTop: 8 }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Qayta urinish
            </button>
          </div>
        </div>
      )}

      {/* No results */}
      {!loading && !error && searched && cases.length === 0 && (
        <div className="panel tab-section" style={{ textAlign: 'center', borderStyle: 'dashed', maxWidth: 560, margin: '0 auto 20px' }}>
          <FolderOpen className="w-7 h-7" style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: '8px 0' }}>Sud ishlari topilmadi</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {courtTypeMeta.en} bo&apos;yicha {value} ga mos ish topilmadi.
          </p>
        </div>
      )}

      {/* Results */}
      {cases.length > 0 && !loading && (
        <section>
          <div className="h-section">
            <FolderOpen className="w-3.5 h-3.5" />
            Topilgan ishlar ({cases.length})
          </div>
          <div className="panel tab-section" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="filter-left">
              <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Saralash:</span>
              <div className="select-wrap">
                <select
                  value={courtSortBy}
                  onChange={(e) => setCourtSortBy(e.target.value as typeof courtSortBy)}
                >
                  <option value="newest">Avval yangi</option>
                  <option value="oldest">Avval eski</option>
                  <option value="type">Ish turi bo&apos;yicha</option>
                  <option value="status">Holati bo&apos;yicha</option>
                </select>
              </div>
              {uniqueStatuses.length > 1 && (
                <div className="select-wrap">
                  <select
                    value={courtStatusFilter ?? ''}
                    onChange={(e) => setCourtStatusFilter(e.target.value || null)}
                  >
                    <option value="">Barcha holatlar</option>
                    {uniqueStatuses.map((s) => (
                      <option key={s} value={s}>{CASE_STATUSES[s]?.en ?? s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="select-wrap">
              <select
                value={String(casePageSize)}
                onChange={(e) => setCasePageSize(Number(e.target.value) as PageSize)}
              >
                <option value="10">10 / sahifa</option>
                <option value="20">20 / sahifa</option>
                <option value="50">50 / sahifa</option>
              </select>
            </div>
          </div>

          <div id="cases-list" className="tab-section">
            {pagedCases.map((c, i) => (
              <CourtCaseCard
                key={c.caseNumber + i}
                caseData={c}
                courtType={courtType}
                index={safeCasePage * casePageSize + i}
                expanded={expandedCase === c.caseNumber}
                onToggle={() =>
                  setExpandedCase(expandedCase === c.caseNumber ? null : c.caseNumber)
                }
              />
            ))}
          </div>

          {sortedCases.length > 0 && (
            <PageNav
              page={safeCasePage}
              pageSize={casePageSize}
              total={sortedCases.length}
              onPageChange={setCasePage}
              label="ish"
            />
          )}
        </section>
      )}

      {/* Default state */}
      {!loading && !searched && (
        <section className="quick-grid">
          {COURT_FEATURE_CARDS.map((f, i) => (
            <FeatureCard key={f.title} Icon={f.Icon} title={f.title} desc={f.desc} idx={i} />
          ))}
        </section>
      )}
    </>
  )
}

// ---- AllHearingsTab component removed in v116 — functionality moved to
//      the MAJLISLAR folder inside the Stats tab (lazy-loaded when the
//      folder is opened). The /api/court-hearings route + jadval2 lib are
//      still used internally by that folder. -----------------------------

// ---- Company info tab (orginfo.uz + chamber.uz rating) ----------------

interface CompanyInfoData {
  company: {
    tin: string
    officialName: string
    shortName: string
    registeredDate: string
    status: string
    address: string
    director: string
    phone: string
    email: string
    charterCapital: string
    registeringAuthority: string
    thsht: string
    dbibt: string
    ifut: string
    founders: { name: string; share: string }[]
    orgInfoUrl: string
  } | null
  rating: {
    score: number
    category: string
    taxpayerType: string
    region: string
    district: string
    okedCode: string
    okedName: string
    okedNameRu: string
    okedSection: string
    okedShortName: string
    employeeLimitMf: number
    employeeLimitLf: number
  } | null
}

function ratingLabel(type: string): string {
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
  return labels[type] || "Noma'lum"
}

const COMPANY_FEATURE_CARDS: { Icon: LucideIcon; title: string; desc: string; tone: 'accent' | 'emerald' | 'indigo' | 'violet' | 'sky'; }[] = [
  { Icon: Building2,   title: "Kompaniya ma'lumotlari",     desc: "STIR bo'yicha orginfo.uz dan to'liq ma'lumot: nom, manzil, rahbar, status, ustav kapitali, kontaktlar.", tone: 'accent' },
  { Icon: Award,       title: 'Pudratchi reytingi',          desc: "chamber.uz ma'lumotnomasi — 0-100 ball, AAA-D toifa, soliq to'lovchi turi.", tone: 'accent' },
  { Icon: FileText,    title: 'Faoliyat turi (OKED)',        desc: "Kompaniyaning iqtisodiy faoliyat turi — OKED kodi, nomi, bo'limi bo'yicha to'liq ma'lumot.", tone: 'accent' },
  { Icon: Users,       title: "Ta'sischilar",                desc: "Kompaniya ta'sischilari ro'yxati va ularning ulushlari foizda.", tone: 'accent' },
]

function CompanyInfoTab({
  onViewCases,
  onViewBills,
  onViewHearings,
}: {
  onViewCases: () => void
  onViewBills: () => void
  onViewHearings: () => void
}) {
  const [tin, setTin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CompanyInfoData | null>(null)
  const [searchedTin, setSearchedTin] = useState<string | null>(null)

  const fetchCompany = useCallback(async (tinValue: string) => {
    const clean = tinValue.trim()
    if (!/^\d{9}$/.test(clean)) {
      toast.error("STIR aynan 9 ta raqamdan iborat bo'lishi kerak")
      return
    }
    // Check the 5-min client cache first — Kompaniya tab is frequently re-opened
    // with the same TIN (from other tabs' cross-links). Avoids re-fetching
    // orginfo.uz + chamber.uz every time.
    const cacheK = cacheKey.companyInfo(clean)
    const cached = getCached<CompanyInfoData>(cacheK)
    if (cached) {
      setData({ company: cached.company, rating: cached.rating })
      setSearchedTin(clean)
      toast.success("Kompaniya ma'lumotlari keshdan yuklandi")
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
    setSearchedTin(clean)
    try {
      const res = await fetch(`/api/company-info?tin=${encodeURIComponent(clean)}`)
      const json = (await res.json()) as { ok: boolean; error?: string } & CompanyInfoData
      if (!json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      setData({ company: json.company, rating: json.rating })
      setCached(cacheK, { company: json.company, rating: json.rating })
      toast.success("Kompaniya ma'lumotlari yuklandi")
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Network error'
      setError(msg)
      toast.error(`Xatolik: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const displayName = data?.company?.shortName || data?.company?.officialName || (searchedTin ? `STIR ${formatTin(searchedTin)}` : '')
  const rating = data?.rating

  return (
    <>
      {/* Search hero */}
      <section className="glass anim-fade-up tab-section">
        <div className="eyebrow">
          <Building2 className="w-3 h-3" />
          <span>O'ZBEKISTON · ORGINFO.UZ + CHAMBER.UZ</span>
        </div>
        <h2 className="h-display">Kompaniya <span className="accent">ma'lumotlari</span></h2>
        <p className="lede">
          Ro&apos;yxatdan o&apos;tish tafsilotlari, ustav fondi, direktor va tashkilotchilar haqida ma&apos;lumot.
        </p>

        <form
          className="search-row"
          onSubmit={(e) => { e.preventDefault(); fetchCompany(tin) }}
        >
          <div className="input-wrap" style={{ flex: 1, minWidth: 200 }}>
            <Search className="w-4 h-4" />
            <input
              inputMode="numeric"
              maxLength={9}
              value={tin}
              onChange={(e) => setTin(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="STIR raqamini kiriting (9 ta raqam)"
              className="console-input"
              aria-label="Kompaniya STIR raqami"
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading || tin.length !== 9}>
            {loading ? <SvgSpinner className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            <span>{loading ? 'Qidirilmoqda' : "Ma'lumot olish"}</span>
          </button>
        </form>

        {/* Sample chips */}
        <div className="chip-row" style={{ marginTop: 18 }}>
          <span className="chip-label">Namuna:</span>
          {['302678824', '305858476', '301946789'].map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              onClick={() => { setTin(t); fetchCompany(t) }}
              disabled={loading}
            >
              {formatTin(t)}
            </button>
          ))}
        </div>
      </section>

      {/* Loading */}
      {loading && (
        <div className="glass loading-box tab-section">
          <div className="loading-head">
            <SvgSpinner />
            <div>
              <div className="loading-title">
                STIR {searchedTin ? formatTin(searchedTin) : ''} bo&apos;yicha ma&apos;lumotlar yuklanmoqda…
              </div>
              <div className="loading-sub">
                orginfo.uz (kompaniya) + chamber.uz (reyting) so&apos;rovlari parallel bajarilmoqda.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="decision-bar tab-section">
          <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
          <div className="decision-text">
            <p className="t1">Kompaniya topilmadi</p>
            <p className="t2">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && !error && data && (
        <section className="card-stack">
          {/* Rating card (prominent) — FIRST, right after hero */}
          {rating && (
            <article className="panel rating-card anim-fade-up">
              <div className="rating-num">
                {rating.score}
                <span style={{ fontSize: 24, color: 'var(--text-3)' }}>/100</span>
              </div>
              <div className="rating-badge">{rating.category}</div>
              <div className="rating-sub">{ratingLabel(rating.category)} reyting</div>
              <div className="info-grid" style={{ marginTop: 26, textAlign: 'left' }}>
                <div className="info-row">
                  <p className="lbl"><Receipt className="w-3 h-3" />Soliq to&apos;lovchi turi</p>
                  <p className="val">{rating.taxpayerType || '—'}</p>
                </div>
                <div className="info-row" style={{ gridColumn: '1 / -1' }}>
                  <p className="lbl"><MapPin className="w-3 h-3" />Hudud</p>
                  <p className="val">{data?.company?.address || [rating.region, rating.district].filter(Boolean).join(', ') || '—'}</p>
                </div>
              </div>
            </article>
          )}

          {/* Quick actions bar — slim toolbar with company name + 4 buttons.
              This replaces the old bottom-of-tab quick-action cards (v123 removed
              the duplicate to keep one consistent actions bar at the top). */}
          <div className="panel anim-fade-up" style={{ padding: '12px 16px' }}>
            <div className="inn-bar">
              <div className="inn-left">
                <div className="inn-icon" style={{ width: 32, height: 32 }}><Zap className="w-4 h-4" /></div>
                <div>
                  <div className="inn-label">Tezkor amallar</div>
                  <div className="inn-value" style={{ fontSize: 13 }}>{displayName}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="btn-ghost btn-sm" onClick={onViewCases}>
                  <Gavel className="w-3 h-3" />
                  <span>Sud ishlari</span>
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={onViewBills}>
                  <Receipt className="w-3 h-3" />
                  <span>To&apos;lovlar</span>
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={onViewHearings}>
                  <CalendarDays className="w-3 h-3" />
                  <span>Majlislar</span>
                </button>
                {data.company?.orgInfoUrl && (
                  <a
                    href={data.company.orgInfoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost btn-sm"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>orginfo.uz</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Company basic info */}
          {data.company && (
            <article className="panel panel-hover anim-fade-up">
              <div className="card-head">
                <div className="card-head-left">
                  <div className="card-head-icon"><Building2 className="w-3.5 h-3.5" /></div>
                  <h3 className="card-head-title">Asosiy ma&apos;lumotlar</h3>
                </div>
              </div>
              <div className="info-grid">
                <div className="info-row">
                  <p className="lbl"><Building2 className="w-3 h-3" />To&apos;liq nomi</p>
                  <p className="val">{data.company.officialName || data.company.shortName || '—'}</p>
                </div>
                <div className="info-row">
                  <p className="lbl"><FileText className="w-3 h-3" />STIR</p>
                  <p className="val mono">{formatTin(data.company.tin)}</p>
                </div>
                <div className="info-row" style={{ gridColumn: '1 / -1' }}>
                  <p className="lbl"><MapPin className="w-3 h-3" />Manzil</p>
                  <p className="val">{data.company.address || '—'}</p>
                </div>
                <div className="info-row">
                  <p className="lbl"><Users className="w-3 h-3" />Rahbar</p>
                  <p className="val">{data.company.director || '—'}</p>
                </div>
                <div className="info-row">
                  <p className="lbl"><ShieldCheck className="w-3 h-3" />Holati</p>
                  <p className="val">{data.company.status || '—'}</p>
                </div>
                <div className="info-row">
                  <p className="lbl"><CalendarDays className="w-3 h-3" />Ro&apos;yxatdan olingan</p>
                  <p className="val mono">{data.company.registeredDate || '—'}</p>
                </div>
                <div className="info-row">
                  <p className="lbl"><Wallet className="w-3 h-3" />Ustav kapitali</p>
                  <p className="val mono">{data.company.charterCapital || '—'}</p>
                </div>
                <div className="info-row">
                  <p className="lbl"><Phone className="w-3 h-3" />Telefon</p>
                  <p className="val mono">{data.company.phone || '—'}</p>
                </div>
                <div className="info-row">
                  <p className="lbl"><Mail className="w-3 h-3" />Email</p>
                  <p className="val mono">{data.company.email || '—'}</p>
                </div>
              </div>
            </article>
          )}

          {/* Industry info (OKED) */}
          {rating && (
            <article className="panel panel-hover anim-fade-up">
              <div className="card-head">
                <div className="card-head-left">
                  <div className="card-head-icon"><FileText className="w-3.5 h-3.5" /></div>
                  <h3 className="card-head-title">Faoliyat sohasi (OKED)</h3>
                </div>
              </div>
              <div className="info-grid">
                <div className="info-row">
                  <p className="lbl"><FileText className="w-3 h-3" />OKED kodi</p>
                  <p className="val mono">{rating.okedCode || '—'}</p>
                </div>
                <div className="info-row">
                  <p className="lbl"><Layers className="w-3 h-3" />Bo&apos;lim</p>
                  <p className="val">{rating.okedSection || '—'}</p>
                </div>
                <div className="info-row" style={{ gridColumn: '1 / -1' }}>
                  <p className="lbl"><Factory className="w-3 h-3" />Faoliyat nomi</p>
                  <p className="val">{rating.okedName || rating.okedNameRu || rating.okedShortName || '—'}</p>
                </div>
              </div>
            </article>
          )}

          {/* Founders */}
          {data.company && data.company.founders.length > 0 && (
            <article className="panel panel-hover anim-fade-up">
              <div className="card-head">
                <div className="card-head-left">
                  <div className="card-head-icon"><Users className="w-3.5 h-3.5" /></div>
                  <div>
                    <h3 className="card-head-title">Asoschilar</h3>
                    <p className="card-head-sub">{data.company.founders.length} ta asoschi</p>
                  </div>
                </div>
              </div>
              <div className="founders-list">
                {data.company.founders.map((f, i) => (
                  <div key={i} className="founder-row">
                    <div className="founder-left">
                      <div className="founder-icon"><User className="w-3.5 h-3.5" /></div>
                      <span className="founder-name">{f.name}</span>
                    </div>
                    <span className="founder-share">{f.share}</span>
                  </div>
                ))}
              </div>
            </article>
          )}

          {/* [v123] Removed the duplicate bottom quick-action cards section.
              The slim "Tezkor amallar" bar above (right after the rating card)
              provides the same 4 actions without redundancy. */}
        </section>
      )}

      {/* Default state */}
      {!loading && !error && !data && (
        <section className="quick-grid">
          {COMPANY_FEATURE_CARDS.map((f, i) => (
            <FeatureCard key={f.title} Icon={f.Icon} title={f.title} desc={f.desc} idx={i} />
          ))}
        </section>
      )}
    </>
  )
}

// ---- Stats Tab (v109) -------------------------------------------------

type StatsCourtType = 'economic' | 'civil' | 'administrative'
type StatsClassification = 'win' | 'lose' | 'neutral' | 'pending'
type StatsRole = 'plaintiff' | 'defendant'

interface StatsCase {
  caseNumber: string
  courtType: StatsCourtType
  regDate: string
  result: string
  classification: StatsClassification
  role: StatsRole
  court: string
  category: string
  counterparty: string
}

interface StatsCompany {
  name: string
  tin: string
  region?: string
  status?: string
}

interface StatsSummary {
  total: number
  win: number
  lose: number
  neutral: number
  pending: number
  asPlaintiff: number
  asDefendant: number
}

interface StatsResponseOk {
  ok: true
  company: StatsCompany
  cases: StatsCase[]
  summary: StatsSummary
  errors: { courtType: string; error: string }[]
}

interface StatsResponseErr {
  ok: false
  error: string
}

type FolderId = 'tahlil' | StatsCourtType | 'hearings'
type DateSpan = 'all' | '1y' | '6m' | '30d'
type OutcomeFilter = 'all' | StatsClassification
type SortMode = 'newest' | 'oldest'

/** Hearing shape returned by /api/court-hearings (mirrors Jadval2Hearing from
 *  src/lib/jadval2.ts — declared locally because jadval2.ts is server-only). */
interface StatsHearing {
  casenumber: string
  hearing_date: string
  hearing_time: string
  responsible: string
  instance: string
  globalid: string
  claimkind: string
  claimtype: string
  category: string
  case_id: string
  claiment: string
  defendant: string
}

const OUTCOME_LABEL: Record<StatsClassification, string> = {
  win: 'Yutdi',
  lose: 'Yutqazdi',
  neutral: 'Neitral',
  pending: 'Kutilmoqda',
}

const ROLE_LABEL: Record<StatsRole, string> = {
  plaintiff: "Da'vogar",
  defendant: 'Javobgar',
}

/** Parse "DD.MM.YYYY" → Date (or invalid Date on failure). */
function parseStatsDate(s: string): Date {
  const m = (s || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (m) return new Date(+m[3], +m[2] - 1, +m[1])
  return new Date(0)
}

function inDateSpan(dateStr: string, span: DateSpan): boolean {
  if (span === 'all') return true
  const d = parseStatsDate(dateStr)
  if (d.getTime() === 0) return false
  const now = new Date()
  const cutoff = new Date()
  if (span === '1y') cutoff.setFullYear(now.getFullYear() - 1)
  else if (span === '6m') cutoff.setMonth(now.getMonth() - 6)
  else if (span === '30d') cutoff.setDate(now.getDate() - 30)
  return d >= cutoff
}

function StatsTab({
  onViewCase,
}: {
  /** Called when the user clicks a case card. The 3rd arg is the full case
   *  object so the Sud ishlari tab can render it INSTANTLY without re-fetching
   *  (Improvement 2). Bills/Upcoming-hearings callers don't pass caseData. */
  onViewCase: (caseNumber: string, courtType: string, caseData?: CourtCase | null) => void
}) {
  const [tinInput, setTinInput] = useState('302678824')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Omit<StatsResponseOk, 'ok'> | null>(null)
  const [activeFolder, setActiveFolder] = useState<FolderId>('tahlil')
  const [dateSpan, setDateSpan] = useState<DateSpan>('all')
  const [outcome, setOutcome] = useState<OutcomeFilter>('all')
  const [sort, setSort] = useState<SortMode>('newest')
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0)
  const [toastMsg, setToastMsg] = useState<{ msg: string; kind: 'info' | 'copy' } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [dlCourtTypes, setDlCourtTypes] = useState<Set<StatsCourtType>>(new Set(['economic', 'civil', 'administrative']))

  // MAJLISLAR folder state — lazy-loaded when the folder is opened
  const [hearings, setHearings] = useState<StatsHearing[]>([])
  const [hearingsLoading, setHearingsLoading] = useState(false)
  const [hearingsError, setHearingsError] = useState<string | null>(null)
  const [hearingsTin, setHearingsTin] = useState<string | null>(null)  // TIN that hearings were fetched for

  const showToast = useCallback((msg: string, kind: 'info' | 'copy' = 'info') => {
    setToastMsg({ msg, kind })
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 2500)
  }, [])

  // Filter + sort a list of cases (memoized)
  const filterAndSort = useCallback(
    (cases: StatsCase[]): StatsCase[] => {
      const filtered = cases.filter(c => inDateSpan(c.regDate, dateSpan))
      const byOutcome = outcome === 'all' ? filtered : filtered.filter(c => c.classification === outcome)
      return [...byOutcome].sort((a, b) => {
        const ta = parseStatsDate(a.regDate).getTime()
        const tb = parseStatsDate(b.regDate).getTime()
        return sort === 'newest' ? tb - ta : ta - tb
      })
    },
    [dateSpan, outcome, sort],
  )

  // Cases per court type (filtered + sorted) — for folder 2/3/4
  const casesByType = useMemo(() => {
    if (!data) return { economic: [] as StatsCase[], civil: [] as StatsCase[], administrative: [] as StatsCase[] }
    return {
      economic: filterAndSort(data.cases.filter(c => c.courtType === 'economic')),
      civil: filterAndSort(data.cases.filter(c => c.courtType === 'civil')),
      administrative: filterAndSort(data.cases.filter(c => c.courtType === 'administrative')),
    }
  }, [data, filterAndSort])

  // Total counts per court type (unfiltered) — for folder-tab badges
  const totalCounts = useMemo(() => {
    if (!data) return { economic: 0, civil: 0, administrative: 0 }
    return {
      economic: data.cases.filter(c => c.courtType === 'economic').length,
      civil: data.cases.filter(c => c.courtType === 'civil').length,
      administrative: data.cases.filter(c => c.courtType === 'administrative').length,
    }
  }, [data])

  // Recomputed summary based on dateSpan (per spec: recompute when dateSpan changes)
  const summary = useMemo<StatsSummary>(() => {
    if (!data) return { total: 0, win: 0, lose: 0, neutral: 0, pending: 0, asPlaintiff: 0, asDefendant: 0 }
    if (dateSpan === 'all') return data.summary
    const filtered = data.cases.filter(c => inDateSpan(c.regDate, dateSpan))
    const s: StatsSummary = { total: filtered.length, win: 0, lose: 0, neutral: 0, pending: 0, asPlaintiff: 0, asDefendant: 0 }
    for (const c of filtered) {
      s[c.classification]++
      if (c.role === 'plaintiff') s.asPlaintiff++
      else s.asDefendant++
    }
    return s
  }, [data, dateSpan])

  // Per-court-type win rates (for Chart B: Win Rate by Court Type)
  const courtTypeWinRates = useMemo(() => {
    const empty = {
      economic: { total: 0, wins: 0 },
      civil: { total: 0, wins: 0 },
      administrative: { total: 0, wins: 0 },
    }
    if (!data) return empty
    const filtered = data.cases.filter(c => inDateSpan(c.regDate, dateSpan))
    const r = { ...empty }
    for (const c of filtered) {
      if (r[c.courtType]) {
        r[c.courtType].total++
        if (c.classification === 'win') r[c.courtType].wins++
      }
    }
    return r
  }, [data, dateSpan])

  // Role breakdown (from dateSpan-filtered cases)
  const roleBreakdown = useMemo(() => {
    const empty = {
      plaintiff: { win: 0, lose: 0, neutral: 0, pending: 0, total: 0 },
      defendant: { win: 0, lose: 0, neutral: 0, pending: 0, total: 0 },
    }
    if (!data) return empty
    const filtered = data.cases.filter(c => inDateSpan(c.regDate, dateSpan))
    const r = JSON.parse(JSON.stringify(empty)) as typeof empty
    for (const c of filtered) {
      r[c.role][c.classification]++
      r[c.role].total++
    }
    return r
  }, [data, dateSpan])

  // Top 5 categories (from dateSpan-filtered cases)
  const categories = useMemo(() => {
    if (!data) return [] as { name: string; count: number }[]
    const filtered = data.cases.filter(c => inDateSpan(c.regDate, dateSpan))
    const byCat = new Map<string, number>()
    for (const c of filtered) {
      const cat = (c.category || '').trim() || "Noma'lum"
      byCat.set(cat, (byCat.get(cat) || 0) + 1)
    }
    return [...byCat.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [data, dateSpan])

  // Fetch handler
  const fetchStats = useCallback(async (tin: string) => {
    if (!/^\d{9}$/.test(tin)) {
      setError("STIR aynan 9 ta raqamdan iborat bo'lishi kerak")
      return
    }
    // 5-min client cache — Stats tab is heavy (orginfo + 3 court searches in
    // parallel) and is frequently re-opened after viewing individual cases.
    const cacheK = cacheKey.stats(tin)
    const cached = getCached<Omit<StatsResponseOk, 'ok'>>(cacheK)
    if (cached) {
      setData(cached)
      setActiveFolder('tahlil')
      setOutcome('all')
      setDateSpan('all')
      setPhase(3)
      setHearings([])
      setHearingsTin(null)
      hearingsFetchedTinRef.current = null
      toast.success("Statistika keshdan yuklandi")
      return
    }
    setLoading(true)
    setError(null)
    setData(null)
    setActiveFolder('tahlil')
    setOutcome('all')
    setDateSpan('all')
    setPhase(1)
    // Reset MAJLISLAR folder state — new search means stale hearings are gone
    setHearings([])
    setHearingsLoading(false)
    setHearingsError(null)
    setHearingsTin(null)
    hearingsFetchedTinRef.current = null
    try {
      // Phase 1 → 2 after a short tick (so the user sees the "company" step)
      setTimeout(() => setPhase(2), 600)
      const res = await fetch(`/api/stats?tin=${encodeURIComponent(tin)}`, {
        signal: AbortSignal.timeout(35000),
      })
      const json = (await res.json()) as StatsResponseOk | StatsResponseErr
      if (!json.ok) throw new Error(json.error || "Statistikani olib bo'lmadi")
      const payload = {
        company: json.company,
        cases: json.cases,
        summary: json.summary,
        errors: json.errors || [],
      }
      setData(payload)
      setCached(cacheK, payload)
      setPhase(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Statistikani olib bo'lmadi")
      setPhase(0)
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    void fetchStats(tinInput.trim())
  }, [tinInput, fetchStats])

  // MAJLISLAR folder — lazy-load hearings when the folder is opened.
  // Fires when activeFolder === 'hearings' AND we have a company TIN AND
  // we haven't already kicked off a fetch for this TIN. The /api/court-hearings
  // route uses orginfo.uz + court-map + jadvalapi.sud.uz to find upcoming
  // hearings for the company's nearest court (90 days forward).
  const hearingsFetchedTinRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeFolder !== 'hearings') return
    const tin = data?.company?.tin
    if (!tin) return
    // Already fetched (or currently fetching) for this TIN — don't re-fire
    if (hearingsFetchedTinRef.current === tin) return
    hearingsFetchedTinRef.current = tin
    let cancelled = false
    setHearingsLoading(true)
    setHearingsError(null)
    setHearings([])
    setHearingsTin(tin)
    ;(async () => {
      try {
        const res = await fetch(`/api/court-hearings?tin=${encodeURIComponent(tin)}&days=90`, {
          signal: AbortSignal.timeout(120000),
        })
        const json = await res.json()
        if (cancelled) return
        if (!json.ok) throw new Error(json.error || `HTTP ${res.status}`)
        const list: StatsHearing[] = Array.isArray(json.hearings) ? json.hearings : []
        setHearings(list)
        if (list.length === 0) {
          showToast('Bu sud uchun kelajakdagi majlislar topilmadi', 'info')
        }
      } catch (e) {
        if (cancelled) return
        setHearingsError(e instanceof Error ? e.message : 'Tarmoq xatosi')
        // On error, clear the ref so a subsequent folder re-open retries
        hearingsFetchedTinRef.current = null
      } finally {
        if (!cancelled) setHearingsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [activeFolder, data?.company?.tin, showToast])

  /** Map a jadval2 claimtype (CIVIL/ECONOMIC/CONFLICT) → our CourtType so
   *  clicking a hearing card jumps to the right court in the Sud ishlari tab. */
  const hearingCourtType = useCallback((claimtype: string): string => {
    const ct = (claimtype || '').toUpperCase()
    if (ct === 'ECONOMIC') return 'economic'
    if (ct === 'CIVIL') return 'civil'
    if (ct === 'CONFLICT') return 'administrative'
    return 'civil'
  }, [])

  const handleHearingClick = useCallback((h: StatsHearing) => {
    onViewCase(h.casenumber, hearingCourtType(h.claimtype))
  }, [onViewCase, hearingCourtType])

  const handleSummaryClick = useCallback((folder: FolderId, outcomeFilter: OutcomeFilter) => {
    setActiveFolder(folder)
    setOutcome(outcomeFilter)
  }, [])

  const handleCtCardClick = useCallback((folder: FolderId) => {
    setActiveFolder(folder)
    setOutcome('all')
  }, [])

  const handleCaseClick = useCallback((c: StatsCase) => {
    // Convert StatsCase → CourtCase so the Sud ishlari tab can render it
    // instantly without re-fetching by case number. StatsCase has the role +
    // counterparty; we derive plaintiff/defendant using the company name.
    const companyName = data?.company?.name || ''
    const caseData: CourtCase = {
      caseNumber: c.caseNumber,
      caseType: c.category || '',
      // We don't have a real caseStatus here — derive from classification.
      // Use Latin-Uzbek strings so the badge lookup resolves to the correct
      // tone + label without leaking Cyrillic into the UI.
      caseStatus: c.classification === 'pending' ? 'Ish yurituvda' : 'Tugatilgan',
      result: c.result || '',
      courtName: c.court || '',
      dateFiled: c.regDate || '',
      plaintiff: c.role === 'plaintiff' ? companyName : c.counterparty,
      defendant: c.role === 'plaintiff' ? c.counterparty : companyName,
      claimAmount: '',
      hearingDate: '',
      hearingTime: '',
      judge: '',
    }
    onViewCase(c.caseNumber, c.courtType, caseData)
  }, [onViewCase, data?.company?.name])

  const handleCopy = useCallback((e: React.MouseEvent, caseNumber: string) => {
    e.stopPropagation()
    try {
      navigator.clipboard.writeText(caseNumber)
      showToast(`Nusxalandi: ${caseNumber}`, 'copy')
    } catch {
      showToast('Nusxalash amalga oshmadi', 'copy')
    }
  }, [showToast])

  // Toggle a court-type checkbox in the Excel download toolbar
  const toggleDlCourtType = useCallback((ct: StatsCourtType) => {
    setDlCourtTypes(prev => {
      const next = new Set(prev)
      if (next.has(ct)) next.delete(ct)
      else next.add(ct)
      return next
    })
  }, [])

  // Build + download an .xlsx workbook from the currently selected court types.
  // Improvement 8: POST the already-fetched cases to the server — no re-fetch,
  // so the export is instant (was 4-8s when the server re-ran the stats workflow).
  const handleDownloadExcel = useCallback(async () => {
    if (!data) return
    const selected = data.cases.filter(c => dlCourtTypes.has(c.courtType))
    if (selected.length === 0) {
      toast.error("Tanlangan sud turlarida ishlar yo'q")
      return
    }
    try {
      const res = await fetch(`/api/stats/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tin: data.company.tin,
          courtTypes: Array.from(dlCourtTypes),
          cases: selected,
          companyName: data.company.name || data.company.tin,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        toast.error(err.error || `Yuklab bo'lmadi (HTTP ${res.status})`)
        return
      }
      // Trigger browser download from the blob
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `statistika-${data.company.tin}-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`Excel yuklandi: ${selected.length} ta ish`)
    } catch (e) {
      toast.error(`Yuklab bo'lmadi: ${e instanceof Error ? e.message : 'xatolik'}`)
    }
  }, [data, dlCourtTypes])

  // Render a case card (used in folders 2/3/4)
  const renderCaseCard = useCallback((c: StatsCase) => {
    const outcomeBadgeClass =
      c.classification === 'win' ? 'b-win' :
      c.classification === 'lose' ? 'b-lose' :
      c.classification === 'neutral' ? 'b-neutral' : 'b-pending'
    const roleBadgeClass = c.role === 'plaintiff' ? 'b-plaintiff' : 'b-defendant'
    const resultClass = c.classification === 'pending' && (!c.result || c.result === '—')
      ? 'pending'
      : c.classification
    const resultText = (c.result && c.result !== '—')
      ? c.result
      : 'Qaror hali chiqmagan'
    const ResultIcon = c.classification === 'win' ? Trophy
      : c.classification === 'lose' ? XCircle
      : c.classification === 'neutral' ? MinusCircle : Clock

    return (
      <article
        key={c.caseNumber}
        className="case-card-stats"
        onClick={() => handleCaseClick(c)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCaseClick(c) }}
      >
        <div className="case-head">
          <div className="case-id-group">
            <p className="case-num-stats">{c.caseNumber}</p>
            <p className="case-reg">
              <CalendarDays className="w-[11px] h-[11px]" />
              {c.regDate || '—'}
            </p>
          </div>
          <button
            type="button"
            className="copy-btn-stats"
            onClick={(e) => handleCopy(e, c.caseNumber)}
            aria-label={`Nusxalash: ${c.caseNumber}`}
          >
            <Copy className="w-[13px] h-[13px]" />
          </button>
        </div>

        <div className="case-badges">
          <span className={`badge ${roleBadgeClass}`}>{ROLE_LABEL[c.role]}</span>
          <span className={`badge ${outcomeBadgeClass}`}>{OUTCOME_LABEL[c.classification]}</span>
        </div>

        <div className={`case-result ${resultClass}`}>
          <span className="cr-icon"><ResultIcon className="w-[13px] h-[13px]" /></span>
          <p className="cr-text">{resultText}</p>
        </div>

        <div className="case-meta-grid">
          <div className="meta-row">
            <p className="meta-lbl">Sud</p>
            <p className="meta-val">{c.court || '—'}</p>
          </div>
          <div className="meta-row">
            <p className="meta-lbl">Qarshi tomon</p>
            <p className="meta-val">{c.counterparty || '—'}</p>
          </div>
        </div>
      </article>
    )
  }, [handleCaseClick, handleCopy])

  // Render a filter bar (shared across all folders)
  const renderFilterBar = useCallback(() => (
    <div className="panel">
      <div className="stats-filter-bar">
        <div className="filter-group">
          <span className="chip-label">Davr:</span>
          {([
            { id: 'all', label: 'Hammasi' },
            { id: '1y', label: '1 yil' },
            { id: '6m', label: '6 oy' },
            { id: '30d', label: '30 kun' },
          ] as const).map(d => (
            <button
              key={d.id}
              type="button"
              className={`chip ${dateSpan === d.id ? 'is-active' : ''}`}
              onClick={() => setDateSpan(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
        <span className="filter-divider" />
        <div className="filter-group">
          <span className="chip-label">Holat:</span>
          {([
            { id: 'all', label: 'Hammasi' },
            { id: 'win', label: 'Yutdi' },
            { id: 'lose', label: 'Yutqazdi' },
            { id: 'neutral', label: 'Neitral' },
            { id: 'pending', label: 'Kutilmoqda' },
          ] as const).map(o => (
            <button
              key={o.id}
              type="button"
              className={`chip ${outcome === o.id ? 'is-active' : ''}`}
              onClick={() => setOutcome(o.id)}
            >
              {o.id !== 'all' && <span className="dot" />}
              {o.label}
            </button>
          ))}
        </div>
        <span className="filter-divider" />
        <div className="filter-group">
          <span className="chip-label">Saralash:</span>
          <div className="select-wrap">
            <select
              aria-label="Saralash tartibi"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
            >
              <option value="newest">Yangi → Eski</option>
              <option value="oldest">Eski → Yangi</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  ), [dateSpan, outcome, sort])

  const folderTabs: { id: FolderId; label: string; Icon: LucideIcon; count?: number }[] = [
    { id: 'tahlil', label: 'Tahlil', Icon: BarChart3 },
    { id: 'economic', label: 'Iqtisodiy', Icon: Building2, count: totalCounts.economic },
    { id: 'civil', label: 'Fuqarolik', Icon: Users, count: totalCounts.civil },
    { id: 'administrative', label: "Ma'muriy", Icon: Scale, count: totalCounts.administrative },
    { id: 'hearings', label: 'Majlislar', Icon: CalendarDays },
  ]

  return (
    <section className="glass anim-fade-up tab-section">
      <div className="eyebrow">
        <BarChart3 className="w-3 h-3" />
        <span>STATISTIKA · MY.SUD.UZ</span>
      </div>
      <h2 className="h-display">
        Kompaniya sud <span className="accent">statistikasi</span>
      </h2>
      <p className="lede">
        STIR raqamini kiriting — tizim iqtisodiy, fuqarolik va ma&apos;muriy sudlardagi barcha ishlarni real vaqtda yuklaydi, har birini Yutdi/Yutqazdi/Neitral bo&apos;yicha tasniflaydi.
      </p>

      <form className="search-row" onSubmit={onSubmit}>
        <div className="input-wrap" style={{ flex: 1, minWidth: 200 }}>
          <Search className="w-4 h-4" />
          <input
            inputMode="numeric"
            maxLength={9}
            value={tinInput}
            onChange={(e) => setTinInput(e.target.value.replace(/\D/g, '').slice(0, 9))}
            placeholder="STIR raqamini kiriting..."
            className="console-input"
            aria-label="Kompaniya STIR raqami"
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading || tinInput.length !== 9}>
          {loading ? <SvgSpinner className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
          <span>{loading ? 'Yuklanmoqda…' : "Statistikani ko'rish"}</span>
        </button>
      </form>

      <div className="chip-row" style={{ marginTop: 18, marginBottom: 0 }}>
        <span className="chip-label">Namunalar:</span>
        <button type="button" className="sample-chip" onClick={() => { setTinInput('302678824'); void fetchStats('302678824') }}>302 678 824</button>
        <button type="button" className="sample-chip" onClick={() => { setTinInput('305543087'); void fetchStats('305543087') }}>305 543 087</button>
        <button type="button" className="sample-chip" onClick={() => { setTinInput('301201019'); void fetchStats('301201019') }}>301 201 019</button>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ marginTop: 24 }}>
          <div className="phase-steps">
            <div className={`phase-step ${phase >= 1 ? 'is-active' : ''}`}>
              <span className="ps-icon">{phase >= 2 ? <CheckCheck className="w-3 h-3" /> : <Loader2 className="w-3 h-3 spin-anim" />}</span>
              orginfo.uz dan kompaniya ma&apos;lumotlari
            </div>
            <div className={`phase-step ${phase >= 2 ? (phase >= 3 ? 'is-done' : 'is-active') : ''}`}>
              <span className="ps-icon">{phase >= 3 ? <CheckCheck className="w-3 h-3" /> : phase === 2 ? <Loader2 className="w-3 h-3 spin-anim" /> : <Clock className="w-3 h-3" />}</span>
              3 sud turidagi ishlar parallel yuklanmoqda (iqtisodiy + fuqarolik + ma&apos;muriy)
            </div>
            <div className={`phase-step ${phase >= 3 ? 'is-done' : ''}`}>
              <span className="ps-icon">{phase >= 3 ? <CheckCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}</span>
              Tasniflash: Yutdi / Yutqazdi / Neitral / Kutilmoqda
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="skel-card">
                <div className="skel-line w-70 h-20" />
                <div className="skel-line w-30" />
                <div className="skel-line w-90" />
                <div className="skel-line w-50" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="decision-bar" style={{ marginTop: 24 }}>
          <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
          <div className="decision-text">
            <p className="t1">Xatolik</p>
            <p className="t2">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && !error && data && (
        <>
          {/* Folder-tab navigation (trapezoidal) */}
          <nav className="folder-nav-wrap" aria-label="Statistika papkalari" style={{ marginTop: 24 }}>
            <div className="folder-nav" role="tablist">
              {folderTabs.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeFolder === t.id}
                  className={`folder-tab ${activeFolder === t.id ? 'is-active' : ''}`}
                  onClick={() => setActiveFolder(t.id)}
                >
                  <t.Icon className="w-[14px] h-[14px]" />
                  <span>{t.label}</span>
                  {/* 'tahlil' is the overview (no count) · 'hearings' is lazy-loaded (no count) */}
                  {t.id !== 'tahlil' && t.id !== 'hearings' && (
                    <span className="ft-count">{t.count ?? 0}</span>
                  )}
                </button>
              ))}
            </div>
          </nav>

          {/* Errors from failed court types (if any) */}
          {data.errors.length > 0 && (
            <div className="decision-bar" style={{ marginTop: 12 }}>
              <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
              <div className="decision-text">
                <p className="t1">Ba&apos;zi sud turlarida xatolik</p>
                <p className="t2">
                  {data.errors.map(e => `${e.courtType}: ${e.error}`).join(' · ')}
                </p>
              </div>
            </div>
          )}

          <div className="folder-content">
            {/* ===== FOLDER 1: TAHLIL ===== */}
            <section
              className={`folder-panel ${activeFolder === 'tahlil' ? 'is-active' : ''}`}
              role="tabpanel"
              aria-labelledby="folder-tahlil"
            >
              {/* Company banner — entity summary at the very top */}
              <div className="company-banner tab-section-sm">
                <div className="cb-icon"><Building className="w-4 h-4" /></div>
                <div className="cb-text">
                  <p className="cb-name">{data.company.name}</p>
                  <p className="cb-sub">
                    STIR · {data.company.tin}
                    {data.company.region ? ` · ${data.company.region.split(',')[0]}` : ''}
                  </p>
                </div>
                <div className="cb-stats">
                  <div className="cb-stat"><span className="cb-v">{summary.total}</span><span className="cb-l">Jami</span></div>
                  <div className="cb-stat"><span className="cb-v">{summary.win}</span><span className="cb-l">Yutdi</span></div>
                  <div className="cb-stat"><span className="cb-v">{summary.lose}</span><span className="cb-l">Yutqazdi</span></div>
                  <div className="cb-stat"><span className="cb-v">{summary.neutral}</span><span className="cb-l">Neitral</span></div>
                </div>
              </div>

              {/* [v123] Download toolbar — moved to be RIGHT after the company
                  banner and BEFORE the summary cards, per the design spec:
                  "Users should see the export option first, then the stats.".
                  The filter bar that used to sit between them is now below the
                  summary cards so the eye reads: banner → export → summary. */}
              <div className="panel download-toolbar tab-section">
                <div className="dl-left">
                  <span className="dl-title">YUKLAB OLISH</span>
                  <div className="dl-chips">
                    {([
                      { id: 'economic', label: 'Iqtisodiy' },
                      { id: 'civil', label: 'Fuqarolik' },
                      { id: 'administrative', label: "Ma'muriy" },
                    ] as const).map(ct => (
                      <button
                        key={ct.id}
                        type="button"
                        className={`chip ${dlCourtTypes.has(ct.id) ? 'is-active' : ''}`}
                        onClick={() => toggleDlCourtType(ct.id)}
                        aria-pressed={dlCourtTypes.has(ct.id)}
                      >
                        {dlCourtTypes.has(ct.id) && <CheckCheck className="w-[11px] h-[11px]" />}
                        {ct.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleDownloadExcel}
                  disabled={dlCourtTypes.size === 0}
                >
                  <Download className="w-4 h-4" />
                  <span>EXCEL YUKLASH</span>
                </button>
              </div>

              {/* Summary cards — top-line stats, immediately after the export toolbar */}
              <div className="tab-section">
                <h3 className="h-section">
                  <Grid3x3 className="w-[11px] h-[11px]" style={{ width: 11, height: 11 }} />
                  Umumiy ko&apos;rsatkichlar
                </h3>
                <div className="summary-grid-stats">
                  <article
                    className="sum-card"
                    onClick={() => handleSummaryClick('economic', 'all')}
                    role="button"
                    tabIndex={0}
                  >
                    <p className="sc-label"><FolderOpen className="w-3 h-3" />Jami ishlar</p>
                    <p className="sc-num">{summary.total}</p>
                    <p className="sc-sub">
                      {summary.total > 0 ? `${Math.round(summary.win / summary.total * 100)}% yutdi · ${Math.round(summary.lose / summary.total * 100)}% yutqazdi` : 'ishlar topilmadi'}
                    </p>
                  </article>
                  <article
                    className="sum-card solid"
                    onClick={() => handleSummaryClick('economic', 'win')}
                    role="button"
                    tabIndex={0}
                  >
                    <p className="sc-label"><Trophy className="w-3 h-3" />Yutdi</p>
                    <p className="sc-num">{summary.win}</p>
                    <p className="sc-sub">{summary.total > 0 ? `${Math.round(summary.win / summary.total * 100)}% · To'liq / Qisman qanoatlantirilgan` : '—'}</p>
                  </article>
                  <article
                    className="sum-card outline"
                    onClick={() => handleSummaryClick('economic', 'lose')}
                    role="button"
                    tabIndex={0}
                  >
                    <p className="sc-label"><XCircle className="w-3 h-3" />Yutqazdi</p>
                    <p className="sc-num">{summary.lose}</p>
                    <p className="sc-sub">{summary.total > 0 ? `${Math.round(summary.lose / summary.total * 100)}% · Rad etilgan / Qaytarilgan` : '—'}</p>
                  </article>
                  <article
                    className="sum-card surface"
                    onClick={() => handleSummaryClick('civil', 'neutral')}
                    role="button"
                    tabIndex={0}
                  >
                    <p className="sc-label"><MinusCircle className="w-3 h-3" />Neitral</p>
                    <p className="sc-num">{summary.neutral}</p>
                    <p className="sc-sub">{summary.total > 0 ? `${Math.round(summary.neutral / summary.total * 100)}% · Javobgar sifatida bekor qilingan` : '—'}</p>
                  </article>
                </div>
              </div>

              {/* [v123] Filter bar — moved BELOW the summary cards (was between
                  the download toolbar and summary). Now the chart section and
                  case-list folders share this filter; the summary cards above
                  re-compute reactively when the date span changes. */}
              <div className="tab-section">
                {renderFilterBar()}
              </div>

              {/* Role breakdown */}
              <div className="tab-section">
                <h3 className="h-section">
                  <Users className="w-[11px] h-[11px]" style={{ width: 11, height: 11 }} />
                  Rol bo&apos;yicha tahlil
                </h3>
                <div className="role-grid">
                  {(['plaintiff', 'defendant'] as const).map(role => {
                    const r = roleBreakdown[role]
                    const total = r.total || 1
                    const winPct = (r.win / total) * 100
                    const losePct = (r.lose / total) * 100
                    const neutralPct = (r.neutral / total) * 100
                    const pendingPct = (r.pending / total) * 100
                    const Icon = role === 'plaintiff' ? Megaphone : Shield
                    return (
                      <article key={role} className="panel role-card">
                        <div className="rc-head">
                          <h4 className="rc-title">
                            <Icon className="w-[14px] h-[14px]" />
                            {ROLE_LABEL[role]} sifatida
                          </h4>
                          <span className="rc-total">{r.total} ish</span>
                        </div>
                        <div className="rc-bar">
                          {r.win > 0 && <div style={{ width: `${winPct}%` }} title="Yutdi" />}
                          {r.neutral > 0 && <div className="surface" style={{ width: `${neutralPct}%` }} title="Neitral" />}
                          {r.lose > 0 && <div className="outline" style={{ width: `${losePct}%` }} title="Yutqazdi" />}
                          {r.pending > 0 && <div className="surface" style={{ width: `${pendingPct}%`, opacity: 0.5 }} title="Kutilmoqda" />}
                        </div>
                        <div className="rc-legend">
                          <div className="rc-row">
                            <div className="rc-left"><span className="rc-swatch" />Yutdi</div>
                            <div className="rc-right">{r.win}<span className="rc-pct">{r.total > 0 ? `${Math.round(winPct)}%` : '—'}</span></div>
                          </div>
                          {r.neutral > 0 && (
                            <div className="rc-row">
                              <div className="rc-left"><span className="rc-swatch surface" />Neitral</div>
                              <div className="rc-right">{r.neutral}<span className="rc-pct">{Math.round(neutralPct)}%</span></div>
                            </div>
                          )}
                          <div className="rc-row">
                            <div className="rc-left"><span className="rc-swatch outline" />Yutqazdi</div>
                            <div className="rc-right">{r.lose}<span className="rc-pct">{r.total > 0 ? `${Math.round(losePct)}%` : '—'}</span></div>
                          </div>
                          {r.pending > 0 && (
                            <div className="rc-row">
                              <div className="rc-left"><span className="rc-swatch" style={{ opacity: 0.4 }} />Kutilmoqda</div>
                              <div className="rc-right">{r.pending}<span className="rc-pct">{Math.round(pendingPct)}%</span></div>
                            </div>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>

              {/* Chart A: Outcome Distribution Donut */}
              <div className="tab-section">
                <h3 className="h-section">
                  <Grid3x3 className="w-[11px] h-[11px]" style={{ width: 11, height: 11 }} />
                  Natija taqsimoti
                </h3>
                <div className="panel">
                  <div className="donut-chart">
                    {(() => {
                      const total = summary.total || 1
                      const winPct = (summary.win / total) * 100
                      const losePct = (summary.lose / total) * 100
                      const neutralPct = (summary.neutral / total) * 100
                      const pendingPct = (summary.pending / total) * 100
                      const p1 = winPct
                      const p2 = p1 + losePct
                      const p3 = p2 + neutralPct
                      const donutBg = summary.total > 0
                        ? `conic-gradient(var(--accent) 0% ${p1}%, color-mix(in srgb, var(--accent) 40%, transparent) ${p1}% ${p2}%, var(--surface-3) ${p2}% ${p3}%, var(--surface-2) ${p3}% 100%)`
                        : 'var(--surface-2)'
                      return (
                        <>
                          <div className="donut-ring" style={{ background: donutBg }}>
                            <div className="donut-center">
                              <span className="dc-num">{summary.total}</span>
                              <span className="dc-lbl">JAMI</span>
                            </div>
                          </div>
                          <div className="donut-legend">
                            <div className="dl-row">
                              <span className="dl-swatch dl-win" />
                              <span className="dl-label">Yutdi</span>
                              <span className="dl-count">{summary.win}</span>
                              <span className="dl-pct">{summary.total > 0 ? `${Math.round(winPct)}%` : '—'}</span>
                            </div>
                            <div className="dl-row">
                              <span className="dl-swatch dl-lose" />
                              <span className="dl-label">Yutqazdi</span>
                              <span className="dl-count">{summary.lose}</span>
                              <span className="dl-pct">{summary.total > 0 ? `${Math.round(losePct)}%` : '—'}</span>
                            </div>
                            <div className="dl-row">
                              <span className="dl-swatch dl-neutral" />
                              <span className="dl-label">Neitral</span>
                              <span className="dl-count">{summary.neutral}</span>
                              <span className="dl-pct">{summary.total > 0 ? `${Math.round(neutralPct)}%` : '—'}</span>
                            </div>
                            <div className="dl-row">
                              <span className="dl-swatch dl-pending" />
                              <span className="dl-label">Kutilmoqda</span>
                              <span className="dl-count">{summary.pending}</span>
                              <span className="dl-pct">{summary.total > 0 ? `${Math.round(pendingPct)}%` : '—'}</span>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Chart B: Win Rate by Court Type */}
              <div className="tab-section">
                <h3 className="h-section">
                  <Layers className="w-[11px] h-[11px]" style={{ width: 11, height: 11 }} />
                  Sud turi bo&apos;yicha g&apos;alaba darajasi
                </h3>
                <div className="panel">
                  <div className="winrate-chart">
                    {([
                      { id: 'economic', label: 'IQTISODIY' },
                      { id: 'civil', label: 'FUQAROLIK' },
                      { id: 'administrative', label: "MA'MURIY" },
                    ] as const).map(ct => {
                      const stat = courtTypeWinRates[ct.id]
                      const rate = stat.total > 0 ? Math.round((stat.wins / stat.total) * 100) : 0
                      return (
                        <div key={ct.id} className="winrate-row">
                          <span className="wr-label">{ct.label}</span>
                          <div className="winrate-bar-track">
                            <div className="winrate-bar-fill" style={{ width: `${rate}%` }} />
                          </div>
                          <span className="wr-value">
                            {stat.total > 0 ? `${stat.wins}/${stat.total} (${rate}%)` : '0 ish'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Chart C: Timeline chart removed in v116 (persistent overflow issue) */}

              {/* Court-type breakdown */}
              <div className="tab-section">
                <h3 className="h-section">
                  <Layers className="w-[11px] h-[11px]" style={{ width: 11, height: 11 }} />
                  Sud turi bo&apos;yicha
                </h3>
                <div className="courttype-grid">
                  {([
                    { id: 'economic', label: 'Iqtisodiy sud' },
                    { id: 'civil', label: 'Fuqarolar sudi' },
                    { id: 'administrative', label: "Ma'muriy sud" },
                  ] as const).map(ct => {
                    const n = totalCounts[ct.id]
                    const pct = summary.total > 0 ? Math.round((n / summary.total) * 100) : 0
                    return (
                      <article
                        key={ct.id}
                        className={`ct-card ${n === 0 ? 'is-empty' : ''}`}
                        onClick={() => handleCtCardClick(ct.id)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="ct-top">
                          <p className="ct-name">{ct.label}</p>
                          <span className="ct-arrow"><ArrowRight className="w-[14px] h-[14px]" /></span>
                        </div>
                        <p className="ct-num">{n}</p>
                        <p className="ct-pct">{pct}% · {n === 0 ? 'ishlar topilmadi' : 'barcha ishlardan'}</p>
                      </article>
                    )
                  })}
                </div>
              </div>

              {/* Categories */}
              {categories.length > 0 && (
                <div className="tab-section">
                  <h3 className="h-section">
                    <Tags className="w-[11px] h-[11px]" style={{ width: 11, height: 11 }} />
                    Kategoriya bo&apos;yicha — Top 5
                  </h3>
                  <div className="panel">
                    <div className="cat-list">
                      {categories.map(cat => {
                        const pct = summary.total > 0 ? (cat.count / summary.total) * 100 : 0
                        return (
                          <div key={cat.name} className="cat-row">
                            <div className="cat-left">
                              <p className="cat-name">{cat.name}</p>
                              <div className="cat-bar"><span style={{ width: `${pct}%` }} /></div>
                            </div>
                            <div className="cat-right">
                              <span className="cat-count">{cat.count}</span>
                              <span className="cat-of">/ {summary.total}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ===== FOLDERS 2/3/4: court-type case lists ===== */}
            {([
              { id: 'economic', label: 'Iqtisodiy sud' },
              { id: 'civil', label: 'Fuqarolar sudi' },
              { id: 'administrative', label: "Ma'muriy sud" },
            ] as const).map(folder => {
              const list = casesByType[folder.id]
              const total = totalCounts[folder.id]
              return (
                <section
                  key={folder.id}
                  className={`folder-panel ${activeFolder === folder.id ? 'is-active' : ''}`}
                  role="tabpanel"
                >
                  <div className="folder-header">
                    <h2 className="fh-title">{folder.label}</h2>
                    <span className="fh-count">{total} ta ish · {data.company.name}</span>
                  </div>

                  {total === 0 ? (
                    <div className="panel">
                      <div className="empty-state">
                        <div className="es-icon"><Inbox className="w-7 h-7" /></div>
                        <p className="es-title">Bu sud turida ishlar topilmadi</p>
                        <p className="es-sub">{data.company.name} · {folder.label.toLowerCase()}ga tortilmagan</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {renderFilterBar()}
                      <div className="result-meta">
                        <p className="rm-left">Ko&apos;rsatilmoqda: <strong>{list.length}</strong> / <strong>{total}</strong> ta ish</p>
                        <p className="rm-left" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-jakarta), system-ui, sans-serif', fontSize: '11.5px' }}>
                          Saralash: {sort === 'newest' ? 'Yangi → Eski' : 'Eski → Yangi'}
                        </p>
                      </div>
                      {list.length === 0 ? (
                        <div className="panel">
                          <div className="empty-state" style={{ padding: '32px 16px' }}>
                            <div className="es-icon"><Inbox className="w-7 h-7" /></div>
                            <p className="es-sub">Tanlangan filtrlar bo&apos;yicha ishlar topilmadi</p>
                          </div>
                        </div>
                      ) : (
                        <div className="case-list">
                          {list.map(renderCaseCard)}
                        </div>
                      )}
                    </>
                  )}
                </section>
              )
            })}

            {/* ===== FOLDER 5: MAJLISLAR (hearings — lazy-loaded) ===== */}
            <section
              className={`folder-panel ${activeFolder === 'hearings' ? 'is-active' : ''}`}
              role="tabpanel"
              aria-labelledby="folder-hearings"
            >
              <div className="folder-header">
                <h2 className="fh-title">Kelajakdagi sud majlislari</h2>
                <span className="fh-count">
                  {hearingsLoading
                    ? 'Yuklanmoqda…'
                    : hearings.length > 0
                      ? `${hearings.length} ta majlis · ${data.company.name}`
                      : hearingsError
                        ? 'Xatolik'
                        : `Majlislar yo'q · ${data.company.name}`}
                </span>
              </div>

              {/* Loading state */}
              {hearingsLoading && (
                <div className="panel">
                  <div className="loading-head">
                    <SvgSpinner />
                    <div>
                      <div className="loading-title">
                        Kompaniya manzili bo&apos;yicha sud majlislari qidirilmoqda…
                      </div>
                      <div className="loading-sub">
                        orginfo.uz → sudni aniqlash → jadvalapi.sud.uz (90 kun × 3 sud turi)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error state */}
              {!hearingsLoading && hearingsError && (
                <div className="decision-bar">
                  <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
                  <div className="decision-text">
                    <p className="t1">Xatolik</p>
                    <p className="t2">{hearingsError}</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!hearingsLoading && !hearingsError && hearings.length === 0 && (
                <div className="panel">
                  <div className="empty-state">
                    <div className="es-icon"><Inbox className="w-7 h-7" /></div>
                    <p className="es-title">Kelajakdagi sud majlislari topilmadi</p>
                    <p className="es-sub">
                      {data.company.name} · eng yaqin sud uchun 90 kun ichida rejalashtirilgan majlislar yo&apos;q
                    </p>
                  </div>
                </div>
              )}

              {/* Hearing cards — clickable, jump to Sud ishlari tab */}
              {!hearingsLoading && !hearingsError && hearings.length > 0 && (
                <>
                  <div className="result-meta">
                    <p className="rm-left">Ko&apos;rsatilmoqda: <strong>{hearings.length}</strong> ta sud majlisi · 90 kun ichida</p>
                    <p className="rm-left" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-jakarta), system-ui, sans-serif', fontSize: '11.5px' }}>
                      Karta ustiga bosing — Sud ishlari bo&apos;limiga o&apos;tadi
                    </p>
                  </div>
                  <div className="case-list">
                    {hearings.map((h, i) => {
                      // Match company name against plaintiff/defendant to highlight the company's role
                      const compName = data.company.name || ''
                      const compKey = compName.toLowerCase().split('"')[1]?.split('"')[0] ?? compName.toLowerCase()
                      const isPlaintiff = !!compKey && h.claiment?.toLowerCase().includes(compKey)
                      const isDefendant = !!compKey && h.defendant?.toLowerCase().includes(compKey)
                      return (
                        <article
                          key={`${h.casenumber}-${i}`}
                          className="case-card-stats"
                          onClick={() => handleHearingClick(h)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleHearingClick(h) }}
                        >
                          <div className="case-head">
                            <div className="case-id-group">
                              <p className="case-num-stats">{h.casenumber}</p>
                              <p className="case-reg">
                                <CalendarDays className="w-[11px] h-[11px]" />
                                {h.hearing_date} · {h.hearing_time}
                              </p>
                            </div>
                          </div>

                          <div className="case-badges">
                            {isPlaintiff && <span className="badge b-plaintiff">{ROLE_LABEL.plaintiff}</span>}
                            {isDefendant && <span className="badge b-defendant">{ROLE_LABEL.defendant}</span>}
                            {h.claimtype === 'CIVIL' && <span className="badge b-court-civ">Fuqarolik</span>}
                            {h.claimtype === 'ECONOMIC' && <span className="badge b-court-econ">Iqtisodiy</span>}
                            {h.claimtype === 'CONFLICT' && <span className="badge b-court-adm">Ma&apos;muriy</span>}
                            <span className="badge b-duty">{h.instance}</span>
                          </div>

                          <div className="case-meta-grid">
                            <div className="meta-row">
                              <p className="meta-lbl">Sudya</p>
                              <p className="meta-val">{h.responsible || '—'}</p>
                            </div>
                            <div className="meta-row">
                              <p className="meta-lbl">Kategoriya</p>
                              <p className="meta-val">{h.category || '—'}</p>
                            </div>
                            <div className="meta-row">
                              <p className="meta-lbl">Da&apos;vogar</p>
                              <p className="meta-val" style={isPlaintiff ? { fontWeight: 700 } : undefined}>
                                {h.claiment || '—'}
                              </p>
                            </div>
                            <div className="meta-row">
                              <p className="meta-lbl">Javobgar</p>
                              <p className="meta-val" style={isDefendant ? { fontWeight: 700 } : undefined}>
                                {h.defendant || '—'}
                              </p>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </>
              )}
            </section>
          </div>
        </>
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100, display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '12px 18px', background: 'var(--accent)', color: 'var(--void)',
            border: '1px solid var(--accent)', boxShadow: 'var(--shadow-3)',
            fontFamily: 'var(--font-jetbrains), ui-monospace, monospace', fontSize: 12,
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
            maxWidth: 'calc(100vw - 32px)',
          }}
        >
          {toastMsg.kind === 'copy' ? <CheckCheck className="w-[14px] h-[14px]" /> : <ArrowRight className="w-[14px] h-[14px]" />}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{toastMsg.msg}</span>
        </div>
      )}
    </section>
  )
}

// ---- Main page -------------------------------------------------------

export default function Home() {
  const [inn, setInn] = useState('302678824')
  const [invoiceInput, setInvoiceInput] = useState('')
  const [searchMode, setSearchMode] = useState<'inn' | 'invoice'>('inn')
  const [loading, setLoading] = useState(false)
  const [bills, setBills] = useState<EnrichedBill[]>([])
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [searched, setSearched] = useState(false)
  const [torStatus, setTorStatus] = useState<'checking' | 'active' | 'inactive'>('checking')
  const [torInstalling, setTorInstalling] = useState(false)
  const [phase, setPhase] = useState<{ phase: string; detail?: string } | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set())
  const [billPageSize, setBillPageSize] = useState<PageSize>(10)
  const [billPage, setBillPage] = useState(0)
  const [recent, setRecent] = useState<{ inn: string; lastSearchedAt: string }[]>([])
  const [tab, setTab] = useState<'bills' | 'cases' | 'hearings' | 'company' | 'stats'>('bills')
  const [pendingCaseNumber, setPendingCaseNumber] = useState<string | null>(null)
  const [pendingCourtType, setPendingCourtType] = useState<CourtType | null>(null)
  // Improvement 2: when Stats tab clicks a case, we pass the full case object
  // so CourtCasesTab can render it INSTANTLY without re-fetching by case number.
  const [pendingCaseData, setPendingCaseData] = useState<CourtCase | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const innInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setRecent(loadRecent())
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return
      e.preventDefault()
      innInputRef.current?.focus()
      innInputRef.current?.select?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const checkTorStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/tor-status', { signal: AbortSignal.timeout(3000) })
      const data = (await res.json()) as { available: boolean }
      setTorStatus(data.available ? 'active' : 'inactive')
    } catch {
      setTorStatus('inactive')
    }
  }, [])

  useEffect(() => {
    checkTorStatus()
    const interval = setInterval(checkTorStatus, 15000)
    return () => clearInterval(interval)
  }, [checkTorStatus])

  const handleTorInstall = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setTorInstalling(true)
      setTorStatus('checking')
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/tor-install', { method: 'POST', body: formData })
        const data = (await res.json()) as { ok: boolean; error?: string; message?: string }
        if (!data.ok) {
          toast.error(data.error ?? "O'rnatish muvaffaqiyatsiz tugadi")
          setTorStatus('inactive')
          return
        }
        toast.success("Tor o'rnatildi. Proxy ishga tushmoqda (~30s)…")
        try {
          const spawnRes = await fetch('/api/tor-status', { method: 'POST' })
          const spawnData = (await spawnRes.json()) as { ok: boolean; available: boolean; error?: string }
          if (spawnData.available) {
            setTorStatus('active')
            toast.success("Tor faol! Endi to'lovlarni qidirishingiz mumkin.")
            return
          }
        } catch { /* spawn may take time */ }
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 3000))
          try {
            const statusRes = await fetch('/api/tor-status', { signal: AbortSignal.timeout(3000) })
            const statusData = (await statusRes.json()) as { available: boolean }
            if (statusData.available) {
              setTorStatus('active')
              toast.success("Tor faol! Endi to'lovlarni qidirishingiz mumkin.")
              return
            }
          } catch { /* keep polling */ }
        }
        setTorStatus('inactive')
        toast.error('Tor 60s ichida ishga tushmadi.')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "O'rnatish muvaffaqiyatsiz tugadi")
        setTorStatus('inactive')
      } finally {
        setTorInstalling(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [checkTorStatus],
  )

  const runSearch = useCallback(async (innValue: string) => {
    const clean = innValue.trim()
    if (!/^\d{9}$/.test(clean)) {
      toast.error("STIR aynan 9 ta raqamdan iborat bo'lishi kerak")
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setBills([])
    setTotal(0)
    setLoaded(0)
    setError(null)
    setSearched(true)
    setElapsed(0)
    setFilters(new Set())
    setPhase({ phase: 'connecting', detail: 'billing.sud.uz ga ulanilmoqda…' })
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    try {
      const res = await fetch(`/api/bills?inn=${encodeURIComponent(clean)}`, { signal: ctrl.signal })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let collected: EnrichedBill[] = []
      let totalBills = 0
      let succeeded = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const msg = JSON.parse(line)
            if (msg.type === 'phase') {
              setPhase({ phase: msg.phase, detail: msg.detail })
            } else if (msg.type === 'meta') {
              totalBills = msg.total
              setTotal(msg.total)
            } else if (msg.type === 'bill') {
              collected.push(msg.bill)
              setBills([...collected])
              setLoaded(collected.length)
            } else if (msg.type === 'done') {
              succeeded = true
              upsertRecent(clean)
              setRecent(loadRecent())
              if (collected.length === 0) toast.info("Ushbu STIR uchun to'lovlar topilmadi")
              else toast.success(`${collected.length} ta to'lov import qilindi`)
              setPhase(null)
            } else if (msg.type === 'error') {
              throw new Error(msg.error)
            }
          } catch { /* ignore malformed line */ }
        }
      }
      if (!succeeded) {
        if (totalBills > 0 || collected.length > 0) {
          upsertRecent(clean)
          setRecent(loadRecent())
        }
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        const msg = e instanceof Error ? e.message : 'Network error'
        setError(msg)
        toast.error(msg)
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      setLoading(false)
    }
  }, [])

  useEffect(() => () => {
    abortRef.current?.abort()
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  // Single-bill lookup: fetch one bill by its 12-digit invoice number via the
  // billing.sud.uz checkStatus endpoint (GET /api/bills?invoice=NUMBER).
  const runSingleBillSearch = useCallback(async (invoiceNumber: string) => {
    const clean = invoiceNumber.trim()
    if (!/^\d{12}$/.test(clean)) {
      toast.error('Kvitansiya raqami 12 ta raqamdan iborat bo\'lishi kerak')
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setBills([])
    setTotal(0)
    setLoaded(0)
    setError(null)
    setSearched(true)
    setElapsed(0)
    setFilters(new Set())
    setPhase({ phase: 'connecting', detail: 'Kvitansiya holati billing.sud.uz dan tekshirilmoqda…' })
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    try {
      const res = await fetch(`/api/bills?invoice=${encodeURIComponent(clean)}`, { signal: ctrl.signal })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const detail = data.bill
      const bill: EnrichedBill = {
        number: clean,
        invoiceStatus: detail?.invoiceStatus ?? 'UNKNOWN',
        issued: detail?.issued ?? null,
        detail,
      }
      setBills([bill])
      setTotal(1)
      setLoaded(1)
      setPhase(null)
      toast.success('Kvitansiya topildi')
    } catch (e) {
      if (!ctrl.signal.aborted) {
        const msg = e instanceof Error ? e.message : 'Network error'
        setError(msg)
        toast.error(msg)
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      setLoading(false)
    }
  }, [])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchMode === 'invoice') {
      runSingleBillSearch(invoiceInput)
    } else {
      runSearch(inn)
    }
  }

  const dataInn = inn

  const sortedBills = [...bills].sort((a, b) => {
    const da = Number(a.detail?.issued ?? a.issued) || 0
    const db = Number(b.detail?.issued ?? b.issued) || 0
    if (sortBy === 'newest') return db - da
    return da - db
  })

  const filteredBills = useMemo(() => {
    if (filters.size === 0) return sortedBills
    return sortedBills.filter((b) => {
      const st = b.detail?.invoiceStatus ?? b.invoiceStatus
      const cat = categoryMeta(b.detail?.payCategory, b.detail?.description)
      if (filters.has('paid') && !isPaidStatus(st)) return false
      if (filters.has('unpaid') && !isUnpaidStatus(st)) return false
      if (filters.has('davlat_boji') && cat.kind !== 'davlat_boji') return false
      if (filters.has('pochta') && cat.kind !== 'pochta') return false
      return true
    })
  }, [sortedBills, filters])

  useEffect(() => { setBillPage(0) }, [filters, sortBy, inn, billPageSize])

  const billTotalPages = Math.max(1, Math.ceil(filteredBills.length / billPageSize))
  const safeBillPage = Math.min(billPage, billTotalPages - 1)
  const pagedBills = filteredBills.slice(
    safeBillPage * billPageSize,
    safeBillPage * billPageSize + billPageSize,
  )

  const toggleFilter = (k: FilterKey) => {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const innHint =
    inn.length === 0 || inn.length === 9
      ? null
      : `9 ta raqam kiriting — yana ${9 - inn.length} ta qoldi`

  const onRecentClick = (rinn: string) => {
    setInn(rinn)
    runSearch(rinn)
  }
  const onRecentRemove = (rinn: string) => {
    removeRecent(rinn)
    setRecent(loadRecent())
    toast.info("So'nggi qidiruvlardan olib tashlandi")
  }

  const hasResults = bills.length > 0

  /** "Ko'rish" button: switch to cases tab and prefill the case number. */
  const handleViewCase = useCallback((caseNumber: string, courtType?: string, caseData?: CourtCase | null) => {
    if (!caseNumber) return
    setPendingCaseNumber(caseNumber)
    setPendingCaseData(caseData ?? null)
    // Map court type string to CourtType — fixes the bug where clicking
    // "Ko'rish" on a civil/admin case always opened economic court.
    if (courtType) {
      const ct = courtType.toLowerCase()
      let mapped: CourtType = 'economic'
      if (ct.includes('civil') || ct.includes('fuqarolik') || ct.includes('citizen')) mapped = 'civil'
      else if (ct.includes('admin') || ct.includes("ma'muriy") || ct.includes('m amuriy') || ct.includes('conflict')) mapped = 'administrative'
      else if (ct.includes('criminal') || ct.includes('jinoyat')) mapped = 'criminal'
      else if (ct.includes('economic') || ct.includes('iqtisodiy')) mapped = 'economic'
      setPendingCourtType(mapped)
    }
    setTab('cases')
  }, [])

  return (
    <>
      {/* Animated blob field + grain overlay (Monochrome Glass background) */}
      <div className="blob-field">
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
      </div>
      <div className="grain" />

      <div className="shell">
        {/* ====================== HEADER ====================== */}
        <header className="app-header">
          <div className="header-inner">
            <div className="brand">
              <div className="brand-mark">
                <Scale className="w-[18px] h-[18px]" />
              </div>
              <div className="brand-text">
                <h1 className="brand-title">Sud Billing Lookup</h1>
                <p className="brand-sub">v132</p>
              </div>
            </div>
            <div className="header-right">
              <TorStatusBadge
                status={torStatus}
                onInstall={() => fileInputRef.current?.click()}
                installing={torInstalling}
              />
              <ThemeToggle />
              <a
                href="https://billing.sud.uz"
                target="_blank"
                rel="noopener noreferrer"
                className="ext-link"
              >
                <span className="hidden sm:inline">billing.sud.uz</span>
                <span className="sm:hidden">sud.uz</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </header>

        {/* ====================== MAIN ====================== */}
        <main className="main-content">
          {/* Hidden file input for Tor install */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".tar.gz,.tgz,application/gzip"
            onChange={handleTorInstall}
            className="hidden"
            aria-hidden="true"
          />

          {/* ====================== TABS (liquid-rail) ====================== */}
          <div className="tabs-wrap anim-fade-up">
            <nav className="liquid-rail" role="tablist" aria-label="Asosiy bo'limlar">
              {([
                { id: 'bills',         label: "To'lovlar",        Icon: Receipt     },
                { id: 'cases',         label: 'Sud ishlari',      Icon: Gavel       },
                { id: 'hearings',      label: 'Sud majlislari',   Icon: CalendarDays },
                { id: 'company',       label: 'Kompaniya',         Icon: Building2   },
                { id: 'stats',         label: 'Statistika',        Icon: BarChart3   },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`tab-btn ${tab === t.id ? 'is-active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  <t.Icon className="w-[15px] h-[15px]" />
                  <span className="tab-label">{t.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* ============================================================ */}
          {/* ====================== BILLS TAB ========================== */}
          {/* ============================================================ */}
          <section
            className={`tab-panel ${tab === 'bills' ? 'is-active' : ''}`}
            data-panel="bills"
            role="tabpanel"
          >
            {/* Search hero */}
            <section className="glass anim-fade-up tab-section">
              <div className="eyebrow">
                <Receipt className="w-3 h-3" />
                <span>O'ZBEKISTON · BILLING.SUD.UZ</span>
              </div>
              <h2 className="h-display">Kompaniya nomiga chiqarilgan barcha <span className="accent">to'lovlarni</span> import qiling</h2>
              <p className="lede">
                STIR raqamini kiriting — tizim billing.sud.uz saytidan barcha kvitansiyalarni real vaqtda yuklaydi.
              </p>

              <form className="search-row" onSubmit={onSubmit}>
                <div className="input-wrap" style={{ flex: 1, minWidth: 200 }}>
                  <Search className="w-4 h-4" />
                  {searchMode === 'inn' ? (
                    <input
                      ref={innInputRef}
                      inputMode="numeric"
                      maxLength={9}
                      value={inn}
                      onChange={(e) => setInn(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      placeholder="STIR raqamini kiriting..."
                      className="console-input"
                      aria-label="Kompaniya STIR raqami"
                      disabled={loading}
                    />
                  ) : (
                    <input
                      ref={innInputRef}
                      inputMode="numeric"
                      maxLength={12}
                      value={invoiceInput}
                      onChange={(e) => setInvoiceInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="Kvitansiya raqamini kiriting (12 raqam)"
                      className="console-input"
                      aria-label="Kvitansiya raqami"
                      disabled={loading}
                    />
                  )}
                </div>
                <button type="submit" className="btn-primary" disabled={loading || (searchMode === 'inn' ? inn.length !== 9 : invoiceInput.length !== 12)}>
                  {loading ? <SvgSpinner className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                  <span>{loading ? `${elapsed}s` : (searchMode === 'inn' ? "To'lovlarni qidirish" : 'Tekshirish')}</span>
                </button>
              </form>

              {/* Mode toggle: STIR (all bills) vs Kvitansiya (single bill) */}
              <div className="toggle-pair" style={{ marginTop: 18 }}>
                <button
                  type="button"
                  onClick={() => { setSearchMode('inn'); setBills([]); setSearched(false); }}
                  className={`toggle-btn ${searchMode === 'inn' ? 'is-active' : ''}`}
                >
                  STIR
                </button>
                <button
                  type="button"
                  onClick={() => { setSearchMode('invoice'); setBills([]); setSearched(false); }}
                  className={`toggle-btn ${searchMode === 'invoice' ? 'is-active' : ''}`}
                >
                  Kvitansiya
                </button>
              </div>

              {/* Sample chips + hints */}
              {searchMode === 'inn' && (
                <>
                  {innHint && (
                    <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 14, fontFamily: 'var(--font-jetbrains), monospace' }}>{innHint}</p>
                  )}
                  <div className="chip-row" style={{ marginTop: 14 }}>
                    <span className="chip-label">Sinab ko'ring:</span>
                    <button type="button" className="chip" onClick={() => setInn('302678824')} disabled={loading}>
                      302 678 824
                    </button>
                    <button type="button" className="chip" onClick={() => setInn('305543087')} disabled={loading}>
                      305 543 087
                    </button>
                    <button type="button" className="chip" onClick={() => setInn('301201019')} disabled={loading}>
                      301 201 019
                    </button>
                  </div>
                </>
              )}
              {searchMode === 'invoice' && invoiceInput.length > 0 && invoiceInput.length !== 12 && (
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 14, fontFamily: 'var(--font-jetbrains), monospace' }}>
                  12 ta raqam kiriting — yana {12 - invoiceInput.length} ta qoldi
                </p>
              )}

              {recent.length > 0 && (
                <div className="chip-row" style={{ marginTop: 14 }}>
                  <span className="chip-label">So'nggi:</span>
                  {recent.map((r) => (
                    <span
                      key={r.inn}
                      className="chip"
                      style={{ cursor: 'default' }}
                    >
                      <button
                        type="button"
                        onClick={() => onRecentClick(r.inn)}
                        disabled={loading}
                        style={{ color: 'var(--text-2)', fontWeight: 700 }}
                      >
                        {r.inn}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRecentRemove(r.inn)}
                        aria-label={`Remove ${r.inn}`}
                        style={{ color: 'var(--text-3)', marginLeft: 6 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Loading */}
            {loading && (
              <div className="tab-section">
                <BillsLoadingState
                  inn={inn}
                  loaded={loaded}
                  total={total}
                  elapsed={elapsed}
                  phase={phase}
                />
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="decision-bar tab-section">
                <div className="decision-icon"><AlertCircle className="w-4 h-4" /></div>
                <div className="decision-text">
                  <p className="t1">Qidiruv muvaffaqiyatsiz tugadi</p>
                  <p className="t2">
                    {error.toLowerCase().includes('fetch failed') ||
                    error.toLowerCase().includes('econnrefused') ||
                    error.toLowerCase().includes('unreachable')
                      ? "billing.sud.uz vaqtincha ishlamayapti. Server ishdan chiqqan yoki so'rovlar sonini cheklagan bo'lishi mumkin."
                      : error}
                  </p>
                  <button
                    type="button"
                    onClick={() => runSearch(dataInn)}
                    className="btn-ghost btn-sm"
                    style={{ marginTop: 8 }}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Qayta urinish
                  </button>
                </div>
              </div>
            )}

            {/* No results */}
            {!loading && !error && searched && bills.length === 0 && (
              <div className="panel tab-section" style={{ textAlign: 'center', borderStyle: 'dashed', maxWidth: 560, margin: '0 auto 20px' }}>
                <FolderOpen className="w-7 h-7" style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: '8px 0' }}>To&apos;lovlar topilmadi</h3>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
                  billing.sud.uz ma&apos;lumotlar bazasida STIR{' '}
                  <span className="mono" style={{ fontWeight: 700, color: 'var(--text-1)' }}>{formatTin(dataInn)}</span> bo&apos;yicha hech qanday kvitansiya ro&apos;yxatga olinmagan.
                </p>
              </div>
            )}

            {/* Results */}
            {hasResults && !loading && (
              <div>
                {/* INN bar */}
                <div className="panel anim-fade-up tab-section">
                  <div className="inn-bar">
                    <div className="inn-left">
                      <div className="inn-icon"><Building2 className="w-5 h-5" /></div>
                      <div>
                        <div className="inn-label">Kompaniya STIR raqami</div>
                        <div className="inn-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {formatTin(dataInn)}
                          <CopyButton value={dataInn} label="Nusxalash" />
                        </div>
                      </div>
                    </div>
                    <div className="inn-right">
                      <div className="inn-count">
                        <div className="num">{total || bills.length}</div>
                        <div className="lbl">Jami</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => runSearch(dataInn)}
                        disabled={loading}
                        className="btn-icon"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div className="tab-section">
                  <div className="h-section">
                    <Receipt className="w-3.5 h-3.5" />
                    Xulosa
                  </div>
                  <SummaryCards bills={bills} />
                </div>

                {/* Sort + filter bar */}
                <div className="panel tab-section">
                  <div className="filter-bar">
                    <div className="filter-left">
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Saralash:</span>
                      <div className="select-wrap">
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                        >
                          <option value="newest">Avval yangi</option>
                          <option value="oldest">Avval eski</option>
                        </select>
                      </div>
                      <div className="divider-vert" style={{ display: 'none' }} />
                      <div className="filter-left">
                        {FILTER_DEFS.map((f) => {
                          const on = filters.has(f.key)
                          return (
                            <button
                              key={f.key}
                              type="button"
                              onClick={() => toggleFilter(f.key)}
                              aria-pressed={on}
                              className={`chip ${on ? 'is-active' : ''}`}
                            >
                              <span className="dot" />
                              {f.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="select-wrap">
                      <select
                        value={String(billPageSize)}
                        onChange={(e) => setBillPageSize(Number(e.target.value) as PageSize)}
                      >
                        <option value="10">10 / sahifa</option>
                        <option value="20">20 / sahifa</option>
                        <option value="50">50 / sahifa</option>
                        <option value="100">100 / sahifa</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Bills list */}
                <div id="bills-list" className="tab-section">
                  {filteredBills.length === 0 ? (
                    <div className="panel" style={{ textAlign: 'center', borderStyle: 'dashed' }}>
                      <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Joriy filtrlarga mos to&apos;lov topilmadi.</p>
                    </div>
                  ) : (
                    pagedBills.map((b, i) => (
                      <BillCard
                        key={b.number + i}
                        bill={b}
                        index={safeBillPage * billPageSize + i}
                        onViewCase={handleViewCase}
                      />
                    ))
                  )}
                </div>

                {/* Pagination */}
                {filteredBills.length > 0 && (
                  <PageNav
                    page={safeBillPage}
                    pageSize={billPageSize}
                    total={filteredBills.length}
                    onPageChange={setBillPage}
                  />
                )}
              </div>
            )}

            {/* Default state */}
            {!loading && !searched && (
              <div className="quick-grid">
                {FEATURE_CARDS.map((f, i) => (
                  <FeatureCard key={f.title} Icon={f.Icon} title={f.title} desc={f.desc} idx={i} />
                ))}
              </div>
            )}
          </section>

          {/* ============================================================ */}
          {/* ====================== CASES TAB ========================== */}
          {/* ============================================================ */}
          <section
            className={`tab-panel ${tab === 'cases' ? 'is-active' : ''}`}
            data-panel="cases"
            role="tabpanel"
          >
            <CourtCasesTab
              onViewCase={handleViewCase}
              pendingCaseNumber={pendingCaseNumber}
              pendingCourtType={pendingCourtType}
              pendingCaseData={pendingCaseData}
              onCaseNumberConsumed={() => {
                setPendingCaseNumber(null)
                setPendingCourtType(null)
                setPendingCaseData(null)
              }}
            />
          </section>

          {/* ============================================================ */}
          {/* ====================== HEARINGS TAB ======================= */}
          {/* ============================================================ */}
          <section
            className={`tab-panel ${tab === 'hearings' ? 'is-active' : ''}`}
            data-panel="hearings"
            role="tabpanel"
          >
            <UpcomingHearingsTab onViewCase={handleViewCase} />
          </section>

          {/* ============================================================ */}
          {/* ====================== ALL HEARINGS TAB (removed v116) ==== */}
          {/* The Barcha majlislar tab was removed in v116. Its
              functionality moved to the MAJLISLAR folder inside the
              Stats tab (lazy-loaded when the folder is opened). */}

          {/* ============================================================ */}
          {/* ====================== COMPANY INFO TAB =================== */}
          {/* ============================================================ */}
          <section
            className={`tab-panel ${tab === 'company' ? 'is-active' : ''}`}
            data-panel="company"
            role="tabpanel"
          >
            <CompanyInfoTab
              onViewCases={() => setTab('cases')}
              onViewBills={() => setTab('bills')}
              onViewHearings={() => setTab('hearings')}
            />
          </section>

          {/* ============================================================ */}
          {/* ====================== STATS TAB (v109) =================== */}
          {/* ============================================================ */}
          <section
            className={`tab-panel ${tab === 'stats' ? 'is-active' : ''}`}
            data-panel="stats"
            role="tabpanel"
          >
            <StatsTab
              onViewCase={(caseNumber, courtType, caseData) => {
                setPendingCaseNumber(caseNumber)
                setPendingCourtType(courtType as CourtType)
                setPendingCaseData(caseData ?? null)
                setTab('cases')
              }}
            />
          </section>
        </main>

        {/* ====================== FOOTER ====================== */}
        <footer className="app-footer" data-version="v132">
          <div className="footer-inner">
            <div className="footer-text">Sud Billing Lookup v132</div>
          </div>
        </footer>
      </div>
    </>
  )
}
