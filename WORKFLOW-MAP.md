# Sud Billing Lookup — Workflow Map

## Overall architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (browser)                           │
│                    localhost:3000 (Next.js)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  API Routes │ │ API Routes  │ │ API Routes  │
    │  /api/bills │ │/api/stats   │ │/api/court-  │
    │             │ │             │ │  cases      │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           │    ┌──────────┼──────────┐    │
           │    │          │          │    │
    ┌──────▼──┐ │  ┌───────▼───┐ ┌───▼────┐ │
    │billing  │ │  │orginfo.ts │ │court-  │ │
    │  .ts    │ │  │           │ │case.ts │ │
    └────┬────┘ │  └─────┬─────┘ └───┬────┘ │
         │      │        │           │      │
         │  ┌───▼────┐   │    ┌──────▼───┐  │
         │  │chamber │   │    │jadval2.ts│  │
         │  │  .ts   │   │    └────┬─────┘  │
         │  └───┬────┘   │         │        │
         │      │        │         │        │
         └──────┴────────┴─────────┴────────┘
                           │
                  ┌────────▼────────┐
                  │ CF Workers (×4) │
                  │ Round-robin proxy│
                  └────────┬────────┘
                           │
           ┌───────┬───────┼───────┬───────┐
           │       │       │       │       │
      ┌────▼──┐┌───▼──┐┌───▼──┐┌───▼──┐┌───▼──┐
      │billing││jadval││jadval││orginfo││chamber│
      │.sud.uz││.sud.uz││api.  ││ .uz  ││ .uz  │
      │       ││      ││sud.uz││      ││      │
      └───────┘└──────┘└──────┘└──────┘└──────┘
```

## CF Workers (4, round-robin)
- `broad-field-f2b0.uzwebfox.workers.dev`
- `wild-hall-04ae.uzwebfox.workers.dev`
- `orange-darkness-8843.najimsheikh071.workers.dev`
- `wandering-wind-1d3d.najimsheikh071.workers.dev`

**Every** external request routes through these workers (NEVER direct — user IP gets blocked). Configured via `CF_WORKER_URLS` in `.env`.

---

## Tab 1: To'lovlar (Bills)

### Purpose
Search billing.sud.uz for all kvitansiyalar (payment receipts) issued to a company by STIR, or look up a single kvitansiya by number.

### Workflow
```
User enters STIR (9 digits) or kvitansiya number
  │
  ▼
POST /api/bills (streaming NDJSON)
  │
  ├─ Phase 1: connecting
  │   billing.sud.uz homepage → get cookies + session
  │   (via CF worker, 1 request)
  │
  ├─ Phase 2: captcha
  │   recaptcha.sud.uz → PoW (SHA-256) + math captcha
  │   (via CF worker, 1-2 requests)
  │   If score ≥ 0.9: token granted directly
  │   Else: solve math captcha → token
  │
  ├─ Phase 3: searching
  │   billing.sud.uz/api/invoice/searchByInn → list of bills
  │   (via CF worker, 1 request, up to 6 retries on 521)
  │
  └─ Phase 4: enriching (parallel, 4 concurrent)
      For each bill: billing.sud.uz/api/invoice/checkStatus
      (via CF worker, 4 workers round-robin)
      ├─ Bails early after 3 consecutive HTTP 500 (permanent fail)
      └─ 1 retry round for transient failures (timeout/521)
          (skips permanent failures)
  │
  ▼
Client renders bills progressively (first bill hides big loader,
slim progress bar replaces it)
```

### APIs called
| Endpoint | Host | Purpose |
|----------|------|---------|
| `/api/invoice/searchByInn` | billing.sud.uz | Search bills by STIR |
| `/api/invoice/checkStatus` | billing.sud.uz | Get bill details (amount, status, case) |
| recaptcha API | recaptcha.sud.uz | PoW + math captcha |

### Known issues
- billing.sud.uz intermittently returns 521 (origin down) — handled with retries + circuit breaker
- Some bills return HTTP 500 permanently (broken invoice) — bails after 3 attempts, skips in retry

---

## Tab 2: Sud ishlari (Court Cases)

### Purpose
Search my.sud.uz (via jadval.sud.uz + jadvalapi.sud.uz) for court cases by STIR or case number. Show full case details (hearings, decision, parties) on expand.

### Workflow
```
User selects court type (economic/civil/criminal/administrative)
User selects search mode (STIR / PINFL / case number)
User enters value
  │
  ▼
