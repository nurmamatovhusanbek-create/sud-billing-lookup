# Sud Billing Lookup

A comprehensive legal intelligence platform for Uzbekistan that aggregates court cases, billing records, company information, and contractor ratings from multiple government sources into a single unified interface.

## Features

### 6 Tabs

1. **To'lovlar (Bills)** — Search billing.sud.uz for all payment receipts by company STIR. Solves PoW captcha (SHA-256), streams results progressively, enriches each receipt with payment status, court details, and case numbers. ReceiptView renders an actual styled cheque/receipt with serrated edges, barcode-style number, and dashed line items. Excel export with full bill details.

2. **Sud ishlari (Court Cases)** — Search my.sud.uz (jadval.sud.uz + jadvalapi.sud.uz) for court cases by STIR, PINFL, or case number. Full case details on expand: judge, hearings timeline, decisions, appellate + cassation instances. Full-text search within results. PDF export via browser print engine.

3. **Sud majlislari (Upcoming Hearings)** — Save companies and monitor their scheduled court hearings across 3 court types (economic, civil, administrative — criminal skipped for companies). Each hearing renders as a "docket ticket" with calendar tear-off date block. Each hearing links to the full case detail.

4. **Kompaniya (Company Info)** — Fetches company profile from orginfo.uz (name, address, director, status, registration, capital, phone, email, founders) + contractor rating from chamber.uz (0-100 score, AAA-D category, taxpayer type, OKED industry code). Rating displayed as conic-gradient ring (reuses Stats donut technique). Quick-action buttons link to other tabs.

5. **Statistika (Stats)** — Aggregates all court cases across 3 court types, classifies each as WIN/LOSE/NEUTRAL/PENDING based on company role (plaintiff vs defendant) and case outcome. Court type is re-classified by case number prefix (4-=economic, 2-/3-=civil, 5-=administrative). Interactive SVG trend chart with clickable bars that show cases per month. Donut chart for outcome distribution. Win-rate bars per court type. Excel export. Company comparison mode (side-by-side). 5 folder tabs (TAHLIL analytics + 3 court-type case lists + MAJLISLAR hearing scanner).

6. **Kuzatuv (Watchlist)** — Multi-company monitoring dashboard. Add companies by STIR, see at-a-glance: total cases, win rate, contractor rating score + category, next hearing date. Click any card to jump to that company's stats.

### Key Technical Features

- **Cloudflare Workers** (4 workers, round-robin) — All requests to sud.uz / orginfo.uz / chamber.uz route through CF Workers with hardcoded fallback URLs. User IP is never exposed.
- **curl-based TLS fingerprint bypass** — jadval.sud.uz does TLS fingerprinting (JA3/JA4) and blocks non-browser clients. System `curl` (via `spawn`, non-blocking) is used to bypass this, running in parallel with CF Worker + Node.js fetch attempts.
- **Parallel Race + BEST-OF** — For each API endpoint, ALL proxies (CF Workers + curl + direct fetch) fire simultaneously. The result with the MOST cases wins.
- **Server-side caching** — 60-second in-memory cache for court-case search results and stats. Deduplicates concurrent calls from Stats + Watchlist tabs.
- **Client-side caching** — 5-minute localStorage cache for company info, stats, and case lists. 24-hour server-side cache for orginfo TIN lookups. Force-refresh via "Yangilash" button.
- **Excel export** — Both bills and stats can be exported to .xlsx (built manually with jszip — no Excel library dependency, no Turbopack issues).
- **PDF export** — Court case details can be printed to high-res PDF via browser print engine (vector text, no rasterization).
- **Appeal/Cassation instances** — Case details show appellate and cassation instances parsed from the API's `reviews` array.
- **Dark/Light theme** — Pure grayscale palette (white→black ramp), persists to localStorage, FOUC-prevented.
- **Design system** — Radius tokens (--r-pill/--r-card/--r-field/--r-tag/--r-dot), spacing scale (--space-1..8), icon scale (--icon-sm/md/lg), motion token (--ease-surface). Each component declares its own radius in its own CSS block (no opt-in exemption lists).
- **Shared primitives** — DataStrip (replaces box-in-box pattern), CaseRefRow (reusable "related case" row with dot+text status), ReceiptView (styled cheque), unified Button component, SegmentedControl (tabs/folders).

### Data Sources

| Source | What it provides | Access Method |
|--------|-----------------|---------------|
| billing.sud.uz | Payment receipts (kvitansiyalar), payment status, court fees | CF Workers + PoW captcha |
| recaptcha.sud.uz | PoW captcha for billing.sud.uz + my.sud.uz | Direct (not blocked) |
| jadval.sud.uz | Court case search + details (ALL court types by TIN) | `curl` (TLS fingerprint bypass) + CF Workers |
| jadvalapi.sud.uz | Court case search + details (ECONOMIC/CIVIL/CONFLICT), hearing schedule | CF Workers + direct fetch |
| orginfo.uz | Company profile (name, address, director, founders, OKED) | CF Workers |
| admin.chamber.uz | Contractor rating (0-100 score, AAA-D category, taxpayer type) | CF Workers |

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + custom CSS (Monochrome Glass design system)
- **Database**: Prisma ORM (SQLite)
- **Fonts**: Inter (body + headings) + JetBrains Mono (code/numbers) via next/font/google
- **Icons**: Lucide React
- **Excel**: jszip (manual .xlsx generation — no external Excel library)
- **Deployment**: Vercel (or any Node.js host)

