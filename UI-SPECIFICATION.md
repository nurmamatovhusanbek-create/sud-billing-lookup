# Sud Billing Lookup — Complete UI Specification

> **Version**: v7 | **Framework**: Next.js 16 + Tailwind CSS 4 + shadcn/ui (New York)
> **Icons**: Lucide React | **Toasts**: Sonner | **Fonts**: Geist Sans + Geist Mono
> **Layout**: Responsive, mobile-first, sticky header + sticky footer, max-width 1152px (max-w-6xl)

---

## 1. Global Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (sticky, h-16, backdrop-blur)                       │
│  [Logo] Sud Billing Lookup          [Tor badge] [billing↗]  │
├─────────────────────────────────────────────────────────────┤
│  MAIN (flex-1, py-8 sm:py-10, space-y-8)                    │
│                                                             │
│  ┌─ Search Hero ─────────────────────────────────────────┐  │
│  │  H2: "Import every bill issued under a company"       │  │
│  │  Description paragraph                                │  │
│  │  [Building2 icon] [INN input ____] [Search bills]    │  │
│  │  Try: [302678824] [305543087] [301201019]            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ (state-dependent content) ───────────────────────────┐  │
│  │  Default / Loading / Error / No results / Results     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  FOOTER (sticky bottom, border-t, bg-muted/30)              │
│  Data sourced from billing.sud.uz  ·  For informational use │
└─────────────────────────────────────────────────────────────┘
```

**Root wrapper**: `<div className="min-h-screen flex flex-col bg-background">`
- The footer uses `mt-auto` so it sticks to the bottom when content is short,
  and gets pushed down naturally when content is long.

---

## 2. Header (sticky)

**Container**: `sticky top-0 z-40 border-b bg-background/80 backdrop-blur`
**Height**: `h-16` (64px)
**Inner**: `mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between gap-3`

### Left side — Logo + Title
```
┌─────────┐  Sud Billing Lookup
│  ⚖️     │  billing.sud.uz receipt importer
│ (9x9)   │  (subtitle hidden on mobile)
└─────────┘
```
- **Logo box**: `h-9 w-9 rounded-lg bg-primary text-primary-foreground`
- **Icon**: `Scale` (lucide), `h-5 w-5`
- **Title**: `font-semibold text-sm sm:text-base truncate`
- **Subtitle**: `text-[11px] text-muted-foreground hidden sm:block`

### Right side — Tor badge + External link

#### Tor Status Badge (3 states)

| State | Appearance | Icon | Color |
|-------|------------|------|-------|
| **checking** | `Loader2` spinner + "Checking Tor…" | 🔄 | Gray (`bg-muted/50`) |
| **active** | `Globe` + "Tor active" + pulsing dot | 🌐 | Green (`bg-emerald-50 text-emerald-700`) |
| **inactive** | `Globe` + "Tor not detected — click to install" | 🌐 | Amber (`bg-amber-50 text-amber-700`) |

- **Icon size**: `h-3 w-3`
- **Active dot**: `h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse`
- **Inactive state is clickable** — opens file picker to install Tor from `.tar.gz`
- **Badge style**: `variant="outline" gap-1.5 border`
- Mobile: text shortens to "Tor…", "Install Tor", "Installing…"

#### External link
- Text: `billing.sud.uz ↗`
- Style: `text-xs text-muted-foreground hover:text-foreground hidden md:inline`

#### Hidden file input
- `<input type="file" accept=".tar.gz,.tgz" className="hidden">` — triggered by Tor badge click

---

## 3. Search Hero

**Container**: `<section className="space-y-4">`

### Title + Description
- **H2**: `text-2xl sm:text-3xl font-bold tracking-tight` — "Import every bill issued under a company"
- **Description**: `text-muted-foreground text-sm sm:text-base max-w-2xl`
  - Mentions "Yuridik shaxs" (bold), davlat boji / pochta, court case numbers

### Search Form
```
┌──────────────────────────────────────┐  ┌──────────────┐
│ 🏢  Enter company INN / STIR (9 dig)│  │ 🔍 Search bills│
└──────────────────────────────────────┘  └──────────────┘
```
- **Layout**: `flex flex-col sm:flex-row gap-2 sm:gap-3`
- **Input wrapper**: `relative flex-1`
- **Building2 icon**: `absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`
- **Input**: `pl-10 h-12 text-base font-mono` (48px height, monospace font)
  - `inputMode="numeric" pattern="\d{9}" maxLength={9}`
  - Only digits, auto-strips non-digits
  - Disabled while loading
- **Button**: `size="lg" h-12 px-6 gap-2`
  - Icon: `Search` (h-4 w-4) or `Loader2` spinner when loading
  - Text: "Search bills" or `Searching… ${elapsed}s`
  - Disabled when `inn.length !== 9` or loading

### Sample INN buttons
```
Try: [302678824] [305543087] [301201019]
```
- Style: `font-mono px-2 py-0.5 rounded border bg-muted/40 hover:bg-muted text-xs`
- Disabled while loading

---

## 4. State: Default (no search yet)

3 feature cards in a grid (`grid-cols-1 md:grid-cols-3 gap-4`):

| Card | Icon | Title | Description |
|------|------|-------|-------------|
| 1 | `Receipt` (h-5 w-5) | Import all receipts | Every bill (kvitansiya) created under the INN is pulled from billing.sud.uz. |
| 2 | `Scale` (h-5 w-5) | See type & status | Each bill is tagged as davlat boji or pochta, with paid amount and payment status. |
| 3 | `Gavel` (h-5 w-5) | Court case numbers | For every receipt, the court that used it and the case / work number are listed. |

**Card style**: `border-border/70`, Content `p-5 space-y-2`
**Icon box**: `h-9 w-9 rounded-lg bg-primary/10`, icon `text-primary h-5 w-5`

---

## 5. State: Loading (with live phase timeline)

### Loading Card
**Container**: `<Card className="border-dashed">`, Content `p-6 space-y-4`

#### Current activity row
```
🔄  Looking up INN 302678824…
    Analyzing risk score…
    12s elapsed