GET /api/court-cases?courtType=X&mode=Y&value=Z
  │
  ├─ searchCourtCases() calls BOTH APIs in parallel:
  │   ├─ jadvalapi.sud.uz/online-monitoring/{TYPE}/findByTin/{TIN}
  │   └─ jadval.sud.uz/case/findByTin/{TIN}
  │   (via CF workers, merged + deduplicated)
  │
  └─ Returns case list (caseNumber, result, plaintiff, defendant, etc.)
  │
  ▼
Client renders case cards
  │
  ├─ Click "Tafsilotlarni ko'rish" → expand card
  │   │
  │   ▼
  │   GET /api/court-cases?courtType=X&detail={caseNumber}
  │   │
  │   ├─ getCaseDetails() calls BOTH APIs in parallel:
  │   │   ├─ jadvalapi.sud.uz/online-monitoring/{TYPE}/findByNumber/{case@number}
  │   │   └─ jadval.sud.uz/case/findByNumber/{case@number}
  │   │   (via CF workers, merged)
  │   │
  │   ├─ Returns: general info + firstInstance (hearings + decision)
  │   │         + appellate + cassation (if exist)
  │   │
  │   └─ Also fetches party TINs via orginfo.uz (name → TIN lookup)
  │
  └─ Click "Ko'rish" on a bill/hearing → jumps to this tab with case pre-filled
      (passes courtType so correct court is selected)
```

### APIs called
| Endpoint | Host | Purpose |
|----------|------|---------|
| `/online-monitoring/{TYPE}/findByTin/{TIN}` | jadvalapi.sud.uz | Search cases by TIN (economic/civil/admin) |
| `/online-monitoring/{TYPE}/findByNumber/{case}` | jadvalapi.sud.uz | Get case details by number |
| `/case/findByTin/{TIN}` | jadval.sud.uz | Search cases by TIN (economic only) |
| `/case/findByNumber/{case}` | jadval.sud.uz | Get case details by number |
| `/case/findByCivilNumber/{case}` | jadval.sud.uz | Civil case details |
| `/case/findByCriminalNumber/{case}` | jadval.sud.uz | Criminal case details |
| `/case/findByAdmNumber/{case}` | jadval.sud.uz | Admin case details |
| orginfo.uz search | orginfo.uz | Party name → TIN lookup (for detail view) |

### Cross-tab linking
- Bills tab "Ko'rish" → this tab with case number + court type
- Sud majlislari "Ko'rish" → this tab with case number + court type
- Stats tab case click → this tab with case number + court type

### Court type mapping
| Source | Maps to |
|--------|---------|
| `ECONOMIC` / `iqtisodiy` | economic |
| `CITIZEN` / `CIVIL` / `fuqarolik` | civil |
| `ADMINISTRATIVE` / `CONFLICT` / `ma'muriy` | administrative |
| `CRIMINAL` / `jinoyat` | criminal |

---

## Tab 3: Sud majlislari (Upcoming Hearings)

### Purpose
Save companies (by STIR) and view their upcoming scheduled court hearings across all 4 court types.

### Workflow
```
User enters STIR + optional name
  │
  ├─ "Saqlash" button → saves to localStorage (sud-saved-companies)
  │
  └─ Click saved company tile → fetches upcoming hearings
      │
      ▼
    GET /api/upcoming-hearings?tin={TIN}
      │
      ├─ Searches ALL 4 court types in parallel:
      │   ├─ searchCourtCases('economic', 'tin', TIN)
      │   ├─ searchCourtCases('civil', 'tin', TIN)
      │   ├─ searchCourtCases('criminal', 'tin', TIN)  [may fail — no TIN search]
      │   └─ searchCourtCases('administrative', 'tin', TIN)
      │
      ├─ For each case found, checks hearing_date
      ├─ Filters for UPCOMING hearings (date ≥ today)
      └─ Returns sorted by date (soonest first)
  │
  ▼
Client renders hearing cards
  │
  └─ "Ko'rish" → jumps to Sud ishlari with case number + court type
```