## Architecture

```
src/
  app/
    page.tsx              — Main UI (5700+ lines, 6 tabs, all components)
    layout.tsx            — Root layout (fonts, metadata, theme bootstrap)
    globals.css           — Design system (4900+ lines, radius/spacing/icon tokens)
    api/
      bills/              — Bills search + NDJSON streaming + Excel export
      bills/export/       — Excel export (POST with bill data)
      court-cases/        — Case search + detail fetch
      court-hearings/     — Hearing schedule scan (90-day window)
      upcoming-hearings/  — 3-court-type upcoming hearing aggregator
      company/            — orginfo.uz TIN lookup (tinOnly mode)
      company-info/       — Combined orginfo + chamber profile
      stats/              — Full stats aggregator (5 parallel fetches)
      stats/export/       — Excel export (POST with case data)
      mib-debt/           — MIB debt check (2-phase: prepare + submit)
      tor-status/         — TOR proxy status/spawn
      tor-install/        — TOR expert bundle upload + extract
  components/
    ui-custom/
      button.tsx          — Unified Button (primary/ghost/icon + sm)
      data-strip.tsx      — Shared field strip (replaces box-in-box)
      receipt-view.tsx    — Styled cheque/receipt component
      case-ref-row.tsx    — Shared "related case" row (dot+text + chevron)
      segmented-control.tsx — Unified tab/toggle/folder-nav primitive
    shared/
      badges.tsx          — 5 shared badge components
  lib/
    billing.ts            — billing.sud.uz scraper (ProxyPool, captcha, PoW)
    court-case.ts         — Court case fetcher (parallel race, BEST-OF, curl bypass)
    court-case-types.ts   — Shared types + status constants
    court-map.ts          — TIN/address → court-code mapping
    jadval2.ts            — jadval2.sud.uz hearing scanner
    orginfo.ts            — orginfo.uz company info (24h cache)
    chamber.ts            — chamber.uz contractor rating
    stats.ts              — Stats aggregator (classification, dedup, cache)
    mib.ts                — MIB debt check (Wicket AJAX)
    tor.ts                — TOR SOCKS5 proxy manager
    cache.ts              — Client-side localStorage cache (versioned)
    db.ts                 — Prisma client singleton
    utils.ts              — cn() helper
  cloudflare-worker/
    proxy.js              — CF Worker source (CORS proxy, browser headers)
```

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- `curl` installed on the system (for jadval.sud.uz TLS bypass)
- 4 Cloudflare Workers deployed (see `cloudflare-worker/proxy.js`)

### Installation

```bash
bun install
```

### Environment Variables

Create a `.env` file:

```
DATABASE_URL=file:./prisma/dev.db
CF_WORKER_URLS=https://your-worker1.workers.dev,https://your-worker2.workers.dev,https://your-worker3.workers.dev,https://your-worker4.workers.dev
```

### Deploy Cloudflare Workers

1. Go to https://dash.cloudflare.com → Workers & Pages → Create
2. Copy the contents of `cloudflare-worker/proxy.js` into the editor
3. Deploy 4 workers (for round-robin load balancing)
4. Add their URLs to `.env` as `CF_WORKER_URLS`

### Run

```bash
bun run dev
```

Open http://localhost:3000

## How Court Case Data Flows

1. User enters STIR (e.g. 200248856) → Stats tab calls `/api/stats?tin=200248856`
2. `getCompanyStats(tin)` fires 5 parallel fetches:
   - orginfo.uz → company name
   - chamber.uz → rating + name fallback
   - `searchCourtCases('economic', 'tin', tin)` → calls jadvalapi + jadval.sud.uz
   - `searchCourtCases('civil', 'tin', tin)` → calls jadvalapi CIVIL
   - `searchCourtCases('administrative', 'tin', tin)` → calls jadvalapi CONFLICT
3. For each API endpoint, ALL proxies fire in parallel:
   - 4 CF Workers (round-robin)
   - Direct Node.js fetch
   - `curl` via `spawn` (for jadval.sud.uz TLS bypass only)
4. BEST-OF: take the result with the MOST cases
5. Merge + deduplicate by case number
6. Re-classify court type by case number prefix (4-=economic, 2-/3-=civil, 5-=administrative)
7. Classify each case as WIN/LOSE/NEUTRAL/PENDING
8. Return to frontend → render in 5 folder tabs

See `STATS-DATA-FLOW.md` for the complete code walkthrough.

## Documentation

- `BUILD.md` — Complete 6994-line build specification (every type, component, CSS class, API endpoint)
- `STATS-DATA-FLOW.md` — Stats tab data flow + code walkthrough
- `STATS-INVESTIGATION.md` — API investigation + TLS fingerprinting findings
- `cloudflare-worker/proxy.js` — CF Worker source with deployment instructions

## Version

Current: v151