```
- **Spinner**: `Loader2 h-6 w-6 animate-spin text-primary`
- **Title**: `font-medium` — "Looking up INN {inn}…" or "Importing bills for INN {inn}…"
- **Detail**: `text-sm text-muted-foreground` — live phase detail message
- **Elapsed**: `text-xs text-muted-foreground font-mono`

#### Phase step timeline (before bills stream in)
6 steps shown horizontally with connectors:

```
✅ Connecting → ✅ Proof-of-work → 🔄 Risk analysis → Searching → Fetching
   via Tor                                     (current)
```

| # | Phase key | Label | Icon |
|---|-----------|-------|------|
| 1 | `connecting` | Connecting via Tor | `Globe` |
| 2 | `captcha_pow` | Proof-of-work | `ShieldCheck` |
| 3 | `captcha_analyze` | Risk analysis | `ShieldCheck` |
| 4 | `captcha_math` | Math captcha (AI) | `ShieldCheck` |
| 5 | `searching` | Searching bills | `Search` |
| 6 | `enriching` | Fetching details | `Receipt` |

**Step states**:
- ✅ Done: `CheckCircle2 h-3 w-3 text-emerald-600`
- 🔄 Current: `Loader2 h-3 w-3 animate-spin` + `bg-primary/10 text-primary font-medium`
- ⬜ Pending: icon in `text-muted-foreground/50`
- Connector: `h-px w-4` — `bg-emerald-300` if done, `bg-border` otherwise
- Labels hidden on mobile (`hidden sm:inline`)

#### Progress bar (once bills start streaming)
```
Importing bills for INN 302678824…
15 / 60 bills loaded                    45s · 25%
██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Fetching each bill's court, amount, status and case numbers through Tor…
```
- **Counter**: `text-muted-foreground font-mono text-xs`
- **Bar**: `h-2 rounded-full bg-muted overflow-hidden`
- **Fill**: `h-full bg-primary transition-all duration-300`
- **Caption**: `text-xs text-muted-foreground`

#### Skeleton placeholders (before bills stream)
- 6 summary card skeletons: `h-24 rounded-lg`
- 2 bill card skeletons: `h-48 rounded-lg`

---

## 6. State: Error

**Alert** (`variant="destructive"`):
```
⚠️ Lookup failed
billing.sud.uz is temporarily unreachable — the server may be down or
rate-limiting. Please wait a moment and try again.
```
- **Icon**: `AlertCircle h-4 w-4`
- Smart message: detects "fetch failed" / "econnrefused" / "unreachable" → shows server-unreachable message

---

## 7. State: No Bills Found

**Card** (`border-dashed`, centered):
```
     📄
  No bills found
  No receipts were created under INN 302678824 on billing.sud.uz.