### APIs called
Same as Tab 2 (court case search) — reuses `searchCourtCases()` for all 4 court types.

### Data storage
- Saved companies: `localStorage['sud-saved-companies']` (TIN + name + savedAt)

---

## Tab 4: Kompaniya (Company Info)

### Purpose
Look up full company profile from orginfo.uz + contractor rating from chamber.uz.

### Workflow
```
User enters STIR
  │
  ▼
GET /api/company-info?tin={TIN}
  │
  ├─ Parallel fetch:
  │   ├─ orginfo.uz → company details
  │   │   ├─ Search by TIN → get org ID
  │   │   ├─ Fetch org page → parse name, address, director, status,
  │   │   │   registered date, charter capital, phone, email, founders
  │   │   └─ (via CF worker, 10s timeout per request)
  │   │
  │   └─ admin.chamber.uz → contractor rating
  │       ├─ GET /api/GetCompanyCriteries/{TIN}
  │       └─ Returns: score (0-100), category (AAA-D), taxpayer type,
  │           region, OKED code + name + section
  │
  └─ Merges + returns company + rating
  │
  ▼
Client renders:
  1. Rating card (score, category, progress bar) — FIRST
  2. Quick actions bar (Sud ishlari / To'lovlar / Majlislar / orginfo.uz)
  3. Asosiy ma'lumotlar (company info grid)
  4. Faoliyat sohasi (OKED)
  5. Asoschilar (founders list)
  6. Quick action cards
```

### APIs called
| Endpoint | Host | Purpose |
|----------|------|---------|
| `/uz/search/all/?q={TIN}` | orginfo.uz | Find org by TIN |
| `/uz/organization/{orgId}/` | orginfo.uz | Full company profile |
| `/api/GetCompanyCriteries/{TIN}` | admin.chamber.uz | Contractor rating (0-100, AAA-D) |

### Known issues
- orginfo.uz intermittently times out (10s timeout per request, 2 retries)
- When orginfo fails, rating still loads from chamber.uz (parallel fetch)

---

## Tab 5: Statistika (Stats)

### Purpose
Aggregate all court cases (economic + civil + administrative) for a company, classify each as WIN/LOSE/NEUTRAL/PENDING, and display interactive stats + Excel export.

### Workflow
```
User enters STIR
  │
  ▼
GET /api/stats?tin={TIN}
  │
  ├─ ALL 4 requests fire IN PARALLEL (Promise.allSettled):
  │   ├─ orginfo.uz → company name (for name matching)
  │   │   (non-blocking — falls back to TIN if fails)
  │   │
  │   ├─ searchCourtCases('economic', 'tin', TIN)
  │   │   └─ jadval.sud.uz + jadvalapi.sud.uz (parallel, merged)
  │   │
  │   ├─ searchCourtCases('civil', 'tin', TIN)
  │   │   └─ jadvalapi.sud.uz/CIVIL/findByTin
  │   │
  │   └─ searchCourtCases('administrative', 'tin', TIN)
  │       └─ jadvalapi.sud.uz/CONFLICT/findByTin
  │
  ├─ Merge + deduplicate all cases
  ├─ Classify each case:
  │   ├─ Determine role (plaintiff vs defendant) by name matching
  │   └─ Map result string → WIN/LOSE/NEUTRAL/PENDING
  │
  └─ Returns: company + cases[] + summary{total, win, lose, neutral, pending}
  │
  ▼
Client renders TAHLIL folder:
  ├─ Summary cards (Jami / Yutdi / Yutqazdi / Neitral)
  ├─ Role breakdown (Da'vogar / Javobgar win rates)
  ├─ Donut chart (outcome distribution)
  ├─ Win-rate bars (by court type)
  ├─ Court-type breakdown (clickable → opens that folder)
  ├─ Category list (top 5)
  └─ Download toolbar (court-type checkboxes + Excel button)
      │
      ▼
    GET /api/stats/export?tin={TIN}&courtTypes=economic,civil
      │
      ├─ Fetches stats again (same workflow as above)
      ├─ Filters by selected court types
      ├─ Builds .xlsx manually using jszip (no Excel library)
      └─ Returns downloadable .xlsx file
```

