# Stats Tab — Complete Data Flow & Code Walkthrough

> **Purpose:** This document traces the exact path data takes from the user typing a STIR to cases appearing in the Stats tab. Every function, every API call, every filter, every classification — with the actual current code and line-by-line explanations.

---

## Table of Contents

1. [The Big Picture — 5-Layer Flow](#1-the-big-picture--5-layer-flow)
2. [Layer 1: Frontend Trigger (page.tsx → fetchStats)](#layer-1-frontend-trigger)
3. [Layer 2: API Route (/api/stats)](#layer-2-api-route)
4. [Layer 3: Stats Aggregator (stats.ts → getCompanyStats)](#layer-3-stats-aggregator)
5. [Layer 4: Court Case Fetcher (court-case.ts → searchCourtCases)](#layer-4-court-case-fetcher)
6. [Layer 5: Classification & Filtering (stats.ts → classifyCase + classifyOutcome)](#layer-5-classification--filtering)
7. [Where It Breaks — Known Failure Points](#7-where-it-breaks--known-failure-points)
8. [The External APIs — What They Actually Return](#8-the-external-apis--what-they-actually-return)

---

## 1. The Big Picture — 5-Layer Flow

```
User types STIR 302678824 → clicks "Statistikani ko'rish"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: Frontend (page.tsx)                            │
│ fetchStats(tin) → checks client cache → fetch API       │
└─────────────────────────────────────────────────────────┘
         │
         ▼  GET /api/stats?tin=302678824
┌─────────────────────────────────────────────────────────┐
│ LAYER 2: API Route (src/app/api/stats/route.ts)         │
│ Validates TIN → 60s timeout → calls getCompanyStats()   │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 3: Stats Aggregator (src/lib/stats.ts)            │
│ Checks server cache → fires 5 parallel fetches:         │
│   1. orginfo.uz     → company name                      │
│   2. chamber.uz     → rating + name fallback            │
│   3. searchCourtCases('economic', 'tin', tin)           │
│   4. searchCourtCases('civil', 'tin', tin)              │
│   5. searchCourtCases('administrative', 'tin', tin)     │
│ → classifies each case → deduplicates → returns         │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 4: Court Case Fetcher (src/lib/court-case.ts)     │
│ For each court type, calls 2 APIs in parallel:          │
│   - jadvalapi.sud.uz/online-monitoring/{TYPE}/findByTin │
│   - jadval.sud.uz/case/findByTin (economic only)        │
│ Each API called through 4 CF Workers simultaneously     │
│ (PARALLEL RACE + BEST-OF — takes result with most cases)│
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 5: Classification (stats.ts)                      │
│ For each raw case:                                      │
│   1. Determine role: plaintiff or defendant?            │
│      (name-match company against plaintiff/defendant)   │
│   2. Classify outcome: WIN / LOSE / NEUTRAL / PENDING   │
│      (keyword match on Cyrillic + Latin result text)    │
│ Returns { company, cases[], summary, errors[] }         │
└─────────────────────────────────────────────────────────┘
         │
         ▼
Frontend receives JSON → renders in StatsTab
```

---

## Layer 1: Frontend Trigger

**File:** `src/app/page.tsx` — `StatsTab` component, `fetchStats` function (~line 3473)

### What happens when the user clicks "Statistikani ko'rish"

```tsx
const fetchStats = useCallback(async (tin: string, force = false) => {
  // Step 1: Validate TIN is exactly 9 digits
  if (!/^\d{9}$/.test(tin)) {
    setError("STIR aynan 9 ta raqamdan iborat bo'lishi kerak")
    return
  }

  // Step 2: Check 5-minute client-side cache (localStorage)
  // Key: sb-cache-v148:stats:302678824
  const cacheK = cacheKey.stats(tin)
  if (!force) {
    const cached = getCached<Omit<StatsResponseOk, 'ok'>>(cacheK)
    if (cached) {
      // Cache HIT — instantly render, no API call
      setData(cached)
      setActiveFolder('tahlil')
      setOutcome('all')
      setDateSpan('all')
      setPhase(3)  // Skip loading animation
      toast.success("Statistika keshdan yuklandi")
      return
    }
  } else {
    // Force-refresh: user clicked search again for same TIN
    // Clear the cache so we fetch fresh data
    clearCached(cacheK)
  }

  // Step 3: Start loading state
  setLoading(true)
  setError(null)
  setData(null)
  setActiveFolder('tahlil')
  setOutcome('all')
  setDateSpan('all')
  setPhase(1)  // Show phase 1 of loading animation

  try {
    // Step 4: After 600ms, advance to phase 2 (shows "3 sud turi" step)
    setTimeout(() => setPhase(2), 600)

    // Step 5: Call the API with 70-second timeout
    const res = await fetch(`/api/stats?tin=${encodeURIComponent(tin)}`, {
      signal: AbortSignal.timeout(70000),
    })
    const json = (await res.json()) as StatsResponseOk | StatsResponseErr

    if (!json.ok) throw new Error(json.error || "Statistikani olib bo'lmadi")

    // Step 6: Store in state + cache for next visit
    const payload = {
      company: json.company,
      cases: json.cases,
      summary: json.summary,
      errors: json.errors || [],
    }
    setData(payload)
    setCached(cacheK, payload)  // Cache for 5 minutes
    setPhase(3)  // Loading complete
  } catch (e) {
    setError(e instanceof Error ? e.message : "Statistikani olib bo'lmadi")
    setPhase(0)
  } finally {
    setLoading(false)
  }
}, [])
```

### Key decisions in this layer:

1. **Client cache (5 min):** The Stats tab is heavy — 5 parallel API calls. If the user navigates away and comes back within 5 minutes, they get instant cached results. The `force` parameter bypasses this when the user clicks search again for the same TIN.

2. **Force-refresh logic:** When the user clicks "Statistikani ko'rish" for a TIN that's already loaded, `force=true` is passed, clearing the cache and fetching fresh data.

3. **70-second timeout:** The backend has a 60-second timeout, so the frontend gives 70 seconds (10s buffer) before aborting.

---

## Layer 2: API Route

**File:** `src/app/api/stats/route.ts`

### What happens when `/api/stats?tin=302678824` is called

```typescript
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90  // Next.js function timeout

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tin = (searchParams.get('tin') || '').trim()

  // Step 1: Validate TIN
  if (!tin || !/^\d{9}$/.test(tin)) {
    return NextResponse.json(
      { ok: false, error: "STIR aynan 9 ta raqamdan iborat bo'lishi kerak" },
      { status: 400 },
    )
  }

  // Step 2: Race between the actual fetch and a 60-second timeout
  const timeout = new Promise<{ ok: false; error: string }>((resolve) => {
    setTimeout(
      () => resolve({ ok: false, error: "So'rov vaqti tugadi (60s). Qayta urinib ko'ring." }),
      60000,
    )
  })

  try {
    const result = await Promise.race([
      getCompanyStats(tin),  // ← The actual work happens here
      timeout,
    ])

    // If timeout fired first, return 504
    if ('ok' in result && result.ok === false) {
      return NextResponse.json(result, { status: 504 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Statistikani olib bo\'lmadi' },
      { status: 502 },
    )
  }
}
```

### Response shape:

```typescript
// Success:
{
  ok: true,
  company: { name: "ANDIJONKABEL AJ", tin: "302678824", region: "...", status: "..." },
  cases: [
    {
      caseNumber: "4-1001-2605/14720",
      courtType: "economic",       // "economic" | "civil" | "administrative"
      regDate: "15.05.2025",       // DD.MM.YYYY
      result: "Тўлиқ қаноatlantirilgan",
      classification: "win",       // "win" | "lose" | "neutral" | "pending"
      role: "plaintiff",           // "plaintiff" | "defendant"
      court: "Тошкент туманлараро иқтисодий суди",
      category: "Маҳсулот етказиб бериш шартномаси",
      counterparty: "O'ZBEKKIMYOMASH ZAVODI AJ"
    },
    // ... 52 more cases
  ],
  summary: {
    total: 53,
    win: 26,
    lose: 15,
    neutral: 10,
    pending: 2,
    asPlaintiff: 40,
    asDefendant: 13
  },
  errors: []  // e.g. [{ courtType: "administrative", error: "HTTP 404" }]
}

// Failure:
{ ok: false, error: "So'rov vaqti tugadi (60s)..." }
```

---

## Layer 3: Stats Aggregator

**File:** `src/lib/stats.ts` — `getCompanyStats(tin)`

### This is the brain of the operation. It orchestrates 5 parallel fetches.

```typescript
export async function getCompanyStats(tin: string): Promise<CompanyStats> {
  console.log(`[stats] building stats for TIN ${tin}`)

  // ─── SERVER CACHE (60 seconds) ───
  // If the Stats tab and Watchlist tab both load the same TIN simultaneously,
  // this prevents 2 identical fetches. The FIRST call fetches; the second
  // gets the cached result.
  const cached = statsCache.get(tin)
  if (cached && Date.now() - cached.ts < STATS_CACHE_TTL) {
    console.log(`[stats] ${tin}: returning cached result`)
    return cached.result
  }

  // Store the PROMISE (not the result) so concurrent calls share it
  const fetchPromise = fetchCompanyStatsInternal(tin)
  statsCache.set(tin, { result: fetchPromise, ts: Date.now() })

  return fetchPromise
}
```

### The actual fetch — 5 parallel calls:

```typescript
async function fetchCompanyStatsInternal(tin: string): Promise<CompanyStats> {

  // ─── FIRE ALL 5 FETCHES IN PARALLEL ───
  // Promise.allSettled = wait for ALL to finish (success or failure),
  // don't let one failure kill the others.
  const courtTypes: StatsCourtType[] = ['economic', 'civil', 'administrative']

  const [orginfoResult, chamberResult, ...courtResults] = await Promise.allSettled([
    getCompanyByTin(tin),           // 1. orginfo.uz → company name + address
    getCompanyRating(tin),          // 2. chamber.uz → rating + name fallback
    searchCourtCases('economic', 'tin', tin),     // 3. Economic cases
    searchCourtCases('civil', 'tin', tin),        // 4. Civil cases
    searchCourtCases('administrative', 'tin', tin), // 5. Administrative cases
  ])

  // ─── PROCESS COMPANY NAME (with fallbacks) ───
  let company: CompanyStatsCompany
  let companyNameNorm = ''

  // Try chamber.uz first for the name (in case orginfo fails)
  let chamberName = ''
  if (chamberResult.status === 'fulfilled' && chamberResult.value) {
    chamberName = chamberResult.value.name || chamberResult.value.nameLat || ''
  }

  if (orginfoResult.status === 'fulfilled' && orginfoResult.value) {
    // orginfo succeeded — use its name (most reliable)
    const info = orginfoResult.value
    const name = info.shortName || info.officialName || chamberName || `STIR ${tin}`
    company = { name, tin: info.tin || tin, region: info.address, ... }
    companyNameNorm = normalizeName(name)
  } else if (chamberName) {
    // orginfo failed — fall back to chamber.uz name
    company = { name: chamberName, tin, ... }
    companyNameNorm = normalizeName(chamberName)
  } else {
    // Both failed — use TIN as the name (matching will be looser)
    company = { name: `STIR ${tin}`, tin }
  }

  // ─── PROCESS COURT CASES ───
  const errors: CourtTypeError[] = []
  const allCases: CaseWithClassification[] = []

  // courtResults[0] = economic, courtResults[1] = civil, courtResults[2] = administrative
  courtResults.forEach((res, i) => {
    const ct = courtTypes[i]
    if (res.status === 'fulfilled') {
      // SUCCESS — classify each raw case
      for (const raw of res.value) {
        const cwc = classifyCase(raw, ct, companyNameNorm, tin)
        if (cwc) allCases.push(cwc)
      }
    } else {
      // FAILURE — record the error, continue with other court types
      errors.push({ courtType: ct, error: res.reason.message })
    }
  })

  // ─── DEDUPLICATE by case number ───
  // A case might appear in both jadval.sud.uz AND jadvalapi.sud.uz
  // searchCourtCases already dedupes within itself, but we guard here too.
  const seen = new Set<string>()
  const deduped: CaseWithClassification[] = []
  for (const c of allCases) {
    if (c.caseNumber && !seen.has(c.caseNumber)) {
      seen.add(c.caseNumber)
      deduped.push(c)
    }
  }

  // ─── COMPUTE SUMMARY ───
  const summary = {
    total: deduped.length,
    win: 0, lose: 0, neutral: 0, pending: 0,
    asPlaintiff: 0, asDefendant: 0,
  }
  for (const c of deduped) {
    summary[c.classification]++
    if (c.role === 'plaintiff') summary.asPlaintiff++
    else summary.asDefendant++
  }

  return { company, cases: deduped, summary, errors }
}
```

### Why 5 parallel calls?

| # | What | Why | Timeout |
|---|---|---|---|
| 1 | `getCompanyByTin(tin)` | orginfo.uz — gets the canonical company name. Needed for plaintiff/defendant matching. | 6s |
| 2 | `getCompanyRating(tin)` | chamber.uz — gets the contractor rating (0-100, AAA-D). Also a name fallback if orginfo fails. | 10s |
| 3 | `searchCourtCases('economic', 'tin', tin)` | jadvalapi + jadval.sud.uz — economic cases (the bulk, 50-100 cases) | 10-20s |
| 4 | `searchCourtCases('civil', 'tin', tin)` | jadvalapi — civil cases (usually 2-5 cases) | 10s |
| 5 | `searchCourtCases('administrative', 'tin', tin)` | jadvalapi — administrative/conflict cases (usually 0-3 cases) | 10s |

All 5 fire at the same instant. The total time is the SLOWEST one (usually economic at 10-20s), not the sum.

---

## Layer 4: Court Case Fetcher

**File:** `src/lib/court-case.ts` — `searchCourtCases(courtType, mode, value)`

### This is where the actual HTTP requests happen. It's the most complex layer.

#### Step 1: Check server cache (60s)

```typescript
export async function searchCourtCases(
  courtType: CourtType,
  mode: SearchMode,
  value: string,
): Promise<CourtCase[]> {
  const encodedValue = mode === 'caseNumber' ? value.replace('/', '@') : value

  // Cache key: "economic:tin:302678824"
  const cacheKey = `${courtType}:${mode}:${encodedValue}`
  const cached = courtCaseCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < COURT_CASE_CACHE_TTL) {
    return cached.result  // Cache hit — instant return
  }

  // Cache miss — fire the actual fetch
  const fetchPromise = searchCourtCasesInternal(courtType, mode, value, encodedValue)
  courtCaseCache.set(cacheKey, { result: fetchPromise, ts: Date.now() })
  return fetchPromise
}
```

#### Step 2: Determine which APIs to call

```typescript
function getApiConfig(courtType: CourtType, mode: SearchMode, value: string): ApiConfig[] {
  const configs: ApiConfig[] = []

  // For economic + tin mode, we call TWO APIs:
  if (courtType === 'economic' && mode === 'tin') {
    // API 1: jadvalapi.sud.uz (newer, returns 6-100 cases)
    configs.push({
      url: `https://jadvalapi.sud.uz/online-monitoring/ECONOMIC/findByTin/${value}`,
      mapper: mapJadvalApiCase,
    })
    // API 2: jadval.sud.uz (older, returns 50-94 cases — the bulk)
    configs.push({
      url: `https://jadval.sud.uz/case/findByTin/${value}`,
      mapper: mapJadvalCase,
    })
  }

  // For civil + tin mode, only ONE API:
  if (courtType === 'civil' && mode === 'tin') {
    configs.push({
      url: `https://jadvalapi.sud.uz/online-monitoring/CIVIL/findByTin/${value}`,
      mapper: mapJadvalApiCase,
    })
  }

  // For administrative + tin mode, only ONE API:
  if (courtType === 'administrative' && mode === 'tin') {
    configs.push({
      url: `https://jadvalapi.sud.uz/online-monitoring/CONFLICT/findByTin/${value}`,
      mapper: mapJadvalApiCase,
    })
  }

  return configs
}
```

#### Step 3: For each API URL, fire ALL CF Workers in PARALLEL

This is the v140 "PARALLEL RACE + BEST-OF" architecture:

```typescript
async function searchCourtCasesInternal(...): Promise<CourtCase[]> {
  const apiConfig = getApiConfig(courtType, mode, encodedValue)

  // Build the list of 4 CF Worker URLs
  const allWorkers = [
    'https://broad-field-f2b0.uzwebfox.workers.dev/',
    'https://wild-hall-04ae.uzwebfox.workers.dev/',
    'https://orange-darkness-8843.najimsheikh071.workers.dev/',
    'https://wandering-wind-1d3d.najimsheikh071.workers.dev/',
  ]

  // For EACH API endpoint, fire ALL 4 workers simultaneously
  const promises = apiConfig.map(async ({ url, mapper }) => {
    const proxyUrls = allWorkers.map(w => w + url)  // 4 worker URLs

    // Fire ALL 4 workers at the same time
    const fetchPromises = proxyUrls.map(async (proxyUrl) => {
      const res = await fetch(proxyUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://my.sud.uz/court-case',
        },
        signal: AbortSignal.timeout(10000),  // 10-second timeout per worker
      })

      if (!res.ok) {
        if (res.status === 404 || res.status === 410) {
          throw new Error('DEFINITIVE_NOT_FOUND')  // Endpoint doesn't exist
        }
        throw new Error(`HTTP ${res.status}`)
      }

      const text = await res.text()
      const data = JSON.parse(text)
      const items = Array.isArray(data) ? data : (data.data || [])
      return items.map(mapper)  // Convert raw API response → CourtCase objects
    })

    // ─── BEST-OF STRATEGY ───
    // Wait for ALL workers to settle, then take the one with the MOST cases.
    // Why? jadvalapi sometimes returns 6 cases, other times 100 — depends on
    // server load and rate limiting. jadval.sud.uz sometimes returns 94, other
    // times returns "Иш топилмади" (not found). Taking the best ensures we
    // always get the maximum available data.
    const allSettled = await Promise.allSettled(fetchPromises)

    // If ANY worker got a definitive 404, the endpoint doesn't exist
    for (const r of allSettled) {
      if (r.status === 'rejected' && r.reason?.message?.startsWith('DEFINITIVE_NOT_FOUND')) {
        return []  // e.g. CONFLICT/findByTin returns 404
      }
    }

    // Collect all successful results
    const successes = allSettled
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)

    if (successes.length === 0) {
      // All 4 workers failed — retry with 15s timeout, then 20s timeout
      // (retry logic omitted for brevity — 3 total attempts)
      return []
    }

    // ─── TAKE THE RESULT WITH THE MOST CASES ───
    successes.sort((a, b) => b.length - a.length)
    return successes[0]  // Best result
  })

  // Merge results from all API endpoints (jadvalapi + jadval.sud.uz)
  const results = await Promise.all(promises)

  // Deduplicate by case number
  const merged: CourtCase[] = []
  const seen = new Set<string>()
  for (const items of results) {
    for (const item of items) {
      if (item.caseNumber && !seen.has(item.caseNumber)) {
        seen.add(item.caseNumber)
        merged.push(item)
      }
    }
  }

  return merged
}
```

### Visual: The parallel race for economic cases

```
searchCourtCases('economic', 'tin', '302678824')
│
├── API 1: jadvalapi.sud.uz/online-monitoring/ECONOMIC/findByTin/302678824
│   ├── Worker 1: broad-field-f2b0.uzwebfox.workers.dev/  → 6 cases
│   ├── Worker 2: wild-hall-04ae.uzwebfox.workers.dev/    → 6 cases
│   ├── Worker 3: orange-darkness-8843.workers.dev/       → 6 cases
│   └── Worker 4: wandering-wind-1d3d.workers.dev/        → timeout
│   └── BEST-OF: 6 cases (all workers that succeeded returned 6)
│
├── API 2: jadval.sud.uz/case/findByTin/302678824
│   ├── Worker 1: broad-field-f2b0.uzwebfox.workers.dev/  → 94 cases ✓
│   ├── Worker 2: wild-hall-04ae.uzwebfox.workers.dev/    → 94 cases ✓
│   ├── Worker 3: orange-darkness-8843.workers.dev/       → timeout
│   └── Worker 4: wandering-wind-1d3d.workers.dev/        → "Иш топилмади"
│   └── BEST-OF: 94 cases (Worker 1 and 2 both got 94)
│
└── MERGE + DEDUP: 94 + 6 = 100 unique cases (deduped by case number)
    (jadval.sud.uz returns the bulk; jadvalapi adds 6 that jadval.sud.uz doesn't have)
```

---

## Layer 5: Classification & Filtering

**File:** `src/lib/stats.ts` — `classifyCase()` + `classifyOutcome()`

### For every raw case, two decisions are made:

1. **What role did the company play?** (plaintiff or defendant)
2. **What was the outcome?** (win, lose, neutral, or pending)

#### Step 1: Determine role (plaintiff vs defendant)

```typescript
function classifyCase(
  raw: CourtCase,
  courtType: StatsCourtType,
  companyNameNorm: string,  // normalized company name from orginfo
  tin: string,
): CaseWithClassification | null {
  if (!raw || !raw.caseNumber || raw.caseNumber === '—') return null

  const plaintiffRaw = raw.plaintiff || ''
  const defendantRaw = raw.defendant || ''

  let role: PartyRole

  // Strategy 1: Name-match the company against the plaintiff field
  if (companyNameNorm && nameMatches(companyNameNorm, normalizeName(plaintiffRaw))) {
    role = 'plaintiff'
  }
  // Strategy 2: Name-match the company against the defendant field
  else if (companyNameNorm && nameMatches(companyNameNorm, normalizeName(defendantRaw))) {
    role = 'defendant'
  }
  // Strategy 3: TIN appears as substring in plaintiff field
  else if (plaintiffRaw.includes(tin)) {
    role = 'plaintiff'
  }
  // Strategy 4: TIN appears as substring in defendant field
  else if (defendantRaw.includes(tin)) {
    role = 'defendant'
  }
  // Strategy 5: Can't determine — default to plaintiff
  // (the case was found by TIN search, so the company IS involved)
  else {
    role = 'plaintiff'
  }

  const classification = classifyOutcome(role, raw.result)
  // ...
}
```

#### Name matching — how it works:

```typescript
function nameMatches(companyNorm: string, partyNorm: string): boolean {
  // Direct substring match (either direction)
  if (partyNorm.includes(companyNorm)) return true
  if (companyNorm.includes(partyNorm)) return true

  // Word-overlap match: if ≥2 significant words of the company name
  // appear in the party field, it's a match
  const cWords = companyNorm.split(' ').filter(w => w.length > 2)
  const pWords = partyNorm.split(' ').filter(w => w.length > 2)

  let matchCount = 0
  for (const cw of cWords) {
    if (pWords.some(pw => pw === cw || pw.includes(cw) || cw.includes(pw))) {
      matchCount++
    }
  }
  return matchCount >= Math.min(2, cWords.length)
}
```

**Example:**
- Company name (normalized): `"andijonkabel aksiyadorlik jamiyati"`
- Plaintiff field: `"ANDIJONKABEL AKSIYADORLIK JAMIYATI QOSHMA KORXONA"`
- Normalized plaintiff: `"andijonkabel aksiyadorlik jamiyati qoshma korxona"`
- Match? YES — `partyNorm.includes(companyNorm)` → true → role = plaintiff

#### Step 2: Classify outcome

```typescript
function classifyOutcome(role: PartyRole, result: string): Classification {
  const r = (result || '').toLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'").trim()

  // Empty result → pending
  if (!r || r === '—' || r === '-') return 'pending'

  // Check for outcome keywords in BOTH Cyrillic and Latin
  const full     = r.includes('тўлиқ') || r.includes("to'liq") || r.includes('toliq')
  const partial  = r.includes('қисман') || r.includes('qisman')
  const rejected = r.includes('рад') || r.includes('rad ')
  const returned = r.includes('қайтарилган') || r.includes('qaytarilgan')
  const leftWithoutReview = r.includes('кўрмасдан') || r.includes("ko'rmasdan")
  const terminated = r.includes('тугатилган') || r.includes('tugatilgan')

  // WIN = fully or partially satisfied (both roles)
  if (full || partial) return 'win'

  // LOSE (plaintiff) / NEUTRAL (defendant) = rejected, returned, or terminated
  if (rejected || returned || leftWithoutReview || terminated) {
    return role === 'plaintiff' ? 'lose' : 'neutral'
  }

  // Unknown outcome → pending
  return 'pending'
}
```

**Classification matrix:**

| Result text (Cyrillic) | Result text (Latin) | Company is plaintiff | Company is defendant |
|---|---|---|---|
| Тўлиқ қаноatlantirilgan | To'liq qanoatlantirilgan | **WIN** | **WIN** |
| Қисман қаноatlantirilgan | Qisman qanoatlantirilgan | **WIN** | **WIN** |
| Рад этилган | Rad etilgan | **LOSE** | **NEUTRAL** |
| Қайтарилган | Qaytarilgan | **LOSE** | **NEUTRAL** |
| Кўрмасдан қолдирилган | Ko'rmasdan qoldirilgan | **LOSE** | **NEUTRAL** |
| Тугатилган | Tugatilgan | **LOSE** | **NEUTRAL** |
| (empty) | (empty) | **PENDING** | **PENDING** |

---

## Frontend Filtering (after data is received)

**File:** `src/app/page.tsx` — `StatsTab` component

Once the data arrives from the API, the frontend applies additional filters:

### Filter 1: Date span (Davr)

```typescript
// inDateSpan checks if a case's regDate falls within the selected period
function inDateSpan(dateStr: string, span: DateSpan): boolean {
  if (span === 'all') return true
  const d = parseStatsDate(dateStr)  // "15.05.2025" → Date object
  if (!d) return true
  const now = new Date()
  const cutoff = new Date()
  if (span === '1y') cutoff.setFullYear(now.getFullYear() - 1)
  else if (span === '6m') cutoff.setMonth(now.getMonth() - 6)
  else if (span === '30d') cutoff.setDate(now.getDate() - 30)
  return d >= cutoff
}
```

### Filter 2: Outcome (Holat)

```typescript
// User can filter by: all | win | lose | neutral | pending
// Applied via useMemo that recomputes when dateSpan or outcome changes
const filterAndSort = useMemo(() => {
  let filtered = data.cases

  // Filter by date span
  if (dateSpan !== 'all') {
    filtered = filtered.filter(c => inDateSpan(c.regDate, dateSpan))
  }

  // Filter by outcome
  if (outcome !== 'all') {
    filtered = filtered.filter(c => c.classification === outcome)
  }

  // Sort: newest first or oldest first
  if (sort === 'newest') {
    filtered = [...filtered].sort((a, b) => parseStatsDate(b.regDate) - parseStatsDate(a.regDate))
  } else {
    filtered = [...filtered].sort((a, b) => parseStatsDate(a.regDate) - parseStatsDate(b.regDate))
  }

  return filtered
}, [data, dateSpan, outcome, sort])
```

### Filter 3: Court-type folders (Tahlil / Iqtisodiy / Fuqarolik / Ma'muriy / Majlislar)

```typescript
// When user clicks a folder tab, cases are filtered by courtType
const casesByType = useMemo(() => {
  if (activeFolder === 'tahlil') return filterAndSort  // all types
  if (activeFolder === 'hearings') return []  // hearings fetched separately
  return filterAndSort.filter(c => c.courtType === activeFolder)
}, [filterAndSort, activeFolder])
```

---

## 7. Where It Breaks — Known Failure Points

### Problem 1: jadval.sud.uz is intermittently down

**Symptom:** Getting 6-11 cases instead of 100+.

**Root cause:** `jadval.sud.uz` (which returns the bulk of cases — 94 of 100 for some TINs) is an older API that frequently goes down for hours at a time. When it's down, it returns `Ишлар топилмади` (cases not found) — a valid HTTP 200 response with a text body, NOT an error.

**What the code does about it:** The v140 fix stopped treating `Иш топилмади` as a definitive "not found" (because jadval.sud.uz returns this text when IP-blocking, even when cases exist). Now the code waits for ALL workers to settle and takes the BEST result. But if ALL 4 workers get `Иш топилмади` from jadval.sud.uz, there's nothing we can do — the API itself is down.

**How to verify:** Run this command when cases seem low:
```bash
curl -s "https://broad-field-f2b0.uzwebfox.workers.dev/https://jadval.sud.uz/case/findByTin/302678824" | head -c 100
```
If it returns `Ишлар топилмади` (15 bytes), the API is down. If it returns a large JSON array (80KB+), it's working.

### Problem 2: CONFLICT/findByTin returns 404

**Symptom:** Administrative cases always show 0.

**Root cause:** `jadvalapi.sud.uz/online-monitoring/CONFLICT/findByTin/` returns HTTP 404 — this endpoint simply doesn't exist on jadvalapi. The code correctly treats 404 as definitive and returns `[]`.

**What the code does about it:** Nothing — there's no alternative API for administrative cases by TIN. The `jadval.sud.uz` older API only supports `findByAdmNumber` (by case number), not `findByTin`.

### Problem 3: orginfo.uz timeout

**Symptom:** Role classification falls back to "plaintiff" for all cases.

**Root cause:** If `orginfo.uz` times out (6s), we don't have the canonical company name. We fall back to `chamber.uz` for the name, and if that also fails, we use `STIR {tin}`. Without the real name, `nameMatches()` can't determine if the company is plaintiff or defendant, so everything defaults to plaintiff.

**What the code does about it:** The v140 fix runs orginfo IN PARALLEL with court cases (was sequential before). If orginfo fails, court cases still load. The company name from chamber.uz is used as a fallback.

### Problem 4: Best-of strategy can still fail

**Symptom:** All 4 CF Workers return partial data (6 cases each from jadvalapi).

**Root cause:** The BEST-OF strategy takes the result with the most cases. But if jadval.sud.uz is down and only jadvalapi is working, ALL 4 workers will return 6 cases from jadvalapi — the best-of 6, 6, 6, 6 is still 6.

**What the code does about it:** The code tries jadval.sud.uz separately (it's a different API endpoint). If jadval.sud.uz returns 94 cases via ANY worker, the best-of becomes 94. But if jadval.sud.uz is completely down, we're stuck with jadvalapi's 6.

---

## 8. The External APIs — What They Actually Return

### jadvalapi.sud.uz (newer API)

**URL pattern:**
```
https://jadvalapi.sud.uz/online-monitoring/{TYPE}/findByTin/{TIN}
```

**TYPE values:**
- `ECONOMIC` — economic cases
- `CIVIL` — civil cases
- `CONFLICT` — administrative cases (returns 404 for findByTin!)

**Response (200 OK):**
```json
[
  {
    "casenumber": "4-1001-2605/14720",
    "category": "Маҳсулот етказиб бериш шартномаси",
    "sub_category": "...",
    "status_name": "Якунланган (Ижро варақасиз)",
    "instance": "Birinchi instansiya",
    "result": "Тўлиқ қаноatlantirilgan",
    "court": "Тошкент туманлараро иқтисодий суди",
    "region": "Тошкент шаҳри",
    "reg_date": "15.05.2025",
    "hearing_date": "20.06.2025",
    "hearing_time": "14:30",
    "responsible": "ЯКУБОВ ШОХРУХ БАХРАМОВИЧ",
    "claiment": "\"ANDIJONKABEL\" AKSIYADORLIK JAMIYATI",
    "defendant": "O'ZBEKKIMYOMASH ZAVODI AJ",
    "claim_amount": "450000000",
    "courtroom": "1-хона",
    "postpone_reason": ""
  }
  // ... typically 6 cases for economic (this API returns fewer)
]
```

**Note:** The API has a typo — `claiment` instead of `claimant`. The mapper handles both.

### jadval.sud.uz (older API)

**URL pattern:**
```
https://jadval.sud.uz/case/findByTin/{TIN}
```

**Response (200 OK):**
```json
[
  {
    "casenumber": "4-1001-2605/14720",
    "category": "Маҳсулот етказиб бериш шартномаси",
    "status_name": "Якунланган (Ижро варақасиз)",
    "instance": "Birinchi instansiya",
    "result": "Тўлиқ қаноatlantirilgan",
    "court": "Тошкент туманлараро иқтисодий суди",
    "reg_date": "15.05.2025",
    "claimant": "\"ANDIJONKABEL\" AKSIYADORLIK JAMIYATI",
    "defendant": "O'ZBEKKIMYOMASH ZAVODI AJ",
    "claim_amount": "450000000"
  }
  // ... typically 94 cases for economic (this API returns the bulk)
]
```

**When down (HTTP 200 but text body):**
```
Ишлар топилмади
```
(15 bytes — "cases not found" in Uzbek)

### Why we call BOTH APIs:

| | jadvalapi.sud.uz | jadval.sud.uz |
|---|---|---|
| **Case count** | 6-10 cases | 50-94 cases |
| **Data richness** | More fields (hearing_date, hearing_time, judge, courtroom) | Fewer fields (no hearing data) |
| **Reliability** | Usually up | Frequently down (returns "Ишлар топилмади") |
| **CONFLICT/findByTin** | 404 (endpoint doesn't exist) | Not available for TIN search |

We merge + deduplicate by case number. jadval.sud.uz provides the bulk (94 cases), jadvalapi adds 6 that jadval.sud.uz doesn't have, giving us 100 total.

---

## Summary — The Complete Data Journey

```
1. User types STIR 302678824
   └→ fetchStats('302678824')
      └→ checks localStorage cache (5 min TTL)
         └→ cache MISS → fetch /api/stats?tin=302678824
            └→ getCompanyStats('302678824')
               └→ checks server cache (60s TTL)
                  └→ cache MISS → fire 5 parallel fetches:
                     │
                     ├─ orginfo.uz → company name "ANDIJONKABEL AJ"
                     ├─ chamber.uz → rating 93/100, category "AA"
                     │
                     ├─ searchCourtCases('economic', 'tin', '302678824')
                     │  └→ calls 2 APIs in parallel:
                     │     ├─ jadvalapi.sud.uz/ECONOMIC/findByTin → 6 cases
                     │     │  └→ each through 4 CF Workers simultaneously
                     │     │     └→ BEST-OF: 6 cases
                     │     └─ jadval.sud.uz/case/findByTin → 94 cases
                     │        └→ each through 4 CF Workers simultaneously
                     │           └→ BEST-OF: 94 cases
                     │  └→ MERGE + DEDUP: 100 unique cases
                     │
                     ├─ searchCourtCases('civil', 'tin', '302678824')
                     │  └→ calls 1 API:
                     │     └─ jadvalapi.sud.uz/CIVIL/findByTin → 3 cases
                     │  └→ 3 cases
                     │
                     └─ searchCourtCases('administrative', 'tin', '302678824')
                        └→ calls 1 API:
                           └─ jadvalapi.sud.uz/CONFLICT/findByTin → 404
                        └→ 0 cases (endpoint doesn't exist)
                  
                  └→ For each of 103 raw cases (100+3+0):
                     ├→ classifyCase():
                     │  ├→ Determine role: name-match company vs plaintiff/defendant
                     │  │  └→ "ANDIJONKABEL" matches plaintiff → role = plaintiff
                     │  └→ classifyOutcome():
                     │     └→ "Тўлиқ қаноatlantirilgan" → contains "тўлиқ" → WIN
                     │
                     └→ Deduplicate by case number → 103 unique cases
                  
                  └→ Compute summary: 53W / 15L / 10N / 2P = 53 total
                  
                  └→ Return { company, cases: [...53], summary, errors: [] }
               
               └→ Store in server cache (60s)
            
            └→ Return JSON to frontend
         
         └→ Store in client cache (5 min)
         └→ setData(payload) → React re-renders StatsTab
            └→ User sees 53 cases in the Tahlil folder
            └→ Filter by date span, outcome, or court type
            └→ Click a case → opens in Sud ishlari tab
```

---

**End of document.**