```
- **Icon circle**: `h-12 w-12 rounded-full bg-muted`, `Receipt h-6 w-6 text-muted-foreground`
- **Padding**: `p-10 text-center space-y-2`

---

## 8. State: Results (bills found)

### 8a. INN Bar
```
┌─────────────────────────────────────────────────────────────┐
│ 🏢  COMPANY INN                      Total: 60  15/60  ↻   │
│     302678824 [Copy]                              Refresh   │
└─────────────────────────────────────────────────────────────┘
```
- **Container**: `rounded-lg border bg-muted/30 px-4 py-3 flex flex-wrap justify-between`
- **Icon box**: `h-8 w-8 rounded-md bg-primary/10`, `Building2 h-4 w-4 text-primary`
- **Label**: `text-[11px] uppercase tracking-wide text-muted-foreground` — "Company INN"
- **Value**: `font-mono font-semibold` + CopyButton
- **Total**: `text-sm`, label muted, value `font-semibold`
- **Live counter** (during loading): `Loader2 h-3.5 w-3.5 animate-spin` + `font-mono text-xs`
- **Refresh button**: `variant="outline" size="sm" gap-1.5`, `RefreshCw h-3.5 w-3.5`

### 8b. Summary Cards (6 cards)
**Grid**: `grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3`

| # | Label | Icon | Icon color | Value format |
|---|-------|------|------------|--------------|
| 1 | TOTAL BILLS | `Receipt` | `text-primary` | Integer count |
| 2 | PAID | `CheckCircle2` | `text-emerald-600` | Integer count |
| 3 | UNPAID | `Clock` | `text-amber-600` | Integer count |
| 4 | TOTAL AMOUNT | `Wallet` | `text-primary` | Sum + "so'm" |
| 5 | TOTAL PAID | `CheckCircle2` | `text-emerald-600` | Sum + "so'm" |
| 6 | OUTSTANDING | `AlertCircle` | `text-amber-600` | Sum + "so'm" |

**Card style**: `border-border/70`, Content `p-4`
- **Label**: `text-[11px] uppercase tracking-wide text-muted-foreground`
- **Icon**: `h-4 w-4` (top-right)
- **Value**: `font-mono font-bold text-lg mt-1.5 leading-tight`
- **Sub**: `text-[11px] text-muted-foreground` — "so'm"
- **Amount format**: `Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2 })` — e.g. "266 759 193,00"

### 8c. Sort Filter
```
🔄 Sort by date:                          [Newest first ▾]
```
- **Layout**: `flex items-center justify-between gap-3 flex-wrap`
- **Icon**: `ArrowUpDown h-4 w-4 text-muted-foreground`
- **Label**: `text-sm text-muted-foreground` — "Sort by date:"
- **Select**: `w-[160px] h-9` with options:
  - `Newest first` (default)
  - `Oldest first`

### 8d. Bill Cards

Each bill is a Card (`overflow-hidden border-border/70 shadow-sm hover:shadow-md transition-shadow`):

#### Card Header
```
┌─────────────────────────────────────────────────────────────┐
│ #1  📄 252117820351 [Copy]     [Economic court] [Pochta] [Used] │
│     🏢 «ARTIKUL AZIYA KABEL» МЧЖ                              │
└─────────────────────────────────────────────────────────────┘
```
- **Index**: `text-xs font-medium text-muted-foreground` — "#1"
- **Bill number**: `CardTitle font-mono text-base break-all` + `Receipt h-4 w-4 text-primary`
- **CopyButton**: `Copy h-3 w-3` → `Check h-3 w-3 text-emerald-600` on copy
- **Payer**: `text-sm text-muted-foreground` + `Building2 h-3.5 w-3.5`
- **3 badges** (right side, `flex-wrap shrink-0 gap-2`):
  1. **CourtTypeBadge** — colored by court type (see below)
  2. **CategoryBadge** — Davlat boji / Pochta / other
  3. **StatusBadge** — payment status

#### Card Body — Money Row (5 cells)
**Grid**: `grid-cols-2 sm:grid-cols-5 gap-3`

| Cell | Label | Icon | Background | Text color |
|------|-------|------|------------|------------|
| 1 | RECEIPT AMOUNT | `Wallet h-3 w-3` | `bg-muted/30` | default |
| 2 | PAID | `CheckCircle2 h-3 w-3` | `bg-emerald-50/50` | `text-emerald-700` |
| 3 | UNPAID | `Clock h-3 w-3` | `bg-amber-50/50` | `text-amber-700` |
| 4 | SPENT | `Receipt h-3 w-3` | `bg-muted/30` | default |
| 5 | BALANCE | `Scale h-3 w-3` | `bg-muted/30` | default |

- **Cell style**: `rounded-lg border p-3`
- **Label**: `text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1`
- **Value**: `font-mono font-semibold text-sm mt-1` + "so'm" suffix (`text-muted-foreground text-xs`)

#### Card Body — Court + Dates (3 columns)
**Grid**: `grid-cols-1 sm:grid-cols-3 gap-3 text-sm`

| Column | Icon | Label | Value |
|--------|------|-------|-------|
| 1 | `Landmark h-4 w-4` | COURT | Court name (e.g. "Тошкент шаҳар суди") + instance |
| 2 | `Clock h-4 w-4` | CREATED | Date (e.g. "30 Jul 2025, 11:16") |
| 3 | `ShieldCheck h-4 w-4` | VALID UNTIL | Expiration date |

- **Icon**: `text-muted-foreground mt-0.5 shrink-0`
- **Label**: `text-[11px] uppercase tracking-wide text-muted-foreground`
- **Value**: `font-medium`
- **Date format**: `en-GB` — "30 Jul 2025, 11:16"

#### Card Body — Purpose + Description (optional)
- **Icon**: `FileText h-4 w-4 text-muted-foreground`
- Shows **Purpose** (e.g. "За подачу искового заявления") and **Type** (e.g. "Давлат божи (Государственная пошлина)")

#### Card Body — Error (if detail fetch failed)
**Alert** (`variant="destructive"`):
- **Icon**: `AlertCircle h-4 w-4`
- **Title**: "Detail unavailable"
- **Description**: `text-xs` — the error message

#### Card Body — Court Usage & Case Numbers (expandable)
**Accordion** (only shown if `historyList` has entries or `claimCaseNumber` exists):

```
▶ Court usage & case numbers (1)
```
- **Trigger**: `Gavel h-4 w-4 text-primary` + "Court usage & case numbers (N)"
- **Chevron**: auto from Accordion

**Expanded content**:

If `claimCaseNumber` exists — highlighted box:
```
# Claim case number: 4-1001-2508/22236  [Copy]
```
- Style: `rounded-md bg-muted/40 p-2.5 text-sm flex items-center gap-2`
- `Hash h-3.5 w-3.5 text-primary`

**Table** of history entries:
| Column | Content |
|--------|---------|
| Case / work number | `# h-3 w-3` + caseNumber (or `#caseId` fallback) + CopyButton |
| Status | Badge: "Used" (teal) or "Returned" (orange) |
| Amount | `font-mono text-xs text-right` + "so'm" |

