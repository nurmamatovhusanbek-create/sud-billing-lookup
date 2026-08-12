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
- **curl-based TLS fingerprint bypass** — jadval.sud.uz does TLS fingerprinting (JA3/JA4) and blocks non-browser clients. System `curl` (via `execSync`, running through Git Bash) is used to bypass this, running in parallel with CF Worker + Node.js fetch attempts.
- **Parallel Race + BEST-OF** — For each API endpoint, ALL proxies (CF Workers + curl + direct fetch) fire simultaneously. The result with the MOST cases wins.
- **Server-side caching** — 60-second in-memory cache for court-case search results and stats. Deduplicates concurrent calls from Stats + Watchlist tabs.
- **Client-side caching** — 5-minute localStorage cache for company info, stats, and case lists. 24-hour server-side cache for orginfo TIN lookups. Force-refresh via "Yangilash" button.
- **Excel export** — Both bills and stats can be exported to .xlsx (built manually with jszip — no Excel library dependency, no Turbopack issues).
- **PDF export** — Court case details can be printed to high-res PDF via browser print engine (vector text, no rasterization).
- **Dark/Light theme** — Pure grayscale palette (white→black ramp), persists to localStorage, FOUC-prevented.
- **Design system** — Radius tokens (--r-pill/--r-card/--r-field/--r-tag/--r-dot), spacing scale (--space-1..8), icon scale (--icon-sm/md/lg), motion token (--ease-surface). Each component declares its own radius in its own CSS block.
- **Shared primitives** — DataStrip (replaces box-in-box pattern), CaseRefRow (reusable "related case" row with dot+text status), ReceiptView (styled cheque), unified Button component, SegmentedControl (tabs/folders).

### Data Sources

| Source | What it provides | Access Method |
|--------|-----------------|---------------|
| billing.sud.uz | Payment receipts (kvitansiyalar), payment status, court fees | CF Workers + PoW captcha |
| recaptcha.sud.uz | PoW captcha for billing.sud.uz | Direct (not blocked) |
| jadval.sud.uz | Court case search + details (ALL court types by TIN) | `curl` via execSync (TLS fingerprint bypass) + CF Workers |
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
- **Deployment**: Vercel, Render, or any Node.js host

---

## Installation Guide (Step by Step)

### Prerequisites

1. **Node.js 18+ or Bun** — Download from https://nodejs.org or https://bun.sh
2. **Git** — Download from https://git-scm.com
3. **curl** — Already installed on Windows 10+ (`C:\Windows\System32\curl.exe`) and all Linux/Mac systems
4. **A Cloudflare account** (free) — For deploying the proxy workers

### Step 1: Clone the Repository

```bash
git clone https://github.com/nurmamatovhusanbek-create/sud-billing-lookup.git
cd sud-billing-lookup
```

### Step 2: Install Dependencies

```bash
# Using Bun (recommended — faster)
bun install

# OR using npm
npm install
```

### Step 3: Deploy Cloudflare Workers (Required)

The app needs Cloudflare Workers to proxy requests to Uzbek government APIs (billing.sud.uz, jadval.sud.uz, orginfo.uz, etc.) without exposing your IP.

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create**
2. Name it `sud-proxy-1` (or anything you like)
3. Open the file `cloudflare-worker/proxy.js` from this repo
4. Copy the entire contents into the Cloudflare editor
5. Click **Deploy**
6. Copy your worker URL (e.g. `https://sud-proxy-1.your-name.workers.dev`)
7. **Repeat steps 2-6** to create 3 more workers (`sud-proxy-2`, `sud-proxy-3`, `sud-proxy-4`) — the app round-robins across 4 workers for load balancing

### Step 4: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Required: Your Cloudflare Worker URLs (comma-separated, no spaces)
CF_WORKER_URLS=https://sud-proxy-1.your-name.workers.dev,https://sud-proxy-2.your-name.workers.dev,https://sud-proxy-3.your-name.workers.dev,https://sud-proxy-4.your-name.workers.dev

