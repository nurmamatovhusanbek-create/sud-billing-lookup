# Tab Function Map — Sud Billing Lookup v127

## Overview
5 tabs, each with specific functions + cross-tab linking. This document prevents accidental removal of features.

## Tab 1: To'lovlar (Bills)
**Purpose**: Search billing.sud.uz for all kvitansiyalar by STIR, or look up a single kvitansiya by number.

### Functions
| Function | Component | API | Lib | CF Workers |
|----------|-----------|-----|-----|------------|
| Search by STIR | BillsTab | /api/bills (streaming NDJSON) | billing.ts | ✅ captcha + billing pools |
| Search by invoice number | BillsTab | /api/bills?invoice=X | billing.ts | ✅ |
| Bill enrichment (checkStatus) | billing.ts | billing.sud.uz/api/invoice/checkStatus | billing.ts | ✅ 4 workers round-robin |
| Captcha (PoW + math) | billing.ts | recaptcha.sud.uz | billing.ts | ✅ captcha pool |
| Progressive loading | BillsTab | streaming | — | — |
| Summary cards (6 cells) | SummaryCards | — | billing.ts (summarizeBills) | — |
| Filter (paid/unpaid, sort) | BillsTab | — | — | — |
| Bill card expand | BillCard | — | — | — |
| "Ko'rish" → Sud ishlari | BillCard | onViewCase(caseNumber, courtType) | — | — |

### Links TO other tabs
- **"Ko'rish" button** → Sud ishlari tab (passes case number + court type from bill detail)

### Links FROM other tabs
- **Kompaniya tab** "To'lovlar" button → this tab
- **Stats tab** "To'lovlar" quick action → this tab

---

## Tab 2: Sud ishlari (Court Cases)
**Purpose**: Search my.sud.uz for court cases by STIR/PINFL/case number. Show full details on expand.

### Functions
| Function | Component | API | Lib | CF Workers |
|----------|-----------|-----|-----|------------|
| Search by STIR | CourtCasesTab | /api/court-cases | court-case.ts | ✅ |
| Search by case number | CourtCasesTab | /api/court-cases | court-case.ts | ✅ |
| Case detail expand | CaseDetailView | /api/court-cases?detail=X | court-case.ts | ✅ |
| Party TIN lookup | CaseDetailView | /api/company?name=X&tinOnly=true | orginfo.ts | ✅ |
| Filter (sort, status, page-size) | CourtCasesTab | — | — | — |
| Pagination | PageNav | — | — | — |
| "Ko'rish" from other tabs | pendingCaseNumber + pendingCourtType | — | — | — |

### Links TO other tabs
- Receives case number + court type from: Bills tab, Sud majlislari tab, Stats tab

### Links FROM other tabs
- **Bills tab** "Ko'rish" → this tab (case number + court type)
- **Sud majlislari** "Ko'rish" → this tab (case number + court type)
- **Stats tab** case click → this tab (case number + court type + pre-loaded case data)

---

## Tab 3: Sud majlislari (Upcoming Hearings)
**Purpose**: Save companies by STIR + view their upcoming scheduled court hearings.

### Functions
| Function | Component | API | Lib | CF Workers |
|----------|-----------|-----|-----|------------|
| Save company | UpcomingHearingsTab | localStorage | — | — |
| Fetch hearings | UpcomingHearingsTab | /api/upcoming-hearings | court-case.ts | ✅ |
| Hearing cards | UpcomingHearingCard | — | — | — |
| "Ko'rish" → Sud ishlari | UpcomingHearingCard | onViewCase(caseNumber, courtType) | — | — |
| Refresh button | UpcomingHearingsTab | fetchHearings(selectedTin) | — | ✅ |
| Delete saved company | UpcomingHearingsTab | localStorage | — | — |