- **Table headers**: `h-9`
- **Row cells**: `py-2`

---

## 9. Footer (sticky bottom)

**Container**: `mt-auto border-t bg-muted/30`
**Inner**: `mx-auto max-w-6xl px-4 sm:px-6 py-5 flex flex-col sm:flex-row justify-between gap-2 text-xs text-muted-foreground`

```
Data sourced live from billing.sud.uz (Yuridik shaxs path).
                                          For informational purposes only · verify on the official portal.
```

---

## 10. Badge Color Systems

### Status Badges (payment status)
| Status ID | Label | Icon | Color (light) |
|-----------|-------|------|---------------|
| `CREATED` | Not paid | `Clock` | Amber (`bg-amber-100 text-amber-800`) |
| `PARTIALLY_PAID` | Partially paid | `Clock` | Orange (`bg-orange-100 text-orange-800`) |
| `PAID` | Fully paid | `CheckCircle2` | Emerald (`bg-emerald-100 text-emerald-800`) |
| `CHECKING` | Awaiting confirmation | `Clock` | Sky (`bg-sky-100 text-sky-800`) |
| `CANCELLED` | Cancelled | `XCircle` | Rose (`bg-rose-100 text-rose-800`) |
| `USED` | Used | `CheckCircle2` | Teal (`bg-teal-100 text-teal-800`) |
| `BREAKED` | Error | `AlertCircle` | Rose (`bg-rose-100 text-rose-800`) |
| `SENT_TO_MIB` | Sent to BPI | `ShieldCheck` | Violet (`bg-violet-100 text-violet-800`) |