### Folder tabs (5)
1. **TAHLIL** — analytics dashboard (summary + charts + download)
2. **IQTISODIY** — economic case list (clickable → Sud ishlari)
3. **FUQAROLIK** — civil case list
4. **MA'MURIY** — administrative case list
5. **MAJLISLAR** — upcoming hearings (lazy-loaded, reuses court-hearings API)

### Classification rules
| Role | Result | Classification |
|------|--------|---------------|
| Plaintiff | To'liq qanoatlantirilgan | WIN |
| Plaintiff | Qisman qanoatlantirilgan | WIN |
| Plaintiff | Rad etilgan / Qaytarilgan / Ko'rmasdan qoldirilgan | LOSE |
| Defendant | To'liq / Qisman qanoatlantirilgan | WIN |
| Defendant | Rad etilgan / Qaytarilgan | NEUTRAL |
| Either | (empty/pending) | PENDING |

### APIs called
| Endpoint | Host | Purpose |
|----------|------|---------|
| jadval.sud.uz/case/findByTin | jadval.sud.uz | Economic cases (full history) |
| jadvalapi.sud.uz/.../ECONOMIC/findByTin | jadvalapi.sud.uz | Economic cases (newer API) |
| jadvalapi.sud.uz/.../CIVIL/findByTin | jadvalapi.sud.uz | Civil cases (full history) |
| jadvalapi.sud.uz/.../CONFLICT/findByTin | jadvalapi.sud.uz | Administrative cases |
| jadvalapi.sud.uz/vka/{TYPE}/{court}/{date} | jadvalapi.sud.uz | Hearing schedule (MAJLISLAR folder, future-only) |
| orginfo.uz | orginfo.uz | Company name (non-blocking) |

### Excel export columns
Sud | Ish raqami | Da'vogar | Javobgar | Sana | Natija | Holat | Sud turi

---

## Cross-tab linking

```
Bills tab ──"Ko'rish"──→ Sud ishlari tab (case number + court type)
Sud majlislari ──"Ko'rish"──→ Sud ishlari tab (case number + court type)
Stats tab ──case click──→ Sud ishlari tab (case number + court type)
Stats tab ──summary card click──→ court-type folder (with filter)
Kompaniya ──quick action──→ Sud ishlari / To'lovlar / Sud majlislari tabs
```

---

## Improvement opportunities

### 1. Caching (HIGH impact)
Currently every tab re-fetches the same data:
- Stats tab fetches court cases → user clicks a case → Sud ishlari re-fetches the same case
- Kompaniya fetches orginfo → Stats tab fetches orginfo again
- **Fix**: Add a shared cache (localStorage or in-memory) for company info + case lists. TTL: 5 minutes.

### 2. Stats tab → Sud ishlari pre-loaded
When user clicks a case in Stats tab, Sud ishlari re-searches by case number (2-4s). Could pass the case data directly from Stats → Sud ishlari (instant display, no re-fetch).

### 3. orginfo.uz resilience
orginfo.uz times out frequently (10s timeout, often 2 retries = 20s wasted). Options:
- Reduce timeout to 5s (fail fast)
- Cache company lookups (TIN → name) for 24 hours
- Fall back to chamber.uz for company name (already have TIN, chamber returns name too?)

### 4. Bills tab — progressive loading is good, but...
The 4-concurrent checkStatus calls can be increased to 6-8 now that the permanent-fail bail is in place (bails after 3 HTTP 500s, doesn't waste time on broken bills).

### 5. Stats tab — name matching fallback
When orginfo fails (company name unknown), the role classification (plaintiff vs defendant) falls back to TIN-substring matching — unreliable. Could use chamber.uz as a secondary name source.

### 6. Criminal cases
Criminal cases can't be searched by TIN (companies can't be criminal defendants, only individuals by PINFL). The Sud majlislari tab tries criminal search for every company — always fails. Should skip criminal for company TINs.

### 7. jadval2 future-only scan
The MAJLISLAR folder in Stats tab scans today+90 days. Many dates return empty arrays. Could skip weekends (already done) + skip known court holidays.

### 8. Excel export — re-fetches stats
The export endpoint re-fetches all stats data (4 parallel API calls) just to generate the Excel. Could pass the already-fetched case data from the client to the server (POST body) instead of re-fetching.
