# BUILD.md — Sud Billing Lookup v137 — Complete Build Specification

> **Purpose**: This document contains EVERY detail needed to rebuild the entire "Sud Billing Lookup" application from scratch as an interactive single-page application (HTML/CSS/JS or any framework). It is a faithful, exhaustive specification of the production app at version `v137`.
>
> **App summary**: A 6-tab Uzbek court-data aggregator. Users enter a company STIR (9-digit Taxpayer Identification Number) and the app scrapes `billing.sud.uz` (court fee receipts), `jadval.sud.uz` / `jadvalapi.sud.uz` (court cases + hearings), `orginfo.uz` (company register), `admin.chamber.uz` (contractor rating), and `mib.uz` (enforcement debts) to surface every receipt, case, hearing, and rating for that company — with monthly-trend charts, an Excel export, a compare-two-companies mode, and a multi-company watchlist dashboard.
>
> **Design language**: "Monochrome Glass" — pure black & white, brutalist sharp edges (`border-radius: 0` everywhere), glassmorphism panels over an animated blob field + grain overlay, light/dark theme.
>
> **Production stack**: Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + sonner toasts + lucide-react icons + Prisma (SQLite) + Cloudflare Worker CORS proxies + an optional Tor SOCKS5 fallback proxy. The entire UI is a single `'use client'` page (`src/app/page.tsx`, 5809 lines). All Uzbek-court scraping logic lives in 14 server-side library files (`src/lib/`). All HTTP endpoints live in 13 API route files (`src/app/api/`).
>
> **Document structure**:
> - **Part 1** — Frontend specification (`src/app/page.tsx`): every type, component, state, prop, API call, UI string, tab, feature.
> - **Part 2** — CSS design system (`src/app/globals.css`): every variable, class, animation, breakpoint, scrollbar rule.
> - **Part 3** — API reference (`src/app/api/`): every endpoint, request/response shape, external service, caching, error handling.
> - **Part 4** — Library reference (`src/lib/`): every exported function, algorithm, external API, constant, retry strategy.
> - **Part 5** — Root layout (`src/app/layout.tsx`): fonts, metadata, theme bootstrap, toast mounts.
> - **Part 6** — Rebuild checklist: the 30+ steps to reconstruct this as a single interactive HTML file.

---

## Table of Contents

### Part 1 — Frontend (`src/app/page.tsx`)
1. Imports & external dependencies
2. Imported types & constants (from `@/lib/court-case-types.ts`)
3. Cache module (from `@/lib/cache.ts`)
4. All TypeScript type definitions declared in `page.tsx`
5. Constants: `PHASE_STEPS`, `COURT_PHASE_STEPS`, `FEATURE_CARDS`, `TREND_MONTH_ABBR`
6. Helper functions + `useCountUp` hook
7. All React components (30+)
8. Tab system
9. API endpoints (every `fetch()` call from the frontend)
10. STIR input system
11. Watchlist feature
12. Compare mode in Stats (v134 Feature 3)
13. Theme toggle
14. Tor (TOR proxy) status indicator
15. Version number
16. pendingCaseData flow (Stats → Cases instant render)
17. Export / download features
18. Pagination
19. Filtering
20. Notification system (toasts)
21. Complete Uzbek UI strings catalogue
22. CSS class catalogue
23. Build notes for single-HTML-file rebuild

### Part 2 — CSS Design System (`src/app/globals.css`)
24. Tailwind imports + `@theme` bindings
25. Design tokens (`:root` light + `[data-theme='dark']` dark)
26. Global reset
27. Monochrome Glass aesthetic (blobs + grain + glass)
28. Every component class
29. `@keyframes` animations
30. Responsive breakpoints
31. Footer sticky mechanic
32. Scrollbar styling
33. Utility classes
34. Design-system cheat sheet
35. CSS rebuild checklist

### Part 3 — API Reference (`src/app/api/`)
36. Cross-cutting concerns (CF Workers, caching, Tor, Excel pattern)
37. All 13 endpoints (request/response shapes)
38. External services map
39. Environment variables

### Part 4 — Library Reference (`src/lib/`)
40. `billing.ts` — billing.sud.uz scraper (ProxyPool, circuit breaker, captcha pipeline)
41. `court-case.ts` — e-sud.uz / my.sud.uz court case fetcher
42. `court-case-types.ts` — shared types + status constants
43. `court-map.ts` — TIN/address → court-code mapping
44. `jadval2.ts` — jadval2.sud.uz hearing schedule scanner
45. `orginfo.ts` — orginfo.uz company info fetcher
46. `chamber.ts` — chamber.uz contractor rating fetcher
47. `stats.ts` — stats aggregator
48. `mib.ts` — MIB debt check
49. `tor.ts` — Tor SOCKS5 proxy manager
50. `cache.ts` — client-side localStorage cache
51. `db.ts` — Prisma client singleton
52. `utils.ts` — `cn()` helper

### Part 5 — Root Layout (`src/app/layout.tsx`)
53. HTML attributes, fonts, metadata, FOUC prevention, body wrapper

### Part 6 — Rebuild Checklist
54. 30+ ordered steps to rebuild as a single interactive HTML file

---



---

# PART 1 — FRONTEND SPECIFICATION (`src/app/page.tsx`)

> **File**: `/home/z/my-project/src/app/page.tsx` — 5809 lines, `'use client'`, default export `Home`. Single Next.js page mounting a 6-tab workspace.


## 1. Imports & External Dependencies

```ts
'use client'
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
  CASE_STATUSES, HEARING_STATUSES, COURT_TYPE_LABELS,
  type CourtType, type SearchMode,
  type CourtCase, type InstanceData, type FullCaseData,
} from '@/lib/court-case-types'
import { getCached, setCached, cacheKey } from '@/lib/cache'
```

All icons come from **lucide-react**. Toasts come from **sonner** (`toast.success/error/info`).

---

## 2. Imported Types & Constants (from `@/lib/court-case-types.ts`)

```ts
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
```

### `CASE_STATUSES` — map of Cyrillic AND Latin keys → `{ en, color }`

| Key (Cyrillic / Latin) | en label | color |
|---|---|---|
| `Иш юритувда` / `Ish yurituvda` | Ish yurituvda | `#2563a8` |
| `Кўриб чиқилмоқда` / `Ko'rib chiqilmoqda` | Ko'rib chiqilmoqda | `#2563a8` |
| `Тугатилган` / `Tugatilgan` | Tugatilgan | `#1e7e44` |
| `Тўхтатилган` / `To'xtatilgan` | To'xtatilgan | `#c47d0e` |
| `Бекор қилинган` / `Bekor qilingan` | Bekor qilingan | `#6b7280` |
| `Апелляцияда` / `Apellyatsiyada` | Apellyatsiyada | `#6d3db5` |
| `Кассацияда` / `Kassatsiyada` | Kassatsiyada | `#4a1d96` |
| `Назоратда` / `Nazoratda` | Nazoratda | `#b91c1c` |
| `Ижро этилмоқда` / `Ijro etilmoqda` | Ijro etilmoqda | `#0e7490` |

### `HEARING_STATUSES` — 5 keys (Cyrillic + Latin) → `{ en, color }`

| Key | en | color |
|---|---|---|
| `Тайинланган` / `Tayinlangan` | Tayinlangan | `#3b82f6` |
| `Кечиктирилган` / `Kechiktirilgan` | Kechiktirilgan | `#f59e0b` |
| `Ўтказилган` / `O'tkazilgan` | O'tkazilgan | `#10b981` |
| `Бекор қилинган` / `Bekor qilingan` | Bekor qilingan | `#9ca3af` |
| `Якунланган` / `Yakunlangan` | Yakunlangan | `#1e7e44` |

### `COURT_TYPE_LABELS: Record<CourtType, { uz, en }>`

| CourtType | uz | en |
|---|---|---|
| `economic` | Iqtisodiy sudlar | Economic Courts |
| `civil` | Fuqarolik sudlar | Civil Courts |
| `criminal` | Jinoyat ishlari | Criminal Courts |
| `administrative` | Ma'muriy ishlar | Administrative Courts |

---

## 3. Cache Module (from `@/lib/cache.ts`)

```ts
const PREFIX = 'sb-cache:'
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | null
export function setCached<T>(key: string, data: T): void
export function clearCached(key: string): void

export const cacheKey = {
  companyInfo: (tin: string) => `company-info:${tin}`,
  stats:       (tin: string) => `stats:${tin}`,
  cases:       (courtType: string, mode: string, value: string) => `cases:${courtType}:${mode}:${value}`,
  upcoming:    (tin: string) => `upcoming:${tin}`,
}
```

Each cached value is stored as `{ data, ts }` under `localStorage['sb-cache:' + key]`. TTL enforced at read-time. Bills tab intentionally NOT cached (streams progressively).

---

## 4. All TypeScript Type Definitions Declared in `page.tsx`

### 4.1 Bills / invoices

```ts
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

interface BillListItem { number: string; invoiceStatus: InvoiceStatus; issued: number | null }

interface EnrichedBill extends BillListItem {
  detail: CheckStatusResponse | null
  error?: string
}
```

### 4.2 Filter + pagination types

```ts
type FilterKey = 'paid' | 'unpaid' | 'davlat_boji' | 'pochta'
type PageSize = 10 | 20 | 50 | 100
```

### 4.3 Watchlist / saved companies

```ts
interface SavedCompany { tin: string; name: string; savedAt: number }
interface WatchlistEntry { tin: string; name: string; addedAt: number }
interface WatchSummary {
  loading: boolean
  error: string | null
  stats?: { total: number; win: number; lose: number; neutral: number; pending: number }
  rating?: { score: number; category: string } | null
  nextHearing?: string | null
}
```

### 4.4 Upcoming hearing

```ts
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
```

### 4.5 Company info

```ts
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
    category: string          // 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D'
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
```

### 4.6 Stats types

```ts
type StatsCourtType      = 'economic' | 'civil' | 'administrative'
type StatsClassification = 'win' | 'lose' | 'neutral' | 'pending'
type StatsRole           = 'plaintiff' | 'defendant'

interface StatsCase {
  caseNumber: string
  courtType: StatsCourtType
  regDate: string         // 'DD.MM.YYYY'
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

interface StatsResponseOk  { ok: true;  company: StatsCompany; cases: StatsCase[]; summary: StatsSummary; errors: { courtType: string; error: string }[] }
interface StatsResponseErr { ok: false; error: string }

interface StatsHearing {
  casenumber: string
  hearing_date: string
  hearing_time: string
  responsible: string     // judge
  instance: string
  globalid: string
  claimkind: string
  claimtype: string       // 'CIVIL' | 'ECONOMIC' | 'CONFLICT'
  category: string
  case_id: string
  claiment: string        // plaintiff (API misspelling)
  defendant: string
}

type FolderId      = 'tahlil' | StatsCourtType | 'hearings'
type DateSpan      = 'all' | '1y' | '6m' | '30d'
type OutcomeFilter = 'all' | StatsClassification
type SortMode      = 'newest' | 'oldest'

interface TimelineMonth {
  month: string    // 'YYYY-MM'
  win: number
  lose: number
  neutral: number
  pending: number
  total: number
  cases: StatsCase[]
}
```

### 4.7 Status / category / filter constant maps

```ts
const STATUS_META: Record<string, { label: string; cls: string }> = {
  CREATED:         { label: "To'lanmagan",        cls: 'b-unpaid' },
  PARTIALLY_PAID:  { label: "Qisman to'langan",   cls: 'b-unpaid' },
  PAID:            { label: "To'liq to'langan",   cls: 'b-paid'   },
  CHECKING:        { label: 'Tasdiqlanmoqda',     cls: 'b-unpaid' },
  CANCELLED:       { label: 'Bekor qilingan',     cls: 'b-unpaid' },
  USED:            { label: 'Ishlatilgan',        cls: 'b-paid'   },
  SENT_TO_MIB:     { label: 'BPIga yuborilgan',   cls: 'b-unpaid' },
}

const COURT_TYPES: Record<string, { en: string; cls: string }> = {
  ECONOMIC:       { en: 'Iqtisodiy sud',   cls: 'b-court-econ' },
  CITIZEN:        { en: 'Fuqarolik sudi',  cls: 'b-court-civ'  },
  CRIMINAL:       { en: 'Jinoyat sudi',    cls: 'b-court-crim' },
  ADMINISTRATIVE: { en: "Ma'muriy sud",    cls: 'b-court-adm'  },
}

const OUTCOME_LABEL: Record<StatsClassification, string> = {
  win: 'Yutdi', lose: 'Yutqazdi', neutral: 'Neitral', pending: 'Kutilmoqda',
}
const ROLE_LABEL: Record<StatsRole, string> = {
  plaintiff: "Da'vogar", defendant: 'Javobgar',
}

const FILTER_DEFS: { key: FilterKey; label: string }[] = [
  { key: 'paid',        label: "To'langan"   },
  { key: 'unpaid',      label: "To'lanmagan" },
  { key: 'davlat_boji', label: 'Davlat boji' },
  { key: 'pochta',      label: 'Pochta'      },
]
```

### 4.8 localStorage keys

| Constant | Value |
|---|---|
| `RECENT_KEY` | `'sbl:recent-inns'` |
| `RECENT_MAX` | `5` |
| `SAVED_COMPANIES_KEY` | `'sud-saved-companies'` |
| `WATCHLIST_KEY` | `'sud-watchlist'` |
| Theme toggle key | `'mono-theme'` |
| Cache prefix | `'sb-cache:'` |

---

## 5. Constants

### 5.1 `PHASE_STEPS` (BillsLoadingState)

```ts
const PHASE_STEPS: { keys: string[]; label: string; Icon: LucideIcon }[] = [
  { keys: ['connecting'],                                              label: 'Ulanmoqda',    Icon: Link2       },
  { keys: ['captcha_pow','captcha_analyze','captcha_math'],            label: 'Kirish',       Icon: ShieldCheck },
  { keys: ['searching'],                                              label: 'Qidirilmoqda', Icon: Search      },
  { keys: ['enriching'],                                              label: 'Tafsilotlar',  Icon: Receipt     },
]
```

### 5.2 `COURT_PHASE_STEPS` (CourtLoadingState — time-based)

```ts
const COURT_PHASE_STEPS = [
  { label: 'Ulanmoqda',    Icon: Link2       },
  { label: 'Kirish',       Icon: ShieldCheck },
  { label: 'Qidirilmoqda', Icon: Search      },
]
// Index derived from elapsed seconds: <2s → 0, <5s → 1, else 2
```

### 5.3 `FEATURE_CARDS` (Bills tab default state)

| Icon | Title | Description |
|---|---|---|
| Receipt | Barcha kvitansiyalarni import | STIR bo'yicha yaratilgan har bir to'lov billing.sud.uz saytidan olinadi. |
| CheckCheck | Turi va holatini ko'rishi | Har bir to'lov davlat boji yoki pochta sifatida belgilanadi. |
| FolderOpen | Sud ish raqamlari | Har bir kvitansiya uchun uni ishlatgan sud hamda ish raqami ko'rsatiladi. |
| ShieldCheck | Maxfiy tarzda qidiriladi | So'rov Tor orqali amalga oshiriladi — qidiruvni qurilmangizga bog'lab bo'lmaydi. |

### 5.4 `COURT_FEATURE_CARDS` (Cases tab default — 4 tiles)

| Icon | Title | Description |
|---|---|---|
| FolderOpen | STIR / PINFL bo'yicha | Iqtisodiy va fuqarolik sudlarida kompaniya yoki jismoniy shaxs bilan bog'liq barcha ishlar. |
| Search | Ish raqami bo'yicha | Muayyan ishni raqami bo'yicha qidirib, to'liq tafsilotlarni ko'ring. |
| CalendarDays | Sud majlislari jadvali | Belgilangan, kechiktirilgan va o'tkazilgan majlislarni har bir instansiya uchun ko'ring. |
| FileText | Qarorlar va hujjatlar | Qaror matni, undirilgan summa, davlat boji va ish hujjatlarini yuklab oling. |

### 5.5 `COMPANY_FEATURE_CARDS` (Company tab default — 4 tiles)

| Icon | Title | Description |
|---|---|---|
| Building2 | Kompaniya ma'lumotlari | STIR bo'yicha orginfo.uz dan to'liq ma'lumot: nom, manzil, rahbar, status, ustav kapitali, kontaktlar. |
| Award | Pudratchi reytingi | chamber.uz ma'lumotnomasi — 0-100 ball, AAA-D toifa, soliq to'lovchi turi. |
| FileText | Faoliyat turi (OKED) | Kompaniyaning iqtisodiy faoliyat turi — OKED kodi, nomi, bo'limi bo'yicha to'liq ma'lumot. |
| Users | Ta'sinchilar | Kompaniya ta'sinchilari ro'yxati va ularning ulushlari foizda. |

### 5.6 `TREND_MONTH_ABBR`

```ts
const TREND_MONTH_ABBR = ['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek']
```

---

## 6. Helper Functions

| Function | Signature | Purpose |
|---|---|---|
| `formatSum(t)` | `(t: number \| null \| undefined) => string` | Divides by 100, formats `ru-RU` Intl, 2 fraction digits |
| `formatTin(tin)` | `(tin: string) => string` | Inserts spaces every 3 digits (`302 678 824`) |
| `formatDate(ts)` | `(ts: number \| null \| undefined) => string` | `en-GB` locale: `dd MMM yyyy, HH:MM`; `—` on null/NaN |
| `parseCaseDate(s)` | `(s: string \| null \| undefined) => number` | Parses `DD.MM.YYYY` or `Date.parse`; returns ms or 0 |
| `instanceLabel(s)` | `(s: string \| null \| undefined) => string` | `first`→`birinchi instansiya`, `appellate`→`apellyatsiya`, `cassation`→`kassatsiya` |
| `computeSummary(bills)` | `(bills: EnrichedBill[]) => {...}` | Returns `{paid, partial, unpaid, other, totalAmount, totalPaid, totalBalance, unpaidTotal}` |
| `isPaidStatus(s)` | | `s === 'PAID' \|\| s === 'USED'` |
| `isUnpaidStatus(s)` | | `s === 'CREATED' \|\| s === 'PARTIALLY_PAID' \|\| s === 'CHECKING'` |
| `categoryMeta(payCategory, description)` | | Detects `pochta` / `boj`; returns `{label, cls, kind}` |
| `ratingLabel(type)` | | `AAA/AA/A`→`Yuqori`, `BBB/BB/B`→`O'rta`, `CCC/CC/C`→`Qoniqarli`, `D`→`Quyu`, else `Noma'lum` |
| `parseStatsDate(s)` | | Parse `DD.MM.YYYY` → Date |
| `inDateSpan(dateStr, span)` | | `all` / `1y` / `6m` / `30d` window check |

### `useCountUp` hook

```ts
function useCountUp(target: number, opts: { duration?, delay?, money?, divisor? } = {}): string
// Default duration=800ms, delay=0, money=false, divisor=1
// Returns formatted string (money? -> ru-RU 2-digit / divisor; else Math.round(value))
// Uses requestAnimationFrame with cubic ease-out (1 - (1-t)^3)
```

### localStorage helpers

```ts
function loadRecent():   { inn: string; lastSearchedAt: string }[]
function saveRecent(items)
function upsertRecent(inn: string)
function removeRecent(inn: string)

function loadSavedCompanies(): SavedCompany[]
function saveCompany(company: SavedCompany)
function removeSavedCompanyFn(tin: string)

function loadWatchlist(): WatchlistEntry[]
function saveWatchlistEntry(e: WatchlistEntry)
function removeWatchlistEntry(tin: string)
```

---

## 7. All React Components

### 7.1 `SvgSpinner({ className })` — SVG spinner (static circle + animated arc)

### 7.2 `StatusBadge({ status })` — invoice status badge
- No status → `<span className="badge b-neutral">Noma'lum</span>`
- Looks up `STATUS_META[status]`; falls back to `b-neutral` + raw status text

### 7.3 `CourtTypeBadge({ type })` — court type badge
- Looks up `COURT_TYPES[type]`; `null` if no type; `b-neutral` fallback

### 7.4 `CategoryBadge({ payCategory, description })` — calls `categoryMeta()`

### 7.5 `CaseStatusBadge({ status })` — uses `CASE_STATUS_TONES` + `CASE_STATUSES[status]?.en`

### 7.6 `HearingStatusBadge({ status })` — uses `HEARING_STATUS_TONES` + `HEARING_STATUSES[status]?.en`

### 7.7 `CopyButton({ value, label })`
- Returns `null` if no value
- Local `copied` state (1.5s reset)
- `onClick`: `navigator.clipboard.writeText(value)` → `toast.success('${label ?? "Qiymat"} nusxalandi')`
- Class: `copy-btn`. Icon swaps `Copy` ↔ `CheckCheck`

### 7.8 `TorStatusBadge({ status, onInstall, installing })`

```ts
status: 'checking' | 'active' | 'inactive'
```

- `checking` → spinner + `Tor tekshirilmoqda…` (mobile: `Tor…`)
- `active` → green dot + `Tor faol`
- `inactive` → button with `ShieldCheck` icon (or spinner if installing) → label `Tor aniqlanmadi — o'rnatish` (mobile: `Tor`)
- Title: `Tor expert bundle (.tar.gz) faylini tanlang va o'rnating`

### 7.9 `ThemeToggle()`
- Reads `document.documentElement.getAttribute('data-theme') || 'light'`
- Toggles to opposite, sets `data-theme` on `<html>`, persists to `localStorage['mono-theme']`
- Renders `<button className="theme-toggle">` with both `<Sun className="theme-icon-dark" />` and `<Moon className="theme-icon-light" />`
- Aria-label / title: `Mavzu o'zgartirish`

### 7.10 `PageNav({ page, pageSize, total, onPageChange, label = "to'lov" })`
- `totalPages = max(1, ceil(total / pageSize))`
- If `totalPages <= 1`: single muted text `{total} ta {label} · {totalPages} sahifa`
- Else: prev `<` button + numbered buttons + next `>` button
- Active page class: `page-btn is-active`
- Aria-labels: `Oldingi sahifa`, `Keyingi sahifa`

### 7.11 `BillCard({ bill, index, onViewCase })`
**State**: `expanded` (boolean)
**Computed**: `detail`, `effectiveStatus`, `history`, `usedHistory` (USED/rolledBackAt/caseNumber), `spentAmount`

**UI structure**:
- `<article className="panel bill-card panel-hover anim-fade-up">`
  - `.bill-head` → `.bill-idx` (`#N`, receipt number + CopyButton, payer) + `.badge-row` (court type + category + status badges)
  - `.money-grid` → 5 `.money-cell`s: Kvitansiya / To'langan / To'lanmagan / Sarflangan / Qoldiq (each: `lbl`, `val`, `sub` "so'm")
  - `.info-grid` → Sud / Berilgan sana / Amal qilish muddati
  - Second `.info-grid` (full-width) → Maqsad
  - If `bill.error`: `.decision-bar` with `Tafsilot mavjud emas` + `bill.error`
  - If `hasCaseNumbers`: `.expand-btn` (`Sud tomonidan ishlatilishi (N)` / `Yashirish`)
    - Expanded: `.expand-content.is-open > .expand-inner`
      - If `claimCaseNumber`: `№ Da'vo ish raqami:` + CopyButton + `Ko'rish` button → `onViewCase(claimCaseNumber, courtType)`
      - `<table className="usage-table">` of `usedHistory` rows

### 7.12 `SummaryCard({ label, value, sub, Icon, big, tone, money, divisor, idx })`
- Calls `useCountUp(value, { duration:800, delay: 100+idx*50, money, divisor })`
- Class: `summary-cell paid|unpaid` based on tone
- Anim: `anim-fade-up` with `animationDelay: idx*0.05s`

### 7.13 `SummaryCards({ bills })` — 6 cards in order:
1. `Jami` (Receipt, big)
2. `To'langan` (CheckCheck, big, tone 'paid')
3. `To'lanmagan` (Clock, big, tone 'unpaid')
4. `Jami summa` (Wallet, money, divisor 100, sub "so'm")
5. `To'langan` (CheckCheck, money, divisor 100, sub "so'm", tone 'paid')
6. `Qarzdorlik` (AlertCircle, money, divisor 100, sub "so'm", tone 'unpaid')

Wraps in `<div className="summary-grid is-split">`.

### 7.14 `BillsLoadingState({ inn, loaded, total, elapsed, phase })`
- `pct = total > 0 ? round(loaded/total*100) : 0`
- `currentStepIndex` from `PHASE_STEPS.findIndex(s => s.keys.includes(phase.phase))`
- Renders `.glass.loading-box` with `.loading-head` (spinner + title + sub + `{elapsed}s o'tdi`)
- 4-step phase timeline when `total === 0 && phase && currentStepIndex >= 0`
- Progress bar when `total > 0`
- 3 shimmer skeleton cards when `total === 0`

### 7.15 `FeatureCard({ Icon, title, desc, idx })`
- Renders `<div className="quick-tile anim-fade-up" style={{ animationDelay: idx*0.06s }}>`
- Icon uses `var(--accent)`

### 7.16 `CourtLoadingState({ value, elapsed })`
- Step index from elapsed: `<2s → 0`, `<5s → 1`, else `2`
- Title: `"{value}" bo'yicha sud ishlari qidirilmoqda…`
- Sub: `my.sud.uz ochilmoqda, captcha yechilmoqda va so'rov yuborilmoqda.`

### 7.17 `InfoRow({ label, value, mono, Icon, hideIfEmpty })`
- Returns `null` if `hideIfEmpty && (!value || value === '—')`
- Renders `<dt>` (with optional icon) + `<dd className={mono ? 'mono' : ''}>` (value or `—`)

### 7.18 `InstanceView({ title, data })`
- If empty (no hearings, no decision, no appellate meta) → `null`
- Renders `.detail-section` with title (`{hearingCount} ta majlis, {docCount} ta hujjat`), appellate-meta `.decision-bar`, `.hearing-timeline`, decision `.decision-bar`, documents list

### 7.19 `CaseDetailView({ caseNumber, courtType })`
**State**: `data: FullCaseData | null`, `loading`, `error`, `elapsed`, `plaintiffTin`, `defendantTin`, `tinLoading`

**useEffect (on `[caseNumber, courtType]`)**:
- 1-second `setInterval` for elapsed timer
- `fetch('/api/court-cases?courtType=${courtType}&detail=${encodeURIComponent(caseNumber)}')`
- Then parallel `fetch('/api/company?name=${name}&tinOnly=true')` for plaintiff + defendant

**`handlePrintPDF()`**: Opens new browser window with print-optimised HTML, auto-triggers `window.print()` 400ms after load. Button label `PDF sifatida saqlash`.

**UI**: `.detail-panel` with `.detail-toolbar` (PDF button) + `.detail-section` with `.detail-grid` `<dl>` of InfoRow (Sud / Ish raqami / Ish turi / Ish holati / Sudya / Da'vo predmeti / Kotib / Da'vogar / Da'vogar STIR / Javobgar / Javobgar STIR / Uchinchi shaxs / Vakil / Prokuror / Da'vo summasi / Davlat boji / Ariza berilgan sana / Muddat sanasi) + `<InstanceView>` for firstInstance / appellate / cassation.

### 7.20 `CourtCaseCard({ caseData, courtType, index, expanded, onToggle })`
- `<article className="panel case-card panel-hover anim-fade-up">`
- `.bill-head` with `#N`, case number + CopyButton, caseType, `CaseStatusBadge`
- `.info-grid`: Sud / Ariza berilgan sana / Da'vogar / Javobgar
- If `result`: `.decision-bar` with `Natija: {result}`
- `.expand-btn` (`Tafsilotlarni ko'rish` / `Tafsilotlarni yashirish`)
- Expanded → `<CaseDetailView>`

### 7.21 `UpcomingHearingsTab({ onViewCase })`
**State**: `savedCompanies`, `selectedTin`, `hearings: UpcomingHearing[]`, `loading`, `error`, `elapsed`, `addTin`, `addName`

**`fetchHearings(tin)`**:
- 5-min cache (`cacheKey.upcoming(tin)`)
- `fetch('/api/upcoming-hearings?tin=${tin}')` → `data.ok ? setHearings(data.hearings) + cache : setError`

**`handleAddCompany()`**: Validates 9-digit TIN, `saveCompany({tin, name, savedAt: Date.now()})` + refresh.

**`handleRemoveCompany(tin)`**: removes from localStorage + list.

**UI structure**:
- Hero `.glass.tab-section` with eyebrow `O'ZBEKISTON · MY.SUD.UZ`, title `Rejalashtirilgan sud majlislari`
- Saved-companies section (`.h-section` `Saqlangan kompaniyalar (N)` + `.company-list` of `.company-tile`s)
- Error / loading / results / no-results states
- Default state: 4 FeatureCards

### 7.22 `UpcomingHearingCard({ hearing, onViewCase, index })`
- Same `.panel.case-card` structure as CourtCaseCard
- `.badge-row` with court-type badge + `Ko'rish` button
- `.info-grid`: Majlis sanasi / Sudya / Sud / Da'vogar / Javobgar

### 7.23 `CourtCasesTab({ onViewCase, pendingCaseNumber, pendingCourtType, pendingCaseData, onCaseNumberConsumed })`
**State**:
- `courtType: CourtType` (default `'economic'`)
- `mode: SearchMode` (default `'tin'`)
- `value` (default `'302678824'`)
- `loading`, `cases: CourtCase[]`, `error`, `searched`, `elapsed`, `expandedCase`
- `courtSortBy: 'newest'|'oldest'|'type'|'status'` (default `'newest'`)
- `courtStatusFilter: string | null`
- `casePage` (0), `casePageSize: PageSize` (10)
- `caseSearchQuery` ('')

**`modeOptions` (useMemo by courtType)**:
- economic/administrative → `[{tin, "STIR bo'yicha"}, {caseNumber, "Ish raqami bo'yicha"}]`
- civil/criminal → `[{pinfl, "PINFL bo'yicha"}, {caseNumber, "Ish raqami bo'yicha"}]`

**`runSearchWith(rawValue, modeVal, courtVal)`**:
- Validates: TIN `^\d{9}$`, PINFL `^\d{14}$`, caseNumber `^\d+-[\d-]+/\d+$`
- 5-min cache (`cacheKey.cases`)
- `fetch('/api/court-cases?courtType=${courtVal}&mode=${modeVal}&value=${encodeURIComponent(clean)}')`

**useEffect on `[pendingCaseNumber, pendingCourtType, pendingCaseData, ...]`**:
- If `pendingCaseData` (Stats → Cases instant flow): `setCases([pendingCaseData])`, `onCaseNumberConsumed()`, `toast.success("Ish ma'lumotlari yuklandi (Stats dan)")`
- Else: setTimeout 50ms → `runSearchWith(pendingCaseNumber, 'caseNumber', targetCourt)`

**`sortedCases` (useMemo)**: filters by status, full-text search across caseNumber/plaintiff/defendant/judge/result/courtName/caseType/caseStatus, sorts by `courtSortBy`.

**UI**: Hero + court-type toggle (4: Iqtisodiy / Fuqarolik / Jinoyat / Ma'muriy) + mode toggle + input + loading / error / no-results / results (`.h-section` `Topilgan ishlar (N)` + filter panel + `<div id="cases-list">` of CourtCaseCards + `<PageNav>`) + default state (4 CourtFeatureCards).

### 7.24 `CompanyInfoTab({ onViewCases, onViewBills, onViewHearings })`
**State**: `tin`, `loading`, `error`, `data: CompanyInfoData | null`, `searchedTin`

**`fetchCompany(tinValue)`**: validates `^\d{9}$`, cache, `fetch('/api/company-info?tin=${clean}')`, caches.

**UI**:
- Hero with eyebrow `O'ZBEKISTON · ORGINFO.UZ + CHAMBER.UZ`, title `Kompaniya ma'lumotlari`
- Sample chips `['302678824', '305858476', '301946789']` (DIFFERENT from Stats tab!)
- Results: `.card-stack`:
  1. **Rating card** (prominent): `.panel.rating-card` with `.rating-num` (`{score}/100`), `.rating-badge` (category), `.rating-sub`, info-grid (Soliq to'lovchi turi, Hudud)
  2. **Quick actions bar**: `.panel` with `.inn-bar` containing Zap icon, label `Tezkor amallar`, 4 buttons (Sud ishlari / To'lovlar / Majlislar + orginfo.uz external link)
  3. **Asosiy ma'lumotlar** panel: To'liq nomi / STIR / Manzil / Rahbar / Holati / Ro'yxatdan olingan / Ustav kapitali / Telefon / Email
  4. **Faoliyat sohasi (OKED)** panel: OKED kodi / Bo'lim / Faoliyat nomi
  5. **Asoschilar** panel (only if founders.length > 0): founders list with name + share %

### 7.25 `WatchlistTab({ onViewInStats })`
**State**: `entries: WatchlistEntry[]`, `addTin`, `addName`, `summaries: Record<tin, WatchSummary>`, ref `fetchedRef: Set<tin>`

**`kickOffFetch(tin)`** — fires 3 parallel fetches (each patches its own slice):
1. `fetchWatchStats(tin)` → `summaries[tin].stats`
2. `fetchWatchRating(tin)` → `summaries[tin].rating`
3. `fetchWatchNextHearing(tin)` → `summaries[tin].nextHearing`

**`handleAdd()`**: validates 9-digit TIN, `saveWatchlistEntry`, refresh, `kickOffFetch(tin)`, toast `"Kuzatuv ro'yxatiga qo'shildi"`.

**UI**:
- Hero `.glass` with eyebrow `O'ZBEKISTON · KO'P KOMPANIYA KUZATUVI`, title `Kompaniyalarni kuzating`
- `.h-section` `Kuzatuvdagi kompaniyalar (N)`
- `.watchlist-grid` of `.watch-card`s. Each card:
  - `.wc-head` with name + `STIR · {formatTin}` + trash button
  - `.wc-metrics` (4 cells): Jami ishlar, G'alaba %, Reyting, Keyingi majlis
  - `.wc-footer` with truncated name + rating badge + `Statistika →` jump link
  - Click → `onViewInStats(tin)`

### 7.26 `TrendChart({ timeline, onViewCase })`
**State**: `selectedMonth: string | null`

**Constants**: `BAR_W=24`, `BAR_GAP=4`, `HEIGHT=200`, `PAD_TOP=10`, `PAD_BOTTOM=24`, `BAR_AREA=166`, `maxTotal=max(1, ...totals)`, `svgWidth`, `baseY=176`

**If `timeline.length === 0`**: renders dashed `.panel` `Hozircha oylik ma'lumotlar yo'q.`

**SVG structure**:
- `<svg className="trend-svg" role="img" aria-label="Oylik ishlar trendi">`
- For each month `<g className="trend-bar-group" onClick={toggle selectedMonth}>`:
  - `<title>` with tooltip text `Yan 2024: 5 yutdi, 2 yutqazdi, 1 neitral, 0 kutilmoqda (jami 8)`
  - Stacked rects from bottom up: win (`var(--accent)`), lose (`var(--accent)` opacity 0.5), neutral (`var(--surface-3)`), pending (`var(--surface-2)` with border)
  - If `total === 0`: 2px-tall placeholder rect at baseline
  - If selected: outline rect around bar
  - If `i % 3 === 0`: `<text className="trend-label">` with `Yan '24`
- Below SVG: `.stacked-tl-legend` with 4 swatches (Yutdi / Yutqazdi / Neitral / Kutilmoqda)
- If `selectedMonth`: `.trend-month-cases` popup with title, count summary, close `✕` button, scrollable `.trend-month-list` of `.trend-case-card`s
- Each `.trend-case-card` onClick → `onViewCase(c.caseNumber, c.courtType, c)`

### 7.27 `StatsTab({ pendingTin, onConsumeTin, onViewCase })`
**State (15 useState + 2 useRef)**:
- `tinInput` (default `'302678824'`), `loading`, `error`, `data`
- `activeFolder: FolderId` (`'tahlil'`), `dateSpan: DateSpan` (`'all'`), `outcome: OutcomeFilter` (`'all'`), `sort: SortMode` (`'newest'`)
- `phase: 0|1|2|3`, `toastMsg`, `dlCourtTypes: Set<StatsCourtType>` (default all 3)
- `compareMode` (false), `compareTin`, `compareData`, `compareLoading`, `compareError`
- `hearings`, `hearingsLoading`, `hearingsError`, `hearingsTin`
- Refs: `toastTimerRef`, `compareAbortRef`, `hearingsFetchedTinRef`

**`fetchStats(tin)`**:
- Validates `^\d{9}$`
- Cache check (`cacheKey.stats(tin)`); on hit → `setData`, `setPhase(3)`, `toast.success("Statistika keshdan yuklandi")`
- Else: `setLoading(true)`, `setPhase(1)`, `setTimeout(() => setPhase(2), 600)`
- `fetch('/api/stats?tin=${tin}', { signal: AbortSignal.timeout(35000) })`

**`onSubmit`**: form submit → `fetchStats(tinInput)`. If `compareMode && /^\d{9}$/.test(compareTin)` → also `fetchCompare(compareTin)` in parallel.

**`fetchCompare(tin)`**: aborts previous, cache check, `fetch('/api/stats?tin=${tin}')`, sets `compareData` + caches.

**useEffect on `[pendingTin, ...]`**: if `pendingTin` is 9-digit, `setTinInput(pendingTin)`, `onConsumeTin()`, `fetchStats(pendingTin)`.

**`extractMetrics(d)` (useMemo)**: returns `{total, win, lose, neutral, pending, winRate, asPlaintiff, asDefendant, economic, civil, administrative}`.

**MAJLISLAR folder useEffect**: when `activeFolder === 'hearings'` and a TIN is present:
- `fetch('/api/court-hearings?tin=${tin}&days=90', { signal: AbortSignal.timeout(120000) })`
- If `list.length === 0`: `showToast('Bu sud uchun kelajakdagi majlislar topilmadi', 'info')`

**`hearingCourtType(claimtype)`**: maps `ECONOMIC`→`economic`, `CIVIL`→`civil`, `CONFLICT`→`administrative`, default `civil`.

**`handleCaseClick(c)`** — converts `StatsCase` → `CourtCase`:
- `caseStatus: c.classification === 'pending' ? 'Ish yurituvda' : 'Tugatilgan'`
- `plaintiff: c.role === 'plaintiff' ? companyName : c.counterparty`
- `defendant: c.role === 'plaintiff' ? c.counterparty : companyName`
- Calls `onViewCase(c.caseNumber, c.courtType, caseData)`

**`handleDownloadExcel()`**:
- `selected = data.cases.filter(c => dlCourtTypes.has(c.courtType))`
- If empty: `toast.error("Tanlangan sud turlarida ishlar yo'q")`
- `POST /api/stats/export` with body `{ tin, courtTypes, cases: selected, companyName }`
- Receives blob, downloads as `statistika-{tin}-{YYYY-MM-DD}.xlsx`

**`folderTabs`**:
```ts
[
  { id: 'tahlil',         label: 'Tahlil',     Icon: BarChart3 },
  { id: 'economic',       label: 'Iqtisodiy',  Icon: Building2, count: totalCounts.economic },
  { id: 'civil',          label: 'Fuqarolik',  Icon: Users,     count: totalCounts.civil },
  { id: 'administrative', label: "Ma'muriy",   Icon: Scale,     count: totalCounts.administrative },
  { id: 'hearings',       label: 'Majlislar',  Icon: CalendarDays },
]
```

**UI sections (top to bottom)**:
- Hero `.glass.tab-section` with eyebrow `STATISTIKA · MY.SUD.UZ`, title `Kompaniya sud statistikasi`, STIR input, sample chips `302 678 824` / `305 543 087` / `301 201 019`
- `.compare-toggle-row`: checkbox + `Taqqoslash rejimi`
- Compare loading + error inline panels
- Loading: 3-phase `.phase-steps` (orginfo.uz → 3 sud turi → tasniflash)
- Results:
  - `.folder-nav-wrap` with `.folder-nav` of 5 folder tabs
  - `.folder-content` with 5 folder panels:
    1. **TAHLIL**: company-banner + download-toolbar + summary cards (4) + filter bar + (compare split view OR role breakdown + donut + winrate bars + TrendChart + court-type breakdown + categories)
    2-4. **ECONOMIC / CIVIL / ADMINISTRATIVE**: `.folder-header` + (empty state OR filter bar + result-meta + `.case-list`)
    5. **HEARINGS folder** (lazy): loading/error/empty/list states

### 7.28 `Home()` (main page component — default export)

**State (15 useState + 5 useRef)**:
- `inn` (default `'302678824'`), `invoiceInput`, `searchMode: 'inn'|'invoice'` (`'inn'`)
- `loading`, `bills: EnrichedBill[]`, `total`, `loaded`, `error`, `elapsed`, `searched`
- `torStatus: 'checking'|'active'|'inactive'` (`'checking'`), `torInstalling`
- `phase: { phase, detail? } | null`
- `sortBy: 'newest'|'oldest'` (`'newest'`), `filters: Set<FilterKey>` (empty)
- `billPageSize: PageSize` (10), `billPage` (0)
- `recent`, `tab` (`'bills'`)
- `pendingStatsTin`, `pendingCaseNumber`, `pendingCourtType`, `pendingCaseData`
- Refs: `abortRef`, `timerRef`, `fileInputRef`, `innInputRef`

**useEffect on mount**: `setRecent(loadRecent())`.

**useEffect for `/` keyboard shortcut**: focuses `innInputRef` on `/` key (unless inside input/textarea/contenteditable).

**`checkTorStatus`**: `fetch('/api/tor-status', { signal: AbortSignal.timeout(3000) })` → `setTorStatus(data.available ? 'active' : 'inactive')`. Polled every 15s.

**`handleTorInstall(e)`**: Reads `.tar.gz` file, `POST /api/tor-install` with FormData, then `POST /api/tor-status` to spawn, then polls 20 times × 3s = 60s.

**`runSearch(innValue)`**:
- Validates `^\d{9}$`
- Aborts previous, starts new AbortController
- `fetch('/api/bills?inn=${clean}', { signal })` → streams NDJSON lines via `res.body.getReader()`
- Each line is JSON with `type`: `phase` / `meta` / `bill` / `done` / `error`

**`runSingleBillSearch(invoiceNumber)`**: Validates `^\d{12}$`, `fetch('/api/bills?invoice=${clean}')`.

**`handleViewCase(caseNumber, courtType?, caseData?)`**:
- `setPendingCaseNumber(caseNumber)`, `setPendingCaseData(caseData ?? null)`
- Maps courtType string to `CourtType`: civil/fuqarolik/citizen→civil, admin/ma'muriy/conflict→administrative, criminal/jinoyat→criminal, economic/iqtisodiy→economic
- `setTab('cases')`

**UI structure**:
- `.blob-field` (3 animated blobs) + `.grain` overlay
- `.shell`:
  - **Header** `.app-header > .header-inner`:
    - Brand: `.brand-mark` (Scale icon) + `.brand-text` (`Sud Billing Lookup` + `v137` sub)
    - Header-right: `<TorStatusBadge>`, `<ThemeToggle>`, external link to `https://billing.sud.uz`
  - **Main** `.main-content`:
    - Hidden `<input type="file" accept=".tar.gz,.tgz,application/gzip">` for Tor install
    - **Tabs**: `.tabs-wrap > nav.liquid-rail` with 6 tab buttons
    - 6 `<section className="tab-panel {tab===id?'is-active':''}">` panels
    - Bills tab inline (hero + STIR/Kvitansiya toggle + sample chips + recent-searches chips + loading/error/results/default)
    - `<CourtCasesTab>` / `<UpcomingHearingsTab>` / `<CompanyInfoTab>` / `<StatsTab>` / `<WatchlistTab>`
  - **Footer** `<footer className="app-footer" data-version="v137">`:
    - `<div className="footer-inner"><div className="footer-text">Sud Billing Lookup v137</div></div>`

---

## 8. Tab System

The `tab` state has type `'bills' | 'cases' | 'hearings' | 'company' | 'stats' | 'watchlist'`. Default is `'bills'`.

| Order | id | Label (Uzbek) | Icon |
|---|---|---|---|
| 1 | `bills` | "To'lovlar" | `Receipt` |
| 2 | `cases` | "Sud ishlari" | `Gavel` |
| 3 | `hearings` | "Sud majlislari" | `CalendarDays` |
| 4 | `company` | "Kompaniya" | `Building2` |
| 5 | `stats` | "Statistika" | `BarChart3` |
| 6 | `watchlist` | "Kuzatuv" | `Eye` |

Rendered as `<nav className="liquid-rail" role="tablist" aria-label="Asosiy bo'limlar">` containing 6 `<button className="tab-btn {is-active}">`.

---

## 9. API Endpoints (every `fetch()` call from the frontend)

| # | Method | URL | Query/Body | Response | Caller |
|---|---|---|---|---|---|
| 1 | GET | `/api/bills?inn={STIR}` | stream NDJSON | `{type:'phase'\|'meta'\|'bill'\|'done'\|'error', ...}` | `Home.runSearch` |
| 2 | GET | `/api/bills?invoice={12-digit}` | JSON | `{ok, bill: CheckStatusResponse, error?}` | `Home.runSingleBillSearch` |
| 3 | POST | `/api/bills/export` | `{ bills: EnrichedBill[] }` | binary `.xlsx` | Bills "Excel" button |
| 4 | GET | `/api/court-cases?courtType={ct}&mode={mode}&value={v}` | JSON | `{ok, cases: CourtCase[], error?}` | `CourtCasesTab.runSearchWith` |
| 5 | GET | `/api/court-cases?courtType={ct}&detail={caseNumber}` | JSON | `{ok, general, firstInstance, appellate, cassation, error?}` | `CaseDetailView` |
| 6 | GET | `/api/company?name={name}&tinOnly=true` | JSON | `{ok, company: {tin}, error?}` | `CaseDetailView` (parallel) |
| 7 | GET | `/api/company-info?tin={STIR}` | JSON | `{ok, company, rating, error?}` | `CompanyInfoTab`, `fetchWatchRating` |
| 8 | GET | `/api/upcoming-hearings?tin={STIR}` | JSON | `{ok, hearings: UpcomingHearing[], error?}` | `UpcomingHearingsTab`, `fetchWatchNextHearing` |
| 9 | GET | `/api/stats?tin={STIR}` | JSON (35s timeout) | `StatsResponseOk \| StatsResponseErr` | `StatsTab.fetchStats`, `fetchCompare`, `fetchWatchStats` |
| 10 | POST | `/api/stats/export` | `{ tin, courtTypes, cases, companyName }` | binary `.xlsx` | `StatsTab.handleDownloadExcel` |
| 11 | GET | `/api/court-hearings?tin={STIR}&days=90` | JSON (120s timeout) | `{ok, hearings: StatsHearing[], error?}` | `StatsTab` MAJLISLAR folder |
| 12 | GET | `/api/tor-status` | JSON (3s timeout) | `{ available: boolean }` | `Home.checkTorStatus` (polled 15s) |
| 13 | POST | `/api/tor-status` | (no body) | `{ok, available, error?}` | `Home.handleTorInstall` |
| 14 | POST | `/api/tor-install` | `FormData` with `file` field (`.tar.gz`) | `{ok, error?, message?}` | `Home.handleTorInstall` |

---

## 10. STIR Input System

### 10.1 Demo STIRs (3 chips shown in Bills + Stats tabs)

| STIR | Display | Used in |
|---|---|---|
| `302678824` | `302 678 824` | Bills tab, Stats tab (also default `inn` / `tinInput`) |
| `305543087` | `305 543 087` | Bills tab, Stats tab |
| `301201019` | `301 201 019` | Bills tab, Stats tab |

A 4th set of sample chips in the **Company** tab uses different STIRs: `['302678824', '305858476', '301946789']`.

### 10.2 STIR input behaviour

- All STIR inputs use `inputMode="numeric"`, `maxLength={9}`, `onChange` strips non-digits via `e.target.value.replace(/\D/g, '').slice(0, 9)`
- Submit button `disabled` while `value.length !== 9`
- Validation regex `^\d{9}$`; on fail → `toast.error("STIR aynan 9 ta raqamdan iborat bo'lishi kerak")`
- Display formatting via `formatTin(tin)`: inserts spaces every 3 digits → `302 678 824`

### 10.3 Recent STIRs list (Bills tab only)

- Stored in `localStorage['sbl:recent-inns']` as `[{ inn, lastSearchedAt }, ...]` (max 5)
- `upsertRecent(inn)` prepends (deduped)
- Rendered as chips below the Bills search input with label `So'nggi:`
- Each chip: clickable inn (refills input + triggers search) + `✕` remove button

### 10.4 STIR passing between tabs

| From → To | Mechanism |
|---|---|
| Watchlist → Stats | `setPendingStatsTin(tin); setTab('stats')` → StatsTab's `pendingTin` useEffect auto-fills + fetches |
| Bills → Cases | `handleViewCase(caseNumber, courtType?)` → sets `pendingCaseNumber` + `pendingCourtType` |
| Stats → Cases | `handleCaseClick(c)` builds a `CourtCase` object → `onViewCase(caseNumber, courtType, caseData)` → sets `pendingCaseData` too (instant render) |
| Hearings → Cases | `onViewCase(caseNumber, courtType)` → `pendingCaseNumber` + `pendingCourtType` |
| Company → Cases/Bills/Hearings | Just `setTab('cases' \| 'bills' \| 'hearings')` (no prefill) |

---

## 11. Watchlist Feature

### 11.1 Storage
- localStorage key: `sud-watchlist`
- Schema: `WatchlistEntry[]` = `{ tin: string, name: string, addedAt: number }[]`

### 11.2 Add flow
`WatchlistTab.handleAdd`:
1. Strips non-digits, slices to 9
2. Validates `length === 9` (else toast error)
3. `name = addName.trim() || \`STIR ${formatTin(tin)}\``
4. `saveWatchlistEntry({ tin, name, addedAt: Date.now() })`
5. Refreshes entries list, clears inputs, toast `"Kuzatuv ro'yxatiga qo'shildi"`
6. Immediately `kickOffFetch(tin)` for the new entry

### 11.3 Per-card summary fetch (parallel, 3 calls)
`kickOffFetch(tin)` fires 3 API calls in parallel:
1. `fetchWatchStats(tin)` → `fetch('/api/stats?tin=${tin}', { signal: AbortSignal.timeout(35000) })` → sets `summaries[tin].stats`
2. `fetchWatchRating(tin)` → `fetch('/api/company-info?tin=${tin}', { signal: AbortSignal.timeout(15000) })` → sets `summaries[tin].rating`
3. `fetchWatchNextHearing(tin)` → `fetch('/api/upcoming-hearings?tin=${tin}', { signal: AbortSignal.timeout(30000) })` → sets `summaries[tin].nextHearing`

### 11.4 Watch-card display (4 metrics)

| Metric | Source | Loading | Empty |
|---|---|---|---|
| Jami ishlar | `stats.total` | spinner | `—` |
| G'alaba % | `round(win/total*100)` | spinner | `—` |
| Reyting | `rating.score` | spinner | `—` |
| Keyingi majlis | `nextHearing` | spinner | `Yo'q` |

Footer: truncated name (22 chars + `…`) + rating category badge + `Statistika →` jump.

### 11.5 Hand-off to Stats tab
Clicking anywhere on a `.watch-card` (or pressing Enter — `role="button" tabIndex={0}`) calls `onViewInStats(tin)`:
```ts
(tin) => { setPendingStatsTin(tin); setTab('stats') }
```
Then StatsTab's useEffect on `pendingTin`:
```ts
if (!pendingTin) return
if (!/^\d{9}$/.test(pendingTin)) return
setTinInput(pendingTin)
onConsumeTin()
void fetchStats(pendingTin)
```

---

## 12. Compare Mode in Stats (v134 Feature 3)

### 12.1 Toggle
`.compare-toggle-row` contains:
```tsx
<label className="compare-toggle">
  <input type="checkbox" checked={compareMode} onChange={...} />
  <ArrowLeftRight className="w-3.5 h-3.5" />
  Taqqoslash rejimi
</label>
```

### 12.2 Second STIR input
When `compareMode === true`, renders `.compare-input-wrap` with second STIR input + "Taqqoslash" button:
- Input: `placeholder="Solishtirish STIR (9 raqam)"`, `aria-label="Solishtirish STIR raqami"`
- Button: `disabled={compareLoading || compareTin.length !== 9}`

### 12.3 Parallel fetch
`onSubmit` fires BOTH:
```ts
void fetchStats(tinInput)
if (compareMode && /^\d{9}$/.test(compareTin.trim())) {
  void fetchCompare(compareTin.trim())
} else {
  setCompareData(null); setCompareError(null)
}
```

### 12.4 Split view
When `compareData` is present, TAHLIL folder hides single-company sections and renders:
```tsx
<div className="compare-split">
  {renderColumn(data,        'Kompaniya A', data.company.name,        true )}
  <div className="compare-vs">VS</div>
  {renderColumn(compareData, 'Kompaniya B', compareData.company.name, false)}
</div>
```

Each `.compare-col` contains:
- `.compare-col-head` (label + name)
- 4 summary cards (Jami / Yutdi / Yutqazdi / Neitral) in 2-col grid
- Donut chart (140×140 ring with conic-gradient + legend)
- Win-rate chart (3 rows: IQTISODIY / FUQAROLIK / MA'MURIY)

Below the split: `.compare-table` with rows:

| Ko'rsatkich | {Company A} | {Company B} |
|---|---|---|
| Jami ishlar | a.total | b.total |
| G'alaba darajasi % | a.winRate% | b.winRate% | (winner cell highlighted via `ct-winner`)
| Da'vogar sifatida | a.asPlaintiff | b.asPlaintiff |
| Javobgar sifatida | a.asDefendant | b.asDefendant |
| Iqtisodiy sud | a.economic | b.economic |
| Fuqarolik sudi | a.civil | b.civil |
| Ma'muriy sud | a.administrative | b.administrative |

The TrendChart still renders — main company's timeline always, plus the compare company's timeline as a second chart below.

---

## 13. Theme Toggle

```tsx
function ThemeToggle() {
  const toggle = () => {
    const html = document.documentElement
    const current = html.getAttribute('data-theme') || 'light'
    const next = current === 'dark' ? 'light' : 'dark'
    html.setAttribute('data-theme', next)
    try { localStorage.setItem('mono-theme', next) } catch { /* ignore */ }
  }
  return (
    <button type="button" onClick={toggle} className="theme-toggle"
            aria-label="Mavzu o'zgartirish" title="Mavzu o'zgartirish">
      <Sun className="theme-icon-dark" />
      <Moon className="theme-icon-light" />
    </button>
  )
}
```

- localStorage key: `mono-theme`
- Sets `data-theme="light" | "dark"` on `<html>`
- CSS controls which icon shows based on the current theme

---

## 14. Tor (TOR proxy) Status Indicator

### 14.1 Header badge
`<TorStatusBadge status={torStatus} onInstall={() => fileInputRef.current?.click()} installing={torInstalling} />`

### 14.2 Polling
```ts
const checkTorStatus = useCallback(async () => {
  try {
    const res = await fetch('/api/tor-status', { signal: AbortSignal.timeout(3000) })
    const data = await res.json() as { available: boolean }
    setTorStatus(data.available ? 'active' : 'inactive')
  } catch { setTorStatus('inactive') }
}, [])

useEffect(() => {
  checkTorStatus()
  const interval = setInterval(checkTorStatus, 15000)  // every 15s
  return () => clearInterval(interval)
}, [checkTorStatus])
```

### 14.3 Install flow
1. User clicks badge when `inactive` → triggers hidden file input
2. `POST /api/tor-install` with FormData(file) (the `.tar.gz` expert bundle)
3. If `!data.ok` → `toast.error(data.error ?? "O'rnatish muvaffaqiyatsiz tugadi")`
4. Else → `toast.success("Tor o'rnatildi. Proxy ishga tushmoqda (~30s)…")`
5. `POST /api/tor-status` to spawn the Tor process
6. If spawn returns `available: true` → `setTorStatus('active')`, `toast.success("Tor faol! Endi to'lovlarni qidirishingiz mumkin.")`
7. Else: poll 20 times × 3s (60s total) — each iteration calls `GET /api/tor-status`
8. If 60s elapsed without success → `setTorStatus('inactive')`, `toast.error('Tor 60s ichida ishga tushmadi.')`

---

## 15. Version Number

| Location | Value |
|---|---|
| `<p className="brand-sub">` (header) | `v137` |
| `<footer ... data-version="v137">` | attribute |
| `<div className="footer-text">` | `Sud Billing Lookup v137` |

---

## 16. pendingCaseData Flow (Stats → Cases instant render)

**Trigger**: User clicks a case card in the Stats tab → `StatsTab.handleCaseClick(c)`:
```ts
const companyName = data?.company?.name || ''
const caseData: CourtCase = {
  caseNumber: c.caseNumber,
  caseType: c.category || '',
  caseStatus: c.classification === 'pending' ? 'Ish yurituvda' : 'Tugatilgan',
  result: c.result || '',
  courtName: c.court || '',
  dateFiled: c.regDate || '',
  plaintiff: c.role === 'plaintiff' ? companyName : c.counterparty,
  defendant: c.role === 'plaintiff' ? c.counterparty : companyName,
  claimAmount: '', hearingDate: '', hearingTime: '', judge: '',
}
onViewCase(c.caseNumber, c.courtType, caseData)
```

**Home's `onViewCase` callback (passed to StatsTab)**:
```ts
(caseNumber, courtType, caseData) => {
  setPendingCaseNumber(caseNumber)
  setPendingCourtType(courtType as CourtType)
  setPendingCaseData(caseData ?? null)
  setTab('cases')
}
```

**CourtCasesTab's pendingCaseData useEffect**:
```ts
if (!pendingCaseNumber) return
const targetCourt = pendingCourtType || 'economic'
if (courtTypeRef.current !== targetCourt) setCourtType(targetCourt)
if (modeRef.current !== 'caseNumber') setMode('caseNumber')
setValue(pendingCaseNumber)

if (pendingCaseData) {
  setCases([pendingCaseData])      // INSTANT — no fetch
  setSearched(true)
  setExpandedCase(null)
  setError(null)
  setElapsed(0)
  onCaseNumberConsumed()
  toast.success("Ish ma'lumotlari yuklandi (Stats dan)")
  return
}
// Fallback: no pre-loaded data → search by case number
setTimeout(() => {
  void runSearchWith(pendingCaseNumber, 'caseNumber', targetCourt)
  onCaseNumberConsumed()
}, 50)
```

---

## 17. Export / Download Features

### 17.1 Bills Excel export
```ts
const res = await fetch('/api/bills/export', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bills: filteredBills }),
})
const blob = await res.blob()
const a = document.createElement('a')
a.href = URL.createObjectURL(blob)
a.download = `tolovlar-${new Date().toISOString().slice(0, 10)}.xlsx`
document.body.appendChild(a); a.click(); document.body.removeChild(a)
toast.success(`Excel yuklandi: ${filteredBills.length} ta to'lov`)
```

### 17.2 Stats Excel export
`handleDownloadExcel`:
- `selected = data.cases.filter(c => dlCourtTypes.has(c.courtType))`
- If empty: `toast.error("Tanlangan sud turlarida ishlar yo'q")`
- `POST /api/stats/export` with body `{ tin, courtTypes, cases: selected, companyName }`
- Downloads as `statistika-{tin}-{YYYY-MM-DD}.xlsx`

The `dlCourtTypes` set is toggled via 3 chip buttons (Iqtisodiy / Fuqarolik / Ma'muriy), default all 3 on.

### 17.3 Case-detail PDF export (print window)
`handlePrintPDF` builds a full HTML document with print-optimised CSS, calls `window.open('', '_blank', 'width=1000,height=720')`, writes the HTML, then auto-triggers `window.print()` 400ms after load.
- Print button label: `PDF sifatida saqlash`
- Footer: `Sud Billing Lookup tomonidan yaratilgan · {now} · {caseNumber}`

---

## 18. Pagination

Both Bills tab and Cases tab use the shared `<PageNav>` component.

### 18.1 Page-size selector
| Tab | Options |
|---|---|
| Bills | `10 / sahifa`, `20 / sahifa`, `50 / sahifa`, `100 / sahifa` |
| Cases | `10 / sahifa`, `20 / sahifa`, `50 / sahifa` (no 100) |

### 18.2 Page reset
- Bills: `useEffect(() => { setBillPage(0) }, [filters, sortBy, inn, billPageSize])`
- Cases: `useEffect(() => { setCasePage(0) }, [courtStatusFilter, courtSortBy, casePageSize, courtType])`

### 18.3 Safe page
```ts
const totalPages = Math.max(1, Math.ceil(filteredBills.length / pageSize))
const safePage = Math.min(page, totalPages - 1)
const paged = filteredBills.slice(safePage * pageSize, safePage * pageSize + pageSize)
```

---

## 19. Filtering

### 19.1 Bills tab filters
- **Sort dropdown**: `Avval yangi` / `Avval eski`
- **Filter chips** (4, multi-select via `Set<FilterKey>`):
  - `To'langan` (paid) — `isPaidStatus(st)`
  - `To'lanmagan` (unpaid) — `isUnpaidStatus(st)`
  - `Davlat boji` (davlat_boji) — `categoryMeta(...).kind === 'davlat_boji'`
  - `Pochta` (pochta) — `categoryMeta(...).kind === 'pochta'`

### 19.2 Cases tab filters
- **Sort dropdown** (4 options): `Avval yangi`, `Avval eski`, `Ish turi bo'yicha`, `Holati bo'yicha`
- **Status dropdown** (only when `uniqueStatuses.length > 1`): `Barcha holatlar` + one per unique status
- **In-list search box** (only when `cases.length > 5`): full-text search across `caseNumber / plaintiff / defendant / judge / result / courtName / caseType / caseStatus`

### 19.3 Stats tab filters (shared `renderFilterBar`)
- **Davr (date span) chips**: `Hammasi` (all), `1 yil` (1y), `6 oy` (6m), `30 kun` (30d)
- **Holat (outcome) chips**: `Hammasi`, `Yutdi`, `Yutqazdi`, `Neitral`, `Kutilmoqda`
- **Saralash (sort) dropdown**: `Yangi → Eski`, `Eski → Yangi`

The `dateSpan` filter also recomputes `summary`, `courtTypeWinRates`, `roleBreakdown`, `categories`, `timeline`, `compareTimeline`.

---

## 20. Notification System (Toasts)

### 20.1 sonner (library toasts)
Imported as `import { toast } from 'sonner'`:

| Method | Example calls |
|---|---|
| `toast.success(msg)` | `${label} nusxalandi`, `N ta to'lov import qilindi`, `Kvitansiya topildi`, `Kompaniya ma'lumotlari yuklandi`, `Majlislar keshdan yuklandi`, `N ta ish topildi`, `Ish ma'lumotlari yuklandi (Stats dan)`, `Statistika keshdan yuklandi`, `Taqqoslash keshdan yuklandi`, `Kuzatuv ro'yxatiga qo'shildi`, `Tor o'rnatildi...`, `Tor faol!...`, `Excel yuklandi: N ta to'lov`, `Excel yuklandi: N ta ish` |
| `toast.error(msg)` | `STIR aynan 9 ta raqamdan iborat bo'lishi kerak`, `PINFL aynan 14 ta raqamdan iborat bo'lishi kerak`, `Ish raqami formati: X-XXXX-XXXX/XXXXX`, `Qidiruv qiymatini kiriting`, `Qidiruv muvaffaqiyatsiz tugadi`, `Kvitansiya raqami 12 ta raqamdan iborat bo'lishi kerak`, `Tafsilot mavjud emas`, `PDF oynasini ochib bo'lmadi...`, `Kompaniya topilmadi`, `Xatolik: ${msg}`, `Tanlangan sud turlarida ishlar yo'q`, `Yuklab bo'lmadi`, `Tor 60s ichida ishga tushmadi.`, `O'rnatish muvaffaqiyatsiz tugadi` |
| `toast.info(msg)` | `Sud ishlari topilmadi`, `Ushbu STIR uchun to'lovlar topilmadi`, `So'nggi qidiruvlardan olib tashlandi` |

### 20.2 Local StatsTab toast
StatsTab has its OWN inline toast (in addition to sonner) for copy/info messages:
```ts
const [toastMsg, setToastMsg] = useState<{ msg: string; kind: 'info' | 'copy' } | null>(null)
const showToast = useCallback((msg, kind = 'info') => {
  setToastMsg({ msg, kind })
  if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  toastTimerRef.current = setTimeout(() => setToastMsg(null), 2500)
}, [])
```

Rendered as a fixed-position bottom-center pill:
```tsx
{toastMsg && (
  <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
    zIndex: 100, display: 'inline-flex', alignItems: 'center', gap: 10,
    padding: '12px 18px', background: 'var(--accent)', color: 'var(--void)',
    border: '1px solid var(--accent)', boxShadow: 'var(--shadow-3)',
    fontFamily: 'var(--font-jetbrains), ui-monospace, monospace', fontSize: 12,
    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
    maxWidth: 'calc(100vw - 32px)' }}>
    {toastMsg.kind === 'copy' ? <CheckCheck /> : <ArrowRight />}
    <span>{toastMsg.msg}</span>
  </div>
)}
```

---

## 21. Complete Uzbek UI Strings Catalogue

### 21.1 Header / footer / global
| String | Location |
|---|---|
| `Sud Billing Lookup` | brand-title (h1) |
| `v137` | brand-sub (p) |
| `Tor tekshirilmoqda…` / `Tor…` (mobile) | TorStatusBadge checking |
| `Tor faol` | TorStatusBadge active |
| `Tor aniqlanmadi — o'rnatish` / `Tor` (mobile) | TorStatusBadge inactive |
| `Tor expert bundle (.tar.gz) faylini tanlang va o'rnating` | TorStatusBadge title |
| `Mavzu o'zgartirish` | ThemeToggle aria-label/title |
| `billing.sud.uz` / `sud.uz` (mobile) | external link |
| `Sud Billing Lookup v137` | footer-text |
| `Asosiy bo'limlar` | tabs nav aria-label |

### 21.2 Tab labels
| id | Label |
|---|---|
| bills | `To'lovlar` |
| cases | `Sud ishlari` |
| hearings | `Sud majlislari` |
| company | `Kompaniya` |
| stats | `Statistika` |
| watchlist | `Kuzatuv` |

### 21.3 Bills tab strings
- Eyebrow: `O'ZBEKISTON · BILLING.SUD.UZ`
- Title: `Kompaniya nomiga chiqarilgan barcha to'lovlarni import qiling`
- Lede: `STIR raqamini kiriting — tizim billing.sud.uz saytidan barcha kvitansiyalarni real vaqtda yuklaydi.`
- Placeholders: `STIR raqamini kiriting...`, `Kvitansiya raqamini kiriting (12 raqam)`
- Buttons: `To'lovlarni qidirish` / `Tekshirish`, `${elapsed}s`
- Mode toggles: `STIR`, `Kvitansiya`
- Hint: `9 ta raqam kiriting — yana ${9 - inn.length} ta qoldi`
- Chip labels: `Sinab ko'ring:`, `So'nggi:`
- Sample chips: `302 678 824`, `305 543 087`, `301 201 019`
- Loading title: `STIR {formatTin(inn)} uchun to'lovlar import qilinmoqda…` / `STIR {formatTin(inn)} qidirilmoqda…`
- Phase steps: `Ulanmoqda`, `Kirish`, `Qidirilmoqda`, `Tafsilotlar`
- Progress: `{loaded} / {total} ta to'lov yuklandi`, `{pct}%`
- Summary card labels: `Jami`, `To'langan`, `To'lanmagan`, `Jami summa`, `Qarzdorlik` (with `so'm` sub)
- Sort options: `Avval yangi`, `Avval eski`
- Filter chips: `To'langan`, `To'lanmagan`, `Davlat boji`, `Pochta`
- Page sizes: `10 / sahifa`, `20 / sahifa`, `50 / sahifa`, `100 / sahifa`
- Download button: `Excel`
- Error title: `Qidiruv muvaffaqiyatsiz tugadi`
- Retry button: `Qayta urinish`
- No results title: `To'lovlar topilmadi`
- Default state cards: `Barcha kvitansiyalarni import`, `Turi va holatini ko'rish`, `Sud ish raqamlari`, `Maxfiy tarzda qidiriladi`

### 21.4 BillCard strings
- Labels: `Kvitansiya`, `To'langan`, `To'lanmagan`, `Sarflangan`, `Qoldiq` (all with `so'm` sub)
- Info rows: `Sud`, `Berilgan sana`, `Amal qilish muddati`, `Maqsad`
- Error: `Tafsilot mavdel emas`
- Expand: `Sud tomonidan ishlatilishi (${N})`, `Yashirish`
- Claim case label: `№ Da'vo ish raqami:`
- Ko'rish button: `Ko'rish`
- Table badges: `Ishlatilgan`, `Qaytarilgan`

### 21.5 Cases tab strings
- Eyebrow: `O'ZBEKISTON · MY.SUD.UZ`
- Title: `Kompaniya ishtirokidagi sud ishlarini ko'ring`
- Lede: `jadval.sud.uz orqali ochiq va yopiq sud ishlarini, majlislar tarixini va qarorlarni toping.`
- Court type toggles: `Iqtisodiy`, `Fuqarolik`, `Jinoyat`, `Ma'muriy`
- Mode toggles: `STIR bo'yicha`, `Ish raqami bo'yicha`, `PINFL bo'yicha`
- Placeholders: `9 xonali STIR raqamini kiriting`, `masalan, 4-1001-2605/14720`, `14 xonali PINFL raqamini kiriting`
- Button: `Qidirish`, `${elapsed}s`
- Loading title: `"{value}" bo'yicha sud ishlari qidirilmoqda…`
- Error: `Qidiruv muvaffaqiyatsiz tugadi`
- Retry: `Qayta urinish`
- No results: `Sud ishlari topilmadi`
- Section header: `Topilgan ishlar (${N})`
- Sort: `Saralash:`, `Avval yangi`, `Avval eski`, `Ish turi bo'yicha`, `Holati bo'yicha`
- Status filter: `Barcha holatlar`
- Case card: `Sud`, `Ariza berilgan sana`, `Da'vogar`, `Javobgar`, `Natija:`
- Expand: `Tafsilotlarni ko'rish`, `Tafsilotlarni yashirish`

### 21.6 CaseDetailView strings
- Loading: `Ish tafsilotlari yuklanmoqda…`, `{elapsed}s o'tdi`
- Error: `Ish tafsilotlarini yuklab bo'lmadi`
- PDF button: `PDF`, title `PDF sifatida saqlash`
- Section title: `Umumiy ma'lumotlar`
- InfoRow labels: `Sud`, `Ish raqami`, `Ish turi`, `Ish holati`, `Sudya`, `Da'vo predmeti`, `Kotib`, `Da'vogar`, `Da'vogar STIR`, `Javobgar`, `Javobgar STIR`, `Uchinchi shaxs`, `Vakil`, `Prokuror`, `Da'vo summasi`, `Davlat boji`, `Ariza berilgan sana`, `Muddat sanasi`
- Instance titles: `Birinchi instansiya`, `Apellyatsiya`, `Kassatsiya`
- Instance subtitle: `{N} ta majlis, {N} ta hujjat`
- Hearing: `Sud zali:`, `Sudya:`, `Kechiktirildi:`
- Decision: `Qaror:`, `Sana:`, `Ijro:`, `Undirilgan summa:`, `Qaytarilgan davlat boji:`, `Apellyatsiya muddati:`
- Documents: `Hujjatlar ({N})`

### 21.7 Upcoming Hearings tab strings
- Eyebrow: `O'ZBEKISTON · MY.SUD.UZ`
- Title: `Rejalashtirilgan sud majlislari`
- Lede: `Kompaniyalaringizni saqlang va ularning barcha 4 ta sud turi (iqtisodiy, fuqarolik, jinoyat, ma'muriy) bo'yicha rejalashtirilgan sud majlislarini kuzating.`
- Placeholders: `STIR (9 raqam)`, `Kompaniya nomi (ixtiyoriy)`
- Button: `Saqlash`
- Section header: `Saqlangan kompaniyalar ({N})`
- Empty: `Saqlangan kompaniyalar yo'q.`
- Error: `Majlislarni olib bo'lmadi`
- Loading title: `STIR {formatTin(selectedTin)} uchun 4 ta sud turi qidirilmoqda…`
- Results header: `Rejalashtirilgan majlislar ({N})`
- Refresh: `Yangilash`
- No results: `Rejalashtirilgan majlislar yo'q`
- Default cards: `Kompaniyalarni saqlash`, `Barcha 4 ta sud turi`, `To'liq ish ma'lumoti`, `Istalgan vaqtda yangilash`
- Hearing card: `Majlis sanasi`, `Sudya`, `Sud`, `Da'vogar`, `Javobgar`, `Ko'rish`

### 21.8 Company tab strings
- Eyebrow: `O'ZBEKISTON · ORGINFO.UZ + CHAMBER.UZ`
- Title: `Kompaniya ma'lumotlari`
- Lede: `Ro'yxatdan o'tish tafsilotlari, ustav fondi, direktor va tashkilotchilar haqida ma'lumot.`
- Placeholder: `STIR raqamini kiriting (9 ta raqam)`
- Button: `Ma'lumot olish`, `Qidirilmoqda`
- Sample chips: `302 678 824`, `305 858 476`, `301 946 789`
- Loading title: `STIR {formatTin} bo'yicha ma'lumotlar yuklanmoqda…`
- Error: `Kompaniya topilmadi`
- Rating labels: `Soliq to'lovchi turi`, `Hudud`
- Quick actions bar: `Tezkor amallar`, `Sud ishlari`, `To'lovlar`, `Majlislar`, `orginfo.uz`
- Basic info: `Asosiy ma'lumotlar`, `To'liq nomi`, `STIR`, `Manzil`, `Rahbar`, `Holati`, `Ro'yxatdan olingan`, `Ustav kapitali`, `Telefon`, `Email`
- OKED: `Faoliyat sohasi (OKED)`, `OKED kodi`, `Bo'lim`, `Faoliyat nomi`
- Founders: `Asoschilar`, `{N} ta asoschi`
- Default cards: `Kompaniya ma'lumotlari`, `Pudratchi reytingi`, `Faoliyat turi (OKED)`, `Ta'sinchilar`

### 21.9 Stats tab strings
- Eyebrow: `STATISTIKA · MY.SUD.UZ`
- Title: `Kompaniya sud statistikasi`
- Lede: `STIR raqamini kiriting — tizim iqtisodiy, fuqarolik va ma'muriy sudlardagi barcha ishlarni real vaqtda yuklaydi, har birini Yutdi/Yutqazdi/Neitral bo'yicha tasniflaydi.`
- Button: `Statistikani ko'rish`, `Yuklanmoqda…`
- Sample chips: `302 678 824`, `305 543 087`, `301 201 019`
- Compare toggle: `Taqqoslash rejimi`
- Compare placeholder: `Solishtirish STIR (9 raqam)`
- Compare button: `Taqqoslash`, `Yuklanmoqda…`
- Compare loading: `Solishtirish kompaniyasi yuklanmoqda…`
- Compare error: `Solishtirishda xatolik`
- Loading phases: `orginfo.uz dan kompaniya ma'lumotlari`, `3 sud turidagi ishlar parallel yuklanmoqda (iqtisodiy + fuqarolik + ma'muriy)`, `Tasniflash: Yutdi / Yutqazdi / Neitral / Kutilmoqda`
- Error: `Xatolik`
- Folder tabs: `Tahlil`, `Iqtisodiy`, `Fuqarolik`, `Ma'muriy`, `Majlislar`
- Company banner: `STIR · {tin}`, stats labels `Jami`, `Yutdi`, `Yutqazdi`, `Neitral`
- Download toolbar: `YUKLAB OLISH`, `EXCEL YUKLASH`
- Section headers: `Umumiy ko'rsatkichlar`, `Rol bo'yicha tahlil`, `Natija taqsimoti`, `Sud turi bo'yicha g'alaba darajasi`, `Oylik ishlar trendi`, `Sud turi bo'yicha`, `Kategoriya bo'yicha — Top 5`, `Taqqoslash: {A} vs {B}`, `Taqqoslash jadvali`
- Summary cards: `Jami ishlar`, `Yutdi`, `Yutqazdi`, `Neitral`
- Donut: `JAMI`, `Yutdi`, `Yutqazdi`, `Neitral`, `Kutilmoqda`
- Win-rate labels: `IQTISODIY`, `FUQAROLIK`, `MA'MURIY`
- Role labels: `Da'vogar sifatida`, `Javobgar sifatida`
- Court-type cards: `Iqtisodiy sud`, `Fuqarolar sudi`, `Ma'muriy sud`
- Trend chart empty: `Hozircha oylik ma'lumotlar yo'q.`
- Trend chart legend: `Yutdi`, `Yutqazdi`, `Neitral`, `Kutilmoqda`
- Trend month popup: `{monthName} {year}`, `{N} ta ish · {win} yutdi · {lose} yutqazdi · {neutral} neitral`
- Filter bar: `Davr:`, `Hammasi`, `1 yil`, `6 oy`, `30 kun`, `Holat:`, `Saralash:`, `Yangi → Eski`, `Eski → Yangi`
- Folder headers: `Iqtisodiy sud`, `Fuqarolar sudi`, `Ma'muriy sud`, `Kelajakdagi sud majlislari`
- Empty states: `Bu sud turida ishlar topilmadi`, `Kelajakdagi sud majlislari topilmadi`
- Hearing meta: `Ko'rsatilmoqda: {N} ta sud majlisi · 90 kun ichida`

### 21.10 Watchlist tab strings
- Eyebrow: `O'ZBEKISTON · KO'P KOMPANIYA KUZATUVI`
- Title: `Kompaniyalarni kuzating`
- Lede: `Saqlangan kompaniyalaringizning sud statistikasi, to'lanmagan to'lovlari va rejalashtirilgan majlislari bir ko'rinishda. STIR kiriting va kuzatuv ro'yxatiga qo'shing.`
- Placeholders: `STIR (9 raqam)`, `Kompaniya nomi (ixtiyoriy)`
- Button: `Qo'shish`
- Section header: `Kuzatuvdagi kompaniyalar ({N})`
- Empty: `Kuzatuv ro'yxati bo'sh. Yuqoridagi formadan STIR kiriting.`
- Card: `STIR · {formatTin}`, `Jami ishlar`, `G'alaba %`, `Reyting`, `Keyingi majlis`, `Yo'q`
- Trash aria: `O'chirish`
- Footer: `Statistika`

### 21.11 Validation error toasts
- `STIR aynan 9 ta raqamdan iborat bo'lishi kerak`
- `PINFL aynan 14 ta raqamdan iborat bo'lishi kerak`
- `Ish raqami formati: X-XXXX-XXXX/XXXXX`
- `Qidiruv qiymatini kiriting`
- `Kvitansiya raqami 12 ta raqamdan iborat bo'lishi kerak`
- `Tanlangan sud turlarida ishlar yo'q`
- `Yuklab bo'lmadi` / `Yuklab bo'lmadi (HTTP {status})`
- `Xatolik: ${msg}` / `Xatolik: ${err.message}`

### 21.12 Success toasts
- `${label ?? 'Qiymat'} nusxalandi`
- `${N} ta to'lov import qilindi`
- `Ushbu STIR uchun to'lovlar topilmadi`
- `Kvitansiya topildi`
- `Kompaniya ma'lumotlari yuklandi`
- `Kompaniya ma'lumotlari keshdan yuklandi`
- `Majlislar keshdan yuklandi`
- `${N} ta ish topildi`
- `${N} ta ish topildi (keshdan)`
- `Sud ishlari topilmadi`
- `Ish ma'lumotlari yuklandi (Stats dan)`
- `Statistika keshdan yuklandi`
- `Taqqoslash keshdan yuklandi`
- `Kuzatuv ro'yxatiga qo'shildi`
- `Tor o'rnatildi. Proxy ishga tushmoqda (~30s)…`
- `Tor faol! Endi to'lovlarni qidirishingiz mumkin.`
- `Excel yuklandi: ${N} ta to'lov`
- `Excel yuklandi: ${N} ta ish`

### 21.13 Info/error toasts
- `So'nggi qidiruvlardan olib tashlandi`
- `PDF oynasini ochib bo'lmadi — brauzer pop-up'larni bloklamoqda`
- `O'rnatish muvaffaqiyatsiz tugadi`
- `Tor 60s ichida ishga tushmadi.`
- `Nusxalash amalga oshmadi`
- `Bu sud uchun kelajakdagi majlislar topilmadi`
- `Network error` / `Tarmoq xatosi`

### 21.14 Print PDF popup strings
- Title bar: `${caseNumber} — Sud Billing Lookup`
- Print button: `PDF sifatida saqlash`
- H2: `Umumiy ma'lumotlar`
- H3: `Majlislar tarixi ({N})`
- Instance titles: `Birinchi instansiya`, `Apellyatsiya`, `Kassatsiya`
- Footer: `Sud Billing Lookup tomonidan yaratilgan · {now} · {caseNumber}`

---

## 22. CSS Class Catalogue (key classes referenced in JSX)

### 22.1 Layout & shell
`shell`, `app-header`, `header-inner`, `brand`, `brand-mark`, `brand-text`, `brand-title`, `brand-sub`, `header-right`, `ext-link`, `main-content`, `app-footer`, `footer-inner`, `footer-text`, `tab-panel`, `tabs-wrap`, `liquid-rail`, `tab-btn`, `tab-label`, `is-active`, `blob-field`, `blob`, `b1`, `b2`, `b3`, `grain`

### 22.2 Hero / glass
`glass`, `eyebrow`, `h-display`, `accent`, `lede`, `search-row`, `input-wrap`, `console-input`, `btn-primary`, `chip-row`, `chip-label`, `chip`, `sample-chip`, `toggle-pair`, `toggle-btn`, `tab-section`, `tab-section-sm`, `h-section`

### 22.3 Panels & cards
`panel`, `panel-hover`, `anim-fade-up`, `card-stack`, `quick-grid`, `quick-tile`, `action-card-desc`, `bill-card`, `case-card`, `rating-card`, `rating-num`, `rating-badge`, `rating-sub`, `bill-head`, `bill-idx`, `idx-num`, `bill-title`, `receipt`, `company`, `badge-row`, `money-grid`, `money-cell`, `is-paid`, `is-unpaid`, `is-accent`, `info-grid`, `info-row`, `lbl`, `val`, `sub`, `mono`, `tabular`, `expand-btn`, `is-open`, `expand-content`, `expand-inner`, `usage-table`, `col-num`, `col-amt`, `decision-bar`, `decision-icon`, `decision-text`, `t1`, `t2`, `korish-btn`, `copy-btn`

### 22.4 Badges
`badge`, `b-paid`, `b-unpaid`, `b-neutral`, `b-court-econ`, `b-court-civ`, `b-court-crim`, `b-court-adm`, `b-duty`, `b-win`, `b-lose`, `b-pending`, `b-plaintiff`, `b-defendant`, `solid`, `outline`, `muted`

### 22.5 Loading states
`loading-box`, `loading-head`, `loading-title`, `loading-sub`, `phase-row`, `phase-step`, `is-done`, `is-current`, `progress-label`, `progress-track`, `progress-fill`, `skeleton-grid`, `skel-card`, `shimmer`, `phase-steps`, `ps-icon`, `spin-anim`, `svg-spin`

### 22.6 Summary & summary-grid
`summary-grid`, `summary-grid is-split`, `summary-cell`, `summary-grid-stats`, `sum-card`, `sum-card solid`, `sum-card outline`, `sum-card surface`, `sc-label`, `sc-num`, `sc-sub`

### 22.7 Stats tab specifics
`company-banner`, `cb-icon`, `cb-text`, `cb-name`, `cb-sub`, `cb-stats`, `cb-stat`, `cb-v`, `cb-l`, `download-toolbar`, `dl-left`, `dl-title`, `dl-chips`, `stats-filter-bar`, `filter-group`, `filter-divider`, `folder-nav-wrap`, `folder-nav`, `folder-tab`, `ft-count`, `folder-content`, `folder-panel`, `folder-header`, `fh-title`, `fh-count`, `result-meta`, `rm-left`, `case-list`, `case-card-stats`, `case-head`, `case-id-group`, `case-num-stats`, `case-reg`, `copy-btn-stats`, `case-badges`, `case-result`, `cr-icon`, `cr-text`, `case-meta-grid`, `meta-row`, `meta-lbl`, `meta-val`, `empty-state`, `es-icon`, `es-title`, `es-sub`, `role-grid`, `role-card`, `rc-head`, `rc-title`, `rc-total`, `rc-bar`, `rc-legend`, `rc-row`, `rc-left`, `rc-swatch`, `rc-right`, `rc-pct`, `donut-chart`, `donut-ring`, `donut-center`, `dc-num`, `dc-lbl`, `donut-legend`, `dl-row`, `dl-swatch`, `dl-win`, `dl-lose`, `dl-neutral`, `dl-pending`, `dl-label`, `dl-count`, `dl-pct`, `winrate-chart`, `winrate-row`, `wr-label`, `winrate-bar-track`, `winrate-bar-fill`, `wr-value`, `courttype-grid`, `ct-card`, `is-empty`, `ct-top`, `ct-name`, `ct-arrow`, `ct-num`, `ct-pct`, `cat-list`, `cat-row`, `cat-left`, `cat-name`, `cat-bar`, `cat-right`, `cat-count`, `cat-of`

### 22.8 TrendChart specifics
`trend-chart-container`, `trend-svg`, `trend-bar-group`, `trend-bar`, `trend-label`, `stacked-tl-legend`, `trend-month-cases`, `trend-month-head`, `trend-month-title`, `trend-month-sub`, `trend-month-close`, `trend-month-list`, `trend-case-card`, `tcc-head`, `tcc-num`, `tcc-date`, `tcc-badges`, `tcc-result`, `tcc-party`

### 22.9 Company tab specifics
`founders-list`, `founder-row`, `founder-left`, `founder-icon`, `founder-name`, `founder-share`, `card-head`, `card-head-left`, `card-head-icon`, `card-head-title`, `card-head-sub`, `inn-bar`, `inn-left`, `inn-icon`, `inn-label`, `inn-value`, `inn-right`, `inn-count`, `btn-icon`, `btn-ghost`, `btn-ghost btn-sm`, `detail-panel`, `detail-toolbar`, `detail-section`, `detail-section-title`, `detail-grid`, `hearing-timeline`, `hearing-item`, `hearing-dot`, `hearing-content`, `when`, `where`, `info-row`

### 22.10 Compare mode specifics
`compare-toggle-row`, `compare-toggle`, `compare-input-wrap`, `compare-split`, `compare-col`, `compare-col-head`, `cc-label`, `cc-name`, `is-a`, `compare-vs`, `compare-table`, `ct-winner`

### 22.11 Watchlist specifics
`watchlist-grid`, `watch-card`, `wc-head`, `wc-name`, `wc-stir`, `wc-trash`, `wc-metrics`, `wc-metric`, `wc-metric-label`, `wc-metric-value`, `is-pending`, `is-accent`, `wc-footer`, `wc-jump`

### 22.12 Upcoming Hearings specifics
`company-list`, `company-tile`, `is-selected`, `name`, `stir`, `sel`, `trash`

### 22.13 Misc / utility
`hidden`, `sm:inline`, `sm:hidden`, `theme-toggle`, `theme-icon-dark`, `theme-icon-light`, `tor-badge`, `dot`, `divider-vert`, `select-wrap`, `filter-bar`, `filter-left`, `page-btn`, `pagination`, `btn-sm`

---

## 23. Build Notes (for the single-HTML-file rebuild)

1. **The Next.js component is `'use client'`** — entire UI is client-side. Reproduces cleanly as a single HTML file with vanilla JS or a single bundled React app.
2. **All API endpoints** are relative paths under `/api/...`. In a single-file rebuild, these need to be replaced with either:
   - Public Uzbek API endpoints directly (billing.sud.uz, my.sud.uz, jadval.sud.uz, jadvalapi.sud.uz, orginfo.uz, chamber.uz) — but CORS will block direct browser calls, so
   - A small proxy server (Cloudflare Worker is what this app uses) that forwards to those endpoints, OR
   - Mock data fixtures for offline use.
3. **Streaming bills** (`/api/bills?inn=...`) returns NDJSON — the client reads via `res.body.getReader()`. In a single HTML file, you can use the Fetch API's streaming reader the same way.
4. **localStorage keys** (4 distinct): `mono-theme` (theme), `sbl:recent-inns` (recent STIRs), `sud-saved-companies` (Hearings tab), `sud-watchlist` (Watchlist tab). Cache prefix is `sb-cache:` (5-min TTL).
5. **Sonner toasts** need to be replicated — the local inline StatsTab toast is a fixed-position pill at bottom-center.
6. **Monochrome Glass aesthetic**: animated blobs (`.blob-field > .b1/.b2/.b3`) + `.grain` overlay + glassmorphism panels (`.glass`, `.panel`). Pure B&W — no colour hues; status badges use `b-paid` (solid) vs `b-unpaid` (outline) instead of green/red.
7. **`border-radius: 0`** everywhere — sharp edges only.
8. **All text is in Uzbek (Latin script)**, with the sole exception of the Cyrillic status keys stored as object keys (which are looked up against the constants and never displayed raw).
9. **`useCountUp`** animates summary card numbers from 0 → target over 800ms with cubic ease-out, delay `100 + idx*50`ms per card.
10. **Sample chips differ between tabs**: Stats tab uses `302678824 / 305543087 / 301201019` while Company tab uses `302678824 / 305858476 / 301946789`. Default initial value for the Bills STIR input AND the Stats STIR input is `302678824`.


---

# PART 2 — CSS DESIGN SYSTEM (`src/app/globals.css`)

> Source: `/home/z/my-project/src/app/globals.css` (4070 lines). Aesthetic: **"Monochrome Glass"** — pure black & white, brutalist sharp edges (`border-radius:0` everywhere), glassmorphism panels over an animated blob field + grain overlay. Theme: Light (default) + Dark via `[data-theme='dark']` attribute.

> Theme: Light (default) + Dark via `[data-theme='dark']` attribute.
> Fonts loaded in `src/app/layout.tsx` via `next/font/google`:
> - **Unbounded** (display) → `--font-unbounded` · weights 500/600/700/800
> - **Inter** (body, full Cyrillic) → `--font-jakarta` · weights 400–800
> - **JetBrains Mono** (mono labels) → `--font-jetbrains` · weights 400–700

---

## 1 · TAILWIND IMPORTS & @theme BINDINGS (lines 1–71)

```css
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));
```

### `@theme inline` block (lines 9–71)

Binds Tailwind v4 tokens to the custom monochrome CSS variables so Tailwind utility classes (`bg-background`, `text-foreground`, etc.) resolve to grayscale. **All radius tokens are forced to `0`**.

```
--font-display:  var(--font-unbounded), sans-serif;
--font-body:     var(--font-jakarta), system-ui, sans-serif;
--font-sans:     var(--font-jakarta), system-ui, sans-serif;
--font-mono:     var(--font-jetbrains), ui-monospace, monospace;

--color-background: var(--void);
--color-foreground: var(--text-1);

/* Monochrome ink ramp */
--color-ink:        var(--void);
--color-ink-2:      var(--surface);
--color-ink-3:      var(--surface-2);
--color-ink-4:      var(--surface-3);
--color-fg:         var(--text-1);
--color-fg-2:       var(--text-2);
--color-fg-3:       var(--text-3);
--color-line:       var(--border);
--color-line-2:     var(--border-soft);
--color-surface:    var(--surface);
--color-surface-2:  var(--surface-2);
--color-surface-3:  var(--surface-3);
--color-border-c:   var(--border);
--color-border-c-2: var(--border-soft);
--color-c:          var(--border);
--color-c-2:        var(--border-soft);
--color-accent:     var(--accent);
--color-accent-2:   var(--accent);
--color-accent-3:   var(--accent);

/* shadcn bindings (toaster/sonner compat) — all forced to monochrome */
--color-sidebar-ring, --color-ring, --color-input, --color-border,
--color-destructive, --color-primary, --color-chart-1..5  → all = var(--accent)
--color-sidebar-accent: var(--accent-dim)
--color-muted-foreground: var(--text-2)
--color-muted: var(--surface-2)
--color-secondary / --color-secondary-foreground: var(--surface-2) / var(--text-1)
--color-primary / --color-primary-foreground: var(--accent) / var(--void)
--color-card: var(--panel-bg)
--color-popover / --color-popover-foreground: var(--void) / var(--text-1)

/* shadcn radii — ALL ZERO */
--radius-sm: 0; --radius-md: 0; --radius-lg: 0; --radius-xl: 0;
```

---

## 2 · DESIGN TOKENS — `:root` (LIGHT, lines 79–206)

> **7-step grayscale ramp**: `#FFF → #F8F8F8 → #E8E8E8 → #C0C0C0 → #808080 → #404040 → #000`
> Accent IS pure black in light mode.

### 2.1 · Pure grayscale base palette
| Token | Value | Usage |
|---|---|---|
| `--void` | `#FFFFFF` | page background (pure white) |
| `--void-cream` | `#F8F8F8` | off-white |
| `--void-stone` | `#E8E8E8` | light gray |
| `--void-mid` | `#C0C0C0` | medium gray |
| `--void-dark` | `#404040` | dark gray |
| `--void-ink` | `#000000` | pure black (accent) |

### 2.2 · Surface tokens (translucent black overlays)
| Token | Value |
|---|---|
| `--surface` | `rgba(0,0,0,0.04)` |
| `--surface-2` | `rgba(0,0,0,0.02)` |
| `--surface-3` | `rgba(0,0,0,0.08)` |

### 2.3 · Legacy compat aliases
```
--bg-base:          var(--void);
--bg-surface:       var(--panel-bg);
--bg-surface-2:     var(--surface-2);
--bg-surface-3:     var(--surface-3);
--bg-elevated:      rgba(255,255,255,0.6);
--bg-surface-ghost: rgba(0,0,0,0.02);
```

### 2.4 · Borders (translucent black)
| Token | Value |
|---|---|
| `--border` | `rgba(0,0,0,0.10)` |
| `--border-soft` | `rgba(0,0,0,0.06)` |
| `--border-strong` | `rgba(0,0,0,0.14)` |
| `--border-faint` | `rgba(0,0,0,0.04)` |
| `--border-accent` | `var(--accent)` |

### 2.5 · Text
| Token | Value |
|---|---|
| `--text-1` | `#000000` (primary) |
| `--text-2` | `rgba(0,0,0,0.65)` (secondary) |
| `--text-3` | `rgba(0,0,0,0.42)` (muted) |
| `--text-faint` | `rgba(0,0,0,0.28)` |
| `--text-on-accent` | `var(--void)` (white-on-black) |
| `--text-primary` / `--text-secondary` / `--text-muted` | aliases for `--text-1/2/3` |

### 2.6 · Accent
| Token | Value |
|---|---|
| `--accent` | `#000000` |
| `--accent-hover` | `#000000` |
| `--accent-dark` | `#000000` |
| `--accent-dim` | `rgba(0,0,0,0.08)` |
| `--accent-soft` | `rgba(0,0,0,0.04)` |
| `--accent-glow` | `rgba(0,0,0,0.10)` |
| `--b-accent` | `var(--accent)` |

### 2.7 · Blob / Glass / Panel
| Token | Value |
|---|---|
| `--blob-color` | `#000000` |
| `--glass-bg` | `linear-gradient(160deg, rgba(255,255,255,0.55), rgba(255,255,255,0.42))` |
| `--panel-bg` | `rgba(255,255,255,0.5)` |
| `--panel-bg-2` | `rgba(255,255,255,0.4)` |
| `--header-bg` | `rgba(255,255,255,0.72)` |
| `--sticky-bg` | `rgba(255,255,255,0.85)` |

### 2.8 · 3-level elevation shadow system
```
--shadow-1:      0 24px 60px -24px rgba(0,0,0,0.16), 0 1px 2px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.6);
--shadow-2:      0 2px 8px -4px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.4);
--shadow-3:      0 8px 24px -10px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.4);
--shadow-hover:  0 10px 24px -8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.5);
--shadow-press:  inset 0 1px 2px rgba(0,0,0,0.20);
--shadow:        var(--shadow-2);
--shadow-md:     var(--shadow-2);
--shadow-deep:   var(--shadow-3);
--inner-shadow:  inset 0 1px 0 rgba(255,255,255,0.4);
--skeleton-1:    rgba(0,0,0,0.06);
--skeleton-2:    rgba(0,0,0,0.08);
--selection:     rgba(0,0,0,0.16);
```

### 2.9 · Status colors — ALL aliases to monochrome (NO actual color)
All of these collapse to `var(--accent)` / `var(--accent-dim)` so the app never renders any hue:
`--green`, `--blue`, `--amber`, `--red`, `--violet`, `--teal` (+ their `-tint` and `-text` variants).

### 2.10 · Badge text colors (monochrome)
```
--b-paid:      var(--accent);
--b-unpaid:    var(--text-1);
--b-partial:   var(--text-1);
--b-cancelled: var(--text-1);
--b-checking:  var(--text-2);
--b-used:      var(--accent);
--b-mib:       var(--text-1);
```

### 2.11 · shadcn raw values (light)
```
--background: #FFFFFF;       --foreground: #000000;
--card: rgba(255,255,255,0.5); --card-foreground: #000000;
--popover: #FFFFFF;          --popover-foreground: #000000;
--primary: #000000;          --primary-foreground: #FFFFFF;
--secondary: rgba(0,0,0,0.03); --secondary-foreground: #000000;
--muted: rgba(0,0,0,0.03);   --muted-foreground: rgba(0,0,0,0.65);
--accent-foreground: #FFFFFF; --destructive: #000000;
--border: rgba(0,0,0,0.10);  --input: #FFFFFF;  --ring: #000000;
--chart-1..5: #000000;
--sidebar: rgba(255,255,255,0.5);
--sidebar-foreground: #000000;
--sidebar-primary: #000000; --sidebar-primary-foreground: #FFFFFF;
--sidebar-accent: rgba(0,0,0,0.08); --sidebar-accent-foreground: #000000;
--sidebar-border: rgba(0,0,0,0.10); --sidebar-ring: #000000;
--radius: 0;
```

---

## 3 · DESIGN TOKENS — `[data-theme='dark']` (lines 208–302)

> Pure black bg, pure white text/accent. Inverts the light scheme.

### 3.1 · Grayscale palette (dark)
| Token | Value |
|---|---|
| `--void` | `#000000` (pure black — page bg) |
| `--void-charcoal` | `#0A0A0A` |
| `--void-slate` | `#141414` |
| `--void-light-slate` | `#404040` |
| `--void-warm-white` | `#FFFFFF` (accent / strong text) |
| `--void-off-white` | `#F8F8F8` |

### 3.2 · Surfaces (translucent white overlays)
```
--surface:   rgba(255,255,255,0.06);
--surface-2: rgba(255,255,255,0.03);
--surface-3: rgba(255,255,255,0.10);
```

### 3.3 · Borders / Text / Accent (dark)
```
--border:        rgba(255,255,255,0.08);
--border-soft:   rgba(255,255,255,0.05);
--border-strong: rgba(255,255,255,0.12);
--border-faint:  rgba(255,255,255,0.04);
--border-accent: var(--accent);

--text-1: #FFFFFF;
--text-2: rgba(255,255,255,0.65);
--text-3: rgba(255,255,255,0.42);
--text-faint: rgba(255,255,255,0.26);
--text-on-accent: var(--void);

--accent:        #FFFFFF;
--accent-hover:  #FFFFFF;
--accent-dark:   #FFFFFF;
--accent-dim:    rgba(255,255,255,0.08);
--accent-soft:   rgba(255,255,255,0.04);
--accent-glow:   rgba(255,255,255,0.10);

--blob-color: #FFFFFF;
--glass-bg:   linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025));
--panel-bg:   rgba(255,255,255,0.04);
--panel-bg-2: rgba(255,255,255,0.03);
--header-bg:  rgba(0,0,0,0.72);
--sticky-bg:  rgba(0,0,0,0.85);
```

### 3.4 · Shadows (dark) — deeper drop, faint top highlight
```
--shadow-1:      0 24px 60px -24px rgba(0,0,0,0.6),  0 1px 2px rgba(0,0,0,0.3),  inset 0 1px 0 rgba(255,255,255,0.05);
--shadow-2:      0 2px 8px -4px rgba(0,0,0,0.4),                            inset 0 1px 0 rgba(255,255,255,0.04);
--shadow-3:      0 8px 24px -10px rgba(0,0,0,0.5),                           inset 0 1px 0 rgba(255,255,255,0.04);
--shadow-hover:  0 10px 24px -8px rgba(0,0,0,0.55),                          inset 0 1px 0 rgba(255,255,255,0.06);
--shadow-press:  inset 0 1px 2px rgba(0,0,0,0.4);
--inner-shadow:  inset 0 1px 0 rgba(255,255,255,0.04);
--skeleton-1:    rgba(255,255,255,0.06);
--skeleton-2:    rgba(255,255,255,0.08);
--selection:     rgba(255,255,255,0.16);
```

### 3.5 · shadcn raw values (dark)
```
--background: #000000;   --foreground: #FFFFFF;
--card: rgba(255,255,255,0.04); --card-foreground: #FFFFFF;
--popover: #000000;      --popover-foreground: #FFFFFF;
--primary: #FFFFFF;      --primary-foreground: #000000;
--secondary: rgba(255,255,255,0.03); --secondary-foreground: #FFFFFF;
--muted: rgba(255,255,255,0.03); --muted-foreground: rgba(255,255,255,0.65);
--accent-foreground: #000000; --destructive: #FFFFFF;
--border: rgba(255,255,255,0.08); --input: #000000; --ring: #FFFFFF;
--chart-1..5: #FFFFFF;
--sidebar: rgba(255,255,255,0.04);
--sidebar-accent: rgba(255,255,255,0.08);
```

---

## 4 · GLOBAL RESET & BASE STYLES — `@layer base` (lines 307–348)

```css
* {
  box-sizing: border-box;
  border-radius: 0 !important;            /* ← square corners EVERYWHERE */
}

/* Exemptions: round elements that MUST stay circular */
.blob, .status-dot, .tor-badge .dot, .chip .dot, .copy-btn .dot {
  border-radius: 50% !important;
}

*, *::before, *::after { box-sizing: border-box; }

html {
  -webkit-text-size-adjust: 100%;
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--void);
  color: var(--text-1);
  font-family: var(--font-jakarta), system-ui, -apple-system, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  transition: background-color 0.25s ease, color 0.25s ease;
}

button { font-family: inherit; cursor: pointer; border: none; background: none; color: inherit; border-radius: 0; }
a { color: inherit; text-decoration: none; }
::selection { background: var(--selection); color: var(--text-1); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
[data-lucide] { stroke-width: 2; flex-shrink: 0; }
input, select, textarea { border-radius: 0 !important; }
```

**Key takeaways**:
- Universal `border-radius:0 !important` — only `.blob`, `.status-dot`, `.tor-badge .dot`, `.chip .dot`, `.copy-btn .dot` are exempted to `50%`.
- Body uses Inter (`--font-jakarta`) at 14px / line-height 1.5.
- Color transition (0.25s ease) animates theme switches.

---

## 5 · "MONOCHROME GLASS" AESTHETIC — Background Layers (lines 350–381)

### 5.1 · Layer structure
```
z-index: 0  →  .blob-field   (fixed, 3 animated gradient blobs)
z-index: 1  →  .grain        (fixed, SVG fractalNoise texture at 3% opacity)
z-index: 2  →  .shell        (relative, page content)
```

### 5.2 · `.blob-field` (fixed container)
```css
position: fixed; inset: 0; z-index: 0;
pointer-events: none; overflow: hidden;
```

### 5.3 · `.blob` (individual blob — circles, blurred)
```css
position: absolute;
border-radius: 50%;
filter: blur(80px);
opacity: 0.12;
background: var(--blob-color);     /* #000 light / #FFF dark */
```
Three named blobs with drift animations:
| Class | Size | Position | Animation |
|---|---|---|---|
| `.blob.b1` | 520×520 | top:-140px, left:-100px | `drift1 22s ease-in-out infinite` |
| `.blob.b2` | 460×460 | top:20%, right:-160px | `drift2 26s ease-in-out infinite` |
| `.blob.b3` | 400×400 | bottom:-120px, left:20% | `drift3 24s ease-in-out infinite` |

### 5.4 · `.grain` (fixed noise overlay)
```css
position: fixed; inset: 0; z-index: 1;
pointer-events: none;
opacity: 0.03;
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='60' height='60' filter='url(%23n)'/%3E%3C/svg%3E");
```

### 5.5 · Glassmorphism recipe (used by `.glass`, `.panel`, `.bento`, `.sum-card`, `.ct-card`, etc.)
- `background: var(--glass-bg)` — linear-gradient(160deg, 0.55→0.42 alpha white)
- `border: 1px solid var(--border)`
- `backdrop-filter: blur(24px) saturate(140%)` (panel: `blur(16px)`)
- `box-shadow: var(--shadow-1)` (panel: `var(--shadow-2)`)
- `::before` top accent bar (3px high, full width, `var(--accent)` background) on `.glass` and `.bento-strong`

### 5.6 · Color discipline
**NO indigo, NO blue, NO hue.** All status color tokens (`--green`, `--blue`, `--amber`, `--red`, `--violet`, `--teal`) collapse to `var(--accent)`. Badges signal state via **fill** (solid = positive) vs **outline** (transparent + 1px border = negative/pending), not via hue.

### 5.7 · border-radius:0 everywhere
Forced by universal selector `* { border-radius: 0 !important; }`. Only circular dots/blobs are exempted.

---

## 6 · LAYOUT SHELL (lines 383–391)

| Class | Key properties |
|---|---|
| `.shell` | `position: relative; z-index: 2; min-height: 100vh; display: flex; flex-direction: column;` |
| `.wrap` | `width: 100%; max-width: 1180px; margin: 0 auto; padding: 0 20px;` (640px+: `0 28px`) |
| `.main-content` | `flex: 1; max-width: 1180px; margin: 0 auto; width: 100%; padding: 44px 20px 64px;` (640px+: `56px 28px 72px`) |

---

## 7 · HEADER (lines 393–515)

### `.app-header` — sticky 68px glass header
```
position: sticky; top: 0; z-index: 40;
height: 68px;
display: flex; align-items: center;
background: var(--header-bg);                          /* rgba(255,255,255,0.72) */
backdrop-filter: blur(24px) saturate(140%);
-webkit-backdrop-filter: blur(24px) saturate(140%);
border-bottom: 1px solid var(--border-soft);
```

### `.header-inner`
```
height: 68px; display: flex; align-items: center; justify-content: space-between;
gap: 16px; max-width: 1180px; margin: 0 auto; width: 100%;
padding: 0 20px;   (640px+: 0 28px)
```

### `.brand` / `.brand-mark` / `.brand-text` / `.brand-title` / `.brand-sub`
- `.brand` — flex row, gap 12px
- `.brand-mark` — 38×38, `background: var(--accent)`, `color: var(--void)`, flex-centered (contains an 18×18 SVG logo)
- `.brand-title` — Unbounded 14px/700, letter-spacing -0.01em, `color: var(--text-1)`, ellipsis nowrap
- `.brand-sub` — JetBrains 10px, uppercase, letter-spacing 0.12em, `color: var(--text-3)`, **hidden below 640px**

### `.header-right`, `.header-actions`
Flex rows, gap 8px, flex-shrink 0.

### `.status-badge`, `.tor-badge` — 32px monochrome status pill
```
height: 32px; padding: 0 14px;
border: 1px solid var(--border);
background: var(--surface-2);
font: 600 11px var(--font-jetbrains); text-transform: uppercase; letter-spacing: 0.06em;
color: var(--text-2);
```
`.tor-badge:hover` → `background: var(--surface); color: var(--text-1); border-color: var(--accent);`

### `.status-dot`, `.tor-badge .dot`
```
width: 6px; height: 6px; border-radius: 50%;
background: var(--accent);
animation: pulse 2s ease-in-out infinite;
```

### `.ext-link` — 32px monochrome external link
Same shell as `.tor-badge` (height 32, padding 0 14, mono 11px). Hover → accent color, accent-dim bg.

### `.icon-btn`, `.btn-icon` — 38×38 square icon buttons
```
width: 38px; height: 38px;
background: var(--surface-2);
border: 1px solid var(--border);
color: var(--text-2);
transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.2s;
```
- `.btn-icon:hover` → `border-color: var(--accent); color: var(--accent); transform: rotate(90deg);` (spins!)
- `.icon-btn:hover` → `background: var(--accent-dim); border-color: var(--accent); color: var(--accent);`

### `.theme-toggle` — 32×32 (matches tor-badge/ext-link)
Same shell as icon-btn but smaller (32px). Contains two icons (`.theme-icon-light` / `.theme-icon-dark`), toggled by `:root[data-theme="light"]`.

---

## 8 · TABS — liquid-rail (lines 538–594)

### `.tabs-wrap`
```
display: flex; justify-content: center; margin-bottom: 36px;
(640px+: justify-content: flex-start;)
```

### `.liquid-rail` / `.tabs-bar`
```
position: relative; display: inline-flex; gap: 2px;
padding: 6px;
border: 1px solid var(--border-soft);
background: var(--surface-2);
backdrop-filter: blur(10px);
overflow-x: auto;
scrollbar-width: none;        /* hidden */
```
`::-webkit-scrollbar { display: none; }`

### `.tab-btn`
```
padding: 10px 18px;
border: none; background: none;
font: 700 12.5px var(--font-jakarta);
color: var(--text-2);
transition: color 0.35s cubic-bezier(0.16,1,0.3,1), background 0.35s cubic-bezier(0.16,1,0.3,1);
```
- `.tab-btn svg` — 15×15, opacity 0.7
- `.tab-btn:hover` → `color: var(--text-1);`
- `.tab-btn.is-active` → `color: var(--void); background: var(--accent); box-shadow: 0 8px 20px -6px rgba(0,0,0,0.4);` (svg opacity 1)
- **Below 640px**: `.tab-btn .tab-label` and `.tab-btn span` are hidden (icon-only tabs)

### `.tab-pill`
`display: none !important;` (legacy, never rendered)

---

## 9 · TAB PANELS (lines 596–605)

```
.tab-panel { display: none; }
.tab-panel.is-active {
  display: block;
  animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 10 · GLASS HERO + PANEL (lines 607–712)

### `.glass` — primary hero glass
```
background: var(--glass-bg);
border: 1px solid var(--border);
box-shadow: var(--shadow-1);
backdrop-filter: blur(24px) saturate(140%);
-webkit-backdrop-filter: blur(24px) saturate(140%);
padding: 34px 24px;             (640px+: 44px 40px)
position: relative;
overflow: hidden;
margin-bottom: 18px;
```
`.glass::before` — 3px top accent bar (`background: var(--accent)`)

### `.panel` — secondary panel (smaller glass)
```
background: var(--panel-bg);
border: 1px solid var(--border);
box-shadow: var(--shadow-2);
padding: 20px;                  (640px+: 24px)
transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
margin-bottom: 14px;
backdrop-filter: blur(16px);
```
`.panel-hover:hover` → `transform: translateY(-3px); border-color: var(--accent); box-shadow: var(--shadow-3);`

### `.bento` family (legacy compat aliases)
- `.bento` — same as `.panel`
- `.bento-hover:hover` — same as `.panel-hover:hover`
- `.bento-strong` — same as `.glass` (with `::before` accent bar)

### Grids
- `.bento-grid-6` — 2 cols → 3 cols (640px) → 6 cols (1000px+), gap 10px
- `.bento-grid-4` — 1 col → 2 cols (640px) → 4 cols (1024px+), gap 12px
- `.card-stack` — flex column, gap 16px
- `.card-stack-sm` — flex column, gap 12px

### `.tab-section` family (v123)
- `.tab-section` — `margin-bottom: 20px;` (last-child: 0) — consistent 20px rhythm for major blocks
- `.tab-section-sm` — `margin-bottom: 14px;` (last-child: 0) — tighter rhythm for thin toolbars
- `.summary-grid.is-split` — Bills tab 6-cell split: 2 cols → 3 cols (640px) → 6 cols (1000px) with a vertical divider `::before` on the 4th cell (5px left, 1px wide, var(--border-soft)) to visually separate count vs money groups

### `.card-head` family
- `.card-head` — flex row, space-between, gap 12px, margin-bottom 16px, flex-wrap
- `.card-head-left` — flex row, gap 10px
- `.card-head-icon` — 32×32 square, `background: var(--surface-2); color: var(--accent); border: 1px solid var(--border);` (SVG 14×14)
- `.card-head-title` — Unbounded 14px/700, letter-spacing -0.01em
- `.card-head-sub` — JetBrains 11px, uppercase, letter-spacing 0.06em, `color: var(--text-3)`

---

## 11 · HEADINGS (lines 776–834)

### `.eyebrow` / `.h-eyebrow` — small uppercase label pill
```
display: inline-flex; gap: 8px;
font: 700 10px var(--font-jetbrains);
letter-spacing: 0.14em; text-transform: uppercase;
color: var(--text-3);
margin: 0 0 18px;
padding: 5px 12px;
border: 1px solid var(--border);
background: var(--surface-2);
```

### `.h-display` — main page hero heading
```
font-family: var(--font-unbounded);
font-weight: 700;
letter-spacing: -0.02em;
line-height: 1.1;
font-size: clamp(26px, 4.2vw, 40px);
color: var(--text-1);
margin: 0 0 16px;
```
`.h-display .accent` — `color: var(--accent); border-bottom: 3px solid var(--accent);` (underlined accent word)

### `.lede`
```
color: var(--text-2);
font-size: 14.5px;
line-height: 1.65;
max-width: 560px;
margin: 0 0 30px;
```

### `.h-section` — small section divider header
```
font: 700 10px var(--font-jetbrains);
text-transform: uppercase;
letter-spacing: 0.14em;
color: var(--text-3);
margin: 38px 0 14px;
display: flex; align-items: center; gap: 10px;
```
`.h-section::after` — `flex: 1; height: 1px; background: var(--border-soft);` (expanding divider line)

---

## 12 · SEARCH ROW + CONSOLE INPUT (lines 836–886)

### `.search-row`
```
display: flex; flex-direction: column; gap: 10px; margin-bottom: 18px;
(560px+: flex-direction: row;)
```

### `.input-wrap`
```
position: relative; flex: 1;
```
`.input-wrap > svg` — 16×16 absolutely positioned at left 20px, vertically centered, `color: var(--text-3)`, pointer-events none

### `.console-input`, `.input` — 52px brutalist input
```
width: 100%;
height: 52px;
padding: 0 20px 0 48px;
border: 1px solid var(--border);
background: rgba(255,255,255,0.5);   /* dark: rgba(255,255,255,0.04) */
color: var(--text-1);
font-family: var(--font-jetbrains);
font-size: 14.5px;
outline: none;
transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
```
- `::placeholder` — `color: var(--text-3);`
- `:focus` — `border-color: var(--accent); box-shadow: 4px 4px 0 var(--accent);` (offset hard shadow = brutalist)

### `.input.pl-12`
`padding-left: 48px;` (icon padding variant)

### `.input-mono`
```
font-family: var(--font-jetbrains);
font-variant-numeric: tabular-nums;
letter-spacing: 0;
```

---

## 13 · BUTTONS (lines 888–972)

### `.btn-primary` / `.btn.btn-primary` — 52px solid accent CTA
```
height: 52px;
padding: 0 26px;
border: none;
background: var(--accent);
color: var(--void);
font: 800 13px var(--font-jakarta);
text-transform: uppercase;
letter-spacing: 0.06em;
display: inline-flex; align-items: center; justify-content: center; gap: 8px;
transition: transform 0.25s, box-shadow 0.25s, background 0.25s;
white-space: nowrap;
```
- `:hover` → `transform: translateY(-2px); box-shadow: var(--shadow-hover);`
- `:disabled` → `background: var(--surface-2); color: var(--text-3); cursor: not-allowed; transform: none; box-shadow: none; border: 1px solid var(--border);`
- SVG: 16×16

### `.btn` — generic 52px secondary
Same shell as `.btn-primary` but `border: 1px solid var(--border); background: var(--surface-2); color: var(--text-2);`
- `:hover` → `border-color: var(--accent); color: var(--accent);`
- `:active` → `transform: translateY(1px);`

### `.btn-ghost` — 44px ghost button
```
height: 44px;
padding: 0 18px;
background: var(--surface-2);
color: var(--text-2);
border: 1px solid var(--border);
font: 700 12px var(--font-jakarta);
text-transform: uppercase;
letter-spacing: 0.06em;
```
- `:hover` → `background: var(--accent-dim); color: var(--accent); border-color: var(--accent);`
- `:disabled` → `opacity: 0.55; cursor: not-allowed;`

### `.btn-sm`
```
height: 32px; padding: 0 12px; font-size: 11px;
white-space: nowrap; text-transform: none; letter-spacing: 0; font-weight: 600;
```

---

## 14 · CHIPS (lines 974–1018)

### `.chip-row`
`display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 6px;`

### `.chip-label`
Mono 10px uppercase, `color: var(--text-3)`, letter-spacing 0.1em

### `.chip` — 32px square chip
```
height: 32px;
padding: 0 14px;
border: 1px solid var(--border);
background: var(--surface-2);
color: var(--text-2);
font: 600 12px var(--font-jetbrains);
display: inline-flex; align-items: center; gap: 6px;
white-space: nowrap;
transition: background 0.2s, color 0.2s, border-color 0.2s;
```
- `:hover` and `.is-active` → `border-color: var(--accent); color: var(--accent); background: var(--accent-dim);`
- `.chip .dot` — 6×6, `border-radius: 50%`, `background: currentColor; opacity: 0.6;`

---

## 15 · TOGGLE PAIR (lines 1020–1047)

### `.toggle-pair`
```
display: inline-flex; gap: 2px; padding: 4px;
border: 1px solid var(--border-soft);
background: var(--surface-2);
margin-top: 22px;
```

### `.toggle-btn`
```
padding: 9px 18px;
border: none; background: none;
color: var(--text-2);
font: 700 12px var(--font-jetbrains);
text-transform: uppercase; letter-spacing: 0.06em;
transition: background 0.2s, color 0.2s;
```
`.toggle-btn.is-active` → `background: var(--accent); color: var(--void);`

---

## 16 · INN BAR (lines 1049–1103)

### `.inn-bar`
```
display: flex; align-items: center; justify-content: space-between;
flex-wrap: wrap; gap: 14px;
```

### `.inn-left` / `.inn-right`
- `.inn-left` — flex row, gap 14px
- `.inn-right` — flex row, gap 18px

### `.inn-icon` — 44×44 square icon container
`background: var(--surface); border: 1px solid var(--border); color: var(--accent);` (SVG 20×20)

### `.inn-label`
Mono 10px uppercase, letter-spacing 0.08em, `color: var(--text-3)`, margin-bottom 3px

### `.inn-value`
Mono 16px/700, `color: var(--text-1)`

### `.inn-count` / `.inn-count .num` / `.inn-count .lbl`
- `.inn-count` — flex column, align-items flex-end
- `.num` — mono 19px/800, `color: var(--accent)`
- `.lbl` — mono 10px uppercase, `color: var(--text-3)`, text-align right

---

## 17 · SUMMARY GRID (lines 1105–1141)

### `.summary-grid` (Bills tab 6-cell)
```
display: grid;
grid-template-columns: repeat(2, 1fr);   (640px+: 3 cols; 1000px+: 6 cols)
gap: 10px;
```

### `.summary-cell`
```
background: rgba(255,255,255,0.5);   /* dark: rgba(255,255,255,0.04) */
border: 1px solid var(--border-soft);
padding: 16px;
backdrop-filter: blur(10px);
```
- `.summary-cell .lbl` — mono 9px uppercase, letter-spacing 0.08em, `color: var(--text-3)`, margin-bottom 6px
- `.summary-cell .val` — mono 20px/800, `color: var(--text-1)`, tabular-nums
- `.summary-cell.paid .val` — `color: var(--accent); font-weight: 900;`
- `.summary-cell.unpaid .val` — `color: var(--text-2);`
- `.summary-cell.money .val` — `font-size: 14px;`

---

## 18 · FILTER BAR (lines 1143–1190)

### `.filter-bar`
```
display: flex; flex-wrap: wrap; align-items: center;
gap: 10px; justify-content: space-between;
```

### `.filter-left`
Flex row, flex-wrap, gap 8px

### `.select-wrap` — custom dropdown
- `position: relative; display: inline-flex; align-items: center;`
- `.select-wrap select` — 38px height, padding 0 32px 0 15px, background-image (chevron SVG), border 1px var(--border), mono 12px, appearance none
  - Dark theme uses a different chevron stroke color (`%23f5f5f5`)
  - `:focus` → `border-color: var(--accent);`
- `.select-wrap select option` — `background: var(--void); color: var(--text-1); padding: 10px;`

---

## 19 · BILL CARD + CASE CARD (lines 1192–1245)

### `.bill-card`, `.case-card`
```
padding: 22px;   (640px+: 26px)
```
They share the `.panel` base elsewhere (the card itself uses `.panel` plus this padding tweak).

### `.bill-head` — flex row, space-between, gap 12px, flex-wrap, margin-bottom 16px

### `.bill-idx` — flex row, gap 10px

### `.idx-num`
Mono 11px/600, `color: var(--text-3)`

### `.bill-title` — flex column, gap 2px

### `.receipt` — receipt number
```
font-family: var(--font-jetbrains);
font-weight: 700;
font-size: 14.5px;
display: flex; align-items: center; gap: 8px;
color: var(--text-1);
font-variant-numeric: tabular-nums;
```

### `.company`
`font-size: 12.5px; color: var(--text-2);`

### `.copy-btn`
- `background: none; border: none; color: var(--text-3); padding: 2px;`
- `:hover` → `color: var(--accent);`
- SVG 13×13

### `.badge-row`
Flex row, gap 6px, flex-wrap, justify-content flex-end

---

## 20 · BADGES — 24px square, monochrome (lines 1246–1289)

### Base `.badge`
```
height: 24px;
padding: 0 10px;
font: 700 9.5px var(--font-jetbrains);
text-transform: uppercase;
letter-spacing: 0.06em;
display: inline-flex; align-items: center; gap: 4px;
border: 1px solid var(--border);
background: var(--surface-2);
color: var(--text-2);
white-space: nowrap;
```
`.badge svg` — 11×11

### Variants
| Class | Style | Meaning |
|---|---|---|
| `.b-econ, .b-duty, .b-neutral, .b-court-econ, .b-court-civ, .b-court-crim, .b-court-adm` | `background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border);` | neutral info (court type, duty, instance) |
| `.b-paid, .b-used, .b-accent` | `background: var(--accent); color: var(--void); border-color: var(--accent);` | **SOLID** = positive |
| `.b-unpaid, .b-partial, .b-cancelled, .b-checking, .b-mib, .b-amber` | `background: transparent; color: var(--text-1); border: 1px solid var(--text-1);` | **OUTLINE** = negative/pending |
| `.b-plaintiff` | solid accent (Da'vogar) | role = plaintiff |
| `.b-defendant` | outline (Javobgar) | role = defendant |
| `.b-win` | solid accent | outcome = won |
| `.b-lose` | outline | outcome = lost |
| `.b-pending` | `background: var(--surface); color: var(--text-2); border-color: var(--border);` | outcome = pending |

---

## 21 · MONEY CELLS (lines 1291–1354)

### `.money-grid`
```
display: grid;
grid-template-columns: repeat(2, 1fr);   (560px+: repeat(5, 1fr))
gap: 8px;
margin-bottom: 16px;
```

### `.money-cell`
```
padding: 12px 13px;
background: var(--surface-2);
border: 1px solid var(--border-soft);
transition: border-color 0.15s, background 0.15s;
position: relative;
```
- `:hover` → `border-color: var(--border);`
- `.label` / `.lbl` — mono 9px uppercase, letter-spacing 0.06em, `color: var(--text-3)`, flex row gap 4px (icon 10×10)
- `.value` / `.val` — mono 15px/700, tabular-nums, `color: var(--text-1)`, nowrap ellipsis
- `.sub` — 10.5px, `color: var(--text-3)`

### Variants
- `.is-paid` / `.is-accent` → `border-color: var(--accent); background: var(--accent-dim);` val color `var(--accent)` weight 900
- `.is-unpaid` → `border-color: var(--text-1); background: transparent;` val color `var(--text-1)`

---

## 22 · INFO GRID + INFO ROWS (lines 1356–1402)

### `.info-grid`
```
display: grid;
grid-template-columns: 1fr;   (640px+: repeat(3, 1fr))
gap: 10px;
margin-bottom: 12px;
```

### `.info-row`
```
background: var(--surface-2);
padding: 11px 13px;
border: 1px solid var(--border-soft);
display: flex; flex-direction: column; gap: 3px;
min-width: 0;
```
- `:hover` → `border-color: var(--border);`
- `.lbl`/`.label` — mono 9px uppercase, `color: var(--text-3)`, flex with 11×11 icon
- `.val`/`.value` — 13px/500, `color: var(--text-1)`, line-height 1.35, word-break
- `.val.mono` / `.value.mono` — JetBrains + tabular-nums

---

## 23 · EXPAND BUTTON + DETAIL GRID (lines 1404–1503)

### `.expand-btn` — full-width 40px
```
height: 40px; padding: 0 16px;
background: var(--surface-2);
border: 1px solid var(--border);
color: var(--text-2);
font: 700 11px var(--font-jetbrains);
text-transform: uppercase; letter-spacing: 0.06em;
width: 100%;
justify-content: space-between;
```
- `:hover` → `border-color: var(--accent); color: var(--accent);`
- `.is-open svg` → `transform: rotate(180deg);` (chevron flip)

### `.expand-content`
`max-height: 0; overflow: hidden; transition: max-height 0.45s cubic-bezier(0.16,1,0.3,1);`
`.is-open` → `max-height: 2000px;`

### `.expand-inner`
`padding-top: 16px;`

### `.detail-grid` — definition list (dt/dd)
```
display: grid;
grid-template-columns: 1fr 1fr;   (560px-: 1 col)
background: var(--surface-2);
overflow: hidden;
margin-bottom: 16px;
border: 1px solid var(--border-soft);
```
- `dt` — mono 9px uppercase, padding 11px 15px 2px, flex with 11×11 icon, border-bottom
- `dd` — mono 13px, padding 0 15px 11px, `color: var(--text-1)`, word-break, border-bottom
- `dd.mono` — JetBrains + tabular-nums
- Last dt/dd: border-bottom 0

### `.detail-panel` / `.detail-section` / `.detail-toolbar` / `.detail-section-title`
- `.detail-panel` — flex column, gap 16px
- `.detail-section` — flex column, gap 12px
- `.detail-toolbar` — flex row, justify-end, gap 8px
- `.detail-section-title` — mono 10px/700 uppercase, letter-spacing 0.14em, `color: var(--text-3)`, flex with 12×12 accent SVG

---

## 24 · HEARING TIMELINE (lines 1505–1549)

### `.hearing-timeline` — vertical line with square dots
```
position: relative;
padding-left: 20px;
margin-bottom: 16px;
```
`::before` — 2px wide vertical line at left 5px, top 4px to bottom 4px, `background: var(--accent);`

### `.hearing-item`
`position: relative; padding-bottom: 14px;` (last-child: 0)

### `.hearing-dot` — 11×11 SQUARE dot (NOT round)
```
position: absolute; left: -20px; top: 2px;
width: 11px; height: 11px;
background: var(--accent);
border: 2px solid var(--void);
box-sizing: content-box;
```

### `.hearing-item .when`
Mono 12.5px/700, `color: var(--text-1)`, tabular-nums

### `.hearing-item .where`
12px, `color: var(--text-3)`, margin-top 2px

### `.hearing-content`
Flex column, gap 4px

---

## 25 · DECISION BAR (lines 1551–1583)

### `.decision-bar` — monochrome alert/info banner
```
display: flex; gap: 12px; align-items: flex-start;
padding: 14px 16px;
background: var(--surface);
border: 1px solid var(--border);
margin-top: 16px;
```

### `.decision-icon` — 30×30 accent square
`background: var(--accent); color: var(--void);` (SVG 16×16)

### `.decision-text`
- Flex column, gap 2px, flex 1
- `.t1` — 13px/700, `color: var(--text-1)`
- `.t2` — mono 11px, `color: var(--text-3)`
- `.accent` — `color: var(--accent); font-weight: 700;`

---

## 26 · COMPANY LIST + TILES (lines 1585–1651)

### `.company-list`
```
display: grid;
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
gap: 12px;
```

### `.company-tile`
```
background: rgba(255,255,255,0.5);   /* dark: rgba(255,255,255,0.04) */
border: 1px solid var(--border);
padding: 17px;
cursor: pointer;
transition: transform 0.25s, border-color 0.25s, background 0.25s;
backdrop-filter: blur(10px);
```
- `:hover` → `border-color: var(--accent); transform: translateY(-3px);`
- `.is-selected` → `border-color: var(--accent); background: var(--accent-dim);`
- `.name` — 13.5px/700, `color: var(--text-1)`
- `.stir` — mono 11.5px, `color: var(--text-3)`
- `.sel` — hidden by default, flex when `.is-selected` (10px mono uppercase accent)

### `.trash` — 26×26 trash icon
`position: absolute; top: 13px; right: 13px;` (SVG 12×12)

---

## 27 · RATING CARD (lines 1653–1730)

### `.rating-card` — centered hero
```
text-align: center;
padding: 44px 24px;
display: flex; flex-direction: column; align-items: center;
gap: 4px;
```

### `.rating-num` / `.rating-score`
```
font-family: var(--font-unbounded);
font-size: 60px;
font-weight: 800;
color: var(--accent);
line-height: 1;
font-variant-numeric: tabular-nums;
```

### `.rating-sub` / `.rating-score-out`
Mono 12px/600 uppercase, letter-spacing 0.1em, `color: var(--text-3)`

### `.rating-badge` / `.rating-cat` — 30px solid accent pill
```
display: inline-flex; gap: 6px;
height: 30px; padding: 0 16px;
background: var(--accent); color: var(--void);
font: 800 13px var(--font-jetbrains); letter-spacing: 0.06em;
```

### `.rating-label`
13px/700 Jakarta, `color: var(--text-1)`

### `.rating-bar` / `.rating-bar-fill`
- Track — 6px high, `background: var(--surface-2)`, max-width 200px, 1px border
- Fill — `background: var(--accent)`, height 100%

### `.rating-info` / `.rating-top` / `.rating-meta-grid` / `.rating-score-block`
Layout helpers — flex column 12px gap, 2-col grid 10px gap, centered.

---

## 28 · QUICK GRID + TILES (lines 1732–1784)

### `.quick-grid`, `.actions-grid`
```
display: grid;
grid-template-columns: 1fr 1fr;   (640px+: repeat(4, 1fr))
gap: 12px;
```

### `.quick-tile`, `.action-card`
```
background: rgba(255,255,255,0.5);   /* dark: rgba(255,255,255,0.04) */
border: 1px solid var(--border);
padding: 18px 15px;
display: flex; flex-direction: column; gap: 11px;
cursor: pointer;
text-align: left; font-family: inherit; width: 100%;
backdrop-filter: blur(10px);
```
- `:hover` → `border-color: var(--accent); background: var(--accent-dim); transform: translateY(-3px);`
- `.quick-tile svg` — 19×19, `color: var(--accent)`
- `.lbl` / `.action-card-title` — 12.5px/700, `color: var(--text-1)`
- `.action-card-icon` — 32×32 accent-dim bg + 1px border, SVG 14×14
- `.action-card-desc` — 11.5px, `color: var(--text-3)`

---

## 29 · PAGINATION (lines 1786–1822)

### `.pagination`
```
display: flex; align-items: center; justify-content: center;
gap: 6px; margin-top: 22px; flex-wrap: wrap;
```

### `.page-btn` — 36×36 square
```
width: 36px; height: 36px;
border: 1px solid var(--border);
background: var(--surface-2);
color: var(--text-2);
font: 700 12.5px var(--font-jetbrains);
```
- `:hover:not(:disabled)` → `border-color: var(--accent); color: var(--accent); background: var(--accent-dim);`
- `.is-active` → `background: var(--accent); border-color: var(--accent); color: var(--void);`
- `:disabled` → `opacity: 0.35; cursor: not-allowed;`

---

## 30 · LOADING STATE (lines 1824–1918)

### `.loading-box` — empty container marker

### `.loading-head` — flex row, gap 13px, margin-bottom 18px

### `.loading-title` — 13.5px/700, `color: var(--text-1)`
### `.loading-sub` — 12px, `color: var(--text-3)`

### `.phase-row` — flex wrap, gap 7px, margin-bottom 18px

### `.phase-step` (in row form — 30px high)
```
height: 30px; padding: 0 13px;
font: 700 10px var(--font-jetbrains);
text-transform: uppercase; letter-spacing: 0.06em;
background: var(--surface-2); color: var(--text-3);
border: 1px solid var(--border-soft);
```
- `.is-current` → `background: var(--accent-dim); color: var(--accent); border-color: var(--accent);`
- `.is-done` → `background: var(--accent); color: var(--void); border-color: var(--accent);`
- SVG 12×12

### `.phase-line` — 16×1px connector
`background: var(--border-soft); margin: 0 4px;`
`.is-done` → `background: var(--accent);`

### `.progress-label` / `.progress-track` / `.progress-fill`
- Label — flex space-between, mono 11px, `color: var(--text-3)`
- Track — 8px high, `background: var(--surface-2)`, 1px border
- Fill — `background: var(--accent); width: 0%; transition: width 0.4s cubic-bezier(0.16,1,0.3,1);`

### `.skeleton-grid` — grid, gap 12px, margin-top 14px

### `.skel`, `.skel-card`
`border: 1px solid var(--border-soft); background: var(--surface-2);`

### `.shimmer`, `.skel-card.shimmer`
```
background: linear-gradient(90deg, var(--surface) 25%, var(--skeleton-2) 37%, var(--surface) 63%);
background-size: 400% 100%;
animation: shimmer 1.6s linear infinite !important;
```

### `.skel-card` (stats variant, line 3133)
`padding: 22px; background: var(--panel-bg); border: 1px solid var(--border-soft); margin-bottom: 12px;`

### `.skel-line` — skeleton bar
`height: 12px; background: var(--skeleton-1); margin-bottom: 8px;`
Width modifiers: `.w-30`, `.w-50`, `.w-70`, `.w-90`, `.h-20`

---

## 31 · KORISH BUTTON (lines 1920–1941)

### `.korish-btn` — mini view button (24px)
```
display: inline-flex; gap: 4px;
height: 24px; padding: 0 10px;
font: 700 9.5px var(--font-jetbrains);
text-transform: uppercase; letter-spacing: 0.06em;
color: var(--accent);
background: var(--accent-dim);
border: 1px solid var(--accent);
```
- `:hover` → `background: var(--accent); color: var(--void);`
- SVG 11×11

---

## 32 · FOUNDER ROWS (lines 1943–1989)

### `.founders-list` — flex column, gap 8px

### `.founder-row`
```
display: flex; align-items: center; justify-content: space-between;
gap: 10px; padding: 10px 12px;
background: var(--surface-2);
border: 1px solid var(--border-soft);
```

### `.founder-left` — flex row, gap 10px

### `.founder-icon` — 28×28 square
`background: var(--surface); color: var(--text-2); border: 1px solid var(--border);` (SVG 13×13)

### `.founder-name`
13px/500, `color: var(--text-1)`, word-break

### `.founder-share` — 22px solid accent pill
```
display: inline-flex; gap: 4px;
height: 22px; padding: 0 8px;
font: 700 11.5px var(--font-jetbrains);
font-variant-numeric: tabular-nums;
background: var(--accent); color: var(--void);
border: 1px solid var(--accent);
```

---

## 33 · USAGE TABLE (lines 1991–2030)

### `.usage-table`
`width: 100%; border-collapse: collapse; font-size: 12.5px; border: 1px solid var(--border-soft); overflow: hidden;`

### `.usage-table thead th`
- `padding: 9px 12px; font: 700 9.5px var(--font-jetbrains); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-3); background: var(--surface-2); border-bottom: 1px solid var(--border-soft);`

### `.usage-table tbody td`
- `padding: 9px 12px; border-bottom: 1px solid var(--border-soft); color: var(--text-1); vertical-align: middle;`
- Last row: `border-bottom: 0;`

### `.col-num` — mono 600 tabular-nums
### `.col-amt` — right-aligned mono 700 tabular-nums

---

## 34 · HINT BANNER (lines 2032–2048)

### `.hint-banner`
```
display: flex; gap: 10px; align-items: center;
background: var(--surface);
border: 1px solid var(--border);
padding: 11px 16px;
font: 600 12px var(--font-jetbrains);
color: var(--text-2);
margin-bottom: 26px;
```
SVG 14×14

---

## 35 · FOOTER — sticky bottom (lines 2050–2080)

### `.app-footer`
```
padding: 30px 20px;
text-align: center;
color: var(--text-3);
font: 11px var(--font-jetbrains);
text-transform: uppercase;
letter-spacing: 0.12em;
border-top: 1px solid var(--border-soft);
margin-top: auto;                 /* ← sticks to bottom of flex shell */
```

### `.footer-inner`
```
display: flex; align-items: center; justify-content: space-between;
gap: 12px; flex-wrap: wrap;
max-width: 1180px; margin: 0 auto;
```

### `.footer-text` / `.footer-links` / `.footer-link`
- `.footer-text` — 11px, `color: var(--text-3)`
- `.footer-links` — flex row, gap 12px
- `.footer-link` — 11px, `color: var(--text-3); transition: color 0.15s;` `:hover` → `color: var(--accent);`

### Sticky-bottom mechanic
The `.shell` is `min-height: 100vh; display: flex; flex-direction: column;`. The `.main-content` is `flex: 1`. The `.app-footer` uses `margin-top: auto;` so it always pins to the bottom of the viewport even when content is short.

---

## 36 · MISC HELPERS (lines 2082–2118)

| Class | Properties |
|---|---|
| `.divider` | `height: 1px; background: var(--border-soft); margin: 14px 0; border: 0;` |
| `.divider-vert` | `width: 1px; align-self: stretch; background: var(--border-soft);` |
| `.no-scrollbar` | `scrollbar-width: none; -ms-overflow-style: none;` + `::-webkit-scrollbar { display: none; }` |
| `.border-dashed` | `border-style: dashed !important;` |
| `.loading-pulse` / `.glow-pulse` | `animation: loadingPulse 2.4s ease-in-out infinite !important;` |
| `.text-accent` | `color: var(--accent);` |
| `.text-secondary` | `color: var(--text-2);` |
| `.text-muted` | `color: var(--text-3);` |
| `.text-fg` | `color: var(--text-1);` |
| `.text-fg-2` | `color: var(--text-2);` |
| `.text-fg-3` | `color: var(--text-3);` |
| `.mono` | `font-family: var(--font-jetbrains), ui-monospace, monospace;` |
| `.tabular` | `font-variant-numeric: tabular-nums;` |
| `.tracking-tight` | `letter-spacing: -0.02em;` |
| `.tracking-tighter` | `letter-spacing: -0.03em;` |
| `.mini-summary` | sticky top 84px, z-index 30, `background: var(--sticky-bg); backdrop-filter: blur(12px) saturate(140%); border: 1px solid var(--border); padding: 8px 18px; box-shadow: var(--shadow-2);` |

> **Note**: There is **no `.sr-only` utility** in this stylesheet (it must come from Tailwind core or shadcn). No `.hidden` either — Tailwind's `hidden` utility is used instead.

---

## 37 · ANIMATIONS (lines 2120–2151, plus scattered)

### `.anim-fade-up` family — staggered fade-up entrance
```
.anim-fade-up   { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) both; }
.anim-fade-up-1 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.06s both; }
.anim-fade-up-2 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.12s both; }
.anim-fade-up-3 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.18s both; }
.anim-fade-up-4 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.24s both; }
.anim-fade-up-5 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.30s both; }
.anim-fade-up-6 { animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1) 0.36s both; }
```

### `.anim-scale-in`
`animation: scaleIn 0.4s cubic-bezier(0.16,1,0.3,1) both;`

### `.slide-down`
`overflow: hidden; animation: slideDown 0.4s cubic-bezier(0.16,1,0.3,1) both;`

### Complete `@keyframes` registry

| Name | Definition | Applied by |
|---|---|---|
| `drift1` | `0%,100% translate(0,0) scale(1); 50% translate(60px,40px) scale(1.1);` | `.blob.b1` |
| `drift2` | `0%,100% translate(0,0) scale(1); 50% translate(-50px,60px) scale(0.9);` | `.blob.b2` |
| `drift3` | `0%,100% translate(0,0) scale(1); 50% translate(40px,-50px) scale(1.15);` | `.blob.b3` |
| `pulse` | `0%,100% opacity:1; 50% opacity:0.3;` | `.status-dot`, `.tor-badge .dot` |
| `pulse-dot` | (alias of `pulse`) | unused / legacy |
| `fadeUp` | `from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); }` | `.tab-panel.is-active`, `.folder-panel.is-active`, `.anim-fade-up*` |
| `fade-up` | (alias of `fadeUp`) | unused / legacy |
| `shimmer` | `0% background-position:100% 0; 100% background-position:-100% 0;` | `.shimmer`, `.skel-card.shimmer` |
| `loadingPulse` | `0%,100% border-color:var(--border); 50% border-color:var(--accent);` | `.loading-pulse`, `.glow-pulse` |
| `scaleIn` | `from { opacity:0; transform:scale(0.95) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); }` | `.anim-scale-in` |
| `slideDown` | `from { opacity:0; max-height:0; transform:translateY(-6px); } to { opacity:1; max-height:3000px; transform:translateY(0); }` | `.slide-down` |
| `svgSpin` | `to { transform: rotate(360deg); }` | `.svg-spin` (0.7s linear infinite) |
| `spin` | `to { transform: rotate(360deg); }` | `.spinner:not(svg)` (0.8s linear infinite), `.spin-anim` |

### `@media (prefers-reduced-motion: reduce)` (line 2146)
```css
*, *::before, *::after {
  animation-duration: 0.001ms !important;
  transition-duration: 0.001ms !important;
}
```

---

## 38 · SPINNERS (lines 2153–2189)

### `.svg-spin` — 28×28 SVG spinner container
`animation: svgSpin 0.7s linear infinite !important;`

### `.spinner` — SVG circle spinner
- Container 28×28
- `.spinner circle` — `fill: none; stroke: var(--accent); stroke-width: 3; stroke-linecap: round; stroke-dasharray: 60; stroke-dashoffset: 20;`

### `.spinner:not(svg)` — CSS-only spinner
```
width: 18px; height: 18px;
border: 2px solid var(--accent-dim);
border-top-color: var(--accent);
animation: spin 0.8s linear infinite !important;
display: inline-block;
```

### `.spin-anim`
`animation: spin 0.8s linear infinite !important; transform-origin: center;`

---

## 39 · STATISTIKA TAB — Folder Navigation (lines 2191–2313)

### `.folder-nav-wrap`
```
margin: 6px 0 12px;
overflow-x: auto; scrollbar-width: none;
padding: 6px 0 0;
position: relative; z-index: 5;
```
`::-webkit-scrollbar { display: none; }`

### `.folder-nav`
`display: inline-flex; align-items: flex-end; gap: 0; min-width: max-content; padding: 0 4px;`

### `.folder-tab` — trapezoidal file-folder tab
```
position: relative; z-index: 1;
display: inline-flex; align-items: center; justify-content: center;
height: 58px; padding: 0 44px 0 40px;
border: 1px solid var(--border); border-bottom: none;
background: var(--surface-2);
color: var(--text-2);
font: 700 13px var(--font-jetbrains);
text-transform: uppercase; letter-spacing: 0.06em;
white-space: nowrap;
clip-path: polygon(0 0, 100% 0, 82% 100%, 18% 100%);   /* trapezoidal */
-webkit-clip-path: polygon(0 0, 100% 0, 82% 100%, 18% 100%);
margin-right: -50px;                                     /* nestle overlap */
transition: transform 0.25s, background 0.25s, color 0.25s, box-shadow 0.25s;
```
- z-index stacking: `:nth-child(1)=4, :nth-child(2)=3, :nth-child(3)=2, :nth-child(4)=1, .is-active=10, :hover=9`
- `:hover:not(.is-active)` → `transform: translateY(-2px); color: var(--text-1); background: var(--surface);`
- `.is-active` → `background: var(--accent); color: var(--void); transform: translateY(-4px); box-shadow: var(--shadow-hover);`
- SVG 14×14, opacity 0.65 default → 1 when active
- `.ft-count` — 18px tall count chip, mono 10px, border 1px currentColor
- `.is-active .ft-count` → `background: var(--void); color: var(--accent); border-color: var(--void);`
- `:last-child { margin-right: 0; padding-right: 48px; }`, `:first-child { padding-left: 42px; }`

### Mobile (max-width: 640px)
`.folder-tab` → height 48px, padding 0 36px 0 32px, font 11px, gap 7px, margin-right -40px.

### `.folder-content` / `.folder-panel`
- `.folder-content` — `position: relative; margin-top: 12px;`
- `.folder-panel` — `display: none;`
- `.folder-panel.is-active` — `display: block; animation: fadeUp 0.45s cubic-bezier(0.16,1,0.3,1);`

---

## 40 · FOLDER HEADER + COMPANY BANNER (lines 2326–2418)

### `.folder-header`
```
display: flex; align-items: baseline; justify-content: space-between;
gap: 14px; flex-wrap: wrap; margin-bottom: 16px; padding: 0 2px;
```
- `.fh-title` — Unbounded 20px/700, letter-spacing -0.01em
- `.fh-count` — mono 11px uppercase, letter-spacing 0.08em, `color: var(--text-3)`

### `.company-banner` — TAHLIL company context bar
```
display: flex; align-items: center; gap: 14px;
padding: 16px 18px;
background: var(--surface-2);
border: 1px solid var(--border-soft);
border-left: 3px solid var(--accent);          /* ← accent left stripe */
margin-bottom: 18px; flex-wrap: wrap;
```
- `.cb-icon` — 36×36, `background: var(--accent); color: var(--void);` (SVG 16×16)
- `.cb-name` — Unbounded 14px/700
- `.cb-sub` — mono 10.5px uppercase, `color: var(--text-3)`
- `.cb-stats` — flex row, gap 18px (640px-: 14px), mono tabular-nums
- `.cb-stat` — flex column align-end; `.cb-v` 16px/700, `.cb-l` 9.5px uppercase

---

## 41 · STATS FILTER BAR + SAMPLE CHIPS (lines 2420–2462)

### `.stats-filter-bar`
`display: flex; flex-wrap: wrap; align-items: center; gap: 14px;`

### `.filter-group` — flex wrap, gap 8px

### `.filter-divider` — 1px vertical line
`width: 1px; align-self: stretch; background: var(--border-soft); margin: 4px 2px;`
Hidden below 720px.

### `.sample-chip` — 28px dashed-border chip
```
height: 28px; padding: 0 12px;
border: 1px dashed var(--border);
background: transparent; color: var(--text-2);
font: 600 11.5px var(--font-jetbrains);
font-variant-numeric: tabular-nums;
```
- `:hover` → `border-style: solid; border-color: var(--accent); color: var(--accent); background: var(--accent-dim);`

---

## 42 · STATS SUMMARY CARDS (lines 2464–2545)

### `.summary-grid-stats` (4 cells)
```
display: grid;
grid-template-columns: repeat(2, 1fr);   (1024px+: repeat(4, 1fr))
gap: 12px;
```

### `.sum-card`
```
background: var(--panel-bg);
border: 1px solid var(--border);
padding: 22px 20px;
cursor: pointer;
transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
backdrop-filter: blur(16px);
position: relative; overflow: hidden;
```
- `:hover` → `transform: translateY(-3px); border-color: var(--accent); box-shadow: var(--shadow-3);`
- `.sc-label` — mono 9.5px/700 uppercase, `color: var(--text-3)`, flex with 12×12 icon
- `.sc-num` — mono 44px/700, `color: var(--text-1)`, tabular-nums, letter-spacing -0.02em
- `.sc-sub` — mono 10.5px uppercase, `color: var(--text-3)`

### Variants
- `.solid` → `background: var(--accent); border-color: var(--accent);` text inverted (label/sub `var(--accent-dim)`, num `var(--void)`)
- `.outline` → `background: transparent; border-color: var(--text-1); border-width: 2px;`
- `.surface` → `background: var(--surface); border-color: var(--border);`

### Mobile (max-width: 640px)
`.sum-card` padding 18px 16px, `.sc-num` font 36px.

---

## 43 · ROLE BREAKDOWN (lines 2547–2639)

### `.role-grid`
```
display: grid;
grid-template-columns: 1fr;   (640px+: 1fr 1fr)
gap: 14px;
```

### `.role-card` — base (uses .panel elsewhere)
- `.rc-head` — flex row, space-between, gap 10px, margin-bottom 14px
- `.rc-title` — Unbounded 13px/700, flex with 14×14 accent SVG
- `.rc-total` — mono 11px uppercase, `color: var(--text-3)`, tabular-nums
- `.rc-bar` — `display: flex; height: 8px; background: var(--surface-2); border: 1px solid var(--border-soft); overflow: hidden; margin-bottom: 14px;`
  - `> div` — `height: 100%; background: var(--accent); transition: width 0.5s cubic-bezier(0.16,1,0.3,1);`
  - `.outline` — `background: transparent; border-right: 1px solid var(--text-1);`
  - `.surface` — `background: var(--surface-3);`
- `.rc-legend` — flex column, gap 8px
- `.rc-row` — flex row, space-between, gap 10px, Jakarta 12.5px, `color: var(--text-2)`
- `.rc-swatch` — 10×10, `background: var(--accent);` (`.outline` transparent + 1px border, `.surface` `var(--surface-3)`)
- `.rc-right` — mono 700, `color: var(--text-1)`, tabular-nums
- `.rc-pct` — mono 10px/600, `color: var(--text-3)`, letter-spacing 0.06em

---

## 44 · TIMELINE CHART (lines 2641–2722)

### `.timeline-scroll`
```
overflow-x: auto; overflow-y: hidden;
width: 100%; position: relative;
scrollbar-width: thin;
scrollbar-color: var(--border-strong) transparent;
```
- `::-webkit-scrollbar { height: 6px; }`
- `::-webkit-scrollbar-track { background: transparent; }`
- `::-webkit-scrollbar-thumb { background: var(--border-strong); }`

### `.timeline-chart`
`display: flex; align-items: flex-end; gap: 2px; height: 180px; padding: 8px 0 0; position: relative; min-width: 100%;`

### `.timeline-bar`
```
flex: 1 0 0; min-width: 8px;
background: var(--accent);
position: relative;
transition: opacity 0.2s, transform 0.2s;
cursor: pointer;
```
- `:hover` → `opacity: 0.7; transform: translateY(-2px);`
- `.is-zero` → `background: var(--surface-3); opacity: 0.5;`
- `.tl-tip` — absolute tooltip above bar, `background: var(--accent); color: var(--void);` mono 10px uppercase, padding 4px 8px, opacity 0 → 1 on hover

### `.timeline-labels`
Flex row, gap 2px, margin-top 8px, min-width 100%
- `.tl-lbl` — mono 9px uppercase, `color: var(--text-3)`, opacity 0 (`.show` → 1)

---

## 45 · COURT-TYPE BREAKDOWN (lines 2724–2796)

### `.courttype-grid`
```
display: grid;
grid-template-columns: 1fr;   (640px+: repeat(3, 1fr))
gap: 12px;
```

### `.ct-card`
```
background: var(--panel-bg);
border: 1px solid var(--border);
padding: 22px 20px;
cursor: pointer;
transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
backdrop-filter: blur(16px);
```
- `:hover` → `transform: translateY(-3px); border-color: var(--accent); box-shadow: var(--shadow-3);`
- `.is-empty` → `opacity: 0.7;` (hover → 1)
- `.ct-top` — flex row, space-between, gap 10px, margin-bottom 10px
- `.ct-name` — mono 10.5px/600 uppercase, `color: var(--text-3)`
- `.ct-arrow` — `color: var(--text-3);` SVG 14×14, hover → `color: var(--accent); transform: translateX(3px);`
- `.ct-num` — mono 40px/700, `color: var(--accent)`, tabular-nums, letter-spacing -0.02em (`.is-empty` → `color: var(--text-3)`)
- `.ct-pct` — mono 10.5px uppercase, `color: var(--text-3)`

Mobile (640px-): `.ct-num` font 32px.

---

## 46 · CATEGORY LIST (lines 2798–2854)

### `.cat-list` — flex column, gap 14px

### `.cat-row` — flex row, gap 18px
- `.cat-left` — flex 1, column, gap 6px
- `.cat-name` — Jakarta 13px/600, `color: var(--text-1)`, ellipsis nowrap
- `.cat-bar` — `height: 4px; background: var(--surface-3);` `> span` height 100% `background: var(--accent); transition: width 0.5s cubic-bezier(0.16,1,0.3,1);`
- `.cat-right` — flex row baseline, gap 4px, mono tabular-nums
- `.cat-count` — 16px/700, `color: var(--text-1)`
- `.cat-of` — 10px uppercase, `color: var(--text-3)`

---

## 47 · CASE LIST + CASE CARD STATS (lines 2856–2945)

### `.case-list` — flex column, gap 12px

### `.case-card-stats`
```
cursor: pointer;
padding: 22px;          (640px+: 26px)
background: var(--panel-bg);
border: 1px solid var(--border);
box-shadow: var(--shadow-2);
backdrop-filter: blur(16px);
transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
```
`:hover` → `transform: translateY(-3px); border-color: var(--accent); box-shadow: var(--shadow-3);`

### `.case-head` — flex row, space-between, gap 14px, flex-wrap, margin-bottom 14px

### `.case-id-group` — flex row, gap 10px, flex 1

### `.case-num-stats`
Mono 16px/700, `color: var(--text-1)`, tabular-nums, letter-spacing -0.01em, nowrap

### `.case-reg`
Mono 11px uppercase, `color: var(--text-3)`, letter-spacing 0.06em, nowrap, flex with 11×11 SVG

### `.copy-btn-stats` — 28×28
`border: 1px solid var(--border); background: transparent; color: var(--text-3);`
`:hover` → `background: var(--accent); color: var(--void); border-color: var(--accent);`

### `.case-badges` — flex wrap, gap 6px, margin-bottom 14px

---

## 48 · CASE RESULT (lines 2976–3010)

### `.case-result` — accent left border, variant by outcome
```
display: flex; align-items: center; gap: 10px;
padding: 12px 14px;
background: var(--surface-2);
border: 1px solid var(--border-soft);
border-left: 3px solid var(--accent);
margin-bottom: 14px;
```
- `.lose` → `border-left-color: var(--text-1);`
- `.neutral` → `border-left-color: var(--surface-3);`
- `.pending` → `border-left-color: var(--text-3);`

### `.cr-icon` — 28×28 square
- Default → `background: var(--accent); color: var(--void);`
- `.lose` → `background: transparent; color: var(--text-1); border: 1px solid var(--text-1);`
- `.neutral` → `background: var(--surface-3); color: var(--text-1);`
- `.pending` → `background: var(--surface); color: var(--text-2); border: 1px solid var(--border);`
- SVG 13×13

### `.cr-text`
Jakarta 13.5px/600, `color: var(--text-1)`, line-height 1.35

---

## 49 · CASE META GRID (lines 3012–3040)

### `.case-meta-grid`
```
display: grid;
grid-template-columns: 1fr;   (640px+: 1fr 1fr, gap 12px 24px)
gap: 8px;
```
- `.meta-row` — flex column, gap 2px
- `.meta-lbl` — mono 9.5px uppercase, `color: var(--text-3)`, letter-spacing 0.08em
- `.meta-val` — Jakarta 12.5px, `color: var(--text-2)`, line-height 1.4

---

## 50 · EMPTY STATE (lines 3042–3076)

### `.empty-state`
```
display: flex; flex-direction: column; align-items: center; justify-content: center;
gap: 16px; padding: 60px 24px; text-align: center;
```
- `.es-icon` — 64×64, `border: 1px solid var(--border); background: var(--surface-2); color: var(--text-3);` (SVG 28×28)
- `.es-title` — Unbounded 18px/700, `color: var(--text-1)`
- `.es-sub` — mono 11px uppercase, `color: var(--text-3)`, letter-spacing 0.08em

---

## 51 · RESULT META (lines 3078–3099)

### `.result-meta`
```
display: flex; align-items: center; justify-content: space-between;
gap: 12px; flex-wrap: wrap; margin-bottom: 16px; padding: 0 2px;
```
- `.rm-left` — mono 11px uppercase, `color: var(--text-3)`
- `.rm-left strong` — `color: var(--text-1); font-weight: 700;`

---

## 52 · PHASE STEPS (vertical, lines 3101–3130)

### `.phase-steps` — flex column, gap 8px

### `.phase-step` (vertical variant — full row)
```
display: flex; align-items: center; gap: 10px;
padding: 10px 14px;
border: 1px solid var(--border-soft);
background: var(--surface-2);
font: 11.5px var(--font-jetbrains);
color: var(--text-2);
text-transform: uppercase; letter-spacing: 0.06em;
```
- `.is-active` → `border-color: var(--accent); background: var(--accent-dim); color: var(--accent);`
- `.is-done` → `color: var(--text-1); border-color: var(--border);`
- `.ps-icon svg` — 12×12

---

## 53 · DOWNLOAD TOOLBAR (lines 3169–3226)

### `.download-toolbar`
```
display: flex; align-items: center; justify-content: space-between;
gap: 14px; flex-wrap: wrap; padding: 14px 16px;
```
- `.dl-left` — flex row, gap 14px, flex 1
- `.dl-title` — mono 10.5px/700 uppercase, letter-spacing 0.1em, `color: var(--text-3)`
- `.dl-chips` — inline-flex, gap 6px, flex-wrap
- `.chip` (scoped) — inline-flex, gap 5px, padding 6px 10px, border 1px var(--border), transparent bg, `color: var(--text-3)`, mono 11px uppercase
  - `:hover` → `border-color: var(--accent); color: var(--text-1);`
  - `.is-active` → `background: var(--accent); color: var(--void); border-color: var(--accent);`
  - SVG 11×11
- `.btn-primary` (scoped) — `flex-shrink: 0;`

---

## 54 · DONUT CHART (lines 3228–3319)

### `.donut-chart`
`display: flex; align-items: center; gap: 32px; flex-wrap: wrap; padding: 4px 0;`

### `.donut-ring` — 180×180 SVG container
`position: relative; width: 180px; height: 180px; flex-shrink: 0;`
- `::after` — `position: absolute; inset: 26px; background: var(--panel-bg); z-index: 1;` (the "hole")

### `.donut-center`
```
position: absolute; inset: 0;
display: flex; flex-direction: column; align-items: center; justify-content: center;
z-index: 2; pointer-events: none;
```
- `.dc-num` — mono 38px/700, `color: var(--text-1)`, tabular-nums, letter-spacing -0.02em
- `.dc-lbl` — mono 10px/700 uppercase, `color: var(--text-3)`, letter-spacing 0.12em

### `.donut-legend` — flex column, gap 12px, flex 1, min-width 200px

### `.dl-row` — grid `14px 1fr auto auto`, align center, gap 12px

### `.dl-swatch` — 14×14 color block
- `.dl-win` — `background: var(--accent);`
- `.dl-lose` — `background: var(--accent); opacity: 0.4;`
- `.dl-neutral` — `background: var(--surface-3);`
- `.dl-pending` — `background: var(--surface-2); border: 1px solid var(--border);`

### `.dl-label` — Jakarta 13px/600, `color: var(--text-1)`
### `.dl-count` — mono 14px/700, `color: var(--text-1)`, tabular-nums
### `.dl-pct` — mono 11px, `color: var(--text-3)`, tabular-nums, min-width 36px, right-align

---

## 55 · WIN RATE BAR CHART (lines 3321–3365)

### `.winrate-chart` — flex column, gap 18px, padding 4px 0

### `.winrate-row` — flex row, align center, gap 14px, flex-wrap

### `.wr-label` — mono 10.5px/700 uppercase, letter-spacing 0.08em, `color: var(--text-2)`, min-width 100px

### `.winrate-bar-track`
`flex: 1; min-width: 120px; height: 10px; background: var(--surface-2); border: 1px solid var(--border-soft); overflow: hidden; position: relative;`

### `.winrate-bar-fill`
`height: 100%; background: var(--accent); transition: width 0.6s cubic-bezier(0.16,1,0.3,1);`

### `.wr-value` — mono 11.5px/700, `color: var(--text-1)`, tabular-nums, min-width 110px, right-align

### Mobile (640px-)
`.donut-chart` gap 20px, justify center. `.donut-ring` 150×150. `.dc-num` 30px. `.wr-label` 80px / 9.5px. `.wr-value` 90px / 10.5px. `.winrate-bar-track` height 8px.

---

## 56 · STACKED TIMELINE (lines 3367–3416)

### `.stacked-timeline-bar`
```
flex: 1; min-width: 4px;
display: flex; flex-direction: column-reverse;
background: transparent; position: relative;
transition: opacity 0.2s, transform 0.2s;
cursor: pointer;
```
- `:hover` → `opacity: 0.75; transform: translateY(-2px);`
- `.is-zero` → `background: var(--surface-3); opacity: 0.4;`

### `.stacked-segment` — `width: 100%; flex: 0 0 auto;`
- `.seg-win` — `background: var(--accent);`
- `.seg-lose` — `background: var(--accent); opacity: 0.4;`
- `.seg-neutral` — `background: var(--surface-3);`
- `.seg-pending` — `background: var(--surface-2);`

### `.stacked-tl-legend` — flex wrap, gap 14px 18px, margin-top 16px, padding-top 14px, border-top 1px var(--border-soft)
- `> span` — inline-flex, gap 7px, mono 10.5px/600 uppercase, `color: var(--text-2)`
- `.dl-swatch` (scoped) — 11×11

---

## 57 · TREND CHART — SVG (lines 3428–3440, 3786–3826, 3908–4070)

### `.trend-chart-container`
```
overflow-x: auto;
padding: 16px;             (early def: padding-bottom: 8px;)
margin-bottom: 12px;
```
- `::-webkit-scrollbar { height: 6px; }`
- `::-webkit-scrollbar-track { background: transparent; }`
- `::-webkit-scrollbar-thumb { background: var(--border-strong); }`

### `.trend-svg`
`display: block;`

### `.trend-bar-group`
`cursor: pointer;`
`:hover .trend-bar { opacity: 0.8; }`

### `.trend-bar`
`transition: opacity 0.15s;`

### `.trend-label` (SVG text)
`font-family: var(--font-mono); font-size: 9px; fill: var(--text-3); text-anchor: middle;`

### `.trend-tooltip` (SVG text)
`font-family: var(--font-mono); font-size: 10px; fill: var(--text-1);`

### `.trend-legend` — flex wrap, gap 10px 14px, margin-top 12px, padding-top 10px, border-top 1px var(--border-soft)
- `> span` — inline-flex, gap 6px, mono 10px/600 uppercase, `color: var(--text-2)`
- `.dl-swatch` (scoped) — 10×10

### Trend month cases popup (v136 rework)
- `.trend-month-cases` — `margin-top: 12px; padding: 16px; background: var(--surface); border: 1px solid var(--border-strong); border-left: 2px solid var(--accent);`
- `.trend-month-head` — flex row, space-between, margin-bottom 12px
- `.trend-month-title` — `font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--text-1); letter-spacing: -0.01em;`
- `.trend-month-sub` — mono 10px uppercase, `color: var(--text-3)`, letter-spacing 0.06em
- `.trend-month-close` — 22×22 square button, `border: 1px solid var(--border); background: var(--surface-2); color: var(--text-3);`
  - `:hover` → `color: var(--accent); border-color: var(--accent);`
- `.trend-month-list` — flex column, gap 8px, max-height 280px, overflow-y auto, `scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent;`
  - `::-webkit-scrollbar { width: 4px; }`
  - `::-webkit-scrollbar-thumb { background: var(--border-strong); }`

### `.trend-case-card`
```
background: var(--surface-2);
border: 1px solid var(--border-soft);
padding: 10px 12px;
cursor: pointer;
transition: border-color 0.15s, background 0.15s;
position: relative;
```
`:hover` → `border-color: var(--accent); background: var(--surface);`

### `.tcc-*` sub-elements
- `.tcc-head` — flex row, space-between, gap 8px, margin-bottom 6px
- `.tcc-num` — 12px/700, `color: var(--text-1)`
- `.tcc-date` — 10px, `color: var(--text-3)`
- `.tcc-badges` — flex row, gap 4px, margin-bottom 6px
- `.tcc-result` — 11px, `color: var(--text-2)`, line-height 1.4
- `.tcc-party` — 10px, `color: var(--text-3)`, ellipsis nowrap
- `.trend-case-card .korish-btn` — `margin-top: 8px; width: 100%; justify-content: center;`

### `.trend-case-row` (early v134 variant)
`display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--surface-2); border: 1px solid var(--border-soft); cursor: pointer;`
`:hover` → `border-color: var(--accent);`

---

## 58 · WATCHLIST (v134) — v1 (lines 3442–3551) + v2 (lines 3687–3784)

There are TWO `.watch-card` definitions — v1 (richer, with `.wc-*` children) and v2 (compact, with `.watch-card-*` children). Both exist in the stylesheet.

### v1 `.watch-card`
```
position: relative;
background: var(--panel-bg);
border: 1px solid var(--border);
padding: 18px 18px 16px;
cursor: pointer;
transition: transform 0.25s, border-color 0.25s, box-shadow 0.25s;
backdrop-filter: blur(16px);
```
- `:hover` → `transform: translateY(-3px); border-color: var(--accent); box-shadow: var(--shadow-3);`
- `.wc-head` — flex row, space-between, gap 8px, margin-bottom 14px
- `.wc-name` — Jakarta 14px/700, `color: var(--text-1)`, line-clamp 2, ellipsis
- `.wc-stir` — mono 11px, `color: var(--text-3)`, letter-spacing 0.04em
- `.wc-trash` — 26×26, `background: var(--surface-2); border: 1px solid var(--border); color: var(--text-3);` (SVG 12×12)
- `.wc-metrics` — grid `1fr 1fr`, gap 8px 14px
- `.wc-metric` — flex column, gap 2px
- `.wc-metric-label` — mono 9px/700 uppercase, `color: var(--text-3)`
- `.wc-metric-value` — mono 16px/700, `color: var(--text-1)`, tabular-nums (`.is-accent` → `var(--accent)`, `.is-pending` → `var(--text-3)` 12px)
- `.wc-footer` — flex row, space-between, gap 8px, margin-top 14px, padding-top 12px, border-top 1px var(--border-soft), mono 10.5px uppercase `var(--text-3)`
- `.wc-jump` — inline-flex, gap 4px, `color: var(--accent); font-weight: 700;`

### v2 `.watch-card` (overrides v1)
```
background: var(--panel-bg);
border: 1px solid var(--border);
box-shadow: var(--shadow-2), var(--shadow-inset);
padding: 16px;
cursor: pointer;
transition: border-color 0.25s, box-shadow 0.25s;
backdrop-filter: blur(8px);
position: relative;
```
- `:hover` → `border-color: var(--border-strong); box-shadow: var(--shadow-3), var(--shadow-inset);`
- `.watch-card-head` — flex row, space-between, gap 8px, margin-bottom 12px
- `.watch-card-name` — 13px/700, `color: var(--text-1)`
- `.watch-card-tin` — mono 11px, `color: var(--text-3)`
- `.watch-card-stats` — grid 4 cols, gap 4px, margin-bottom 8px
- `.watch-stat` — text-align center, padding 6px 2px, `background: var(--surface); border: 1px solid var(--border-soft);`
  - `.val` — mono 14px/700, `color: var(--text-1)`
  - `.lbl` — mono 8px uppercase, `color: var(--text-3)`, letter-spacing 0.06em
  - `.accent .val` — `color: var(--accent); font-weight: 800;`
  - `.muted .val` — `color: var(--text-2);`
- `.watch-card-footer` — flex row, space-between, gap 6px, mono 10px, `color: var(--text-3)`, margin-top 6px
- `.watch-trash` — absolute top 10px right 10px, 24×24, opacity 0 → 1 on `.watch-card:hover`

### `.watchlist-grid` (defined twice)
- v1: `repeat(auto-fill, minmax(260px, 1fr))`, gap 14px
- v2 (overrides): `1fr` → 2 cols (640px+) → 3 cols (1024px+), gap 12px

---

## 59 · COMPARISON MODE (v134) (lines 3553–3682, 3828–3906)

### `.compare-split`
```
display: grid;
grid-template-columns: 1fr;   (1024px+: 1fr 48px 1fr, align-items: stretch)
gap: 16px;
```

### `.compare-col` — flex column, gap 14px (later: `min-width: 0;`)

### `.compare-vs` — center "VS" divider
- v1: `font-family: var(--font-unbounded); font-size: 18px/800; color: var(--text-3);` with `::before`/`::after` vertical 1px lines (1024px+)
- v2: `font-family: var(--font-display); font-size: 20px/800; padding: 0 12px;`

### `.compare-col-head`
```
display: flex; align-items: baseline; justify-content: space-between;
gap: 8px; padding-bottom: 10px;
border-bottom: 1px solid var(--border-soft);
margin-bottom: 4px;
```
- `.cc-label` — mono 10px/700 uppercase, `color: var(--text-3)`
- `.cc-name` — Jakarta 13px/700, `color: var(--text-1)`, ellipsis nowrap (`.is-a` → `color: var(--accent)`)

### `.compare-table`
```
width: 100%; border-collapse: collapse;
font-family: var(--font-jetbrains); font-size: 12px;
```
- `th, td` — `padding: 10px 12px (v2: 8px 12px); border-bottom: 1px solid var(--border-soft); text-align: right; font-variant-numeric: tabular-nums;`
- `th:first-child, td:first-child` — `text-align: left; font-family: var(--font-jakarta); font-size: 12px; color: var(--text-2); font-weight: 600;`
- `thead th` — mono 10px/700 uppercase, `color: var(--text-3)`, border-bottom 1px var(--border)
- `.ct-winner` (v1) / `td.winner` (v2) — `color: var(--accent); font-weight: 700/800;`

### `.compare-toggle-row` — flex row, gap 10px, margin-top 14px, padding 12px 14px, `border: 1px solid var(--border-soft); background: var(--surface-2);`

### `.compare-toggle`
```
display: inline-flex; align-items: center; gap: 6px (v1) / 8px (v2);
height: 32px; padding: 0 12px;
border: 1px solid var(--border); background: var(--surface);
color: var(--text-2); font: 600 11px var(--font-mono);
text-transform: uppercase; letter-spacing: 0.04em (v1) / 0.08em (v2);
```
- `.is-active` → `background: var(--accent); color: var(--void); border-color: var(--accent);`
- `:hover:not(.is-active)` → `border-color: var(--accent); color: var(--accent);`
- `.compare-toggle input` — `accent-color: var(--accent);`

### `.compare-input-wrap` — flex row, gap 8px, flex 1, min-width 180px
- `.input-wrap` (scoped) — flex 1

### `.compare-grid`
```
display: grid;
grid-template-columns: 1fr;   (900px+: 1fr auto 1fr, align-items: start)
gap: 16px;
```

---

## 60 · RESPONSIVE BREAKPOINTS — Complete Registry

| Breakpoint | Used for |
|---|---|
| `min-width: 560px` | `.search-row` → row layout; `.money-grid` → 5 cols |
| `max-width: 560px` | `.detail-grid` → 1 col; `.detail-grid dt` border-right 0 |
| `min-width: 640px` | `.wrap` padding 28px; `.main-content` padding 56/28/72; `.brand-sub` shown; `.header-inner` padding 28px; `.glass` padding 44/40; `.panel` padding 24; `.tabs-wrap` left-aligned; `.tab-btn` padding 10/18; `.bento-grid-6` 3 cols; `.bento-grid-4` 2 cols; `.bento-strong` padding 44/40; `.summary-grid` 3 cols; `.summary-grid.is-split` 3 cols; `.bill-card/.case-card` padding 26; `.info-grid` 3 cols; `.quick-grid/.actions-grid` 4 cols; `.role-grid` 2 cols; `.courttype-grid` 3 cols; `.case-card-stats` padding 26; `.case-meta-grid` 2 cols; `.summary-grid-stats` 4 cols; `.watchlist-grid` 2 cols |
| `max-width: 640px` | `.tab-btn .tab-label, .tab-btn span` hidden; `.folder-tab` smaller (48px, 11px, gap 7px, margin-right -40px); `.company-banner .cb-stats` gap 14px; `.sum-card` padding 18/16, `.sc-num` 36px; `.ct-card .ct-num` 32px; `.role-card .rc-bar` 6px; `.timeline-chart` 150px; `.donut-chart` gap 20px center; `.donut-ring` 150×150; `.dc-num` 30px; `.wr-label` 80px/9.5px; `.wr-value` 90px/10.5px; `.winrate-bar-track` 8px; `.h-display` 26px; `.case-head` gap 10px; `.case-num-stats` 14px |
| `min-width: 720px` | (filter-divider visible — hidden below) |
| `max-width: 720px` | `.filter-divider` hidden |
| `min-width: 900px` | `.compare-grid` → 1fr auto 1fr |
| `min-width: 1000px` | `.bento-grid-6` 6 cols; `.summary-grid` 6 cols; `.summary-grid.is-split` 6 cols (+ divider) |
| `min-width: 1024px` | `.bento-grid-4` 4 cols; `.summary-grid-stats` 4 cols; `.compare-split` 1fr 48px 1fr; `.watchlist-grid` 3 cols |

---

## 61 · SCROLLBAR STYLING — Per-element (NO global scrollbar styling)

There is **no global `*::-webkit-scrollbar` or `html { scrollbar-color }` rule**. Each scrollable element is styled individually.

| Element | Style |
|---|---|
| `.liquid-rail, .tabs-bar` | `scrollbar-width: none; ::-webkit-scrollbar { display: none; }` (hidden) |
| `.no-scrollbar` (utility) | `scrollbar-width: none; -ms-overflow-style: none; ::-webkit-scrollbar { display: none; }` |
| `.folder-nav-wrap` | `scrollbar-width: none; ::-webkit-scrollbar { display: none; }` (hidden) |
| `.timeline-scroll` | `scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; ::-webkit-scrollbar { height: 6px; } thumb: var(--border-strong); track: transparent` |
| `.trend-chart-container` | `::-webkit-scrollbar { height: 6px; } thumb: var(--border-strong); track: transparent` |
| `.trend-month-list` | `scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; ::-webkit-scrollbar { width: 4px; } thumb: var(--border-strong)` |

> **Firefox** support: `scrollbar-width: thin` + `scrollbar-color` on `.timeline-scroll` and `.trend-month-list`. Hidden scrollbars on `.liquid-rail`, `.folder-nav-wrap`, `.no-scrollbar` use `scrollbar-width: none`.

---

## 62 · PRINT STYLES

**None.** There are no `@media print` rules anywhere in `globals.css`. The app is screen-only; printing will produce unstyled output.

---

## 63 · UTILITY CLASSES — Complete List

### Color utilities
- `.text-accent` → `color: var(--accent);`
- `.text-secondary` → `color: var(--text-2);`
- `.text-muted` → `color: var(--text-3);`
- `.text-fg` → `color: var(--text-1);`
- `.text-fg-2` → `color: var(--text-2);`
- `.text-fg-3` → `color: var(--text-3);`

### Typography utilities
- `.mono` → `font-family: var(--font-jetbrains), ui-monospace, monospace;`
- `.tabular` → `font-variant-numeric: tabular-nums;`
- `.tracking-tight` → `letter-spacing: -0.02em;`
- `.tracking-tighter` → `letter-spacing: -0.03em;`

### Layout utilities
- `.shell` — min-h-screen flex column (page root)
- `.wrap` — max-width 1180px centered
- `.main-content` — flex 1 page body
- `.divider` / `.divider-vert` — 1px horizontal/vertical lines
- `.no-scrollbar` — hide scrollbar on element
- `.border-dashed` — `border-style: dashed !important;`
- `.card-stack` / `.card-stack-sm` — flex column with 16/12px gap

### Animation utilities
- `.anim-fade-up`, `.anim-fade-up-1` through `.anim-fade-up-6` — staggered fade-up entrance
- `.anim-scale-in` — scale + fade entrance
- `.slide-down` — expand from max-height 0
- `.loading-pulse` / `.glow-pulse` — pulsing border animation
- `.spin-anim` — 0.8s linear spin

### Sticky utility
- `.mini-summary` — sticky top 84px, z-index 30, blurred sticky-bg

### `.sr-only` / `.hidden`
**Not defined** in `globals.css`. These come from Tailwind's core utilities (Tailwind v4 ships `.sr-only` and `.hidden` as part of its preflight/utilities layer).

---

## 64 · FOOTER STICKY-BOTTOM MECHANIC

The footer sticks to the bottom via a 3-part flex layout:

```html
<div class="shell">                  <!-- min-height: 100vh; display: flex; flex-direction: column; -->
  <header class="app-header">…</header>
  <main class="main-content">…</main>  <!-- flex: 1; (grows to fill) -->
  <footer class="app-footer">…</footer> <!-- margin-top: auto; (pins to bottom) -->
</div>
```

- `.shell` — `position: relative; z-index: 2; min-height: 100vh; display: flex; flex-direction: column;`
- `.main-content` — `flex: 1; max-width: 1180px; margin: 0 auto; width: 100%; padding: 44px 20px 64px;`
- `.app-footer` — `padding: 30px 20px; border-top: 1px solid var(--border-soft); margin-top: auto;`

The `margin-top: auto` on the footer (combined with `flex: 1` on main-content) guarantees the footer is always pinned to the bottom of the viewport even when the page content is short. The `min-height: 100vh` on `.shell` ensures the layout fills the viewport before content grows.

---

## 65 · DESIGN SYSTEM SUMMARY — Cheat Sheet

### Color palette (light)
```
Page bg:   #FFFFFF
Surface:   rgba(0,0,0,0.04) / 0.02 / 0.08
Border:    rgba(0,0,0,0.10) / 0.06 / 0.14 / 0.04
Text:      #000000 / rgba(0,0,0,0.65) / rgba(0,0,0,0.42) / rgba(0,0,0,0.28)
Accent:    #000000 (with rgba 0.08 / 0.04 / 0.10 variants)
```

### Color palette (dark)
```
Page bg:   #000000
Surface:   rgba(255,255,255,0.06) / 0.03 / 0.10
Border:    rgba(255,255,255,0.08) / 0.05 / 0.12 / 0.04
Text:      #FFFFFF / rgba(255,255,255,0.65) / rgba(255,255,255,0.42) / rgba(255,255,255,0.26)
Accent:    #FFFFFF (with rgba 0.08 / 0.04 / 0.10 variants)
```

### Fonts
- Display: **Unbounded** (700/800, letter-spacing -0.02em)
- Body: **Inter** (400–800, 14px / 1.5)
- Mono: **JetBrains Mono** (400–700, tabular-nums, uppercase labels with letter-spacing 0.06–0.14em)

### Spacing rhythm
- Major section gap: **20px** (`.tab-section`)
- Thin toolbar gap: **14px** (`.tab-section-sm`)
- Card padding: 22px (mobile) → 26px (640px+)
- Panel padding: 20px → 24px
- Glass hero padding: 34/24 → 44/40
- Grid gap: 10–14px

### Border-radius
**`0` everywhere** (universal `!important`). Only `.blob`, `.status-dot`, `.tor-badge .dot`, `.chip .dot`, `.copy-btn .dot` are circles (`50%`).

### Shadows (3 levels + hover + press)
- `--shadow-1` (hero/glass — deep 24px drop + top inset highlight)
- `--shadow-2` (panel — subtle 2px drop + inset)
- `--shadow-3` (hover — 8px drop + inset)
- `--shadow-hover` (CTA hover — 10px drop + inset)
- `--shadow-press` (active — inset only)

### Component heights (consistency table)
| Element | Height |
|---|---|
| App header | 68px |
| Console input / btn-primary / btn | 52px |
| btn-ghost | 44px |
| inn-icon | 44px |
| icon-btn / btn-icon | 38px |
| select-wrap select | 38px |
| brand-mark | 38px |
| page-btn | 36px |
| cb-icon (company banner) | 36px |
| status-badge / tor-badge / ext-link / theme-toggle | 32px |
| chip / toggle-btn (with padding) | 32px |
| folder-tab | 58px (48px mobile) |
| badge | 24px |
| founder-share | 22px |
| korish-btn | 24px |
| trend-month-close | 22px |
| status-dot | 6px |

### Standard transition curves
- Default: `0.15s ease`, `0.2s ease`, `0.25s ease`
- Premium motion: `cubic-bezier(0.16, 1, 0.3, 1)` (entrances, panel hovers, expand content)
- Theme switch: `0.25s ease` (body bg + color)
- Long-running: `0.35s cubic-bezier(0.16, 1, 0.3, 1)` (tab-btn color/bg)
- Bar fills: `0.5–0.6s cubic-bezier(0.16, 1, 0.3, 1)`

### Z-index layers
| Layer | z-index |
|---|---|
| `.blob-field` | 0 |
| `.grain` | 1 |
| `.shell` | 2 |
| `.mini-summary` (sticky) | 30 |
| `.app-header` (sticky) | 40 |
| `.folder-nav-wrap` | 5 |
| `.folder-tab` (active) | 10 |
| `.folder-tab:hover` | 9 |
| `.folder-tab:nth-child(1..4)` | 4, 3, 2, 1 |
| `.tab-btn` | 1 |
| `.timeline-bar .tl-tip` | 20 |
| `.donut-center` | 2 |
| `.donut-ring::after` | 1 |

---

## 66 · REBUILD CHECKLIST (for the HTML reproduction)

1. **Load 3 Google Fonts**: Unbounded (500/600/700/800), Inter (400–800 with cyrillic subset), JetBrains Mono (400–700).
2. **Define `:root` tokens** with all light-mode values from §2.
3. **Define `[data-theme='dark']` tokens** with all dark-mode values from §3.
4. **Universal reset**: `* { box-sizing: border-box; border-radius: 0 !important; }` with circular exemptions for `.blob`, `.status-dot`, `.tor-badge .dot`, `.chip .dot`, `.copy-btn .dot`.
5. **Body**: 14px Inter, line-height 1.5, `background: var(--void); color: var(--text-1); overflow-x: hidden;` + 0.25s ease bg/color transition.
6. **Background layers** (fixed, full-viewport): `.blob-field` (z=0) → 3 blurred 50%-opacity circles animated with `drift1/2/3` → `.grain` (z=1, SVG fractalNoise at 3% opacity).
7. **Shell layout**: `.shell` (min-h-screen, flex column, z=2) → `.app-header` (sticky top, 68px, glass) → `.main-content` (flex 1, max-w 1180px) → `.app-footer` (margin-top auto, mono uppercase).
8. **Header**: backdrop-blur 24px saturate 140%, 1px border-bottom, 38px brand-mark (solid accent), 32px status-badge/ext-link/theme-toggle, 38px icon-btn.
9. **Tabs**: `.liquid-rail` (inline-flex, 6px padding, blur 10px, hidden scrollbar) + `.tab-btn` (10/18 padding, 12.5px Jakarta 700, active = solid accent bg + void color + drop shadow).
10. **Glass hero**: `.glass` with linear-gradient white 0.55→0.42 bg, blur 24px saturate 140%, shadow-1, 3px `::before` top accent bar.
11. **Panels**: `.panel` with rgba(255,255,255,0.5) bg, blur 16px, shadow-2, 14px bottom margin.
12. **Inputs**: 52px, mono 14.5px, 1px border, focus = `4px 4px 0 var(--accent)` hard offset shadow.
13. **Buttons**: btn-primary (52px, solid accent, uppercase, lift on hover), btn (52px secondary), btn-ghost (44px), btn-sm (32px).
14. **Badges**: 24px, mono 9.5px uppercase, 3 visual modes (neutral surface-2, solid accent = positive, transparent + 1px text-1 border = negative).
15. **Cards**: `.bill-card`, `.case-card`, `.case-card-stats` — all use `.panel` base + 22/26px padding + hover lift.
16. **Stats**: `.sum-card` (44px mono number, 3 variants: solid/outline/surface), `.ct-card` (40px mono number, court-type breakdown), `.role-card` (8px bar + legend), `.cat-row` (4px bar + count).
17. **Charts**: `.donut-chart` (180×180 SVG with `::after` hole + center label + 4-row legend), `.winrate-chart` (10px bars), `.trend-chart-container` (SVG stacked bars, horizontal scroll, click-to-expand `.trend-month-cases` popup with `.trend-case-card` list).
18. **Watchlist**: `.watch-card` with glass bg, 4-col mini-stats grid, hidden trash-on-hover.
19. **Comparison mode**: `.compare-split` (1fr / 48px / 1fr) with center `.compare-vs` and side-by-side `.compare-table`.
20. **Animations**: 3 blob drifts (22–26s loops), pulse (2s), fadeUp (0.45s cubic-bezier entrance for tab/folder panels), shimmer (1.6s skeleton), scaleIn, slideDown, svgSpin/spin (0.7–0.8s spinners), loadingPulse (2.4s border pulse). All disabled at 0.001ms when `prefers-reduced-motion: reduce`.
21. **Footer**: `margin-top: auto` + 30/20 padding + 1px top border + mono 11px uppercase 0.12em letter-spacing.
22. **NO print styles. NO `.sr-only` (use Tailwind's). NO global scrollbar styling — per-element only.**

---

---

# PART 3 — API REFERENCE (`src/app/api/`)

> All 13 Next.js App Router API endpoints. All routes run on the Node.js runtime (`export const runtime = 'nodejs'`) and opt out of caching (`export const dynamic = 'force-dynamic'`). Per-route `maxDuration` ranges from 10 s (tor-status) to 120 s (bills).


Comprehensive specification of all 13 Next.js App Router API endpoints. All routes run on the Node.js runtime (`export const runtime = 'nodejs'`) and opt out of caching (`export const dynamic = 'force-dynamic'`). Per-route `maxDuration` ranges from 10 s (tor-status) to 120 s (bills).

---

## Table of Contents

1. [Cross-cutting concerns](#1-cross-cutting-concerns)
   - [1.1 Cloudflare Worker routing](#11-cloudflare-worker-routing)
   - [1.2 Caching behavior](#12-caching-behavior)
   - [1.3 TOR SOCKS proxy manager](#13-tor-socks-proxy-manager)
   - [1.4 Excel export pattern](#14-excel-export-pattern)
   - [1.5 Response envelope](#15-response-envelope)
2. [Endpoints](#2-endpoints)
   - [2.1 `GET /api` — health check](#21-get-api--health-check)
   - [2.2 `GET /api/bills` — bill search + NDJSON stream](#22-get-apibills--bill-search--ndjson-stream)
   - [2.3 `POST /api/bills/export` — Excel export of bills](#23-post-apibillsexport--excel-export-of-bills)
   - [2.4 `GET /api/company` — orginfo.uz company lookup](#24-get-apicompany--orginfouz-company-lookup)
   - [2.5 `GET /api/company-info` — combined orginfo.uz + chamber.uz profile](#25-get-apicompany-info--combined-orginfouz--chamberuz-profile)
   - [2.6 `GET /api/court-cases` — my.sud.uz case search + detail](#26-get-apicourt-cases--mysuduz-case-search--detail)
   - [2.7 `GET /api/court-hearings` — jadvalapi.sud.uz hearing scan](#27-get-apicourt-hearings--jadvalapisuduz-hearing-scan)
   - [2.8 `GET /api/upcoming-hearings` — 3-court-type upcoming-hearing aggregator](#28-get-apiupcoming-hearings--3-court-type-upcoming-hearing-aggregator)
   - [2.9 `GET /api/stats` — full company stats aggregator](#29-get-apistats--full-company-stats-aggregator)
   - [2.10 `POST /api/stats/export` + `GET /api/stats/export` — Excel export of stats](#210-post-apistatsexport--get-apistatsexport--excel-export-of-stats)
   - [2.11 `GET /api/mib-debt` + `POST /api/mib-debt` — 2-phase MIB debt check](#211-get-apimib-debt--post-apimib-debt--2-phase-mib-debt-check)
   - [2.12 `GET /api/tor-status` + `POST /api/tor-status` — TOR proxy status/spawn](#212-get-apitor-status--post-apitor-status--tor-proxy-statusspawn)
   - [2.13 `POST /api/tor-install` — upload + extract tor expert bundle](#213-post-apitor-install--upload--extract-tor-expert-bundle)
3. [External services map](#3-external-services-map)
4. [Environment variables](#4-environment-variables)

---

## 1. Cross-cutting concerns

### 1.1 Cloudflare Worker routing

Every outbound request to a `.sud.uz`, `orginfo.uz`, `chamber.uz`, or `mib.uz` host is wrapped in a Cloudflare Worker URL to avoid IP-blocking by the upstream Uzbek government services (they block direct datacenter IPs and Tor exit nodes). The worker source lives at `cloudflare-worker/proxy.js` and only proxies to a fixed allow-list of hosts (`billing.sud.uz`, `recaptcha.sud.uz`, `my.sud.uz`, `jadval.sud.uz`, `jadvalapi.sud.uz`, `jadval2.sud.uz`, `orginfo.uz`, `mib.uz`, `chamber.uz`, `admin.chamber.uz`, `ihamkor.uz`). It rewrites the request with a full Chrome 124 fingerprint (UA, sec-ch-ua, sec-fetch-*) and adds CORS headers.

**URL building** — every lib has its own `getCfWorkerUrl(targetUrl)` helper that:

1. Reads `process.env.CF_WORKER_URLS` (comma-separated, preferred) and `process.env.CF_WORKER_URL` (single, backward-compat). Both are normalised to end with `/`.
2. If both are empty, falls back to a hardcoded `FALLBACK_WORKERS` array of 4 deployed workers:
   ```
   https://broad-field-f2b0.uzwebfox.workers.dev/
   https://wild-hall-04ae.uzwebfox.workers.dev/
   https://orange-darkness-8843.najimsheikh071.workers.dev/
   https://wandering-wind-1d3d.najimsheikh071.workers.dev/
   ```
3. Selects workers in **round-robin** order via a per-module counter (`orginfoWorkerCounter`, `chamberWorkerCounter`, `courtWorkerCounter`, `jadval2WorkerCounter`, `requestCounter`). The selected worker URL is prepended to the target URL: `worker + targetUrl` → `https://broad-field-f2b0.uzwebfox.workers.dev/https://billing.sud.uz/api/invoice/checkStatus?...`

**Per-module implementations:**

| Module | Function | Round-robin counter |
|---|---|---|
| `src/lib/orginfo.ts` | `getCfWorkerUrl(url)` | `orginfoWorkerCounter` |
| `src/lib/chamber.ts` | `getCfWorkerUrl(url)` | `chamberWorkerCounter` |
| `src/lib/court-case.ts` | `getCfWorkerUrl(url)` + per-call `proxyCourtUrl(url)` | `courtWorkerCounter` / `courtRequestCounter` |
| `src/lib/jadval2.ts` | `getCfWorkerUrl(url)` | `jadval2WorkerCounter` |
| `src/lib/billing.ts` | `getCfWorkerUrls()` returns the array; `nextProxyUrl(url)` round-robins; `getAllProxyUrls(url)` returns all CF workers + `proxy.cors.sh` as last-resort | `requestCounter` |

**billing.sud.uz special case** — billing.sud.uz is fronted by its own Cloudflare which blocks CF Worker IPs with HTTP 521 (`origin_down`) on the `/api/invoice/*` endpoints. The `billing.ts` module therefore uses a `ProxyPool` class with health tracking instead of plain round-robin:
- Pool members: all CF Workers + `proxy.cors.sh` + `api.allorigins.win/raw?url=` + `corsproxy.io/?url=` + `api.codetabs.com/v1/proxy/?quest=` + `thingproxy.freeboard.io/fetch/`.
- Each proxy tracks `successes`/`failures`/`deadUntil`. After **2 consecutive failures** it is marked DEAD for **60 s** (skipped).
- `next()` prefers proxies with `successes > 0` (known-working), then untested ones, then the one with fewest failures.
- A global **circuit breaker** trips after 5 consecutive HTTP 521s, pausing ALL billing requests for 30 s so a dead origin isn't hammered.

### 1.2 Caching behavior

**Server-side (in-process memory):**

| Cache | Location | TTL | Scope |
|---|---|---|---|
| orginfo.uz company-by-TIN | `tinCache` Map in `src/lib/orginfo.ts` | 24 hours | Per-TIN `CompanyInfo` (full profile) — also caches the minimal company name so subsequent stats/upcoming-hearings/court-hearings calls get instant name lookup |
| MIB session store | `sessionStore` Map in `src/lib/mib.ts` | 5 minutes | Per-sessionId `{ cookieHeader, hiddenField, ajaxSubmitUrl, wicketBaseUrl, createdAt }` — bridges GET (Phase 1: fetch captcha) to POST (Phase 2: submit answer) |

Every Next.js route declares `export const dynamic = 'force-dynamic'` so Next's data cache and full-route cache are bypassed — responses are always fresh.

**Client-side (browser `localStorage`):** `src/lib/cache.ts` provides `getCached<T>(key, ttl)` / `setCached<T>(key, data)` / `clearCached(key)` with a 5-minute default TTL under the `sb-cache:` prefix. Cache key builders:
- `companyInfo(tin)` → `sb-cache:company-info:{tin}`
- `stats(tin)` → `sb-cache:stats:{tin}`
- `cases(courtType, mode, value)` → `sb-cache:cases:{type}:{mode}:{value}`
- `upcoming(tin)` → `sb-cache:upcoming:{tin}`

The **bills tab is intentionally NOT cached** (it streams results progressively). The `court-hearings` and `mib-debt` routes are also uncached.

### 1.3 TOR SOCKS proxy manager

`src/lib/tor.ts` manages a Tor SOCKS5 proxy on `127.0.0.1:9050` so billing.sud.uz requests can be routed through rotating exit nodes when the server's own IP gets blocked.

- **Binary lookup** (`findTorBinaryPath()`): checks `./tor/tor.exe` (Windows), `./tor/tor` (Linux/macOS), `/tmp/tor/tor` (Linux sandbox) in that order.
- **Port probe** (`isSocksPortOpen()`): TCP connect to `127.0.0.1:9050` with 1.5 s timeout. If a Tor process is already running externally (or spawned by us), this returns `true`.
- **Spawn** (`spawnTor()`): writes a `torrc` config to `./tor/torrc` with `SOCKSPort 127.0.0.1:9050`, `DataDirectory .tor-data`, `Log notice file .tor-log/notice.log`, `AvoidDiskWrites 1`, `ExitPolicy accept *:*`. Spawns the binary via `child_process.spawn` with `cwd: torDir` (so Windows finds its DLLs) and `LD_LIBRARY_PATH: torDir` for Linux. Polls `notice.log` for the string `Bootstrapped 100%` (120 s timeout).
- **ensure** (`ensureTor()`): returns `true` immediately if the SOCKS port is open. Otherwise spawns Tor from a local binary. If Tor died, restarts it. Returns `false` if no binary is found.
- **rotate** (`rotateTorCircuit()`): `SIGTERM` the running Tor process and spawn a fresh one — forces a new exit node (used when billing.sud.uz blocks the current exit).
- **HTTP wrapper** (`fetchViaTor(url, init)`): a `fetch`-like drop-in that creates an `https.RequestOptions` with `agent: SocksProxyAgent('socks5://127.0.0.1:9050')`. 60 s timeout. Returns `{ ok, status, statusText, json(), text() }`.

**`getTorProxyAgent()`** returns the cached `SocksProxyAgent` (or `null`) for callers that need to plug it into other HTTP clients.

> **Note:** the current `billing.ts` flow uses the CF Worker `ProxyPool` for outbound requests; `fetchViaTor` and `rotateTorCircuit` are exported and called by the `/api/tor-status` and `/api/tor-install` routes to manage the Tor process lifecycle, but the main bills route (`/api/bills`) does not directly route through Tor — it relies on CF Workers + cors.sh. Tor is a fallback layer kept operational for when all CORS proxies are IP-blocked.

### 1.4 Excel export pattern

Both export routes (`/api/bills/export` and `/api/stats/export`) build `.xlsx` files **manually** with [`jszip`](https://www.npmjs.com/package/jszip) rather than using `exceljs` or `sheetjs`. An `.xlsx` is a ZIP of OOXML parts; the builder emits:

| ZIP entry | Purpose |
|---|---|
| `[Content_Types].xml` | Declares the part MIME types |
| `_rels/.rels` | Root relationship → `xl/workbook.xml` |
| `xl/workbook.xml` | Single sheet definition (`<sheets><sheet name="..." sheetId="1" r:id="rId1"/></sheets>`) |
| `xl/_rels/workbook.xml.rels` | Worksheet + sharedStrings + styles relationships |
| `xl/sharedStrings.xml` | Deduped string table — every cell stores `t="s"` + index `<v>` into this table |
| `xl/styles.xml` | 2 cell styles: `0` = default (Calibri 11), `1` = header (bold white on black fill `FF000000`/`FF0A0A0A`) |
| `xl/worksheets/sheet1.xml` | `<cols>` (custom widths) + `<sheetData>` with one `<row>` per record |

Helper functions:
- `esc(s)` — XML-escapes `&`, `<`, `>`, `"`.
- `colLetter(idx)` — 0-based index → Excel column letter (`A`, `B`, …, `Z`, `AA`, …).
- `s(v)` — intern a string into the shared-strings table, returning its index.

Output buffer is generated with `zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })`. Response headers: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="..."`, `Content-Length`, `Access-Control-Allow-Origin: *`.

### 1.5 Response envelope

All JSON responses use the envelope `{ ok: boolean, ...payload }` (success) or `{ ok: false, error: string }` (failure). The bills route uses NDJSON instead (one JSON object per line). The two Excel-export routes return binary `.xlsx` with attachment headers. Status codes:

| Code | Meaning |
|---|---|
| 200 | Success (or NDJSON stream for bills) |
| 400 | Missing/invalid query param or JSON body |
| 404 | Upstream returned "not found" (e.g. company not on orginfo.uz, no cases in selected court types) |
| 422 | tor-install: archive extracted but binary missing |
| 500 | Unexpected internal error (caught exception in handler) |
| 502 | Upstream service call failed (billing.sud.uz, orginfo.uz, etc.) |
| 504 | 30 s overall timeout exceeded (stats route only) |

---

## 2. Endpoints

### 2.1 `GET /api` — health check

**File:** `src/app/api/route.ts` (no `dynamic`/`runtime`/`maxDuration` exports — uses Next.js defaults)

**Request:** no params, no body, no headers.

**Response** (`200 OK`, `application/json`):
```json
{ "message": "Hello, world!" }
```

**External services:** none. **Caching:** none (default Next.js behavior). **Error handling:** none. **Key logic:** trivial health-check probe used by uptime monitors.

---

### 2.2 `GET /api/bills` — bill search + NDJSON stream

**File:** `src/app/api/bills/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=120`.

**Request** — query params:

| Param | Type | Required | Description |
|---|---|---|---|
| `inn` | string (`/^\d{9}$/`) | one of `inn`/`invoice` | 9-digit company tax number (Yuridik shaxs) |
| `invoice` | string | one of `inn`/`invoice` | Single bill number for detail lookup |

**Mode A — invoice detail lookup** (param `invoice` present):
Returns plain JSON, single bill.

Response (`200 OK`):
```json
{
  "ok": true,
  "bill": { /* CheckStatusResponse — see below */ }
}
```
On failure: `{ "ok": false, "error": "..." }` with status `502`.

`CheckStatusResponse` shape (from `src/lib/billing.ts`):
```ts
{
  requestStatus: { code: number; message: string },
  number: string | null,
  invoiceStatus: 'CREATED'|'PARTIALLY_PAID'|'PAID'|'CHECKING'|'CANCELLED'|'USED'|'BREAKED'|'SENT_TO_MIB'|string | null,
  amount: number | null,          // tiyins (1/100 so'm)
  paidAmount: number | null,
  mustPayAmount: number | null,
  balance: number | null,
  overdue: number | null,         // expiration timestamp (ms)
  court: string | null,
  courtId: number | null,
  courtType: 'CRIMINAL'|'CITIZEN'|'ADMINISTRATIVE'|'ECONOMIC'|'MILITARY'|string | null,
  payCategory: string | null,     // Russian label
  payCategoryId: number | null,
  description: string | null,     // Uzbek Cyrillic label (e.g. "Davlat boji")
  purpose: string | null,         // Russian purpose text
  purposeId: number | null,
  instance: string | null,        // e.g. "FIRST"
  payer: string | null,
  payerId: number | null,
  payerTin: string | null,
  forAccount: string | null,
  isInFavor: boolean | null,
  claimCaseNumber: string | null,
  decisionDate: number | null,
  issued: number | null,          // issued timestamp (ms)
  historyList: {
    id: number|null, caseId: number|null, caseNumber: string|null,
    amount: number|null, invoiceId: number|null, usedUserId: number|null,
    rolledBackAt: number|null, invoiceStatus: string|null, createdAt: number|null
  }[] | null
}
```

**Mode B — INN search** (param `inn` present, no `invoice`):
Returns an **NDJSON stream** (`Content-Type: application/x-ndjson; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`). Each line is a JSON object; line types:

1. `meta` — sent once when the first bill is loaded:
   ```json
   { "type": "meta", "inn": "302678824", "total": 60 }
   ```
2. `phase` — sent on each phase transition (zero or more, before any `bill`):
   ```json
   { "type": "phase", "phase": "captcha_pow", "detail": "Solving proof-of-work challenge…" }
   ```
   `phase` ∈ `'connecting' | 'captcha_pow' | 'captcha_analyze' | 'captcha_math' | 'searching' | 'enriching' | 'done'`.
3. `bill` — sent once per enriched bill (index is 0-based):
   ```json
   { "type": "bill", "index": 0, "bill": { /* EnrichedBill — see below */ } }
   ```
4. `done` — sent at the end:
   ```json
   { "type": "done", "inn": "302678824" }
   ```
5. `error` — sent in lieu of `done` if the workflow threw:
   ```json
   { "type": "error", "error": "..." }
   ```

`EnrichedBill` extends `BillListItem` (`{ number, invoiceStatus, issued }`) with a `detail: CheckStatusResponse | null` and optional `error?: string`.

**Error handling:**
- Missing `inn` → `400 { ok:false, error:'Missing "inn" query parameter (company tax number, 9 digits)' }`
- `inn` not 9 digits → `400 { ok:false, error:'INN must be exactly 9 digits (Yuridik shaxs company number)' }`

**External services called** (all routed through the CF Worker `ProxyPool` in `src/lib/billing.ts`):

1. `POST https://recaptcha.sud.uz/api/v1/captcha/pow/challenge` — body `{ siteKey: 'site_bbdb0625df8a200e73f37ebccf0c62ac' }`. Returns `{ challenge, difficulty, algorithm, expiresAt }`.
2. **PoW solve** locally — SHA-256 leading-zero-bits brute force (`solvePow(challenge, difficulty)`).
3. `POST https://recaptcha.sud.uz/api/v1/captcha/analyze` — body `{ siteKey, action:'my_checks', timestamp, signals: { /* browser fingerprint, pow solution */ } }`. Returns `{ token, score, challengeRequired, challenge?: { id, type, imageBase64, expiresAt } }`. If `challengeRequired` is true, the math image is solved with the VLM (`z-ai-web-dev-sdk`) via `solveMathImage(imageBase64)` → integer answer, then re-analyzed.
4. `GET https://billing.sud.uz/api/invoice/captcha/search?passportNumber=&inn={INN}&page=0&size=100&captchaToken={token}` — paginated bill list. Returns `SearchResponse { content: BillListItem[], pageNumber, pageSize, totalElements, totalPages, last }`.
5. For each `BillListItem` (bounded concurrency = 6): `GET https://billing.sud.uz/api/invoice/checkStatus?invoice={number}&lang=ru` — returns `CheckStatusResponse`.

**Key logic:**
- `searchBillsByInn(inn)` retries up to 3× with a fresh captcha token (for 422/rejected) and up to 3× with the same token (for 521/origin-down). Empty results trigger a captcha regeneration.
- `getFullBillData(inn, onProgress, onPhase)` orchestrates the full pipeline:
  1. Calls `searchBillsByInn` → gets all bill list items in one page (size=100).
  2. Spawns 6 concurrent workers that pull items from a shared queue, each calling `getBillStatus(item.number)`. 80 ms delay between requests per worker.
  3. **Retry round (1×):** failed bills are split into *transient* (timeout/521/aborted — retried) vs *permanent* (HTTP 4xx/5xx from origin — skipped, marked with `PERMANENT:` prefix).
  4. Final bills sorted by original search-order.
- `getBillStatus(invoice)` rotates through CF Workers + `proxy.cors.sh` + allorigins + corsproxy + codetabs + thingproxy. Bails early after 3 consecutive HTTP 5xx/429 from the origin (permanent failure for that invoice).
- The `Phase` callback fires on every state transition; the `onProgress` callback fires after every bill is enriched. Both are wired into NDJSON `phase` / `bill` lines.

**Streaming:** yes — `ReadableStream` with `start(controller)`. The `send(obj)` helper enqueues `JSON.stringify(obj) + '\n'` via a `TextEncoder`. Controller closes in `finally`. The `X-Accel-Buffering: no` header tells nginx not to buffer the response.

**Caching:** none — bills route streams fresh data on every call.

---

### 2.3 `POST /api/bills/export` — Excel export of bills

**File:** `src/app/api/bills/export/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=30`.

**Request:**
- Headers: `Content-Type: application/json`
- Body:
  ```ts
  {
    bills: Array<{
      number: string,
      companyName?: string,
      issued?: string,
      invoiceStatus?: string,
      detail?: {
        amount?: number | string,
        paidAmount?: number | string,
        balance?: number | string,
        invoiceStatus?: string,
        courtName?: string,
        expiry?: string,
        claimCaseNumber?: string,
        payCategory?: string,
        description?: string
      }
    }>
  }
  ```

**Response:**
- `200 OK` — binary `.xlsx` (filename `tolovlar-YYYY-MM-DD.xlsx`), `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="..."`, `Content-Length`, `Access-Control-Allow-Origin: *`.
- `400` — `{ ok:false, error:"Eksport uchun to'lovlar yo'q" }` if `bills` missing/empty/non-array.
- `500` — `{ ok:false, error:"..." }` on internal error.

**Excel columns** (sheet name: `To'lovlar`, header row styled bold-white-on-black):

| # | Header | Width | Source |
|---|---|---|---|
| A | Kvitansiya | 22 | `b.number` |
| B | Kompaniya | 35 | `b.companyName` |
| C | Summa | 15 | `b.detail.amount` (stringified) |
| D | To'langan | 15 | `b.detail.paidAmount`, or `amount` if PAID, else `'0'` |
| E | To'lanmagan | 15 | `b.detail.balance`, or `'0'` if PAID, else `amount` |
| F | Holati | 12 | `invoiceStatus` → `'To'langan'` (PAID) / `'Qisman'` (PARTIAL) / `'To'lanmagan'` (UNPAID) / raw status |
| G | Sud | 40 | `b.detail.courtName` |
| H | Berilgan sana | 14 | `b.issued` |
| I | Amal qilish | 14 | `b.detail.expiry` |
| J | Ish raqami | 22 | `b.detail.claimCaseNumber` |
| K | Turi | 18 | `b.detail.payCategory` or `b.detail.description` |

**External services:** none — operates entirely on the POSTed bill data (no re-fetch). **Caching:** none. **Library:** `jszip` (manual OOXML, see [§1.4](#14-excel-export-pattern)).

---

### 2.4 `GET /api/company` — orginfo.uz company lookup

**File:** `src/app/api/company/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=15`.

**Request** — query params (mutually exclusive modes):

| Param | Type | Description |
|---|---|---|
| `tin` | string (`/^\d{9}$/`) | Lookup by TIN — full profile |
| `name` | string | Lookup by company name — full profile (cleaned of legal suffixes like MCHJ/AJ) |
| `name` + `tinOnly=true` | — | Fast TIN-only mode: skip org detail page (1 HTTP request instead of 2-3) |
| `search` | string | Search mode: return list of matching companies |

**Mode A — `search`**:
```json
{ "ok": true, "results": [ /* CompanySearchResult[] */ ] }
```
`CompanySearchResult`:
```ts
{ orgId: string, name: string, tin: string, date: string, region: string, orgInfoUrl: string }
```

**Mode B — `name` + `tinOnly=true`** (fast TIN-only):
```json
{ "ok": true, "company": { "tin": "302678824" } }
```
Returns `404 { ok:false, error:'No TIN found for name "..."' }` if no match.

**Mode C — `name` (full profile)** or **Mode D — `tin` (full profile)**:
```json
{ "ok": true, "company": { /* CompanyInfo — see below */ } }
```
`CompanyInfo`:
```ts
{
  tin: string,
  officialName: string,
  shortName: string,
  registeredDate: string,
  status: string,
  registeringAuthority: string,
  thsht: string,             // legal form code
  dbibt: string,
  ifut: string,              // activity type code
  charterCapital: string,
  email: string,
  phone: string,
  address: string,
  director: string,
  founders: { name: string; share: string }[],
  sustainabilityRating: string,
  largeTaxpayer: string,
  orgInfoUrl: string
}
```

**Error handling:**
- `400` — `{ ok:false, error:'Provide ?tin=XXXXXXXXX (9 digits), ?name=Company Name, or ?search=query' }` if no `tin`/`name`/`search` and `tin` invalid.
- `404` — company not found on orginfo.uz.
- `502` — fetch failure.

**External services called** (all CF-worker-routed via `getCfWorkerUrl(url)` in `src/lib/orginfo.ts`):

| URL | When |
|---|---|
| `GET https://orginfo.uz/uz/search/all/?q={tin-or-name-or-query}` | Every mode — search page |
| `GET https://uz/organization/{orgId}/` | Mode C/D — full org detail page (HTML scraped with regex) |

The HTML scraping extracts: STIR, official/short name (Russian label `Официальное название организации` preferred, Latin `Rasmiy nomi` fallback), `Ro'yxatdan o'tgan sana`, `Faollik holati`, `THSHT`, `DBIBT`, `IFUT`, `Ustav fondi`, `Elektron pochta`, `Telefon raqami` (skips `Telefon raqamini`), `Manzili`, `Rahbar`, `Ta'sischilar` (founders + percentages), `Toifa`, `Yirik soliq`.

**Key logic:**
- `getCompanyByTin(tin)` checks the 24-hour `tinCache` Map first; on miss, fetches the search page, extracts org IDs via `/\/uz\/organization\/([a-f0-9]+)\//g`, fetches the **first 2 candidate org pages in parallel**, returns the first whose STIR matches. Falls through to remaining candidates sequentially. Caches the result.
- `lookupTinByName(name)` (tinOnly mode) — 1 HTTP request: just fetches the search page and picks the best TIN by word-overlap scoring. No detail-page fetch.
- `getCompanyByName(name)` — cleans the name (strips `MAS'ULIYATI CHEKLANGAN JAMIYAT`, `AKSIYADORLIK JAMIYATI`, `QOSHMA KORXONA`, `MCHJ`, `AJ`, `OAO`, `OOO`, quotes), searches, picks the best match by word-overlap score + TIN-presence bonus, then fetches that org's detail page.
- `pickBestTin` / `pickBestMatch` — score = (# query words appearing in result name) / (# query words >2 chars), +0.1 if a valid TIN is present.

**Caching:** server-side `tinCache` 24 h for `getCompanyByTin`. Client-side: `sb-cache:company-info:{tin}` (5 min) on the UI side.

---

### 2.5 `GET /api/company-info` — combined orginfo.uz + chamber.uz profile

**File:** `src/app/api/company-info/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=20`.

**Request:** `?tin=XXXXXXXXX` (9-digit, required).

**Response** (`200 OK`):
```json
{
  "ok": true,
  "company": { /* CompanyInfo subset — see below */ } | null,
  "rating":  { /* ChamberRating subset — see below */ } | null
}
```

`company` (subset of `CompanyInfo`):
```ts
{
  tin: string, officialName: string, shortName: string, registeredDate: string,
  status: string, address: string, director: string, phone: string, email: string,
  charterCapital: string, registeringAuthority: string,
  thsht: string, dbibt: string, ifut: string,
  founders: { name: string; share: string }[],
  orgInfoUrl: string
}
```

`rating` (mapped from `ChamberRating`):
```ts
{
  score: number,              // criteriaAll 0-100
  category: string,           // type: 'AAA'|'AA'|'A'|'BBB'|'BB'|'B'|'CCC'|'CC'|'C'|'D'
  taxpayerType: string,       // taxpayername (e.g. "SDT")
  region: string,             // regionNameLat || regionNameUz
  district: string,           // districtNameLat || districtNameUz
  okedCode: string,
  okedName: string,
  okedNameRu: string,
  okedSection: string,
  okedShortName: string,
  employeeLimitMf: number,
  employeeLimitLf: number
}
```

**Error handling:**
- `400` — `{ ok:false, error:'TIN must be exactly 9 digits' }`.
- `404` — `{ ok:false, error:'Company not found on orginfo.uz or chamber.uz' }` (only when BOTH upstreams fail).
- `502` — unexpected error.

**External services called** (both in parallel via `Promise.allSettled`):

| URL | Source | Worker-routed? |
|---|---|---|
| `GET https://orginfo.uz/uz/search/all/?q={tin}` + `GET https://orginfo.uz/uz/organization/{orgId}/` | `getCompanyByTin(tin)` from `src/lib/orginfo.ts` | yes — CF Worker pool |
| `GET https://admin.chamber.uz/api/GetCompanyCriteries/{tin}` | `getCompanyRating(tin)` from `src/lib/chamber.ts` | yes — CF Worker pool |

If one source fails but the other succeeds, the response still returns 200 with the successful payload and `null` for the failed source. Only when BOTH fail does it return 404.

**Key logic:**
- `getCompanyRating(tin)` calls `https://admin.chamber.uz/api/GetCompanyCriteries/{cleanTin}` with `Accept: application/json`, 10 s timeout. Returns `null` on HTTP non-OK or missing `tin` field in response body. Maps nested `data.okedDetail.{code,name_uz_latn,name_ru,section,name_short_ru,employee_limit_mf,employee_limit_lf}` to the flat `ChamberRating` shape.
- The response `rating.score` field is the raw `criteriaAll` (0-100); the UI computes color via `getRatingColor(type)` (AAA-A green / BBB blue / BB-B amber / CCC-D red) and label via `getRatingLabel(type)`.

**Caching:** server-side via `tinCache` 24 h (shared with `/api/company` — both call `getCompanyByTin`).

---

### 2.6 `GET /api/court-cases` — my.sud.uz case search + detail

**File:** `src/app/api/court-cases/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=30`.

**Request** — query params:

| Param | Type | Required | Description |
|---|---|---|---|
| `courtType` | `'economic'\|'civil'\|'criminal'\|'administrative'` | yes | Court type |
| `mode` | `'tin'\|'caseNumber'\|'pinfl'` | search mode | Required if no `detail` |
| `value` | string | search mode | TIN (9 digits), case number (`\d+-[\d-]+/\d+`, e.g. `4-1001-2605/14720`), or PINFL (14 digits) |
| `detail` | string | detail mode | Case number to fetch full details for (paired with `courtType`) |

**Mode A — case detail** (`detail` + `courtType` present):
```json
{ "ok": true, "general": CaseDetail | null, "firstInstance": InstanceData | null,
  "appellate": InstanceData | null, "cassation": InstanceData | null }
```

`CaseDetail`:
```ts
{
  caseNumber: string, caseType: string, caseStatus: string, court: string,
  judge: string, secretary: string,
  plaintiff: string, plaintiffTin: string,
  defendant: string, defendantTin: string,
  thirdParty: string, claimSubject: string, claimAmount: string,
  applicationDate: string, initiatedDate: string, deadlineDate: string,
  stateDuty: string, representative: string, prosecutor: string
}
```

`InstanceData`:
```ts
{
  hearings: { date: string, time: string, status: string, postponementReason: string, courtroom: string, judge: string }[],
  decision: { date: string, text: string, type: string, awardedAmount: string, stateDutyRecovered: string, enforcedDate: string, appealDeadline: string } | null,
  documents: { name: string, date: string, type: string, fileUrl: string }[],
  appellant?: string, appealFiledDate?: string, appellateCourt?: string, appellateOutcome?: string
}
```

**Mode B — search** (`courtType` + `mode` + `value`):
```json
{ "ok": true, "cases": [ /* CourtCase[] */ ] }
```
`CourtCase`:
```ts
{
  caseNumber: string, caseType: string, caseStatus: string, result: string,
  courtName: string, dateFiled: string,
  plaintiff: string, defendant: string, claimAmount: string,
  hearingDate: string, hearingTime: string, judge: string
}
```

**Error handling:**
- `400` — missing params / invalid format:
  - `Missing parameters. Required: courtType, mode, value`
  - `STIR aynan 9 ta raqamdan iborat bo'lishi kerak` (mode=tin, not 9 digits)
  - `PINFL aynan 14 ta raqamdan iborat bo'lishi kerak` (mode=pinfl, not 14 digits)
  - `Ish raqami formati: X-XXXX-XXXX/XXXXX (masalan, 4-1001-2605/14720 yoki 4-10-2514/671)` (mode=caseNumber, bad format)
- `502` — upstream failure.

**External services called** (all CF-worker-routed via `getCfWorkerUrl(url)` in `src/lib/court-case.ts`):

`searchCourtCases(courtType, mode, value)` calls **both** `jadvalapi.sud.uz` AND `jadval.sud.uz` in parallel and merges results (the official Angular frontend does the same). Case numbers have `/` replaced with `@` in the URL.

| Court type + mode | jadvalapi.sud.uz endpoint | jadval.sud.uz endpoint |
|---|---|---|
| economic + tin | `/online-monitoring/ECONOMIC/findByTin/{value}` | `/case/findByTin/{value}` |
| economic + caseNumber | `/online-monitoring/ECONOMIC/findByNumber/{value}` | `/case/findByNumber/{value}` |
| civil + caseNumber | `/online-monitoring/CIVIL/findByNumber/{value}` | `/case/findByCivilNumber/{value}` |
| civil + tin | `/online-monitoring/CIVIL/findByTin/{value}` | — |
| administrative + tin | `/online-monitoring/CONFLICT/findByTin/{value}` | — |
| administrative + caseNumber | `/online-monitoring/CONFLICT/findByNumber/{value}` | `/case/findByAdmNumber/{value}` |
| criminal + caseNumber | — (jadvalapi doesn't support criminal) | `/case/findByCriminalNumber/{value}` |

Note: jadvalapi maps `administrative` → `CONFLICT` internally. The base URLs are `https://jadval.sud.uz` and `https://jadvalapi.sud.uz`. Headers: `Accept: application/json`, `User-Agent: Mozilla/5.0...`, `Referer: https://my.sud.uz/court-case`. 8 s timeout. 2 attempts per URL with 1 s delay on transient errors (521, ECONNREFUSED, ENOTFOUND, aborted, fetch failed). Results merged and deduped by `caseNumber`.

`getCaseDetails(courtType, caseNumber)` calls `fetchJadvalApiDetails` + `fetchJadvalDetails` in parallel, merges the richest data from each (jadval.sud.uz preferred for hearings), parses `reviews` array for appellate/cassation instances (matches on Cyrillic `апелляция` / `кассация`).

**Caching:** none on the server. Client-side `sb-cache:cases:{type}:{mode}:{value}` (5 min).

---

### 2.7 `GET /api/court-hearings` — jadvalapi.sud.uz hearing scan

**File:** `src/app/api/court-hearings/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=90`.

**Request** — query params:

| Param | Type | Description |
|---|---|---|
| `tin` | string (9 digits) | Company TIN — triggers Mode 2 (search by company) |
| `courtId` | string | Manual court ID (e.g. `andtfsud`) — bypass auto-match |
| `date` | string (`DDMMYYYY`) | Specific date — triggers Mode 1 (browse) |
| `days` | number | Days forward to scan (default 90, capped at 365) |

**Mode 1 — browse** (`courtId` + `date`):
```json
{
  "ok": true,
  "court": "Андижон туманлараро суди",   // court name or raw courtId if not found
  "date": "09072026",
  "hearings": [ /* Jadval2Hearing[] */ ]
}
```

`Jadval2Hearing`:
```ts
{
  casenumber: string,
  hearing_date: string,    // DD.MM.YYYY
  hearing_time: string,    // HH:MM
  responsible: string,     // judge
  instance: string,        // Cyrillic "Birinchi instansiya" etc.
  globalid: string,        // court ID
  claimkind: string,       // "SUIT"
  claimtype: string,       // "CIVIL"|"ECONOMIC"|"CONFLICT"
  category: string,
  case_id: string,         // UUID
  claiment: string,        // plaintiff (misspelled in API)
  defendant: string
}
```

**Mode 2 — search by TIN** (default): looks up company → finds court → scans date range.

Successful response:
```json
{
  "ok": true,
  "company": { "name": "...", "address": "...", "tin": "302678824" },
  "court": { "id": "andtfsud", "name": "Андижон туманлараро суди", "region": "Андижон вилояти" },
  "allCourts": [ /* CourtEntry[] — all courts in the matched region, or all courts if no region match */ ],
  "hearings": [ /* Jadval2Hearing[] — filtered by company name appearing in claiment or defendant */ ],
  "datesScanned": 87,
  "totalFound": 3
}
```

If no court matches the company address:
```json
{
  "ok": true,
  "company": { "name": "...", "address": "...", "tin": "..." },
  "courts": [ /* CourtEntry[] */ ],
  "hearings": [],
  "message": "Select a court to search for hearings."
}
```

**Error handling:**
- `400` — `{ ok:false, error:'Provide a valid 9-digit TIN, or courtId + date' }`.
- `404` — company not found on orginfo.uz, or company name missing.
- `502` — unexpected error.

**External services called:**

1. `GET https://orginfo.uz/uz/search/all/?q={tin}` + `GET https://orginfo.uz/uz/organization/{orgId}/` (CF-worker-routed) — for company name + address.
2. `scanDateRange(courtId, courtName, companyName, startDate, endDate)` in `src/lib/jadval2.ts` — fires `GET https://jadvalapi.sud.uz/vka/{TYPE}/{courtId}/{DDMMYYYY}` for **every date in the range × 3 court types** (CIVIL + ECONOMIC + CONFLICT) in parallel batches of 30 dates × 3 types = 90 concurrent requests per batch (each routed through a CF Worker round-robin). Skips Sundays + Uzbek court holidays (Jan 1-2, Mar 8, Mar 21-22, May 9, Sep 1, Oct 1, Dec 8). 6 s timeout per request. Filters results where `claiment` or `defendant` contains the company name (case-insensitive). Returns sorted newest-first.

**Key logic:**
- `findBestCourt(address)` / `findCourtsByAddress(address)` in `src/lib/court-map.ts` — matches the company address against a static list of 14 regions × N district courts (`CourtEntry[]`). If `courtId` is provided as a query param, uses that directly (manual override).
- Date range: today → today + `days`. **Future-only** — the jadvalapi.sud.uz/vka endpoint rejects past dates with HTTP 400 ("Нотўғри сана белгиланган"), so the route only scans forward.
- The route is the slowest endpoint (max 90 s) because it makes N×3 HTTP requests where N = days to scan (default 90, minus Sundays + holidays ≈ 75).

**Caching:** none.

---

### 2.8 `GET /api/upcoming-hearings` — 3-court-type upcoming-hearing aggregator

**File:** `src/app/api/upcoming-hearings/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=20`.

**Request:** `?tin=XXXXXXXXX` (9 digits, required).

**Response** (`200 OK`):
```json
{
  "ok": true,
  "tin": "302678824",
  "count": 2,
  "hearings": [
    {
      "caseNumber": "...", "caseType": "...", "caseStatus": "...", "result": "...",
      "courtName": "...", "dateFiled": "...",
      "plaintiff": "...", "defendant": "...", "claimAmount": "...",
      "hearingDate": "15.07.2025", "hearingTime": "10:00", "judge": "...",
      "courtType": "economic",
      "isoDate": "2025-07-15",
      "courtTypeLabel": "Economic"
    }
  ]
}
```

**Error handling:**
- `400` — `{ ok:false, error:"STIR aynan 9 ta raqamdan iborat bo'lishi kerak" }`.
- Per-court-type failures are swallowed (Promise.allSettled) — the route still returns 200 with whatever succeeded. Failures are logged but not surfaced in the response.

**External services called** (3 in parallel via `Promise.allSettled`):
- `searchCourtCases('economic', 'tin', tin)` — jadvalapi + jadval.sud.uz merged
- `searchCourtCases('civil', 'tin', tin)` — jadvalapi CIVIL findByTin
- `searchCourtCases('administrative', 'tin', tin)` — jadvalapi CONFLICT findByTin

> **v121 improvement:** criminal search is skipped for company TINs (companies can't be criminal defendants — only individuals by PINFL). The route only accepts 9-digit TINs (regex enforces it), so criminal is always skipped.

**Key logic:**
- For each case returned, the route reads `hearingDate` (DD.MM.YYYY), parses it, converts to ISO `YYYY-MM-DD`, and **filters out past hearings** (where `isoDate < todayStr`). Cases with `hearingDate === '—'` or `'null'` are skipped.
- Surviving cases are decorated with `courtType` (the source type), `isoDate`, and `courtTypeLabel` (capitalized, e.g. `'Economic'`).
- Sorted ascending by `isoDate + hearingTime` (upcoming first).
- Note: the search API (jadvalapi) already returns `hearing_date` + `hearing_time` + `judge` + `court` + `plaintiff` + `defendant` per case — no need to fetch case details individually.

**Caching:** none on server. Client-side `sb-cache:upcoming:{tin}` (5 min).

---

### 2.9 `GET /api/stats` — full company stats aggregator

**File:** `src/app/api/stats/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=60`.

**Request:** `?tin=XXXXXXXXX` (9 digits, required).

**Response** (`200 OK`):
```json
{
  "ok": true,
  "company": {
    "name": "...", "tin": "302678824",
    "region": "...", "status": "...",
    "officialName": "...", "shortName": "..."
  },
  "cases": [
    {
      "caseNumber": "4-1001-2605/14720",
      "courtType": "economic",           // 'economic'|'civil'|'administrative'
      "regDate": "15.03.2024",           // DD.MM.YYYY
      "result": "To'liq qanoatlantirilgan",
      "classification": "win",            // 'win'|'lose'|'neutral'|'pending'
      "role": "plaintiff",                // 'plaintiff'|'defendant'
      "court": "...",
      "category": "...",
      "counterparty": "..."               // the OTHER party's name
    }
  ],
  "summary": {
    "total": 60, "win": 30, "lose": 10, "neutral": 8, "pending": 12,
    "asPlaintiff": 40, "asDefendant": 20
  },
  "errors": [
    { "courtType": "civil", "error": "HTTP 521 origin down" }
  ]
}
```

**Error handling:**
- `400` — `{ ok:false, error:"STIR aynan 9 ta raqamdan iborat bo'lishi kerak" }`.
- `504` — 30 s overall timeout (`Promise.race([getCompanyStats(tin), timeout])`). Response: `{ ok:false, error:"So'rov vaqti tugadi (30s). Qayta urinib ko'ring." }`.
- `502` — unexpected exception.

**External services called** (5 in parallel via `Promise.allSettled` inside `getCompanyStats`):

| Source | Function | URL |
|---|---|---|
| orginfo.uz | `getCompanyByTin(tin)` | `https://orginfo.uz/uz/search/all/?q={tin}` + org detail page (CF-worker-routed) |
| chamber.uz | `getCompanyRating(tin)` | `https://admin.chamber.uz/api/GetCompanyCriteries/{tin}` (CF-worker-routed) |
| economic cases | `searchCourtCases('economic', 'tin', tin)` | jadvalapi ECONOMIC findByTin + jadval.sud.uz case findByTin (CF-worker-routed) |
| civil cases | `searchCourtCases('civil', 'tin', tin)` | jadvalapi CIVIL findByTin (CF-worker-routed) |
| administrative cases | `searchCourtCases('administrative', 'tin', tin)` | jadvalapi CONFLICT findByTin (CF-worker-routed) |

**Key logic:**
1. **Name normalization** (`normalizeName`): strips quotes, lowercases, expands Latin Uzbek `MChJ`→`mas'uliyati cheklangan jamiyati` and `AJ`→`aktsiyadorlik jamiyati`, plus Cyrillic equivalents (`масъулияти чекланган жамияти` / `акционерлик жамияти`). Collapses whitespace.
2. **Name matching** (`nameMatches`): tries direct substring match (either direction), then checks if ≥2 of the company's significant words appear in the party field.
3. **Role classification** (`classifyCase`): if the company name matches the plaintiff field → `plaintiff`; if it matches the defendant field → `defendant`; falls back to TIN-substring match; ultimate fallback = `plaintiff`.
4. **Outcome classification** (`classifyOutcome`):
   - `To'liq qanoatlantirilgan` / `Qisman qanoatlantirilgan` (Cyrillic or Latin) → **WIN** (both roles)
   - `Rad etilgan` / `Qaytarilgan` / `Ko'rmasdan qoldirilgan` / `Tugatilgan` → **LOSE** if plaintiff, **NEUTRAL** if defendant
   - empty/unknown/pending → **PENDING**
5. **Deduplication** by `caseNumber` (a case might appear in both jadval.sud.uz and jadvalapi.sud.uz for economic).
6. **Summary counts**: total / win / lose / neutral / pending / asPlaintiff / asDefendant.
7. **Failure isolation**: if orginfo fails, falls back to chamber.uz for the company name; if chamber also fails, uses `STIR {tin}` as the company name (looser TIN-substring matching). If a court-type fetch fails, the case list from successful types is still returned with the failure noted in `errors[]`.

**Caching:** server-side `tinCache` 24 h (shared with `/api/company` and `/api/company-info`). Client-side `sb-cache:stats:{tin}` (5 min).

---

### 2.10 `POST /api/stats/export` + `GET /api/stats/export` — Excel export of stats

**File:** `src/app/api/stats/export/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=60`.

#### POST (preferred — instant export from client data)

**Request:**
- Headers: `Content-Type: application/json`
- Body:
  ```ts
  {
    tin: string,                                    // 9 digits
    courtTypes?: string[],                          // default ['economic','civil','administrative']
    cases: CaseWithClassification[],                // already-classified cases from the client
    companyName?: string                            // default = tin
  }
  ```

**Response:**
- `200 OK` — binary `.xlsx` (filename `statistika-{tin}-YYYY-MM-DD.xlsx`).
- `400` — invalid JSON body / TIN not 9 digits.
- `404` — `{ ok:false, error:"Tanlangan sud turlarida ishlar yo'q" }` (no cases after filtering).

#### GET (backward-compat fallback — re-fetches stats)

**Request:** `?tin=XXXXXXXXX&courtTypes=economic,civil` (courtTypes optional, default `economic,civil,administrative`).

**Response:**
- `200 OK` — binary `.xlsx` (same filename pattern).
- `400` — TIN invalid.
- `404` — no cases in selected court types.
- `504` — 30 s timeout (same `Promise.race` pattern as `/api/stats`).
- `502` — unexpected.

**Excel columns** (sheet name: `Statistika`, header row styled bold-white-on-black, fill `FF0A0A0A`):

| # | Header | Width | Source |
|---|---|---|---|
| A | Sud | 40 | `c.court` |
| B | Ish raqami | 22 | `c.caseNumber` |
| C | Da'vogar | 35 | `companyName` if `c.role === 'plaintiff'`, else `c.counterparty` |
| D | Javobgar | 35 | `companyName` if `c.role === 'defendant'`, else `c.counterparty` |
| E | Sana | 12 | `c.regDate` |
| F | Natija | 25 | `c.result` |
| G | Holat | 10 | classification → `'Yutdi'`/`'Yutqazdi'`/`'Neitral'`/`'Kutilmoqda'` |
| H | Sud turi | 12 | courtType → `'Iqtisodiy'`/`'Fuqarolik'`/`"Ma'muriy"` |

**External services called:**
- POST: **none** — builds the .xlsx from the POSTed case data (instant).
- GET: full `getCompanyStats(tin)` workflow (same as `/api/stats` — 5 parallel upstream calls).

**Library:** `jszip` (manual OOXML, see [§1.4](#14-excel-export-pattern)). **Caching:** none.

---

### 2.11 `GET /api/mib-debt` + `POST /api/mib-debt` — 2-phase MIB debt check

**File:** `src/app/api/mib-debt/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=30`.

#### Phase 1 — `GET /api/mib-debt?tin=XXXXXXXXX`

Fetches the MIB (Majburiy Ijro Byurosi / Bureau of Compulsory Enforcement) BlackListV2 page + captcha, returns a session ID + base64 captcha image for the user to solve.

**Response** (`200 OK`):
```json
{
  "ok": true,
  "sessionId": "302678824_1719900000000_a1b2c3",
  "captchaImage": "iVBORw0KGgo..."   // base64 PNG
}
```

**Error handling:**
- `400` — `{ ok:false, error:'TIN must be exactly 9 digits' }`.
- `{ ok:false, error:"..." }` — page load failed, captcha download failed, or form parse failed (no HTTP status code override — returns 200 with `ok:false`).

#### Phase 2 — `POST /api/mib-debt`

**Request:**
- Headers: `Content-Type: application/json`
- Body: `{ tin: string, sessionId: string, captchaAnswer: string }`

**Response** (`200 OK`):
```json
{
  "ok": true,
  "tin": "302678824",
  "hasDebt": false,
  "status": "clean",                     // 'clean'|'debt'|'error'|'captcha_failed'
  "message": "302678824 СТИР рақамли юридик шахсда қарздорлик аниқланмади",
  "checkedAt": 1719900123456
}
```

When `hasDebt: true`:
```json
{
  "ok": true,
  "tin": "...",
  "hasDebt": true,
  "status": "debt",
  "message": "...",
  "totalDebt": 42989464.35,             // so'm
  "currentDebt": 10210467.75,
  "debts": [
    {
      "enforcementCaseNumber": "10072617684501",   // 14-digit
      "status": "Жараёнда",
      "subject": "Карз ундириш",
      "department": "Чилонзор тумани",
      "collector": "\"**R B**\" AK***IK JA***TI",
      "amount": 10210467.75
    }
  ],
  "checkedAt": 1719900123456
}
```

**Error handling:**
- `400` — `{ ok:false, error:'Missing tin, sessionId, or captchaAnswer' }`.
- `500` — unexpected exception (caught in outer try/catch).
- Session expiry (5 min TTL): returns `{ ok:true, status:'error', message:"Sessiya muddati tugagan. Qaytadan urinib ko'ring.", hasDebt:false }` — note `ok:true` even on session error (the body envelope is reused).

**External services called** (mib.uz is **NOT** CF-worker-routed — it uses `fetchDirect()` which calls `fetch()` directly with `redirect: 'manual'` and 15 s timeout; mib.uz geo-blocks non-UZ IPs at TCP layer, so the route is designed to be called from a UZ-located server or via the user's own browser via the "direct mode" HTML paste workflow):

| URL | When | Method |
|---|---|---|
| `GET https://mib.uz/bl` | Phase 1 — initial page load (follows redirects, collects cookies) | GET (with manual redirect following up to 5 hops) |
| `GET https://mib.uz/...captcha.png` | Phase 1 — captcha image download (with Referer + Cookie) | GET |
| `POST https://mib.uz/.../wicket/ajax/...` | Phase 2 — Wicket AJAX form submit | POST (URL-encoded body: `{hiddenField}:'', inn, secure_code, submit_button:'1'`) |

The Wicket AJAX submit sends these special headers: `Wicket-Ajax: true`, `Wicket-Ajax-BaseURL: {wicketBaseUrl}`, `X-Requested-With: XMLHttpRequest`, `Origin: https://mib.uz`, `Referer: https://mib.uz/bl`, plus the session cookies from Phase 1.

**Key logic:**
- **`parseBlackListPage(html)`** — extracts: `inn` input id, parent `<form>` id + action, hidden field `{formId}_hf_0`, submit button id, captcha image URL (resolves relative URLs against `https://mib.uz/bl`), and the Wicket AJAX submit URL by matching `Wicket.Ajax.ajax({"u":"...","m":"POST","c":"{submitButtonId}",...})` with two regex variants (attribute order is non-deterministic).
- **Session store** — `sessionStore: Map<sessionId, MibSession>` with 5-minute TTL. Session ID format: `{tin}_{timestamp}_{random6}`. Old sessions are garbage-collected on each new session creation.
- **`parseWicketResponse(xml)`** — parses the Wicket AJAX XML response:
  - `<li class="feedbackPanelERROR">` → `status:'captcha_failed'`
  - `қарздорлик мавжуд` or `Ижро иши рақами` present → `status:'debt'`; extracts `Умумий қарздорлик` (total) and `Жорий қарздорлик` (current) amounts, plus individual debt blocks split on `Ижро иши рақами` (each block parsed for enforcement case number (14-digit), `Ҳужжат ҳолати`, `И/Ҳ мазмуни`, `Ҳужжат иш юритувида`, `Ундирувчи`, `Қарздорлик миқдори`).
  - `<li class="feedbackPanelWARNING">` → `status:'clean'` (e.g. `"қарздорлик аниқланмади"`).
- **`parseAmount(s)`** — Uzbek-formatted number parser: strips spaces, replaces `,` with `.`, `parseFloat`.
- **`parseMibHtml(html, tin)`** (exported, not used by this route) — for "direct mode" where the user pastes the result HTML from their own browser (no geo-block). Same parsing logic as `parseWicketResponse` but operates on full HTML pages.

**Caching:** 5-minute server-side session store (bridges Phase 1 → Phase 2). No result caching.

---

### 2.12 `GET /api/tor-status` + `POST /api/tor-status` — TOR proxy status/spawn

**File:** `src/app/api/tor-status/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=10`.

#### `GET /api/tor-status`

Returns the current Tor proxy state without spawning anything.

**Response** (`200 OK`):
```json
{
  "available": false,      // true if SOCKS proxy listening on 127.0.0.1:9050
  "binaryFound": true,     // true if a tor binary exists at ./tor/tor.exe or ./tor/tor
  "socksPort": 9050
}
```

#### `POST /api/tor-status`

Triggers `ensureTor()` — spawns the tor binary if found but not yet running. Called right after `/api/tor-install` so Tor starts immediately without waiting for a search request.

**Response** (`200 OK`):
```json
{
  "ok": true,                       // whether ensureTor() succeeded
  "available": true,                // SOCKS proxy listening?
  "binaryFound": true,
  "message": "Tor started successfully"   // or "Tor could not start"
}
```

**Error handling:** `500 { ok:false, error:"..." }` if `ensureTor()` throws.

**External services:** none — local binary management only. **Key logic:** see [§1.3 TOR SOCKS proxy manager](#13-tor-socks-proxy-manager).

---

### 2.13 `POST /api/tor-install` — upload + extract tor expert bundle

**File:** `src/app/api/tor-install/route.ts` — `dynamic='force-dynamic'`, `runtime='nodejs'`, `maxDuration=60`.

**Request:**
- Headers: `Content-Type: multipart/form-data`
- Body: form field `file` = the Tor expert bundle `.tar.gz` (or `.tgz`) file.

**Response** (`200 OK`):
```json
{
  "ok": true,
  "message": "Tor installed successfully",
  "binaryPath": "/home/z/my-project/tor/tor"   // or "tor.exe" on Windows
}
```

**Error handling:**
- `400` — no file uploaded, OR file extension not `.tar.gz`/`.tgz`:
  - `{ ok:false, error:"No file uploaded. Select the tor expert bundle .tar.gz file." }`
  - `{ ok:false, error:"File must be a .tar.gz archive (the tor expert bundle)." }`
- `422` — extraction succeeded but no `tor`/`tor.exe` binary found inside the archive:
  ```json
  { "ok": false, "error": "Extraction succeeded but tor.exe was not found inside the archive. Make sure you downloaded the tor expert bundle (not the tor browser)." }
  ```
- `500` — `tar` command failure, IO error, etc.

**Key logic:**
1. Reads the uploaded `File` from `req.formData()`.
2. Validates the filename ends with `.tar.gz` or `.tgz`.
3. Wipes any existing `./tor/` directory, recreates it.
4. Saves the upload to `./tor-bundle.tar.gz`.
5. Spawns `tar -xzf tor-bundle.tar.gz -C tor/` via `child_process.spawn` (relies on the system `tar` command, available on Windows 10+, macOS, Linux). Captures stderr; rejects on non-zero exit code.
6. Deletes the temp archive.
7. Checks for the binary at `./tor/tor.exe` (Windows) or `./tor/tor` (Linux/macOS). If not at the root, recursively searches up to 3 directory levels deep via `searchForBinary(dir, depth)`.
8. If the binary is in a subfolder, copies it (and on Windows: all `.dll` files + `geoip` / `geoip6` data files) to the `./tor/` root so `tor.ts` finds it easily.
9. Returns the absolute path to the installed binary.

**External services:** none. **Caching:** none.

---

## 3. External services map

| Service | Host | Used by | CF-Worker-routed? | Auth |
|---|---|---|---|---|
| Sud Billing (receipts) | `billing.sud.uz` | `/api/bills`, `/api/bills/export` (POST doesn't re-fetch) | Yes — `ProxyPool` (CF Workers + cors.sh + allorigins + corsproxy + codetabs + thingproxy) | Proof-of-work captcha token from `recaptcha.sud.uz` |
| Sud reCAPTCHA | `recaptcha.sud.uz` | `/api/bills` (via `getCaptchaToken`) | Yes — `captchaPool` (CF Workers + cors.sh + allorigins) | None (PoW challenge + risk analysis + optional VLM-solved math image) |
| Court case search (newer API) | `jadvalapi.sud.uz` | `/api/court-cases`, `/api/upcoming-hearings`, `/api/stats`, `/api/stats/export` (GET) | Yes — round-robin CF Workers | None (public) |
| Court case search (older API) | `jadval.sud.uz` | same as above | Yes — round-robin CF Workers | None (public) |
| Court hearing schedule | `jadvalapi.sud.uz/vka` | `/api/court-hearings` | Yes — round-robin CF Workers | None (public) |
| Company directory | `orginfo.uz` | `/api/company`, `/api/company-info`, `/api/court-hearings`, `/api/stats`, `/api/stats/export` (GET) | Yes — round-robin CF Workers (NEVER direct) | None (HTML scraping) |
| Chamber of Commerce rating | `admin.chamber.uz` | `/api/company-info`, `/api/stats` (as name fallback) | Yes — round-robin CF Workers | None (free public JSON API) |
| Bureau of Compulsory Enforcement | `mib.uz` | `/api/mib-debt` (both phases) | **No** — `fetchDirect()` calls `fetch()` directly (mib.uz geo-blocks non-UZ IPs at TCP layer) | Wicket AJAX session + Uzbek-word math captcha (user-solved) |
| VLM (math captcha solver) | `z-ai-web-dev-sdk` | `/api/bills` (via `solveMathImage` in `billing.ts`) | N/A (in-process SDK) | API key from env |
| TOR SOCKS5 proxy | `127.0.0.1:9050` (local) | `/api/tor-status`, `/api/tor-install`, available to `billing.ts` via `fetchViaTor` | N/A (local) | None |
| Cloudflare Worker (CORS proxy) | `*.workers.dev` | All sud.uz/orginfo.uz/chamber.uz calls | N/A — IS the proxy | None |

### CF Worker allow-list (`cloudflare-worker/proxy.js`)

The deployed CF Worker rejects any target host not in this list:
```
billing.sud.uz
recaptcha.sud.uz
my.sud.uz
jadval.sud.uz
jadvalapi.sud.uz
jadval2.sud.uz
orginfo.uz
mib.uz
www.mib.uz
chamber.uz
admin.chamber.uz
ihamkor.uz
```

The worker rewrites all requests with a full Chrome 124 fingerprint (User-Agent, sec-ch-ua, sec-fetch-*, Accept-Language `ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7,uz;q=0.6`, Referer/Orgin set to the target's origin) and adds `Access-Control-Allow-Origin: *` to the response. Free tier: 100,000 requests/day per worker.

---

## 4. Environment variables

| Variable | Required | Description |
|---|---|---|
| `CF_WORKER_URLS` | recommended | Comma-separated list of Cloudflare Worker URLs (preferred multi-worker form). Each is normalised to end with `/`. Example: `https://a.workers.dev/,https://b.workers.dev/` |
| `CF_WORKER_URL` | optional (legacy) | Single CF Worker URL (backward-compat; merged into the pool with `CF_WORKER_URLS`) |
| (ZAI API key) | optional | Used by `z-ai-web-dev-sdk` for math-captcha VLM solving in `billing.ts`. Configured by the SDK itself. |

If neither `CF_WORKER_URLS` nor `CF_WORKER_URL` is set, every module falls back to the hardcoded `FALLBACK_WORKERS` array of 4 deployed workers (see [§1.1](#11-cloudflare-worker-routing)) so the app keeps working when `.env` is lost.

---

*End of API reference. Generated for merge into the master `BUILD.md`.*

---

# PART 4 — LIBRARY REFERENCE (`src/lib/`)

> Complete reference for every file under `src/lib/`. Each entry documents exports, signatures, algorithms, external APIs, transformations, constants, error handling, and caching.


This is the complete reference for every file under `src/lib/` plus the root layout. Each entry documents exports, signatures, algorithms, external APIs, transformations, constants, error handling, and caching.

---

## Table of Contents

1. [billing.ts](#1-billingts) — billing.sud.uz scraper (THE BIG ONE)
2. [court-case.ts](#2-court-casets) — e-sud.uz / my.sud.uz court case fetcher
3. [court-case-types.ts](#3-court-case-typests) — shared types + status constants
4. [court-map.ts](#4-court-mapts) — TIN/address → court-code mapping
5. [jadval2.ts](#5-jadval2ts) — jadval2.sud.uz hearing schedule scanner
6. [orginfo.ts](#6-orginfots) — orginfo.uz company info fetcher
7. [chamber.ts](#7-chamberts) — chamber.uz contractor rating fetcher
8. [stats.ts](#8-statsts) — stats aggregator
9. [mib.ts](#9-mibts) — MIB debt check (mib.uz)
10. [tor.ts](#10-torts) — Tor SOCKS5 proxy manager
11. [cache.ts](#11-cachets) — client-side localStorage cache
12. [db.ts](#12-dbts) — Prisma client singleton
13. [utils.ts](#13-utilsts) — cn() helper
14. [app/layout.tsx](#14-applayouttsx) — root layout

---

## 1. billing.ts

**File**: `src/lib/billing.ts` (1169 lines)
**Imports**: `crypto` (Node), `ZAI` from `z-ai-web-dev-sdk`
**Purpose**: Reverse-engineered scraper for `billing.sud.uz` (Uzbekistan's court-fee payment portal). Returns every receipt (kvitansiya) issued against a legal entity's STIR/INN, enriched with amount, paid amount, court, payment category, and the court case numbers each receipt was used for.

### 1.1 Top-level constants

| Constant | Value | Purpose |
|---|---|---|
| `SITE_KEY` | `'site_bbdb0625df8a200e73f37ebccf0c62ac'` | Site key sent to recaptcha.sud.uz for `my_checks` action |
| `CAPTCHA_API` | `'https://recaptcha.sud.uz'` | Captcha / proof-of-work API base (NOT IP-blocked) |
| `BILLING_API` | `'https://billing.sud.uz'` | Billing API base (IP-blocks aggressively — must be proxied) |
| `FALLBACK_WORKERS` | 4 hardcoded `*.workers.dev` URLs | Used when `CF_WORKER_URLS` env is missing |

The 4 hardcoded fallback workers (identical list reused in court-case.ts, jadval2.ts, orginfo.ts, chamber.ts):
```
https://broad-field-f2b0.uzwebfox.workers.dev/
https://wild-hall-04ae.uzwebfox.workers.dev/
https://orange-darkness-8843.najimsheikh071.workers.dev/
https://wandering-wind-1d3d.najimsheikh071.workers.dev/
```

### 1.2 ProxyPool class (health-tracked CORS proxy rotation)

`ProxyPool` is the core abstraction that lets the scraper survive billing.sud.uz's IP blocking. It rotates through multiple CORS proxies and tracks per-proxy health so dead ones are skipped.

**Interface `ProxyState`**:
```ts
{ url, label, needsEncoding, failures, successes, lastFailureAt, deadUntil }
```

**Static config**:
- `DEAD_THRESHOLD = 2` — mark proxy dead after **2 consecutive** failures (was 3, lowered for faster failover)
- `DEAD_COOLDOWN_MS = 60_000` — dead proxy is skipped for 60 seconds

**Constructor** — `new ProxyPool(proxies: { url: string; needsEncoding?: boolean }[])`. Builds `ProxyState[]`.

**Methods**:
- `next(): ProxyState | null` — Returns the next alive proxy using this priority order:
  1. Revive proxies whose cooldown expired.
  2. If all dead → revive the proxy with the oldest `lastFailureAt` (best chance).
  3. Prefer "known working" proxies (`successes > 0`) — round-robin among them.
  4. Else prefer "untested" proxies (`failures === 0`).
  5. Else pick the alive proxy with the fewest failures.
- `markSuccess(proxy)` — `successes++; failures=0; deadUntil=0`.
- `markFailed(proxy)` — `failures++; lastFailureAt=now`; if `failures >= DEAD_THRESHOLD` and not already dead, set `deadUntil = now + 60s`.
- `aliveCount()` — count of proxies with `deadUntil === 0`.
- `stats()` — human-readable debug string: `host: N✓/N✗ DEAD|alive`.

**Two separate pools are built**:
1. `captchaPool = new ProxyPool(buildCaptchaPool())` — CF Workers first, then `proxy.cors.sh`, then `api.allorigins.win`. Used for `recaptcha.sud.uz` (CF Workers work fine for it).
2. `billingPool = new ProxyPool(buildBillingPool())` — CF Workers first, then `proxy.cors.sh`, `api.allorigins.win` (needsEncoding), `corsproxy.io/?url=`, `api.codetabs.com/v1/proxy/?quest=`, `thingproxy.freeboard.io/fetch/`. Used for `billing.sud.uz` API.

**`poolFor(url)`** — returns `captchaPool` if URL contains `recaptcha.sud.uz`, else `billingPool`.

**Legacy helpers** (kept for backward compat with `fetchJsonWithRetry`):
- `proxyBillingUrl(url)` — wraps a billing URL with the current CORS proxy from `billingPool`. If `needsEncoding` is set, `encodeURIComponent`s the target.
- `getCurrentProxy()` / `rotateProxy()` / `getCurrentProxyLabel()` — wrappers around `proxyPool.next()`.

### 1.3 Global circuit breaker

When `billing.sud.uz`'s origin goes down (sustained 521/522/523), ALL bills fail. Without this breaker, 60 bills × 6 retries × 6 concurrency = 2160 requests would hammer a dead origin.

```ts
const circuitBreaker = {
  consecutive521: 0,
  trippedUntil: 0,
  TRIP_THRESHOLD: 5,        // trip after 5 consecutive 521s
  COOLDOWN_MS: 30_000,      // pause all billing requests for 30s when tripped
  isTripped(): boolean,
  record521(): void,
  recordSuccess(): void,
  async waitForRecovery(): Promise<void>,  // blocks until cooldown expires
}
```

### 1.4 CF Worker URL builder (round-robin)

```ts
function getCfWorkerUrls(): string[]
function nextProxyUrl(targetUrl: string): { url: string; label: string }
function getAllProxyUrls(targetUrl: string): { url: string; label: string }[]
```

- `getCfWorkerUrls()` reads `process.env.CF_WORKER_URLS` (comma-separated, preferred) + `process.env.CF_WORKER_URL` (single, backward compat). Returns normalized URLs (always trailing slash). Falls back to `FALLBACK_WORKERS` if both env vars are missing.
- `nextProxyUrl()` — round-robins through the worker list via a module-level `requestCounter`. **NEVER returns direct** (would expose server IP and get blocked).
- `getAllProxyUrls()` — returns all CF Workers + `proxy.cors.sh/` as a fallback list (also never direct).

### 1.5 Exported types

```ts
type InvoiceStatus = 'CREATED' | 'PARTIALLY_PAID' | 'PAID' | 'CHECKING'
                   | 'CANCELLED' | 'USED' | 'BREAKED' | 'SENT_TO_MIB' | string

interface BillListItem {
  number: string          // receipt/invoice number
  invoiceStatus: InvoiceStatus
  issued: number | null   // issue timestamp (ms)
}

interface HistoryEntry {
  id, caseId: number | null
  caseNumber: string | null
  amount: number | null       // tiyins
  invoiceId, usedUserId, rolledBackAt: number | null
  invoiceStatus: InvoiceStatus | null
  createdAt: number | null
}

interface CheckStatusResponse {
  requestStatus: { code: number; message: string }
  number: string | null
  invoiceStatus: InvoiceStatus | null
  amount: number | null        // total — tiyins
  paidAmount: number | null    // paid so far — tiyins
  mustPayAmount: number | null // remaining — tiyins
  balance: number | null       // remaining balance — tiyins
  overdue: number | null       // validity/expiration timestamp (ms)
  court: string | null
  courtId: number | null
  courtType: string | null     // CRIMINAL | CITIZEN | ADMINISTRATIVE | ECONOMIC | MILITARY
  payCategory: string | null   // Russian label, e.g. "Gosudarstvennaya poshlina"
  payCategoryId: number | null
  description: string | null   // Uzbek Cyrillic label, e.g. "Davlat boji"
  purpose: string | null       // Russian purpose text
  purposeId: number | null
  instance: string | null      // e.g. "FIRST"
  payer: string | null
  payerId, payerTin: ...
  forAccount: string | null
  isInFavor: boolean | null
  claimCaseNumber: string | null
  decisionDate: number | null
  issued: number | null
  historyList: HistoryEntry[] | null
}

interface SearchResponse {
  content: BillListItem[]
  pageNumber, pageSize, totalElements, totalPages: number
  last: boolean
}

interface EnrichedBill extends BillListItem {
  detail: CheckStatusResponse | null
  error?: string
}

interface BillSummary {
  total, paid, partial, unpaid: number
  totalAmount, totalPaid, totalBalance: number  // sum of tiyins
}
```

### 1.6 Status / category helpers

**`COURT_TYPES`** — map of court type IDs to `{ uz, ru, en }` labels:
- `CRIMINAL`, `CITIZEN`, `ADMINISTRATIVE`, `ECONOMIC`, `MILITARY`

**`INVOICE_STATUSES`** — map of invoice status → `{ uz, ru, en }`:
- `CREATED` → "To'lanmagan" / "Not paid"
- `PARTIALLY_PAID` → "Qisman toʻlangan" / "Partially paid"
- `PAID` → "Toʻliq toʻlangan" / "Fully paid"
- `CHECKING` → "Tranzaksiya tasdiqlanishi kutilmoqda" / "Awaiting confirmation"
- `CANCELLED` → "Bekor qilingan" / "Cancelled"
- `USED` → "Foydalanilgan" / "Used"
- `BREAKED` → "Nomaʼlum xatolik" / "Error"
- `SENT_TO_MIB` → "MIBga yuborilgan" / "Sent to BPI"

**Functions**:
- `courtTypeLabel(type: string | null | undefined): string` — returns `COURT_TYPES[type]?.en ?? type`.
- `statusLabel(status): string` — returns `INVOICE_STATUSES[status]?.en ?? status`.
- `paymentBucket(status): 'paid' | 'partial' | 'unpaid' | 'other'` — coarse bucket for badges. `PAID`/`USED`→paid, `PARTIALLY_PAID`→partial, `CREATED`→unpaid, rest→other.
- `categoryLabel(category): { label: string; kind: 'davlat_boji' | 'pochta' | 'other' }` — detects `pochta`/`почта` → pochta; `boj`/`boji`/`бож`/`пошлин` → davlat_boji; else other.
- `tiyinsToSum(tiyins): number` — `tiyins / 100`.
- `formatSum(tiyins): string` — `Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })` of the sum.
- `formatDate(ts): string` — `en-GB` locale `dd MMM yyyy, HH:MM`.

### 1.7 Captcha pipeline (PoW + analyze + VLM math fallback)

The scraper must obtain a captcha token from `recaptcha.sud.uz` before calling billing endpoints. The flow:

**1. Proof-of-work (PoW) challenge**
- `POST {CAPTCHA_API}/api/v1/captcha/pow/challenge` with body `{ siteKey: SITE_KEY }`.
- Response: `{ challenge: string, difficulty: number, algorithm: string, expiresAt: string }`.

**2. Solve PoW** — `solvePow(challenge, difficulty)`:
- Hashes `challenge + nonce.toString()` with SHA-256, incrementing nonce until `countLeadingZeroBits(hash) >= difficulty`.
- `countLeadingZeroBits(buf)`: counts full zero bytes (×8) + leading zero bits of the first non-zero byte.
- Throws `PoW solver timeout` if `Date.now() - start > 10000` (checked every 200k nonces).
- Returns `{ nonce, solveTimeMs }`.

**3. Analyze** — `POST {CAPTCHA_API}/api/v1/captcha/analyze` with body:
```js
{
  siteKey: SITE_KEY,
  action: 'my_checks',
  timestamp: Date.now(),
  signals: {
    ...buildSignals(attempt),
    pow: { challenge, nonce, solveTimeMs, solved: true }
  }
}
```
Response: `{ token: string | null, score: number, challengeRequired: boolean, challenge?: { id, type, imageBase64, expiresAt } }`.

If `!challengeRequired && token` → return token immediately.

**4. Math image challenge (fallback)** — solved with the ZAI VLM:
- `solveMathImage(imageBase64)` calls `zai.chat.completions.createVision` with a prompt instructing it to read a simple arithmetic expression and reply with ONLY the integer result. Extracts the first integer (`/-?\d+/`) from the response.
- `POST {CAPTCHA_API}/api/v1/captcha/challenge/solve` with `{ challengeId, answer, solveTimeMs, siteKey }`.
- Response: `{ success, token?, attemptsRemaining?, challenge? }`. On `success && token` → return token.

**`buildSignals(attempt)`** — synthesizes browser-like signals (mouse moves, keyboard, scroll, touch, timing, fingerprint, botFlags=false, honeypotFilled=false) so the risk-score is non-deterministic enough to sometimes skip the math challenge.

**`getCaptchaToken(maxAttempts=3, onPhase?): Promise<string>`** — orchestrates the above. Iterates `maxAttempts` times; each iteration runs PoW → analyze → (optional) math. If `analyze` returns a token directly, returns it. If math fails or analyze returns nothing, retries with 400 + attempt*150 ms backoff.

### 1.8 Phase streaming

```ts
type Phase = 'connecting' | 'captcha_pow' | 'captcha_analyze'
           | 'captcha_math' | 'searching' | 'enriching' | 'done'
type PhaseCallback = (phase: Phase, detail?: string) => void
```
The optional `onPhase` callback lets the API route stream progress messages to the client (e.g. "Solving proof-of-work challenge…", "Fetching detailed status for 60 bill(s)…").

### 1.9 `fetchJsonWithRetry<T>(url, init, retries=6): Promise<T>`

The core fetcher with retry + proxy selection. Behavior:

- If URL contains `recaptcha.sud.uz` → it's a captcha URL: use **first CF Worker** (round-robin not needed, captcha isn't rate-limited). `effectiveRetries = min(retries, 2)`. Timeout 10s.
- If URL contains `billing.sud.uz` → round-robin via `nextProxyUrl(url)` (CF Workers, NEVER direct). `effectiveRetries = min(retries, 3)`. Timeout 8s.
- Treats HTTP 521/522/523 as "origin down" → throws.
- Treats HTTP 429 / 5xx → throws.
- Validates billing responses: must have `content` array OR `requestStatus` (422 captcha-fail).
- Backoff: captcha URLs use `500 + attempt*1000 + jitter`; billing uses `min(500 * 1.5^attempt + jitter, 2000)`.

### 1.10 `searchBillsByInn(inn, opts): Promise<SearchResponse>`

**Endpoint**: `GET {BILLING_API}/api/invoice/captcha/search?passportNumber=&inn={inn}&page={page}&size={size}&captchaToken={token}`

- Default page=0, size=100.
- Headers: `Accept: application/json`, `User-Agent: Chrome 124`, `Referer: {BILLING_API}/my-checks`.
- **Two-level retry**:
  - Outer: `MAX_TOKEN_ATTEMPTS = 3` — regenerate captcha if search returns empty or fails with non-origin error.
  - Inner: `MAX_SEARCH_RETRIES = 3` — retry search with the SAME token if 521/522/523 (origin temporarily down — captcha is still valid).
- On 521: log "retrying with SAME token in 2s", `onPhase('searching', '...qayta urinilmoqda...')`, sleep 1s, retry inner loop.
- On 422/captcha-fail or empty results: break inner loop, regenerate captcha.
- Returns `SearchResponse` (or empty stub if all attempts returned empty).

### 1.11 `getBillStatus(invoiceNumber, lang='ru'): Promise<CheckStatusResponse>`

**Endpoint**: `GET {BILLING_API}/api/invoice/checkStatus?invoice={invoiceNumber}&lang={lang}`

- Headers: `Accept: application/json`, `User-Agent: Chrome 124`, `Referer: {BILLING_API}/invoice/{invoiceNumber}`.
- Timeout 6s.
- **Multi-proxy rotation with permanent-fail bail**:
  1. Build primary method via `nextProxyUrl(url)` + all fallbacks via `getAllProxyUrls(url)`.
  2. Put primary first, dedupe the rest.
  3. Try each method in order:
     - 521/522/523 (origin down) → `lastErr = HTTP {status}`, reset `httpErrorCount=0`, try next proxy.
     - 429 or 5xx → `lastErr = HTTP {status}`, `httpErrorCount++`. If `httpErrorCount >= 3` → throw `PERMANENT: HTTP {status}` (the origin is returning a definitive error for THIS bill — no point trying the remaining proxies).
     - Body missing or no `requestStatus` → invalid, try next.
     - Else return body.
  4. If all methods fail → throw lastErr.

### 1.12 `getFullBillData(inn, onProgress?, onPhase?): Promise<{ inn, totalElements, bills: EnrichedBill[] }>`

The main entry point. Algorithm:

1. `onPhase('connecting', ...)`.
2. `searchBillsByInn(inn)` — get all bill list items (no limit — processes ALL bills).
3. `onPhase('enriching', 'Fetching detailed status for N bill(s)…')`.
4. **Bounded concurrency: `concurrency = 6`** (was 2 → 4 → 6; safe due to ProxyPool + permanent-fail bail).
5. Spawn 6 workers, each pulling from a shared `items` array. Each worker calls `getBillStatus(item.number)` and pushes the enriched bill, then sleeps 80ms (was 300ms) before next iteration.
6. `onProgress(loaded, total, bill)` fires after each bill (used by the API route to stream partial results to the client).
7. **Retry loop (1 round only)**: filter failed bills into:
   - **Transient** (timeout / 521 / aborted) — re-queued, retried with bounded concurrency.
   - **Permanent** (error message matches `['PERMANENT:', 'HTTP 5', 'HTTP 4', 'invalid']`) — skipped (origin returns a definitive error for that invoice, retrying won't help).
8. Re-sort bills to preserve original search order (via a `Map<number, index>` lookup).

### 1.13 `summarizeBills(bills: EnrichedBill[]): BillSummary`

Sums up the bills:
- `total = bills.length`
- `paid / partial / unpaid` counts (via `paymentBucket`).
- `totalAmount = Σ detail.amount` (tiyins)
- `totalPaid = Σ detail.paidAmount`
- `totalBalance = Σ detail.balance`

### 1.14 Kvitansiya (receipt) PDF/image fetching

**Not implemented in billing.ts.** The bill list and detailed status return text/numeric data only (number, amounts, court, status, history). Receipt images / PDFs would have to be downloaded by the user directly from `billing.sud.uz` via the invoice detail page (`Referer: {BILLING_API}/invoice/{invoiceNumber}`); this module does NOT download or proxy receipt PDFs/PNGs. The `checkStatus` response includes the invoice `number` which is the URL slug for the user-facing receipt page.

### 1.15 Caching

- **No persistent cache** in this module — every call hits billing.sud.uz fresh.
- **In-memory**: `ProxyPool` state (alive/dead tracking) and the global `circuitBreaker` persist across requests within a Node process. No TTL-based response cache.
- Client-side caching of bill results is intentionally NOT done (the bills tab streams results progressively).

---

## 2. court-case.ts

**File**: `src/lib/court-case.ts` (531 lines)
**Imports**: `crypto`, `ZAI` (ZAI is imported but only used by the legacy `getCaptchaTokenMySud` stub).
**Purpose**: Fetches court cases from `jadval.sud.uz` (older API) and `jadvalapi.sud.uz` (newer API). Both endpoints are PUBLIC — no auth, no captcha needed.

### 2.1 Constants

| Constant | Value |
|---|---|
| `JADVAL_API` | `'https://jadval.sud.uz'` |
| `JADVALAPI` | `'https://jadvalapi.sud.uz'` |
| `MYSUD_SITE_KEY` | `'site_835080654e60bd9283ac263c5ebbaaef'` (unused — kept for legacy) |
| `CAPTCHA_API` | `'https://recaptcha.sud.uz'` (unused — kept for legacy) |
| `FALLBACK_WORKERS` | same 4 hardcoded workers as billing.ts |

### 2.2 CF Worker proxy (round-robin)

- Module-level counter `courtWorkerCounter`.
- `getCfWorkerUrl(url): string` — reads `CF_WORKER_URLS` + `CF_WORKER_URL` env vars, normalizes trailing slashes, round-robins. If no env workers → uses `FALLBACK_WORKERS[0] + url` (just the first fallback).
- A second helper `proxyCourtUrl(url)` is defined INSIDE `searchCourtCases` (closure-scoped counter `courtRequestCounter`) and uses the full worker list (or `FALLBACK_WORKERS` if env empty).

### 2.3 Exports

```ts
export type { CourtType, SearchMode, CourtCase, CaseDetail, Hearing, Decision,
             CaseDocument, InstanceData, FullCaseData } from './court-case-types'
export { CASE_STATUSES, HEARING_STATUSES, COURT_TYPE_LABELS } from './court-case-types'

export async function searchCourtCases(
  courtType: CourtType,
  mode: SearchMode,
  value: string,
): Promise<CourtCase[]>

export async function getCaseDetails(
  courtType: CourtType,
  caseNumber: string,
): Promise<FullCaseData>

export async function getCaptchaTokenMySud(): Promise<string>  // STUB — returns 'not-required'
```

### 2.4 `searchCourtCases(courtType, mode, value)`

**Case number encoding**: if `mode === 'caseNumber'`, the `/` is replaced with `@` in the URL (e.g. `4-1001-2605/14720` → `4-1001-2605@14720`).

**Endpoint selection** (`getApiConfig(courtType, mode, value)`):

Court type → API mapping:

| courtType | mode | jadvalapi.sud.uz endpoint | jadval.sud.uz endpoint |
|---|---|---|---|
| `economic` | `tin` | `/online-monitoring/ECONOMIC/findByTin/{tin}` | `/case/findByTin/{tin}` |
| `economic` | `caseNumber` | `/online-monitoring/ECONOMIC/findByNumber/{n}` | `/case/findByNumber/{n}` |
| `civil` | `caseNumber` | `/online-monitoring/CIVIL/findByNumber/{n}` | `/case/findByCivilNumber/{n}` |
| `civil` | `tin` | `/online-monitoring/CIVIL/findByTin/{tin}` | — |
| `administrative` | `tin` | `/online-monitoring/CONFLICT/findByTin/{tin}` | — |
| `administrative` | `caseNumber` | `/online-monitoring/CONFLICT/findByNumber/{n}` | `/case/findByAdmNumber/{n}` |
| `criminal` | `caseNumber` | — | `/case/findByCriminalNumber/{n}` |

The function calls BOTH APIs in parallel and merges results.

**Retry / transient-error handling**:
- Per-endpoint: `2 attempts` total. On transient errors (`521`, `Unable to connect`, `fetch failed`, `ECONNREFUSED`, `ENOTFOUND`, `typo in the url`, `aborted`) — sleep 1s, retry once.
- Non-transient errors → return `[]`.
- HTTP non-200 → return `[]`.
- Body text equal to `Иш топилмади` or containing `топилмади` (Cyrillic "not found") → return `[]`.
- Body parsed as JSON; if it's an array use directly, else extract `data.data`.

**Headers**: `Accept: application/json`, `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`, `Referer: https://my.sud.uz/court-case`. Timeout 8s.

**Merge / dedup**: results from both APIs are merged; deduplicated by `caseNumber` (first occurrence wins).

### 2.5 Mappers

**`mapJadvalApiCase(raw)`** — maps a jadvalapi.sud.uz row to `CourtCase`:
```ts
{
  caseNumber:   raw.casenumber || raw.caseNumber || '—',
  caseType:     raw.category || raw.sub_category || '—',
  caseStatus:   raw.status_name || raw.instance || '—',
  result:       raw.result || '—',
  courtName:    raw.court || '—',
  dateFiled:    raw.reg_date || raw.hearing_date || '—',
  plaintiff:    raw.claiment || raw.claimant || raw.plaintiff || '—',  // note 'claiment' typo in API
  defendant:    raw.defendant || '—',
  claimAmount:  raw.claim_amount || raw.amount || '—',
  hearingDate:  raw.hearing_date || '',
  hearingTime:  raw.hearing_time || '',
  judge:        raw.responsible || '',
}
```

**`mapJadvalCase(raw)`** — same shape, but `dateFiled: raw.reg_date || '—'` (no hearing_date fallback).

### 2.6 `getCaseDetails(courtType, caseNumber)`

Returns `FullCaseData` = `{ general, firstInstance, appellate, cassation }`.

- Encodes `caseNumber` by replacing `/` with `@`.
- Fires `fetchJadvalApiDetails(courtTypeUpper, encodedNumber)` and `fetchJadvalDetails(courtType, encodedNumber)` in parallel.
- **jadvalapi.sud.uz type map** (in `fetchJadvalApiDetails`): `ECONOMIC→ECONOMIC`, `CIVIL→CIVIL`, `ADMINISTRATIVE→CONFLICT`, `CRIMINAL→''` (skipped — jadvalapi doesn't support criminal). URL: `{JADVALAPI}/online-monitoring/{apiType}/findByNumber/{encodedNumber}`.
- **jadval.sud.uz endpoints** (in `fetchJadvalDetails`):
  - economic: `/case/findByNumber/{n}`
  - civil: `/case/findByCivilNumber/{n}`
  - criminal: `/case/findByCriminalNumber/{n}`
  - administrative: `/case/findByAdmNumber/{n}`
- Both helpers guard against non-200, `Иш топилмади`, and `{message, statusCode}` error objects.
- Both prefer `jadvalData?.[0] || jadvalApiData?.[0]` for the general case detail. Hearings come from whichever API returned data (prefer jadval.sud.uz — it has the real `hearing_date`/`hearing_time`/`responsible` fields).
- Hearings are filtered to drop phantom rows where every key field is empty, then normalized back to `'—'` for display.
- Appellate / cassation instances are parsed from the `raw.reviews` array via `parseReviewInstance(raw, 'апелляция' | 'кассация')` — matches Cyrillic instance names lowercased.

### 2.7 Win/lose/neutral classification

**Not in this file** — see [stats.ts §8.4](#84-classifyoutcomerole-result-classification) for the canonical classifier. `court-case.ts` returns the raw `result` string; classification happens downstream in `stats.ts`.

### 2.8 Caching

- No in-memory cache.
- Client-side cache of case lists is handled by `cache.ts` (key `cases:{courtType}:{mode}:{value}`).

---

## 3. court-case-types.ts

**File**: `src/lib/court-case-types.ts` (147 lines)
**Purpose**: Client-safe types and status constants. Separated from `court-case.ts` so client components can import types without pulling in the Node-only `z-ai-web-dev-sdk`.

### 3.1 Exported types

```ts
type CourtType = 'economic' | 'civil' | 'criminal' | 'administrative'
type SearchMode = 'tin' | 'caseNumber' | 'pinfl'

interface CourtCase {
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

interface CaseDetail {
  caseNumber, caseType, caseStatus, court, judge, secretary: string
  plaintiff, plaintiffTin, defendant, defendantTin, thirdParty: string
  claimSubject, claimAmount: string
  applicationDate, initiatedDate, deadlineDate, stateDuty: string
  representative, prosecutor: string
}

interface Hearing {
  date, time, status, postponementReason, courtroom, judge: string
}

interface Decision {
  date, text, type, awardedAmount, stateDutyRecovered, enforcedDate, appealDeadline: string
}

interface CaseDocument { name, date, type, fileUrl: string }

interface InstanceData {
  hearings: Hearing[]
  decision: Decision | null
  documents: CaseDocument[]
  appellant?: string
  appealFiledDate?: string
  appellateCourt?: string
  appellateOutcome?: string
}

interface FullCaseData {
  general: CaseDetail | null
  firstInstance: InstanceData | null
  appellate: InstanceData | null
  cassation: InstanceData | null
}
```

### 3.2 Exported status constants

**`CASE_STATUSES: Record<string, { en: string; color: string }>`** — keys are BOTH Cyrillic Uzbek (matching API responses) AND Latin Uzbek (matching synthetic / StatsTab-converted strings). Values:
| Key | en | color |
|---|---|---|
| `Иш юритувда` / `Ish yurituvda` | Ish yurituvda | `#2563a8` |
| `Кўриб чиқилмоқда` / `Ko'rib chiqilmoqda` | Ko'rib chiqilmoqda | `#2563a8` |
| `Тугатилган` / `Tugatilgan` | Tugatilgan | `#1e7e44` |
| `Тўхтатилган` / `To'xtatilgan` | To'xtatilgan | `#c47d0e` |
| `Бекор қилинган` / `Bekor qilingan` | Bekor qilingan | `#6b7280` |
| `Апелляцияда` / `Apellyatsiyada` | Apellyatsiyada | `#6d3db5` |
| `Кассацияда` / `Kassatsiyada` | Kassatsiyada | `#4a1d96` |
| `Назоратда` / `Nazoratda` | Nazoratda | `#b91c1c` |
| `Ижро этилмоқда` / `Ijro etilmoqda` | Ijro etilmoqda | `#0e7490` |

**`HEARING_STATUSES: Record<string, { en: string; color: string }>`**:
| Key | en | color |
|---|---|---|
| `Тайинланган` / `Tayinlangan` | Tayinlangan | `#3b82f6` |
| `Кечиктирилган` / `Kechiktirilgan` | Kechiktirilgan | `#f59e0b` |
| `Ўтказилган` / `O'tkazilgan` | O'tkazilgan | `#10b981` |
| `Бекор қилинган` / `Bekor qilingan` | Bekor qilingan | `#9ca3af` |
| `Якунланган` / `Yakunlangan` | Yakunlangan | `#1e7e44` |

**`COURT_TYPE_LABELS: Record<CourtType, { uz: string; en: string }>`**:
| CourtType | uz | en |
|---|---|---|
| `economic` | Iqtisodiy sudlar | Economic Courts |
| `civil` | Fuqarolik sudlar | Civil Courts |
| `criminal` | Jinoyat ishlari | Criminal Courts |
| `administrative` | Ma'muriy ishlar | Administrative Courts |

---

## 4. court-map.ts

**File**: `src/lib/court-map.ts` (380 lines)
**Purpose**: Static court jurisdiction map for Uzbekistan. Replaces the 10-ILOVA document from lex.uz — no need to fetch it every time. Scraped from `jadval2.sud.uz/fib/{region}-dis.html` for all 14 regions. Court IDs are used in `jadvalapi.sud.uz/vka/{TYPE}/{courtId}/{DDMMYYYY}` hearing queries.

### 4.1 Exported interface

```ts
interface CourtEntry {
  id: string       // e.g. "andtfsud"
  name: string     // court name in Uzbek Cyrillic
  region: string   // region name in Uzbek Cyrillic
}
```

### 4.2 `CIVIL_COURTS: CourtEntry[]` (private, 14 regions)

~85 court entries covering all 14 Uzbek regions + Republic of Karakalpakstan:
- Andijon (7 courts), Buxoro (7), Jizzax (7), Qashqadaryo (8), Qoraqalpog'iston (6), Navoiy (6), Namangan (5), Samarqand (10), Sirdaryo (5), Surxondaryo (7), Toshkent viloyati (9), Toshkent shahar (6), Farg'ona (7), Xorazm (4).

Court ID naming convention: `{regionCode}{districtCode}t{type}sud` where `t` = `f` (fuqarolik/civil) and type codes are short:
- `vil` = viloyat (regional)
- `t` = tuman (district)
- `sh` = shahar (city)

Examples: `andvilfsud` (Andijon viloyat sudlari), `andtfsud` (Andijon tumanlararo sudlari), `samtfsud` (Samarqand shahar sudlari).

### 4.3 `REGION_MAP` (private)

Maps Latin region names to Cyrillic for address matching:
```ts
[
  { latin: 'andijon', cyrillic: 'Андижон' },
  { latin: 'buxoro', cyrillic: 'Бухоро' },
  { latin: 'jizzax', cyrillic: 'Жиззах' },
  { latin: 'qashqadaryo', cyrillic: 'Қашқадарё' },
  { latin: 'qoraqalpog', cyrillic: 'Қорақалпоғистон' },
  { latin: 'navoiy', cyrillic: 'Навоий' },
  { latin: 'namangan', cyrillic: 'Наманган' },
  { latin: 'samarqand', cyrillic: 'Самарқанд' },
  { latin: 'sirdaryo', cyrillic: 'Сирдарё' },
  { latin: 'surxondaryo', cyrillic: 'Сурхондарё' },
  { latin: 'toshkent vil', cyrillic: 'Тошкент вилоят' },
  { latin: 'toshkent shahar', cyrillic: 'Тошкент шаҳар' },
  { latin: 'fargona', cyrillic: 'Фарғона' },
  { latin: 'xorazm', cyrillic: 'Хоразм' },
]
```

### 4.4 `DISTRICT_COURT_MAP` (private) — structure

```ts
const DISTRICT_COURT_MAP: { keywords: string[]; courtId: string }[] = [...]
```

~120 entries. Each entry is a keyword array (multiple Latin + Cyrillic spellings of a district/city name) → court ID. **Keywords are always compound city/district names** (e.g. `['andijon shahar', 'andijon sh.', 'андижон шаҳар', 'андижон ш']`), never standalone generic words like `'shahr'` (city) — that bug was fixed in v122.

Examples of the keyword array → court ID structure:
```ts
{ keywords: ['andijon shahar', 'andijon sh.', 'андижон шаҳар', 'андижон ш'], courtId: 'andtfsud' },
{ keywords: ['asaka', 'асака'], courtId: 'asaktfsud' },
{ keywords: ["qo'rg'ontepa", 'qorgontepa', 'қўрғонтепа', 'хонобод', 'xonobod'], courtId: 'kteptfsud' },
{ keywords: ['shahrisabz', 'шаҳрисабз'], courtId: 'shaxrtfsud' },  // ← v122 fix removed bare 'shahr' / 'шаҳр'
```

### 4.5 The 'shahr' bug (v122 fix)

**Before v122**: The Shahrisabz entry had keywords `['shahrisabz', 'шаҳрисабз', 'shahr', 'шаҳр']`. The keyword `'shahr'` is the generic Uzbek word for "city" — it matched **any** address containing `"shahri"` (meaning "city of"), e.g. `"Toshkent shahri, Yangihayot tumani"`. This caused every Tashkent-city company to be mapped to `shaxrtfsud` (Shahrisabz tumanlararo sudlari — in Qashqadaryo, 400km away), triggering 228 wasted jadval2 scan requests against the wrong court.

**Fix (v122)**: Removed `'shahr'` and `'шаҳр'` from the keyword array. Shahrisabz now only matches on the full city name. Verified: TIN `302678824` (address `"Toshkent shahri, Yangihayot tumani"`) now correctly maps to `yakkatfsud` (Yakkasaroy tumanlararo sudlari).

**Note on transliteration**: the court ID prefix uses `'shaxr'` (with x) while the keyword uses `'shahr'` (with h) — they refer to the same city. The Cyrillic `'шаҳрисабз'` keyword is the authoritative source.

### 4.6 Exported functions

**`findCourtsByAddress(address: string): CourtEntry[]`** — finds all courts in the region matched from the address:
1. Lowercase the address.
2. Iterate `REGION_MAP`; if address contains the Latin form OR original address contains the Cyrillic form → return all courts in `CIVIL_COURTS` whose `region` includes the Cyrillic form.
3. Fallback: filter `CIVIL_COURTS` by direct `address.includes(court.region)`.

**`getAllCourts(): CourtEntry[]`** — returns the full `CIVIL_COURTS` array.

**`getAllRegions(): string[]`** — returns unique region names.

**`findBestCourt(address: string): CourtEntry | null`** — 3-step cascade:
1. **District keyword match** (most precise): iterate `DISTRICT_COURT_MAP`; for each entry, check every keyword (case-insensitive `addrLower.includes(kw)` OR original-case `address.includes(kw)`). On match → return `CIVIL_COURTS.find(c => c.id === courtId)`.
2. **Name match fallback**: get `findCourtsByAddress(address)`; split address into words longer than 3 chars; strip suffixes `туманлараро|туман|шаҳар|вилоят` from court names; return the first court whose district-name contains (or is contained in) any address word.
3. **Region fallback**: return the first court with `вилоят суди` in its name, else `courts[0]`, else `null`.

### 4.7 Caching

None — all data is static constants. Lookups are O(n) on every call but the maps are small (≤120 entries).

---

## 5. jadval2.ts

**File**: `src/lib/jadval2.ts` (232 lines)
**Imports**: `'server-only'`
**Purpose**: Fetch hearing schedules from `jadvalapi.sud.uz` for any court on any date. Used to find hearings where a company appears as plaintiff or defendant, even in courts that don't support TIN-based search.

### 5.1 Constants

| Constant | Value |
|---|---|
| `JADVALAPI_BASE` | `'https://jadvalapi.sud.uz/vka'` |
| `FETCH_TIMEOUT_MS` | `6_000` (6 seconds) |
| `ALL_TYPES` | `['CIVIL', 'ECONOMIC', 'CONFLICT']` (always scanned in parallel) |
| `FALLBACK_WORKERS` | same 4 hardcoded workers as billing.ts |

### 5.2 COURT_HOLIDAYS set

Stored as `MM-DD` strings so they can be compared against any year. Source: Uzbekistan Labor Code article 158 (official public holidays) plus the second-day observances courts typically follow.

```ts
const COURT_HOLIDAYS = new Set([
  '01-01', // New Year
  '01-02', // New Year (day 2)
  '03-08', // Women's Day
  '03-21', // Navruz
  '03-22', // Navruz (day 2)
  '05-09', // Victory Day
  '09-01', // Independence Day
  '10-01', // Teacher's Day
  '12-08', // Constitution Day
])
```

### 5.3 Exported types

```ts
interface Jadval2Hearing {
  casenumber: string
  hearing_date: string    // DD.MM.YYYY
  hearing_time: string    // HH:MM
  responsible: string     // judge name
  instance: string        // "Birinchi instansiya" etc. (Cyrillic)
  globalid: string        // court ID
  claimkind: string       // "SUIT" etc.
  claimtype: string       // "CIVIL", "ECONOMIC", etc.
  category: string        // case category
  case_id: string         // UUID
  claiment: string        // plaintiff (note: misspelled in API — same as court-case.ts)
  defendant: string       // defendant
}

interface Jadval2SearchResult {
  hearings: Jadval2Hearing[]
  courtId: string
  courtName: string
  datesScanned: number
  totalFound: number
}
```

### 5.4 CF Worker proxy (round-robin)

Module-level counter `jadval2WorkerCounter`. `getCfWorkerUrl(url)` reads env vars + falls back to `FALLBACK_WORKERS[0]`.

### 5.5 `fetchHearingsForDate(courtId, dateStr, type='CIVIL'): Promise<Jadval2Hearing[]>`

**Endpoint**: `GET {JADVALAPI_BASE}/{type}/{courtId}/{dateStr}`
- `type`: `'CIVIL' | 'ECONOMIC' | 'CONFLICT'`
- `dateStr`: `DDMMYYYY` (e.g. `'09072026'`)
- `courtId` URL-encoded.

Headers: `Accept: application/json`. Timeout 6s. Returns `[]` on any error, non-200, or non-array response.

### 5.6 `scanDateRange(courtId, courtName, companyName, startDate, endDate, _type?, onProgress?): Promise<Jadval2SearchResult>`

**Algorithm**:

1. Lowercase `companyName`.
2. **Date generation** (skip Sundays + known court holidays):
   ```ts
   while (cur <= endDate) {
     if (cur.getDay() !== 0) {                       // skip Sunday
       const mmdd = `${MM}-${DD}`
       if (!COURT_HOLIDAYS.has(mmdd)) dates.push(new Date(cur))
     }
     cur.setDate(cur.getDate() + 1)
   }
   ```
3. **Batched parallel scanning**: `BATCH_SIZE = 30` dates per batch. For each date in the batch, fetch all 3 court types (`ALL_TYPES`) in parallel — 30 × 3 = 90 parallel requests per batch (with 4 CF workers round-robin, ~22 per worker).
4. For each returned hearing, filter by `claiment` OR `defendant` containing the company name (case-insensitive).
5. Sort matches by `hearing_date` descending (newest first).
6. `onProgress?.(scanned, total, found)` fires after each batch.

**Note**: The `_type` parameter is ignored — the function always scans all 3 types. Kept for backward-compat with older callers.

### 5.7 `formatDate(d: Date): string` (private)

Returns `DDMMYYYY` (no separators) for the API URL.

### 5.8 Caching

None — every scan is fresh. Each date+type combo is a separate request.

---

## 6. orginfo.ts

**File**: `src/lib/orginfo.ts` (565 lines)
**Purpose**: Scrapes `orginfo.uz` (public directory of Uzbekistan organizations) for company info by TIN. The site is server-rendered HTML — no API, no auth, no captcha. We parse the HTML directly with regex.

### 6.1 Constants

| Constant | Value |
|---|---|
| `ORGINFO_BASE` | `'https://orginfo.uz'` |
| `TIN_CACHE_TTL` | `24 * 60 * 60 * 1000` (24 hours) |
| `FETCH_TIMEOUT_MS` | `6_000` (in `fetchHtml`) — note: spec mentions 5s but actual code uses 6s |
| `FALLBACK_WORKERS` | same 4 hardcoded workers |

### 6.2 Server-side TIN cache (in-memory Map)

```ts
interface TinCacheEntry { info: CompanyInfo; ts: number }
const tinCache = new Map<string, TinCacheEntry>()
```
- TTL 24h. Hit → return `cached.info` immediately.
- Set only on successful `parseCompanyPage` (when `info.shortName || info.officialName` is non-empty).
- No eviction sweep — entries live until process restart.

### 6.3 CF Worker proxy (round-robin)

`orginfo.uz` blocks sustained direct requests, so EVERY fetch is routed through the CF Worker pool. NEVER fetches directly (would block server IP). Falls back to `FALLBACK_WORKERS[0]` only if no workers configured (dev mode).

### 6.4 Exported types

```ts
interface CompanyInfo {
  tin: string
  officialName: string
  shortName: string
  registeredDate: string
  status: string
  registeringAuthority: string
  thsht: string          // legal form code
  dbibt: string          // treasury account code
  ifut: string           // OKVED-like activity code
  charterCapital: string // ustav fondi
  email: string
  phone: string
  address: string
  director: string
  founders: { name: string; share: string }[]
  sustainabilityRating: string
  largeTaxpayer: string
  orgInfoUrl: string
}

interface CompanySearchResult {
  orgId: string          // hex hash from /uz/organization/{orgId}/ URL
  name: string
  tin: string
  date: string
  region: string
  orgInfoUrl: string
}
```

### 6.5 `searchCompanies(query: string): Promise<CompanySearchResult[]>`

**Endpoint**: `GET {ORGINFO_BASE}/uz/search/all/?q={encodeURIComponent(query)}`

Parses search-results HTML via `parseSearchResults`:
- Strip `<script>` / `<style>` blocks.
- Match all `/uz/organization/{orgId}/` links → dedupe `orgId`s.
- For each match, take 800 chars after the link and extract:
  - **name**: first `heading|h[1-6]|a` tag content 5-150 chars.
  - **tin**: first 9-digit number `(\d{9})`.
  - **date**: first `DD.MM.YYYY` pattern.
  - **region**: text after `location` icon (`location[^>]*>([^<]+)`).

### 6.6 `getCompanyByTin(tin: string): Promise<CompanyInfo | null>`

1. **24h cache hit** → return cached.
2. Fetch search page `?q={tin}` → extract org IDs via `extractOrgIds(html)` (matches `/uz/organization/([a-f0-9]+)/`).
3. **v116 optimization: parallel first batch** — fetch the first 2 candidate org detail pages in parallel (`/uz/organization/{orgId}/`). If a match is found in the first batch (TIN equals `extractField(html, 'STIR')`), parse + cache + return immediately.
4. **Sequential fallback** — if neither of the first 2 matches, fetch the remaining candidates one-by-one.
5. Cache successful result for 24h.

### 6.7 `lookupTinByName(name: string): Promise<string | null>`

FAST — 1 HTTP request only (skips the detail page). Cleans the name:
- Strip surrounding quotes (`"`, `«`, `»`, `"`, `"`, `„`, etc.)
- Strip legal suffixes: `MAS'ULIYATI CHEKLANGAN JAMIYAT`, `AKSIYADORLIK JAMIYATI`, `QOSHMA KORXONA`, `MCHJ`, `AJ`, `OAO`, `OOO`.
- Collapse whitespace.

If the cleaned name is >3 chars, use it; else use the quote-stripped original.

Then calls `searchCompanies` → `pickBestTin(results, searchQuery)`:
- Score each result by how many query words (>2 chars) appear in the result name. TIN validity check: `/^\d{9}$/`.
- Bonus for valid TIN (added 0.1 to score in `pickBestMatch`).
- If no good word match → fall back to the first result with a valid TIN.
- **Retry**: if no results, retry with the first 3 words of the original name.

### 6.8 `getCompanyByName(name: string): Promise<CompanyInfo | null>`

Same name cleaning as `lookupTinByName`. Calls `searchCompanies` → `pickBestMatch(results, name, searchQuery)`:
- Scores each result on query-word overlap.
- Picks best score (or `results[0]` if all score -1).
- Fetches the best match's org detail page → `parseCompanyPage(html, tin, orgUrl)`.

### 6.9 `fetchHtml(url, retries=1): Promise<string>`

- Wraps URL with `getCfWorkerUrl`.
- Headers: `User-Agent: Chrome 124 / Windows`, `Accept: text/html`, `Accept-Language: uz,en;q=0.9`, `redirect: 'follow'`.
- Timeout 6s.
- On failure: sleep 500ms, retry once. Returns `''` if both attempts fail.

### 6.10 `parseCompanyPage(html, tin, url): CompanyInfo`

Extracts every field via `extractField` / `extractPhone` / regex:
- **officialName**: `extractField(html, 'Официальное название организации') || extractField(html, 'Rasmiy nomi')` (Russian label first — more reliable — Latin fallback).
- **shortName**: `extractField(html, 'Краткое название организации') || extractField(html, 'Qisqa nomi')`.
- **registeredDate**: `"Ro'yxatdan o'tgan sana"`.
- **status**: `'Faollik holati'`.
- **registeringAuthority**: `"Ro'yxatdan o'tkazuvchi organ"`.
- **thsht / dbibt / ifut**: `THSHT` / `DBIBT` / `IFUT` field codes.
- **charterCapital**: `Ustav fondi`.
- **email**: `Elektron pochta`.
- **phone**: `extractPhone(html)` — finds `Telefon raqami` (NOT `Telefon raqamini` which is the hide-phone service).
- **address**: `Manzili` + next 3 non-empty text blocks joined with `, `.
- **director**: `Rahbar`.
- **founders**: regex `Ta'sischilar.*?(?=<region|<div class="col-12|<section)` + per-founder `>([A-Z][^<]{5,80}(?:OGLI|O'G'LI|QIZI)?)<.*?>([\d.]+)\s*%` — captures name + percentage.
- **sustainabilityRating**: `Toifa`.
- **largeTaxpayer**: `Yirik soliq`.

### 6.11 HTML parsing helpers

- `extractField(html, fieldName)` — finds all occurrences of `fieldName`; for each, scans the next 500 chars for `>([^<]+)<` text. Returns the first non-empty, non-Loading, non-Parol, non-`-` text (after HTML entity decoding `&#x27;`, `&quot;`, `&amp;`).
- `extractMultipleFields(html, fieldName)` — same but returns all matches as a string array.
- `extractPhone(html)` — finds `Telefon raqami` (skipping `Telefon raqamini` via next-char check), extracts `(\+?\d[\d\s-]{5,14}\d)`.
- `extractOrgIds(html)` — `/\/uz\/organization\/([a-f0-9]+)\//g` deduped.

### 6.12 Error handling / retries

- `fetchHtml` retries once with 500ms delay on failure.
- All higher-level functions return `null` on failure rather than throwing.

### 6.13 Caching

- 24h in-memory `tinCache` Map for `CompanyInfo` keyed by TIN.
- No client-side cache (the Company Info tab does its own caching via `cache.ts`).

---

## 7. chamber.ts

**File**: `src/lib/chamber.ts` (153 lines)
**Imports**: `'server-only'`
**Purpose**: Fetches contractor rating from `admin.chamber.uz` (Chamber of Commerce). Returns rating score (0-100), category (AAA-D), taxpayer type, region, industry. **No authentication required**.

### 7.1 Constants

| Constant | Value |
|---|---|
| `FETCH_TIMEOUT_MS` | `10_000` (10s) |
| `FALLBACK_WORKERS` | same 4 hardcoded workers |

### 7.2 Exported interface

```ts
interface ChamberRating {
  tin: string
  name: string
  nameRu: string
  nameLat: string
  criteriaAll: number              // 0-100 rating score
  type: string                     // AAA | AA | A | BBB | BB | B | CCC | CC | C | D
  taxpayerType: number             // taxpayer type ID
  taxpayername: string             // e.g. "SDT" = Large Taxpayer
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
```

### 7.3 CF Worker proxy (round-robin)

`chamberWorkerCounter` module-level. `getCfWorkerUrl` reads env vars + falls back to `FALLBACK_WORKERS[0]`. Note: chamber.ts only reads `CF_WORKER_URLS` (no `CF_WORKER_URL` single fallback).

### 7.4 `getCompanyRating(tin: string): Promise<ChamberRating | null>`

**Endpoint**: `GET https://admin.chamber.uz/api/GetCompanyCriteries/{cleanTin}`

- TIN validation: `/^\d{9}$/`. Returns `null` if invalid.
- Headers: `Accept: application/json`. Timeout 10s.
- Validates response: must have `data.tin`.
- Maps API response fields (with fallbacks):
  - `name: data.name || data.nameUz`
  - `nameLat: data.nameLat || data.nameUz`
  - `taxpayername: data.taxpayername || data.taxpayer_name_uz_latn`
  - `okedCode: data.okedDetail?.code`
  - `okedName: data.okedDetail?.name_uz_latn || data.okedDetail?.name`
  - `okedNameRu: data.okedDetail?.name_ru`
  - `employeeLimitMf / employeeLimitLf: data.okedDetail?.employee_limit_mf / _lf ?? 0`
- Returns `null` on any error or non-OK response.

### 7.5 `getRatingColor(type: string): string`

| type | color | hex |
|---|---|---|
| AAA / AA / A | emerald | `#34d399` |
| BBB | cyan | `#38bdf8` |
| BB / B | amber | `#f59e0b` |
| CCC / CC / C / D | rose | `#f43f5e` |

### 7.6 `getRatingLabel(type: string): string`

| type | label (uz) |
|---|---|
| AAA / AA / A | Yuqori |
| BBB / BB / B | O'rta |
| CCC / CC / C | Qoniqarli |
| D | Quyi |
| (else) | Noma'lum |

### 7.7 Caching

None — every call fetches fresh. (Stats tab uses `cache.ts` to cache the full stats payload, which includes chamber data.)

---

## 8. stats.ts

**File**: `src/lib/stats.ts` (364 lines)
**Imports**: `searchCourtCases, CourtCase` from `./court-case`, `getCompanyByTin` from `./orginfo`, `getCompanyRating` from `./chamber`.
**Purpose**: Aggregates all court cases (economic + civil + administrative) for a company TIN, classifies each as WIN/LOSE/NEUTRAL/PENDING based on the company's role (plaintiff vs defendant) and the case outcome. Builds the payload for the Statistika tab.

### 8.1 Exported types

```ts
type StatsCourtType = 'economic' | 'civil' | 'administrative'
type Classification = 'win' | 'lose' | 'neutral' | 'pending'
type PartyRole = 'plaintiff' | 'defendant'

interface CaseWithClassification {
  caseNumber: string
  courtType: StatsCourtType
  regDate: string              // DD.MM.YYYY (raw)
  result: string               // raw Uzbek outcome
  classification: Classification
  role: PartyRole
  court: string
  category: string
  counterparty: string         // the OTHER party's name
}

interface CompanyStatsSummary {
  total: number
  win: number
  lose: number
  neutral: number
  pending: number
  asPlaintiff: number
  asDefendant: number
}

interface CompanyStatsCompany {
  name: string
  tin: string
  region?: string
  status?: string
  officialName?: string
  shortName?: string
}

interface CourtTypeError {
  courtType: StatsCourtType
  error: string
}

interface CompanyStats {
  company: CompanyStatsCompany
  cases: CaseWithClassification[]
  summary: CompanyStatsSummary
  errors: CourtTypeError[]
}
```

### 8.2 `normalizeName(s: string): string` (private)

1. Strip surrounding quotes (`"`, `«`, `»`, `"`, `"`, `„`, `'`, `'`, `'`, `` ` ``).
2. Lowercase.
3. **Expand legal abbreviations in BOTH scripts**:
   - Latin: `mchj` → `mas'uliyati cheklangan jamiyati`, `aj` → `aktsiyadorlik jamiyati`, `ooo` → `mas'uliyati cheklangan jamiyati`, `oao` → `aktsiyadorlik jamiyati`.
   - Cyrillic: same expansions to `масъулияти чекланган жамияти` / `акционерлик жамияти`.
   - Reason: sud.uz APIs return Cyrillic, but orginfo.uz + chamber.uz sometimes return Latin — covers both so matching works either way.
4. Collapse whitespace.

### 8.3 `nameMatches(companyNorm, partyNorm): boolean` (private)

Three strategies, in order:
1. Direct substring match (either direction).
2. Split both into words >2 chars. Match if ≥2 of the company's words appear in the party field (where "appear" means exact, or one contains the other). Threshold: `min(2, companyWords.length)`.

### 8.4 `classifyOutcome(role, result): Classification` (private)

Per the STATS-TAB-SPEC.md "Interpretation A":

1. Lowercase the result, normalize curly apostrophes to `'`, trim. Empty / `—` / `-` → `pending`.
2. Detect outcome keywords (BOTH Cyrillic and Latin):
   - `full`: `тўлиқ` / `to'liq` / `toliq`
   - `partial`: `қисман` / `qisman`
   - `rejected`: `рад` / `rad ` (covers "Rad etilgan" / "Rad qilingan")
   - `returned`: `қайтарилган` / `qaytarilgan`
   - `leftWithoutReview`: `кўрмасдан` / `ko'rmasdan` / `kormasdan`
   - `terminated`: `тугатилган` / `tugatilgan` (case terminated without ruling)
3. `if (full || partial) return 'win'` — WIN for both roles.
4. `if (rejected || returned || leftWithoutReview || terminated)`:
   - plaintiff → `lose`
   - defendant → `neutral`
5. Else → `pending`.

### 8.5 `getCompanyStats(tin: string): Promise<CompanyStats>` (MAIN EXPORT)

**Parallel fetches (all routed via CF workers — NEVER direct)**:

1. `getCompanyByTin(tin)` — orginfo.uz (worker-routed internally).
2. `getCompanyRating(tin)` — chamber.uz (worker-routed internally). This is the **5th parallel fetch** used as a name fallback if orginfo fails.
3. `searchCourtCases('economic', 'tin', tin)` — economic cases.
4. `searchCourtCases('civil', 'tin', tin)` — civil cases.
5. `searchCourtCases('administrative', 'tin', tin)` — administrative cases.

All 5 fire in parallel via `Promise.allSettled`. None blocks another. If one fails, partial results still return.

**Company name resolution** (in order):
1. If orginfo succeeded → `name = shortName || officialName || chamberName || 'STIR {tin}'`.
2. Else if chamber.uz succeeded → use chamber's `name || nameLat || nameRu`.
3. Else → `STIR {tin}`.

**Case processing**:
- For each court type that succeeded, iterate cases → `classifyCase(raw, courtType, companyNameNorm, tin)`.
- Failed court types → push to `errors: CourtTypeError[]`.
- Deduplicate by `caseNumber` (Set guard).

**Summary computation**:
- `total = deduped.length`
- Count `win` / `lose` / `neutral` / `pending` by classification.
- Count `asPlaintiff` / `asDefendant` by role.

### 8.6 `classifyCase(raw, courtType, companyNameNorm, tin)` (private)

Returns `CaseWithClassification | null` (null if no caseNumber).

**Role determination** (in order):
1. If `companyNameNorm && nameMatches(companyNameNorm, normalizeName(plaintiffRaw))` → `plaintiff`.
2. Else if `companyNameNorm && nameMatches(companyNameNorm, normalizeName(defendantRaw))` → `defendant`.
3. Else if `plaintiffRaw.includes(tin)` → `plaintiff` (TIN-as-substring fallback).
4. Else if `defendantRaw.includes(tin)` → `defendant`.
5. Else → default `plaintiff` (TIN-guaranteed match — we know the case is for this TIN).

Then `classification = classifyOutcome(role, raw.result)`.
`counterparty = role === 'plaintiff' ? defendantRaw : plaintiffRaw`.

### 8.7 Timeline (monthly trend) — built client-side

**Not in this file** — the stats payload returns the per-case `regDate` (DD.MM.YYYY raw). The Statistika tab in `src/app/page.tsx` builds the monthly timeline by bucketing cases into `YYYY-MM` keys from `regDate`, then renders the SVG stacked bar chart in the TrendChart component.

### 8.8 Win rate — built client-side

**Not in this file** — the summary returns raw `win / lose / neutral / pending` counts. The Statistika tab computes `winRate = win / (win + lose)` (excluding neutral + pending from the denominator) for the win-rate bars.

### 8.9 `COURT_TYPE_MAP` (private)

Identity map: `{ economic: 'economic', civil: 'civil', administrative: 'administrative' }`. Used to ensure the output `StatsCourtType` is normalized.

### 8.10 Caching

- No in-memory cache in this module.
- Client-side caching of the full `CompanyStats` payload via `cache.ts` key `stats:{tin}` (5-minute TTL).

---

## 9. mib.ts

**File**: `src/lib/mib.ts` (619 lines)
**Imports**: `'server-only'`
**Purpose**: MIB (Majburiy Ijro Byurosi — Bureau of Compulsory Enforcement) debt check. mib.uz provides a debt-check lookup by STIR (legal entity INN) using a math captcha and Apache Wicket AJAX form submission (stateful, session-bound). The debt-check service (Қарздорликни текшириш) is fully automatable — just STIR + math captcha. The monitoring service requires phone+SMS and is NOT handled here.

### 9.1 Constants

| Constant | Value |
|---|---|
| `MIB_BASE` | `'https://mib.uz'` |
| `FETCH_TIMEOUT_MS` | `15_000` (15s — long because mib.uz is slow + geo-blocking) |
| `SESSION_TTL` | `5 * 60 * 1000` (5 minutes) |

### 9.2 Session store (in-memory Map)

```ts
interface MibSession {
  cookieHeader: string
  hiddenField: string           // Wicket hidden field name ({formId}_hf_0)
  ajaxSubmitUrl: string         // Wicket AJAX submit URL
  wicketBaseUrl: string
  createdAt: number
}
const sessionStore = new Map<string, MibSession>()
```

- `createSession(tin, data)` — generates `sessionId = '{tin}_{Date.now()}_{random6}'`, stores it, sweeps old sessions (TTL > 5 min), returns the ID.
- `getSession(sessionId)` — returns the session if not expired, else deletes + returns null.

### 9.3 `fetchDirect(targetUrl, opts)` (private)

Native `fetch()` with browser-like headers:
- `User-Agent: Chrome 124 / Windows`
- `Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8`
- `Accept-Language: ru-RU,ru;q=0.9,en;q=0.7`
- `redirect: 'manual'` (caller handles redirects explicitly).
- Captures all response headers, including `Set-Cookie` via `getSetCookie()` (Node 18+).

Returns `{ status, statusText, headers, text, arrayBuffer, ok }`.

### 9.4 Exported types

```ts
interface MibDebt {
  enforcementCaseNumber: string    // 14-digit, e.g. "10072617684501"
  status: string                   // Ҳужжат ҳолати, e.g. "Жараёнда"
  subject: string                  // И/Ҳ мазмуни, e.g. "Карз ундириш"
  department: string               // Ҳужжат иш юритувида
  collector: string                // Ундирувчи (masked)
  amount: number                   // Қарздорлик миқдори (so'm)
}

interface MibDebtResult {
  tin: string
  hasDebt: boolean
  status: 'clean' | 'debt' | 'error' | 'captcha_failed'
  message: string                  // raw UZ message
  totalDebt?: number               // so'm
  currentDebt?: number             // so'm
  debts?: MibDebt[]
  checkedAt: number                // Date.now()
}
```

### 9.5 `prepareMibCheck(tin: string)` — Phase 1

Returns `{ ok, sessionId?, captchaImage?, error? }`.

1. TIN validation: `/^\d{9}$/`.
2. `GET {MIB_BASE}/bl` — follow redirects manually (up to 5), collect cookies from every hop.
3. If response is <5000 bytes → "mib.uz returned an error page (geo-block or server down)".
4. Parse the BlackListV2 page HTML via `parseBlackListPage(html)`:
   - Find `<input name="inn">` → extract its `id`.
   - Find all `<form>` tags; pick the LAST one BEFORE the inn input.
   - Extract `id` and `action` from that form tag.
   - Hidden field = `{formId}_hf_0`.
   - Find the submit button: `<button name="submit_button">` within the form block (tries multiple regex patterns).
   - Find the captcha image: first `<img src="...">` in the form block.
   - Find the Wicket AJAX submit URL: matches `Wicket.Ajax.ajax({"u":"...","m":"POST","c":"<submitButtonId>"...})` with attribute order flexibility.
   - Find the Wicket base URL: `Wicket.Ajax.baseUrl="..."`.
5. Download the captcha image (PNG). Convert to base64.
6. Store the session (cookies + hiddenField + ajaxSubmitUrl + wicketBaseUrl) via `createSession`.
7. Return `{ ok: true, sessionId, captchaImage: base64 }`.

### 9.6 `submitMibCheck(tin, sessionId, captchaAnswer)` — Phase 2

Returns `MibDebtResult`.

1. Look up the session. If expired → error result.
2. Build the form body (URL-encoded):
   ```
   {hiddenField}=
   inn={cleanTin}
   secure_code={captchaAnswer}
   submit_button=1
   ```
3. POST to `session.ajaxSubmitUrl` with Wicket AJAX headers:
   - `Accept: text/xml,application/xml,...`
   - `Content-Type: application/x-www-form-urlencoded;charset=UTF-8`
   - `Wicket-Ajax: true`
   - `Wicket-Ajax-BaseURL: {session.wicketBaseUrl}`
   - `X-Requested-With: XMLHttpRequest`
   - `Origin: {MIB_BASE}`
   - `Referer: {MIB_BASE}/bl`
   - `Cookie: {session.cookieHeader}`
4. Parse the XML response via `parseWicketResponse(xml)`:
   - Check `feedbackPanelERROR` → `captcha_failed`.
   - Check for `қарздорлик мавжуд` (debt exists) or `Ижро иши рақами` → `debt` status. Extract:
     - Total / current debt via `Умумий қарздорлик` / `Жорий қарздорлик` patterns.
     - Individual debts: split on `Ижро иши рақами`, for each block extract 14-digit case number + status + subject + department + collector + amount.
   - Check `feedbackPanelWARNING` → `clean` (no debt).
   - Else → `captcha_failed` ("No feedback in response").
5. Delete the session.
6. Return `MibDebtResult` with `{ tin, hasDebt: status==='debt', status, message, totalDebt?, currentDebt?, debts?, checkedAt }`.

### 9.7 `parseMibHtml(html, tin): MibDebtResult` — direct mode

For users who do the check in their own browser (no geo-block) and paste the result HTML. Checks for:
- `(\d+)\s+СТИР\s+рақамли\s+юридик\s+шахсда\s+қарздорлик\s+аниқланмади` → no debt.
- `(\d+)\s+(?:ПИНФЛ|СТИР)\s+рақамли\s+\S+\s+қарздорлик\s+мавжуд` → debt exists.

Same field extraction as `parseWicketResponse` but against plain HTML.

### 9.8 `parseAmount(s: string): number` (private)

Removes spaces, replaces `,` with `.`, `parseFloat`. Returns 0 on NaN.

### 9.9 Error handling

- All network errors are caught and returned as `{ ok: false, error: msg }` (Phase 1) or `MibDebtResult` with `status: 'error'` (Phase 2).
- Cause error code/message is included if available.

### 9.10 Caching

- Sessions: 5-min TTL in `sessionStore` Map, swept on every create.
- No result cache — every debt check is fresh.

---

## 10. tor.ts

**File**: `src/lib/tor.ts` (315 lines)
**Imports**: `https`, `http`, `net`, `child_process.spawn`, `fs`, `path`, `socks-proxy-agent`.
**Purpose**: Manages a Tor SOCKS5 proxy on `127.0.0.1:9050` for bypassing IP blocks. Currently NOT actively used by billing.ts (which uses CF Workers exclusively), but kept as a fallback option.

### 10.1 Constants

| Constant | Value |
|---|---|
| `SOCKS_PORT` | `9050` |
| `TOR_DATA_DIR` | `{cwd}/.tor-data` |
| `TOR_LOG_DIR` | `{cwd}/.tor-log` |
| `NOTICE_LOG` | `{TOR_LOG_DIR}/notice.log` |
| `TOR_BINARY_CANDIDATES` | `['{cwd}/tor/tor.exe', '{cwd}/tor/tor', '/tmp/tor/tor']` |

### 10.2 Module-level state

```ts
let proxyAgent: SocksProxyAgent | null = null
let torProcess: ChildProcess | null = null
let availabilityChecked = false
```

### 10.3 Exported functions

**`isSocksPortOpen(): Promise<boolean>`** — TCP-connect probe to `127.0.0.1:9050` with 1.5s timeout. Returns true on connect, false on timeout/error.

**`findTorBinaryPath(): string | null`** — iterates `TOR_BINARY_CANDIDATES`, returns the first that exists.

**`ensureTor(): Promise<boolean>`** — ensures tor is running:
1. If we have a working `proxyAgent` and `availabilityChecked` → verify port is still open; if yes, return true. If port lost → reset agent + flag, respawn.
2. Check if tor is already running externally (`isSocksPortOpen`). If yes → create `SocksProxyAgent`, set flag, return true.
3. Else spawn tor from local binary via `spawnTor()`. If spawn succeeds → create agent + flag.

**`getTorProxyAgent()`** — returns the current `proxyAgent` (or null).

**`rotateTorCircuit(): Promise<boolean>`** — kills the tor process, waits 1.5s, respawns. Forces a new circuit with a DIFFERENT exit node. Useful when billing.sud.uz blocks the current exit node.

**`fetchViaTor(url, init): Promise<TorFetchResponse>`** — fetch-compatible wrapper that routes through the SOCKS proxy. Uses native `http`/`https` request with `agent: proxyAgent`. 60s timeout. Returns `{ ok, status, statusText, json(), text() }`.

### 10.4 Private helpers

- `writeTorrc(binaryPath): string` — writes a torrc file with:
  ```
  SOCKSPort 127.0.0.1:9050
  DataDirectory {TOR_DATA_DIR}
  Log notice file {NOTICE_LOG}
  AvoidDiskWrites 1
  ExitPolicy accept *:*
  ```
- `waitForBootstrap(timeoutMs=120000): Promise<boolean>` — polls `NOTICE_LOG` every 1s until it contains `Bootstrapped 100%` or timeout.
- `spawnTor(): Promise<boolean>` — kills any previous tor process, spawns the binary with `-f {torrc}`, sets `cwd` to the binary dir (so Windows can find DLLs), `windowsHide: true`, `LD_LIBRARY_PATH` set. Waits for bootstrap.

### 10.5 Error handling

- On spawn error → log + null out `torProcess`.
- On process exit → log + null out `torProcess` and `proxyAgent`, reset `availabilityChecked`.
- All exports return booleans or null rather than throwing.

### 10.6 Caching

- Module-level `proxyAgent` is the "cache" — once tor is bootstrapped, the agent is reused across requests.

---

## 11. cache.ts

**File**: `src/lib/cache.ts` (64 lines)
**Purpose**: Simple client-side localStorage cache with TTL. Used to avoid re-fetching the same data within a 5-minute window. The bills tab is intentionally NOT cached (it streams results progressively).

### 11.1 Constants

| Constant | Value |
|---|---|
| `PREFIX` | `'sb-cache:'` (isolates our keys from other apps sharing localStorage) |
| `DEFAULT_TTL` | `5 * 60 * 1000` (5 minutes) |

### 11.2 Exported functions

**`getCached<T>(key: string, ttl = DEFAULT_TTL): T | null`**
- SSR-safe: returns `null` if `typeof window === 'undefined'`.
- Reads `localStorage.getItem(PREFIX + key)`, parses `{ data, ts }`.
- If `Date.now() - ts > ttl` → returns `null` (expired).
- On any error → returns `null`.

**`setCached<T>(key: string, data: T): void`**
- SSR-safe no-op.
- Writes `{ data, ts: Date.now() }` to localStorage.
- On quota exceeded / private mode → silently ignores.

**`clearCached(key: string): void`** — removes a single key.

**`cacheKey`** — centralized key builders:
```ts
{
  companyInfo: (tin) => `company-info:${tin}`,
  stats: (tin) => `stats:${tin}`,
  cases: (courtType, mode, value) => `cases:${courtType}:${mode}:${value}`,
  upcoming: (tin) => `upcoming:${tin}`,
}
```

### 11.3 Caching

That's the whole file.

---

## 12. db.ts

**File**: `src/lib/db.ts` (12 lines)
**Purpose**: Prisma client singleton. Prevents Next.js dev mode from spawning a new Prisma client on every hot-reload (which would exhaust DB connections).

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['query'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
```

- `db` — the singleton PrismaClient.
- In non-production, the client is stashed on `globalThis.prisma` so HMR reuses it.
- `log: ['query']` — logs every SQL query (dev only effectively, since production doesn't go through this branch).

---

## 13. utils.ts

**File**: `src/lib/utils.ts` (6 lines)
**Purpose**: The canonical shadcn/ui class-name helper.

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- `cn(...inputs: ClassValue[]): string` — combines `clsx` (conditional class joining) with `twMerge` (dedupes conflicting Tailwind classes, last-wins). Used everywhere in shadcn/ui components.

---

## 14. app/layout.tsx

**File**: `src/app/layout.tsx` (85 lines)
**Purpose**: Next.js App Router root layout — sets up the HTML document, fonts, metadata, theme bootstrap, and toast notifications.

### 14.1 HTML attributes

```tsx
<html lang="uz" data-theme="light" suppressHydrationWarning>
```
- `lang="uz"` — Uzbek (Latin script by default; cyrillic content handled by Inter font).
- `data-theme="light"` — default theme; the bootstrap script may override to `dark` based on localStorage.
- `suppressHydrationWarning` — needed because the inline theme-bootstrap script mutates `data-theme` before React hydrates.

### 14.2 Fonts (3 Google Fonts via `next/font/google`)

| Font | CSS variable | Subsets | Weights | Display |
|---|---|---|---|---|
| **Unbounded** | `--font-unbounded` | `latin` | 500, 600, 700, 800 | `swap` |
| **Inter** (variable `jakarta`) | `--font-jakarta` | `latin`, `cyrillic` | 400, 500, 600, 700, 800 | `swap` |
| **JetBrains Mono** | `--font-jetbrains` | `latin` | 400, 500, 600, 700 | `swap` |

Inter is chosen specifically for full Cyrillic support (`ў, қ, ғ, ҳ, а-я`) — fixes rendering of Cyrillic Uzbek text returned by sud.uz / orginfo.uz APIs. (The local variable is named `jakarta` for historical reasons — it was previously Plus Jakarta Sans.)

### 14.3 Metadata

```ts
export const metadata: Metadata = {
  title: "Sud To'lovlarini Qidiruv - billing.sud.uz kvitansiyalarini import qiluvchi vosita",
  description: "Kompaniya STIR raqamini kiriting (9 ta raqam). Ilova billing.sud.uz saytidan barcha kvitansiyalarni import qiladi — turini (davlat boji / pochta), to'langan summani, holatini, sudni va har bir to'lov ishlatilgan sud ish raqamlarini ko'rsatadi.",
  keywords: ["billing.sud.uz", "sud billing", "kvitansiya", "davlat boji", "INN", "STIR", "yuridik shaxs", "Uzbekistan court fees"],
  authors: [{ name: "Sud Billing Lookup" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
  openGraph: {
    title: "Sud To'lovlarini Qidiruv",
    description: "billing.sud.uz dan kompaniya nomiga chiqarilgan barcha kvitansiyalarni import qiling",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sud To'lovlarini Qidiruv",
    description: "billing.sud.uz dan kompaniya nomiga chiqarilgan barcha kvitansiyalarni import qiling",
  },
}
```

### 14.4 FOUC prevention (theme bootstrap)

Inline script in `<head>` applies the saved theme before first paint:
```js
(function(){
  try {
    var t = localStorage.getItem('mono-theme') || 'light';
    if (t !== 'light' && t !== 'dark') t = 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
```
- Reads `localStorage['mono-theme']` (defaults to `'light'`).
- Whitelists `'light'` / `'dark'` — any other value (including null) → `'light'`.
- Sets `data-theme` attribute on `<html>` before React hydrates.

### 14.5 Body wrapper

```tsx
<body className={`${unbounded.variable} ${jakarta.variable} ${jetbrains.variable} antialiased`}>
  {children}
  <Toaster />                              {/* shadcn/ui Toaster (default position) */}
  <SonnerToaster position="top-center" closeButton />  {/* Sonner toast notifications */}
</body>
```
- The three font CSS variables are attached to the body so they cascade to all children.
- `antialiased` for font smoothing.
- Two toast systems are mounted: the shadcn `<Toaster />` (for radix-based toasts) and Sonner's `<SonnerToaster />` (for the newer sonner-style notifications, positioned top-center with a close button).

### 14.6 Theme provider

There is NO explicit theme-provider component wrapped around `{children}` — the theme is applied purely via the `data-theme` HTML attribute (set by the inline bootstrap script and toggled by client code that writes to `localStorage['mono-theme']` and updates `document.documentElement.setAttribute('data-theme', ...)`. The Monochrome Glass aesthetic is implemented in `globals.css` via `[data-theme="light"]` / `[data-theme="dark"]` selectors.

---

## Cross-cutting summary

### External API endpoints (full list)

| Service | Endpoint | Method | Auth | Module |
|---|---|---|---|---|
| recaptcha.sud.uz | `/api/v1/captcha/pow/challenge` | POST | siteKey | billing.ts |
| recaptcha.sud.uz | `/api/v1/captcha/analyze` | POST | siteKey + PoW | billing.ts |
| recaptcha.sud.uz | `/api/v1/captcha/challenge/solve` | POST | challengeId + answer | billing.ts |
| billing.sud.uz | `/api/invoice/captcha/search?passportNumber=&inn=&page=&size=&captchaToken=` | GET | captchaToken | billing.ts |
| billing.sud.uz | `/api/invoice/checkStatus?invoice=&lang=` | GET | — | billing.ts |
| jadval.sud.uz | `/case/findByTin/{tin}` | GET | — (public) | court-case.ts |
| jadval.sud.uz | `/case/findByNumber/{n}` | GET | — | court-case.ts |
| jadval.sud.uz | `/case/findByCivilNumber/{n}` | GET | — | court-case.ts |
| jadval.sud.uz | `/case/findByCriminalNumber/{n}` | GET | — | court-case.ts |
| jadval.sud.uz | `/case/findByAdmNumber/{n}` | GET | — | court-case.ts |
| jadvalapi.sud.uz | `/online-monitoring/ECONOMIC/findByTin/{tin}` | GET | — | court-case.ts |
| jadvalapi.sud.uz | `/online-monitoring/ECONOMIC/findByNumber/{n}` | GET | — | court-case.ts |
| jadvalapi.sud.uz | `/online-monitoring/CIVIL/findByTin/{tin}` | GET | — | court-case.ts |
| jadvalapi.sud.uz | `/online-monitoring/CIVIL/findByNumber/{n}` | GET | — | court-case.ts |
| jadvalapi.sud.uz | `/online-monitoring/CONFLICT/findByTin/{tin}` | GET | — | court-case.ts |
| jadvalapi.sud.uz | `/online-monitoring/CONFLICT/findByNumber/{n}` | GET | — | court-case.ts |
| jadvalapi.sud.uz | `/vka/{TYPE}/{courtId}/{DDMMYYYY}` | GET | — | jadval2.ts |
| orginfo.uz | `/uz/search/all/?q={query}` | GET | — | orginfo.ts |
| orginfo.uz | `/uz/organization/{orgId}/` | GET | — | orginfo.ts |
| admin.chamber.uz | `/api/GetCompanyCriteries/{STIR}` | GET | — | chamber.ts |
| mib.uz | `/bl` (form page) | GET | — | mib.ts |
| mib.uz | Wicket AJAX submit URL (varies) | POST | session cookies | mib.ts |

### CORS proxies / CF Workers

All 4 hardcoded fallback workers (used when `CF_WORKER_URLS` / `CF_WORKER_URL` env vars are missing):
```
https://broad-field-f2b0.uzwebfox.workers.dev/
https://wild-hall-04ae.uzwebfox.workers.dev/
https://orange-darkness-8843.najimsheikh071.workers.dev/
https://wandering-wind-1d3d.najimsheikh071.workers.dev/
```

Additional CORS proxies used by billing.ts (in the ProxyPool, after CF Workers):
- `https://proxy.cors.sh/`
- `https://api.allorigins.win/raw?url=` (needs `encodeURIComponent`)
- `https://corsproxy.io/?url=`
- `https://api.codetabs.com/v1/proxy/?quest=`
- `https://thingproxy.freeboard.io/fetch/`

### In-memory caches

| Module | Cache | TTL |
|---|---|---|
| billing.ts | `ProxyPool` state (alive/dead per proxy) | per-process |
| billing.ts | `circuitBreaker` 521-counter | 30s when tripped |
| orginfo.ts | `tinCache: Map<string, TinCacheEntry>` | 24h |
| mib.ts | `sessionStore: Map<string, MibSession>` | 5 min |
| cache.ts | localStorage (client) | 5 min (default) |
| tor.ts | `proxyAgent` singleton | per-process |

### Concurrency / retry summary

| Module | Concurrency | Retries |
|---|---|---|
| billing.ts `getFullBillData` | **6 workers** (was 2 → 4 → 6) | 1 retry round (transient only) |
| billing.ts `getBillStatus` | sequential across proxies | 3 permanent-fail bail, then throw |
| billing.ts `searchBillsByInn` | 1 search at a time | 3 token regen × 3 same-token retries |
| court-case.ts `searchCourtCases` | both APIs in parallel | 1 retry on transient errors |
| jadval2.ts `scanDateRange` | 30 dates × 3 types = 90 parallel per batch | none |
| stats.ts `getCompanyStats` | 5 parallel (orginfo + chamber + 3 court types) | none at this layer |
| orginfo.ts `getCompanyByTin` | first 2 candidates in parallel | 1 retry in `fetchHtml` |

### User agents used

- billing.ts: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36`
- court-case.ts: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` (shorter)
- orginfo.ts: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36`
- mib.ts: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`
- billing.ts `buildSignals` (captcha fingerprint): `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36`

### Module dependency graph

```
stats.ts
  ├── court-case.ts (searchCourtCases)
  │     └── court-case-types.ts (types + status constants)
  ├── orginfo.ts (getCompanyByTin)
  └── chamber.ts (getCompanyRating)

billing.ts  (standalone — only crypto + ZAI)
jadval2.ts  (standalone — server-only)
court-map.ts (standalone — pure constants + functions)
mib.ts      (standalone — server-only)
tor.ts      (standalone — Node-only, currently unused by billing)
cache.ts    (standalone — client-only)
db.ts       (standalone — Prisma singleton)
utils.ts    (standalone — cn helper)
layout.tsx  (Next.js root)
```

---

# PART 5 — ROOT LAYOUT (`src/app/layout.tsx`)

> **File**: `/home/z/my-project/src/app/layout.tsx` (85 lines)
> **Purpose**: Next.js App Router root layout — sets up HTML document, fonts, metadata, theme bootstrap, and toast notifications.

## 5.1 HTML attributes

```tsx
<html lang="uz" data-theme="light" suppressHydrationWarning>
```

- `lang="uz"` — Uzbek (Latin script default; Cyrillic content handled by Inter font's Cyrillic subset)
- `data-theme="light"` — default theme; bootstrap script may override to `dark` based on localStorage
- `suppressHydrationWarning` — needed because the inline theme-bootstrap script mutates `data-theme` before React hydrates

## 5.2 Fonts (3 Google Fonts via `next/font/google`)

| Font | CSS variable | Subsets | Weights | Display |
|---|---|---|---|---|
| **Unbounded** (display) | `--font-unbounded` | `latin` | 500, 600, 700, 800 | `swap` |
| **Inter** (body) | `--font-jakarta` | `latin`, `cyrillic` | 400, 500, 600, 700, 800 | `swap` |
| **JetBrains Mono** (mono labels) | `--font-jetbrains` | `latin` | 400, 500, 600, 700 | `swap` |

Inter chosen for full Cyrillic support (`ў, қ, ғ, ҳ, а-я`) — fixes rendering of Cyrillic Uzbek text returned by sud.uz / orginfo.uz APIs. (Local variable named `jakarta` for historical reasons — was previously Plus Jakarta Sans.)

## 5.3 Metadata

```ts
export const metadata: Metadata = {
  title: "Sud To'lovlarini Qidiruv - billing.sud.uz kvitansiyalarini import qiluvchi vosita",
  description: "Kompaniya STIR raqamini kiriting (9 ta raqam). Ilova billing.sud.uz saytidan barcha kvitansiyalarni import qiladi — turini (davlat boji / pochta), to'langan summani, holatini, sudni va har bir to'lov ishlatilgan sud ish raqamlarini ko'rsatadi.",
  keywords: ["billing.sud.uz", "sud billing", "kvitansiya", "davlat boji", "INN", "STIR", "yuridik shaxs", "Uzbekistan court fees"],
  authors: [{ name: "Sud Billing Lookup" }],
  icons: { icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg" },
  openGraph: {
    title: "Sud To'lovlarini Qidiruv",
    description: "billing.sud.uz dan kompaniya nomiga chiqarilgan barcha kvitansiyalarni import qiling",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sud To'lovlarini Qidiruv",
    description: "billing.sud.uz dan kompaniya nomiga chiqarilgan barcha kvitansiyalarni import qiling",
  },
}
```

## 5.4 FOUC prevention (theme bootstrap)

Inline script in `<head>` applies saved theme before first paint:
```html
<script dangerouslySetInnerHTML={{ __html: `
  (function(){
    try {
      var t = localStorage.getItem('mono-theme') || 'light';
      if (t !== 'light' && t !== 'dark') t = 'light';
      document.documentElement.setAttribute('data-theme', t);
    } catch(e) {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  })();
` }} />
```

- Reads `localStorage['mono-theme']` (defaults to `'light'`)
- Whitelists `'light'` / `'dark'` — any other value (including null) → `'light'`
- Sets `data-theme` attribute on `<html>` before React hydrates

## 5.5 Body wrapper

```tsx
<body className={`${unbounded.variable} ${jakarta.variable} ${jetbrains.variable} antialiased`}>
  {children}
  <Toaster />                              {/* shadcn/ui Toaster (default position) */}
  <SonnerToaster position="top-center" closeButton />  {/* Sonner toast notifications */}
</body>
```

- Three font CSS variables attached to body so they cascade to all children
- `antialiased` for font smoothing
- Two toast systems mounted: shadcn `<Toaster />` (radix-based) + Sonner's `<SonnerToaster />` (positioned top-center with close button)

## 5.6 Theme provider

**No explicit ThemeProvider component** wrapped around `{children}`. Theme is applied purely via the `data-theme` HTML attribute (set by inline bootstrap script and toggled by client code writing to `localStorage['mono-theme']` and updating `document.documentElement.setAttribute('data-theme', ...)`). The Monochrome Glass aesthetic is implemented in `globals.css` via `[data-theme="light"]` / `[data-theme="dark"]` selectors.

---

# PART 6 — REBUILD CHECKLIST (single interactive HTML file)

This checklist walks through reconstructing the entire app as a single interactive HTML file (with one HTML, one CSS block, and one JS bundle). It assumes you have a working backend proxy (Cloudflare Worker or similar) that forwards browser requests to the Uzbek government APIs (billing.sud.uz, jadval.sud.uz, jadvalapi.sud.uz, orginfo.uz, admin.chamber.uz) with CORS headers.

## Phase A — Skeleton & Design Tokens

1. **Create the HTML skeleton**:
   - `<!DOCTYPE html><html lang="uz" data-theme="light">`
   - `<head>` with: meta charset, viewport, title `"Sud To'lovlarini Qidiruv - billing.sud.uz kvitansiyalarini import qiluvchi vosita"`, the FOUC-prevention inline script (Part 5.4), Google Fonts links for Unbounded (500-800) + Inter (400-800, latin+cyrillic) + JetBrains Mono (400-700), and `<style>` block.
   - `<body>` with class `antialiased`.

2. **Define the CSS design tokens** in `:root` (Part 2 §2):
   - Pure grayscale 7-step ramp: `--void:#FFFFFF`, `--void-cream:#F8F8F8`, `--void-stone:#E8E8E8`, `--void-mid:#C0C0C0`, `--void-dark:#404040`, `--void-ink:#000000`
   - Translucent surfaces: `--surface:rgba(0,0,0,0.04)`, `--surface-2:rgba(0,0,0,0.02)`, `--surface-3:rgba(0,0,0,0.08)`
   - Borders: `--border:rgba(0,0,0,0.10)`, `--border-strong:rgba(0,0,0,0.22)`, `--border-soft:rgba(0,0,0,0.06)`
   - Text: `--text-1:#0A0A0A`, `--text-2:#595959`, `--text-3:#8C8C8C`
   - Accent: `--accent:#000000`, `--accent-dim:rgba(0,0,0,0.06)`
   - Panel/glass backgrounds, 3-level shadow system
   - Status colors aliased to `--accent`

3. **Define the dark theme overrides** under `[data-theme='dark']` (Part 2 §3):
   - `--void:#000000`, `--accent:#FFFFFF`, translucent white surfaces, deeper shadows

4. **Global reset** (Part 2 §4):
   - `* { box-sizing: border-box; border-radius: 0 !important; }` (with 5 circular exemptions: `.blob`, `.status-dot`, `.tor-badge .dot`, `.chip .dot`, `.copy-btn .dot`)
   - `body { background: var(--void); color: var(--text-1); font: 14px/1.5 var(--font-jakarta), system-ui, sans-serif; transition: background 0.25s, color 0.25s; }`

5. **Background layers** (Part 2 §5):
   - `.blob-field` (z=0, fixed) with 3 `.blob.b1/.b2/.b3` (50% size, 50% opacity, `filter: blur(60px)`, 22-26s `@keyframes drift1/2/3`)
   - `.grain` (z=1, fixed) with inline SVG fractalNoise at 3% opacity
   - `.shell` (z=2, `min-h-screen flex flex-col`, `position: relative`)

## Phase B — Layout Shell

6. **Header** (`.app-header`, sticky top, glassmorphism):
   - `.header-inner` with `.brand-mark` (Scale icon) + `.brand-text` (h1 `Sud Billing Lookup` + p `v137`)
   - `.header-right` with `<TorStatusBadge>`, `<ThemeToggle>`, external link `billing.sud.uz`

7. **Main content** (`.main-content`, `flex: 1`):
   - `.tabs-wrap > nav.liquid-rail[role="tablist"]` with 6 `.tab-btn` (To'lovlar / Sud ishlari / Sud majlislari / Kompaniya / Statistika / Kuzatuv)
   - 6 `.tab-panel` sections (only the active one has `is-active`)

8. **Footer** (`.app-footer`, `margin-top: auto`):
   - `<div className="footer-inner"><div className="footer-text">Sud Billing Lookup v137</div></div>`

## Phase C — Core Components

9. **Implement the CSS for every component class** (Part 2 §7 — 60+ classes). Key ones:
   - `.glass` (backdrop-filter: blur(24px) saturate(140%); linear-gradient white 0.55→0.42; 3px `::before` top accent bar)
   - `.panel` (bg `var(--panel-bg)`, border 1px `var(--border)`, padding 16-20px)
   - `.console-input` (borderless bottom-border input with `4px 4px 0 accent` brutalist focus shadow)
   - `.btn-primary` (bg `var(--accent)`, color `var(--void)`, uppercase 11px, letter-spacing 0.08em, `:hover` opacity 0.88)
   - `.badge` + 3 visual modes: neutral (bg `var(--surface-2)`), solid (bg `var(--accent)` color `var(--void)`), outline (border 1px `var(--accent)`)
   - `.bill-card`, `.case-card`, `.hearing-card`, `.watch-card`, `.rating-card`
   - `.summary-grid` (CSS grid: 2 col mobile → 3 col sm → 6 col lg, with `.is-split` divider variant)
   - `.donut-chart` (140×140 ring with `conic-gradient` + center label)
   - `.winrate-chart` (3 rows with bar track + fill + value)
   - `.trend-chart-container` (overflow-x: auto, SVG inside)

10. **Implement the JS state management**:
    - 6-tab state machine (default `'bills'`)
    - STIR input with `inputMode="numeric"`, `maxLength=9`, digit-strip on change
    - 5 localStorage keys: `mono-theme`, `sbl:recent-inns`, `sud-saved-companies`, `sud-watchlist`, `sb-cache:*`
    - 5-min client cache via `getCached/setCached/clearCached` + `cacheKey` builders

## Phase D — Bills Tab (streaming)

11. **STIR/Kvitansiya mode toggle** (default STIR), sample chips `302 678 824 / 305 543 087 / 301 201 019`, recent-searches chips (max 5, localStorage `sbl:recent-inns`).

12. **`runSearch(inn)`** — fetch `/api/bills?inn={STIR}` with streaming NDJSON reader:
    ```js
    const res = await fetch(`/api/bills?inn=${clean}`, { signal })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (!line.trim()) continue
        const msg = JSON.parse(line)
        if (msg.type === 'phase') setPhase({ phase: msg.phase, detail: msg.detail })
        else if (msg.type === 'meta') setTotal(msg.total)
        else if (msg.type === 'bill') { collected.push(msg.bill); setBills([...collected]); setLoaded(collected.length) }
        else if (msg.type === 'done') { upsertRecent(clean); toast.success(`${collected.length} ta to'lov import qilindi`) }
        else if (msg.type === 'error') throw new Error(msg.error)
      }
    }
    ```

13. **BillsLoadingState** — 4-step phase timeline (Ulanmoqda / Kirish / Qidirilmoqda / Tafsilotlar) when `total === 0`; progress bar `{loaded} / {total}` when `total > 0`; 3 shimmer skeletons.

14. **SummaryCards** — 6 cards with `useCountUp` animation (800ms cubic ease-out, delay `100 + idx*50`ms).

15. **BillCard** — expandable card with money-grid (5 cells), info-grid (Sud / Berilgan sana / Amal qilish muddati / Maqsad), expand button `Sud tomonidan ishlatilishi (N)` → usage table of case numbers.

16. **Filter bar** — sort dropdown (Avval yangi / Avval eski), 4 filter chips (To'langan / To'lanmagan / Davlat boji / Pochta), page-size selector (10/20/50/100), Excel download button.

17. **`<PageNav>`** — prev/numbered/next buttons.

## Phase E — Cases Tab

18. **Court-type toggle** (4: Iqtisodiy / Fuqarolik / Jinoyat / Ma'muriy). Mode auto-picks: economic/administrative → tin+caseNumber; civil/criminal → pinfl+caseNumber.

19. **`runSearchWith(value, mode, courtType)`** — validates `^\d{9}$` (TIN), `^\d{14}$` (PINFL), `^\d+-[\d-]+/\d+$` (case number); 5-min cache; fetch `/api/court-cases?courtType=${ct}&mode=${mode}&value=${v}`.

20. **CourtCaseCard** — case number + CopyButton, caseType, status badge, info-grid (Sud / Ariza berilgan sana / Da'vogar / Javobgar), expand → `<CaseDetailView>`.

21. **CaseDetailView** — fetch `/api/court-cases?courtType=${ct}&detail=${caseNumber}` → renders full case info (general + firstInstance + appellate + cassation), each instance has hearing timeline + decision + documents. PDF print button opens new window.

## Phase F — Hearings Tab

22. **Saved companies** (localStorage `sud-saved-companies`) — add form (STIR + name), company tiles with selected indicator + trash button.

23. **`fetchHearings(tin)`** — 5-min cache, fetch `/api/upcoming-hearings?tin=${tin}`, render `UpcomingHearingCard` list.

## Phase G — Company Tab

24. **`fetchCompany(tin)`** — 5-min cache, fetch `/api/company-info?tin=${tin}`.

25. **Render**: rating card (score/100, category badge, rating label) → quick actions bar (Sud ishlari / To'lovlar / Majlislar / orginfo.uz) → Asosiy ma'lumotlar panel → Faoliyat sohasi (OKED) panel → Asoschilar panel.

## Phase H — Stats Tab (the big one)

26. **`fetchStats(tin)`** — 5-min cache, fetch `/api/stats?tin=${tin}` (35s timeout). 3-phase loading indicator (orginfo.uz → 3 sud turi → tasniflash).

27. **5 folders**: Tahlil / Iqtisodiy / Fuqarolik / Ma'muriy / Majlislar. Folder nav with trapezoidal clip-path tabs.

28. **TAHLIL folder**:
    - Company banner (name + STIR + 4 stats)
    - Download toolbar (3 court-type chips + EXCEL YUKLASH button → POST `/api/stats/export`)
    - 4 summary cards (Jami ishlar / Yutdi / Yutqazdi / Neitral) — clickable to switch folder + outcome
    - Filter bar (Davr chips + Holat chips + Saralash dropdown)
    - Role breakdown (2 cards: Da'vogar / Javobgar with stacked bar)
    - Donut chart (conic-gradient with 4 segments + legend)
    - Win-rate bars (3 rows: IQTISODIY / FUQAROLIK / MA'MURIY)
    - **TrendChart** (SVG stacked-bar monthly trend — see §7.26 for full spec)
    - Court-type breakdown (3 cards, clickable)
    - Categories Top 5

29. **Court-type folders** (ECONOMIC / CIVIL / ADMINISTRATIVE): folder-header + filter bar + result-meta + case-list.

30. **MAJLISLAR folder** (lazy): when opened, fetch `/api/court-hearings?tin=${tin}&days=90` (120s timeout). Render hearing cards; click → hand-off to Cases tab.

31. **Compare mode** (v134): toggle + second STIR input + parallel fetch + `.compare-split` (2 columns with donut + winrate + summary cards) + `.compare-table` (7 rows, win-rate winner highlighted).

32. **`handleCaseClick(c)`** — converts StatsCase → CourtCase, calls `onViewCase(caseNumber, courtType, caseData)` for instant render in Cases tab (no re-fetch).

## Phase I — Watchlist Tab

33. **Watchlist** (localStorage `sud-watchlist`) — add form (STIR + name), `.watchlist-grid` of `.watch-card`s.

34. **`kickOffFetch(tin)`** — fires 3 parallel fetches (stats + rating + next hearing), each patches its own slice of `summaries[tin]`. Cards fill in independently.

35. **Watch-card** — 4 metrics (Jami ishlar / G'alaba % / Reyting / Keyingi majlis), click → `onViewInStats(tin)` (sets `pendingStatsTin`, switches to Stats tab, auto-fetches).

## Phase J — Cross-cutting Features

36. **Theme toggle** — `<button className="theme-toggle">` with Sun + Moon icons (CSS shows the right one). On click: toggle `data-theme` on `<html>`, persist to `localStorage['mono-theme']`.

37. **Tor status badge** — poll `/api/tor-status` every 15s (3s timeout). 3 states: checking (spinner) / active (green dot) / inactive (button → triggers hidden file input → `POST /api/tor-install` with FormData → poll until active or 60s timeout).

38. **Toasts** — sonner-style top-center toasts for success/error/info. Plus StatsTab's own inline bottom-center pill for copy/info messages.

39. **Excel exports**:
    - Bills: `POST /api/bills/export` with `{ bills: filteredBills }` → download `tolovlar-YYYY-MM-DD.xlsx`
    - Stats: `POST /api/stats/export` with `{ tin, courtTypes, cases, companyName }` → download `statistika-{tin}-YYYY-MM-DD.xlsx`
    - Both endpoints build OOXML `.xlsx` manually via jszip (NOT exceljs/sheetjs).

40. **PDF export** (case detail) — `window.open('', '_blank')` with full print-optimised HTML, auto-trigger `window.print()` 400ms after load.

## Phase K — Backend Proxy (Cloudflare Worker)

41. **Deploy a Cloudflare Worker** (or any CORS-proxy) that:
    - Accepts requests of form `https://worker.example.com/https://billing.sud.uz/api/invoice/checkStatus?...`
    - Rewrites the request with a full Chrome 124 fingerprint (UA, sec-ch-ua, sec-fetch-*)
    - Adds CORS headers (`Access-Control-Allow-Origin: *`)
    - Only proxies to a fixed allow-list of hosts: `billing.sud.uz`, `recaptcha.sud.uz`, `my.sud.uz`, `jadval.sud.uz`, `jadvalapi.sud.uz`, `jadval2.sud.uz`, `orginfo.uz`, `mib.uz`, `chamber.uz`, `admin.chamber.uz`, `ihamkor.uz`
    - Deploy 4 workers and round-robin through them (per-module counters) to distribute load

42. **Configure the captcha pipeline** (for billing.sud.uz only):
    - PoW challenge: `POST https://recaptcha.sud.uz/api/v1/captcha/pow/challenge` with `{ siteKey: 'site_bbdb0625df8a200e73f37ebccf0c62ac' }`
    - Solve PoW: SHA-256 hash `challenge + nonce` until `countLeadingZeroBits(hash) >= difficulty`
    - Analyze: `POST https://recaptcha.sud.uz/api/v1/captcha/analyze` with siteKey + action `'my_checks'` + PoW solution + synthesized browser signals
    - If `challengeRequired`: download the math image, solve via VLM (or human solver), `POST /api/v1/captcha/challenge/solve`
    - Returns `token` used in `/api/invoice/captcha/search?captchaToken=${token}`

## Phase L — Testing & Polish

43. **Test the 6 tabs** with demo STIR `302678824`:
    - Bills: should stream ~60 receipts with money-grid + usage table
    - Cases (economic): should list cases with expand → detail view
    - Hearings: add company, should list upcoming hearings
    - Company: should show rating 93/100 AA + basic info + OKED + founders
    - Stats: should show 5 folders, TrendChart with clickable month bars, Excel export
    - Watchlist: add company, should show 4 metrics filling in

44. **Test theme toggle** — light ↔ dark, persists across reloads.

45. **Test responsive breakpoints** — 560 / 640 / 720 / 900 / 1000 / 1024px. Tabs scroll horizontally on mobile. Summary grids collapse 6→3→2 cols. Money-grids collapse 5→2 cols.

46. **Test sticky footer** — short pages: footer pins to bottom. Long pages: footer pushed down naturally.

47. **Verify all Uzbek strings** match Part 1 §21 exactly (apostrophes `'` not `'`, Cyrillic status keys handled via the lookup maps).

48. **Verify `border-radius: 0`** everywhere except the 5 circular exemptions (blobs, status dots).

---

## Appendix A — External Services Map

| Host | Routes that use it | CF-Worker-routed? | Auth |
|---|---|---|---|
| `billing.sud.uz` | `/api/bills`, `/api/bills/export` | Yes (ProxyPool with health tracking + circuit breaker) | captchaToken |
| `recaptcha.sud.uz` | `/api/bills` (captcha pipeline) | Yes (captchaPool) | siteKey |
| `jadval.sud.uz` | `/api/court-cases`, `/api/court-hearings` | Yes | — (public) |
| `jadvalapi.sud.uz` | `/api/court-cases`, `/api/court-hearings`, `/api/upcoming-hearings` | Yes | — (public) |
| `jadval2.sud.uz` | (legacy, court-map.ts data source) | — | — |
| `orginfo.uz` | `/api/company`, `/api/company-info`, `/api/stats` | Yes | — (public) |
| `admin.chamber.uz` | `/api/company-info`, `/api/stats` | Yes | — (public) |
| `mib.uz` | `/api/mib-debt` | **No** (geo-blocks at TCP layer; uses direct fetch with manual redirect following) | session cookies + math captcha |
| `my.sud.uz` | (frontend link only, no API calls) | — | — |

## Appendix B — Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `CF_WORKER_URLS` | Comma-separated list of Cloudflare Worker URLs (preferred) | 4 hardcoded fallback workers |
| `CF_WORKER_URL` | Single Cloudflare Worker URL (legacy backward-compat) | — |

The 4 fallback workers (used when both env vars are missing):
```
https://broad-field-f2b0.uzwebfox.workers.dev/
https://wild-hall-04ae.uzwebfox.workers.dev/
https://orange-darkness-8843.najimsheikh071.workers.dev/
https://wandering-wind-1d3d.najimsheikh071.workers.dev/
```

Additional CORS proxies used by billing.ts ProxyPool (after CF Workers fail):
- `https://proxy.cors.sh/`
- `https://api.allorigins.win/raw?url=` (needs `encodeURIComponent`)
- `https://corsproxy.io/?url=`
- `https://api.codetabs.com/v1/proxy/?quest=`
- `https://thingproxy.freeboard.io/fetch/`

## Appendix C — In-Memory Caches

| Module | Cache | TTL |
|---|---|---|
| `billing.ts` | `ProxyPool` state (alive/dead per proxy) | per-process |
| `billing.ts` | `circuitBreaker` 521-counter | 30s when tripped |
| `orginfo.ts` | `tinCache: Map<string, TinCacheEntry>` | 24h |
| `mib.ts` | `sessionStore: Map<string, MibSession>` | 5 min |
| `cache.ts` (client) | localStorage `sb-cache:*` | 5 min (default) |
| `tor.ts` | `proxyAgent` singleton | per-process |

## Appendix D — Concurrency / Retry Summary

| Module | Concurrency | Retries |
|---|---|---|
| `billing.ts` `getFullBillData` | **6 workers** | 1 retry round (transient only) |
| `billing.ts` `getBillStatus` | sequential across proxies | 3 permanent-fail bail, then throw |
| `billing.ts` `searchBillsByInn` | 1 search at a time | 3 token regen × 3 same-token retries |
| `court-case.ts` `searchCourtCases` | both APIs in parallel | 1 retry on transient errors |
| `jadval2.ts` `scanDateRange` | 30 dates × 3 types = 90 parallel per batch | none |
| `stats.ts` `getCompanyStats` | 5 parallel (orginfo + chamber + 3 court types) | none at this layer |
| `orginfo.ts` `getCompanyByTin` | first 2 candidates in parallel | 1 retry in `fetchHtml` |

## Appendix E — User-Agents Used

- `billing.ts`: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36`
- `court-case.ts`: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36` (shorter)
- `orginfo.ts`: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36`
- `mib.ts`: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`

## Appendix F — Module Dependency Graph

```
stats.ts
  ├── court-case.ts (searchCourtCases)
  │     └── court-case-types.ts (types + status constants)
  ├── orginfo.ts (getCompanyByTin)
  └── chamber.ts (getCompanyRating)

billing.ts  (standalone — only crypto + ZAI VLM for captcha math)
jadval2.ts  (standalone — server-only)
court-map.ts (standalone — pure constants + functions)
mib.ts      (standalone — server-only)
tor.ts      (standalone — Node-only, currently unused by billing)
cache.ts    (standalone — client-only)
db.ts       (standalone — Prisma singleton)
utils.ts    (standalone — cn helper)
layout.tsx  (Next.js root)
```

---

**End of BUILD.md — Sud Billing Lookup v137 Complete Build Specification.**

This document contains every type, component, CSS class, API endpoint, library function, external service, constant, retry strategy, caching rule, Uzbek UI string, and rebuild step needed to reconstruct the entire application from scratch as an interactive single-page application. Total source documented: ~14,436 lines across 14 lib files + 13 API routes + 5809-line `page.tsx` + 4070-line `globals.css` + 85-line `layout.tsx`.