### Category Badges (payment type)
| Type | Label | Color |
|------|-------|-------|
| Pochta | "Pochta" | Cyan (`bg-cyan-100 text-cyan-800`) |
| Davlat boji | "Davlat boji" | Emerald (`bg-emerald-100 text-emerald-800`) |
| Other | Original text | Slate (`bg-slate-100 text-slate-800`) |

### Court Type Badges
| Type ID | Label | Color |
|---------|-------|-------|
| `CRIMINAL` | Criminal court | Rose (`bg-rose-100 text-rose-800`) |
| `CITIZEN` | Civil court | Sky (`bg-sky-100 text-sky-800`) |
| `ADMINISTRATIVE` | Administrative court | Violet (`bg-violet-100 text-violet-800`) |
| `ECONOMIC` | Economic court | Emerald (`bg-emerald-100 text-emerald-800`) |
| `MILITARY` | Military court | Amber (`bg-amber-100 text-amber-800`) |

All badges: `variant="outline" gap-1` + `Landmark h-3 w-3` icon
Dark mode variants included (e.g. `dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900`)

---

## 11. Toast Notifications (Sonner)

**Position**: `top-center`
**Props**: `richColors closeButton`

| Event | Type | Message |
|-------|------|---------|
| Bills imported | success | "Imported N bill(s)" |
| No bills found | info | "No bills found for this INN" |
| Tor installed | success | "Tor installed. Starting the proxy…" |
| Tor active | success | "Tor is active! You can now search bills." |
| Tor bootstrap timeout | error | "Tor installed but failed to bootstrap in 60s…" |
| Copy | success | "{label} copied" |
| Invalid INN | error | "INN must be exactly 9 digits" |
| Lookup failed | error | The error message |
| Install failed | error | The error message |

---

## 12. Icon Reference (all Lucide)