# Required: Database URL (SQLite)
DATABASE_URL=file:./prisma/dev.db
```

> **Note:** If you skip the CF Worker setup, the app will still work but with hardcoded fallback workers (which may be rate-limited or blocked). For production use, always deploy your own workers.

### Step 5: Initialize the Database

```bash
bun run db:push
# OR: npx prisma db push
```

### Step 6: Run the App

```bash
bun run dev
# OR: npm run dev
```

Open http://localhost:3000 in your browser.

### Step 7: Verify It Works

1. Go to the **To'lovlar** tab → enter STIR `302678824` → click search
2. Go to the **Statistika** tab → enter STIR `302678824` → click "Statistikani ko'rish"
3. Go to the **Kompaniya** tab → enter STIR `302678824` → click "Ma'lumot olish"

If you see data, everything is working. If bills or stats return errors, check:
- Your CF Worker URLs are correct in `.env`
- The workers are deployed and accessible (visit the URL in a browser)
- Your internet connection allows HTTPS to `*.workers.dev`

---

## Deployment

### Deploy to Render (Free Tier)

1. Go to https://render.com → **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:
   - **Runtime**: Node.js
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**: Add `CF_WORKER_URLS` and `DATABASE_URL`
4. Click **Create Web Service**
5. Once deployed, set up [UptimeRobot](https://uptimerobot.com) to ping the URL every 5 minutes (prevents free-tier spin-down)

> **Note:** On Render (Linux), `curl` uses OpenSSL which has a different TLS fingerprint than Git Bash's MSYS2 curl. `jadval.sud.uz` may return fewer cases on Render than on your local machine. All other APIs (billing, orginfo, chamber, jadvalapi) will work normally.

### Deploy to Vercel

1. Go to https://vercel.com → **New Project** → import your repo
2. Framework preset: **Next.js**
3. Environment Variables: Add `CF_WORKER_URLS` and `DATABASE_URL`
4. Click **Deploy**
5. **Important:** Vercel Hobby tier caps serverless functions at 10 seconds. Bill lookups can take 60-90s. Upgrade to Vercel Pro for 60s timeout, or deploy to Render instead.

### Deploy to Any Node.js Host

```bash
# Build
bun run build

# Start production server
NODE_ENV=production bun .next/standalone/server.js
```

Make sure `CF_WORKER_URLS` and `DATABASE_URL` are set as environment variables.

---

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
   - `curl` via `execSync` (for jadval.sud.uz TLS bypass only)
4. BEST-OF: take the result with the MOST cases
5. Merge + deduplicate by case number
6. Re-classify court type by case number prefix (4-=economic, 2-/3-=civil, 5-=administrative)
7. Classify each case as WIN/LOSE/NEUTRAL/PENDING
8. Return to frontend → render in 5 folder tabs

See `STATS-DATA-FLOW.md` for the complete code walkthrough.

---

## Architecture

```
src/
  app/
    page.tsx              — Main UI (5600 lines, 6 tabs, all components)
    layout.tsx            — Root layout (fonts, metadata, theme bootstrap)
    globals.css           — Design system (4900 lines, radius/spacing/icon tokens)
    api/
      bills/              — Bills search + NDJSON streaming + Excel export
      court-cases/        — Case search + detail fetch
      court-hearings/     — Hearing schedule scan (90-day window)
      upcoming-hearings/  — 3-court-type upcoming hearing aggregator
      company/            — orginfo.uz TIN lookup
      company-info/       — Combined orginfo + chamber profile
      stats/              — Full stats aggregator (5 parallel fetches)
      stats/export/       — Excel export
      mib-debt/           — MIB debt check (2-phase)
      tor-status/         — TOR proxy status/spawn
      tor-install/        — TOR expert bundle upload
  components/
    ui-custom/            — Button, DataStrip, ReceiptView, CaseRefRow, SegmentedControl
    shared/              — Badges, Formatters
  lib/
    billing.ts            — billing.sud.uz scraper (ProxyPool, captcha, PoW)
    court-case.ts         — Court case fetcher (parallel race, curl bypass)
    court-case-types.ts   — Shared types + status constants
    court-map.ts          — TIN/address → court-code mapping
    jadval2.ts            — jadval2.sud.uz hearing scanner
    orginfo.ts            — orginfo.uz company info (24h cache)
    chamber.ts            — chamber.uz contractor rating
    stats.ts              — Stats aggregator (classification, dedup, cache)
    mib.ts                — MIB debt check (Wicket AJAX)
    tor.ts                — TOR SOCKS5 proxy manager
    cache.ts              — Client-side localStorage cache (versioned)
    cf-worker-pool.ts     — Shared CF Worker URL pool (round-robin)
    local-lists.ts        — Unified localStorage list helpers
    db.ts                 — Prisma client singleton
    utils.ts              — cn() helper
  cloudflare-worker/
    proxy.js              — CF Worker source (CORS proxy, browser headers)
  prisma/
    schema.prisma         — Database schema
  public/
    logo.svg              — App favicon/logo
```

## Documentation

- `BUILD.md` — Complete 6994-line build specification (every type, component, CSS class, API endpoint)
- `STATS-DATA-FLOW.md` — Stats tab data flow + code walkthrough
- `STATS-INVESTIGATION.md` — TLS fingerprinting investigation findings
- `cloudflare-worker/proxy.js` — CF Worker source with deployment instructions

## Version

Current: v152