### Court types searched
- economic ✅ (jadval.sud.uz + jadvalapi.sud.uz)
- civil ✅ (jadvalapi.sud.uz)
- administrative ✅ (jadvalapi.sud.uz)
- criminal ❌ (skipped for company TINs — companies can't be criminal defendants)

### Links TO other tabs
- **"Ko'rish" button** → Sud ishlari tab (case number + court type)

### Links FROM other tabs
- **Kompaniya tab** "Majlislar" button → this tab
- **Stats tab** "Majlislar" button → this tab

---

## Tab 4: Kompaniya (Company Info)
**Purpose**: Full company profile from orginfo.uz + contractor rating from chamber.uz.

### Functions
| Function | Component | API | Lib | CF Workers |
|----------|-----------|-----|-----|------------|
| Company profile | CompanyInfoTab | /api/company-info | orginfo.ts | ✅ |
| Contractor rating | CompanyInfoTab | /api/company-info | chamber.ts | ✅ |
| Rating card (score, category) | CompanyInfoTab | — | chamber.ts | — |
| Company info grid | CompanyInfoTab | — | orginfo.ts | — |
| OKED (industry) | CompanyInfoTab | — | chamber.ts | — |
| Founders list | CompanyInfoTab | — | orginfo.ts | — |
| Tezkor amallar (quick actions) | CompanyInfoTab | onViewCases/onViewBills/onViewHearings | — | — |
| orginfo.uz external link | CompanyInfoTab | — | — | — |

### Data sources (parallel)
- orginfo.uz → company name, address, director, status, registered date, charter capital, phone, email, founders
- admin.chamber.uz → score (0-100), category (AAA-D), taxpayer type, region, OKED code + name + section

### Links TO other tabs
- **"Sud ishlari" button** → Sud ishlari tab
- **"To'lovlar" button** → To'lovlar tab
- **"Majlislar" button** → Sud majlislari tab

### Links FROM other tabs
- None (this tab is a destination, not a source)

---

## Tab 5: Statistika (Stats)
**Purpose**: Aggregate all court cases (economic + civil + administrative), classify WIN/LOSE/NEUTRAL, show interactive stats + Excel export.

### Functions
| Function | Component | API | Lib | CF Workers |
|----------|-----------|-----|-----|------------|
| Stats search | StatsTab | /api/stats | stats.ts | ✅ (4 parallel fetches) |
| Excel export | StatsTab | /api/stats/export (POST) | stats.ts + jszip | ✅ |
| Folder tabs (5) | StatsTab | — | — | — |
| TAHLIL dashboard | StatsTab | — | stats.ts | — |
| Summary cards | StatsTab | — | stats.ts | — |
| Donut chart | StatsTab | — | — | — |
| Win-rate bars | StatsTab | — | stats.ts | — |
| Court-type breakdown | StatsTab | — | stats.ts | — |
| Category list | StatsTab | — | stats.ts | — |
| Case list (folders 2-4) | StatsTab | — | stats.ts | — |
| MAJLISLAR folder | StatsTab | /api/court-hearings | jadval2.ts | ✅ |
| Case click → Sud ishlari | StatsTab | onViewCase(caseNumber, courtType, caseData) | — | — |
| Date span filter | StatsTab | — | — | — |
| Outcome filter | StatsTab | — | — | — |
| Sort | StatsTab | — | — | — |

### Folder tabs
1. **TAHLIL** — analytics dashboard (summary + donut + winrate + breakdown + download)
2. **IQTISODIY** — economic case list (clickable → Sud ishlari)
3. **FUQAROLIK** — civil case list
4. **MA'MURIY** — administrative case list
5. **MAJLISLAR** — upcoming hearings (lazy-loaded via jadval2 scan)

### Data sources (4 parallel)
- orginfo.uz → company name (non-blocking, 24h cache, fallback to chamber)
- chamber.uz → company name fallback (when orginfo fails)
- jadval.sud.uz + jadvalapi.sud.uz → economic cases (merged)
- jadvalapi.sud.uz → civil cases
- jadvalapi.sud.uz → administrative cases

### Classification
- WIN: To'liq/Qisman qanoatlantirilgan (both roles)
- LOSE: Rad etilgan/Qaytarilgan/Ko'rmasdan qoldirilgan (plaintiff only)
- NEUTRAL: Rad etilgan/Qaytarilgan (defendant only)
- PENDING: empty/unknown result

### Links TO other tabs
- **Case click** → Sud ishlari tab (case number + court type + pre-loaded case data)
- **Summary card click** → opens court-type folder with filter

### Links FROM other tabs
- None (this tab is a destination)

---

## Cross-tab linking summary

```
To'lovlar ──"Ko'rish"──→ Sud ishlari (case + court type)
Sud majlislari ──"Ko'rish"──→ Sud ishlari (case + court type)
Statistika ──case click──→ Sud ishlari (case + court type + pre-loaded data)
Kompaniya ──"Sud ishlari"──→ Sud ishlari
Kompaniya ──"To'lovlar"──→ To'lovlar
Kompaniya ──"Majlislar"──→ Sud majlislari
Statistika ──"To'lovlar"──→ To'lovlar (quick action)
```

## CF Worker coverage (ALL lib files have fallback)
| Lib file | Workers | Fallback |
|----------|---------|----------|
| billing.ts | ✅ env + hardcoded FALLBACK_WORKERS | ✅ Never direct |
| court-case.ts | ✅ env + hardcoded FALLBACK_WORKERS | ✅ Never direct |
| jadval2.ts | ✅ env + hardcoded FALLBACK_WORKERS | ✅ Never direct |
| chamber.ts | ✅ env + hardcoded FALLBACK_WORKERS | ✅ Never direct |
| orginfo.ts | ✅ env + hardcoded FALLBACK_WORKERS | ✅ Never direct |
| stats.ts | ✅ (delegates to court-case + orginfo + chamber) | ✅ |