| Icon | Where used | Size |
|------|-----------|------|
| `Scale` | Header logo | h-5 w-5 |
| `Globe` | Tor badge (active/inactive), phase step | h-3 w-3 |
| `Loader2` | All spinners (loading, checking, installing) | h-3 w-3 to h-6 w-6 |
| `ShieldCheck` | Phase steps (PoW, analyze, math), valid-until, SENT_TO_MIB | h-3 w-3 to h-4 w-4 |
| `Search` | Search button, phase step | h-4 w-4 |
| `Building2` | INN input icon, INN bar, payer | h-3.5 w-3.5 to h-4 w-4 |
| `Receipt` | Bill number, spent amount, summary, phase, no-results | h-3 w-3 to h-6 w-6 |
| `Wallet` | Total amount (summary + bill card) | h-3 w-3 to h-4 w-4 |
| `CheckCircle2` | Paid status, paid amount, done phase | h-3 w-3 to h-4 w-4 |
| `Clock` | Unpaid, created date, CREATED/CHECKING status | h-3 w-3 to h-4 w-4 |
| `XCircle` | CANCELLED status | h-3 w-3 |
| `AlertCircle` | Error alert, outstanding, BREAKED status | h-3 w-3 to h-4 w-4 |
| `Landmark` | Court name, court type badge | h-3 w-3 to h-4 w-4 |
| `Gavel` | Court usage accordion | h-4 w-4 |
| `Hash` | Case numbers | h-3 w-3 to h-3.5 w-3.5 |
| `Copy` / `Check` | CopyButton | h-3 w-3 |
| `RefreshCw` | Refresh button | h-3.5 w-3.5 |
| `FileText` | Purpose/description | h-4 w-4 |
| `ArrowUpDown` | Sort label | h-4 w-4 |
| `ChevronDown` | Accordion trigger (auto) | default |

---

## 13. Typography & Spacing

| Element | Classes |
|---------|---------|
| Page title (H2) | `text-2xl sm:text-3xl font-bold tracking-tight` |
| Header title (H1) | `font-semibold text-sm sm:text-base` |
| Card title | `font-mono text-base` |
| Body text | `text-sm` |
| Small text | `text-xs` |
| Tiny labels | `text-[11px] uppercase tracking-wide text-muted-foreground` |
| Monospace values | `font-mono` (INN, bill numbers, amounts) |
| Section spacing | `space-y-8` (main), `space-y-6` (results), `space-y-4` (cards) |
| Card padding | `p-4` (summary), `p-5` (feature), `p-6` (loading), `p-10` (no-results) |

---

## 14. Responsive Breakpoints

| Breakpoint | Width | Changes |
|-----------|-------|---------|
| **mobile** (default) | <640px | Single column, stacked form, shortened labels, no subtitle |
| **sm** | ≥640px | Form goes horizontal, full labels show, subtitle appears |
| **md** | ≥768px | Summary cards 3 cols, feature cards 3 cols, external link shows |
| **lg** | ≥1024px | Summary cards 6 cols, money row 5 cols |

---

## 15. Color System (CSS variables from globals.css)

| Variable | Light | Dark |
|----------|-------|------|
| `--background` | `oklch(1 0 0)` (white) | `oklch(0.145 0 0)` (near-black) |
| `--foreground` | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |
| `--primary` | `oklch(0.205 0 0)` (near-black) | `oklch(0.922 0 0)` (near-white) |
| `--muted` | `oklch(0.97 0 0)` | `oklch(0.269 0 0)` |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` |
| `--destructive` | `oklch(0.577 0.245 27)` (red) | `oklch(0.704 0.191 22)` |

**Note**: The app avoids indigo/blue as primary colors (per design guidelines). Badge colors use semantic hues (emerald=success, amber=warning, rose=error, etc.).

---

## 16. Accessibility

- **Semantic HTML**: `header`, `main`, `footer`, `section`, `form`
- **ARIA labels**: INN input (`aria-label="Company INN"`), copy buttons (`aria-label="Copy {value}"`)
- **Keyboard**: All interactive elements are keyboard-accessible (buttons, inputs, accordion, select)
- **Screen readers**: `sr-only` available, hidden file input is `aria-hidden="true"`
- **Touch targets**: Minimum 44px (h-12 buttons, h-9 select)
- **Alt text**: Logo has implicit alt via title

---

*This document describes the UI as of v7. Generated from `src/app/page.tsx`, `src/app/layout.tsx`, and `src/app/globals.css`.*
