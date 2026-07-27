# Sud Billing Lookup

A comprehensive legal intelligence platform for Uzbekistan that aggregates court cases, billing records, company information, and contractor ratings from multiple government sources into a single unified interface.

## Features

### 6 Tabs

1. **To'lovlar (Bills)** — Search billing.sud.uz for all payment receipts by company STIR. Solves PoW captcha (SHA-256), streams results progressively, enriches each receipt with payment status, court details, and case numbers. Excel export with full bill details.

2. **Sud ishlari (Court Cases)** — Search my.sud.uz (jadval.sud.uz + jadvalapi.sud.uz) for court cases by STIR, PINFL, or case number. Full case details on expand: judge, hearings timeline, decisions, appellate + cassation instances. Full-text search within results. PDF export via browser print engine.

3. **Sud majlislari (Upcoming Hearings)** — Save companies and monitor their scheduled court hearings across 3 court types (economic, civil, administrative — criminal skipped for companies). Each hearing links to the full case detail.

4. **Kompaniya (Company Info)** — Fetches company profile from orginfo.uz (name, address, director, status, registration, capital, phone, email, founders) + contractor rating from chamber.uz (0-100 score, AAA-D category, taxpayer type, OKED industry code). Quick-action buttons link to other tabs.

5. **Statistika (Stats)** — Aggregates all court cases across 3 court types, classifies each as WIN/LOSE/NEUTRAL/PENDING based on company role (plaintiff vs defendant) and case outcome. Interactive SVG trend chart with clickable bars that show cases per month. Donut chart for outcome distribution. Win-rate bars per court type. Excel export. Company comparison mode (side-by-side). 5 folder tabs (TAHLIL analytics + 3 court-type case lists + MAJLISLAR hearing scanner).

6. **Kuzatuv (Watchlist)** — Multi-company monitoring dashboard. Add companies by STIR, see at-a-glance: total cases, win rate, contractor rating score + category, next hearing date. Click any card to jump to that company's stats.

### Key Technical Features

- **Cloudflare Workers** (4 workers, round-robin) — All requests to sud.uz / orginfo.uz / chamber.uz route through CF Workers with hardcoded fallback URLs. User IP is never exposed.
- **Progressive loading** — Bills stream in as they're fetched (NDJSON). Stats fire 4 API calls in parallel.
- **Client-side caching** — 5-minute localStorage cache for company info, stats, and case lists. 24-hour server-side cache for orginfo TIN lookups.
- **Excel export** — Both bills and stats can be exported to .xlsx (built manually with jszip — no Excel library dependency, no Turbopack issues).
- **PDF export** — Court case details can be printed to high-res PDF via browser print engine (vector text, no rasterization).
- **Appeal/Cassation instances** — Case details show appellate and cassation instances parsed from the API's `reviews` array.
- **Dark/Light theme** — Pure grayscale palette (white→black ramp), persists to localStorage, FOUC-prevented.
- **Monochrome Glass design** — Glassmorphism, sharp brutalist edges (border-radius:0), animated blob field + grain overlay, Inter + Unbounded + JetBrains Mono fonts.

### Data Sources

| Source | What it provides |
|--------|-----------------|
| billing.sud.uz | Payment receipts (kvitansiyalar), payment status, court fees |
| recaptcha.sud.uz | PoW captcha for billing.sud.uz |
| jadval.sud.uz | Court case search + details (older API, economic cases) |
| jadvalapi.sud.uz | Court case search + details (all court types), hearing schedule |
| orginfo.uz | Company profile (name, address, director, founders, OKED) |
| admin.chamber.uz | Contractor rating (0-100 score, AAA-D category, taxpayer type) |

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4 + custom CSS (Monochrome Glass design system)
- **Database**: Prisma ORM (SQLite)
- **Fonts**: Inter (body) + Unbounded (display) + JetBrains Mono (numbers) via next/font/google
- **Icons**: Lucide React
- **Excel**: jszip (manual .xlsx generation — no external Excel library)
- **Deployment**: Vercel (or any Node.js host)

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
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

## Documentation

- `WORKFLOW-MAP.md` — Complete workflow diagram + improvement opportunities
- `TAB-FUNCTION-MAP.md` — What each tab does + cross-tab linking
- `TAB-DESCRIPTIONS.md` — Plain-language descriptions of each tab
- `STATS-TAB-SPEC.md` — Stats tab specification (classification rules, folder structure)

## Version

Current: v136
