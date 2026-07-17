# Stats Tab — Specification

## Purpose
A new "Statistika" tab that aggregates all court cases (economic + civil + administrative — criminal N/A for companies) for a given STIR, classifies each as WIN / LOSE / NEUTRAL based on the company's role (plaintiff vs defendant) and the case outcome, and presents the data through an interactive folder-tab interface.

## Data source (verified live)
- **Economic**: `jadval.sud.uz/case/findByTin/{TIN}` (1 req, ~0.3-3s, returns all cases + `result` field)
- **Civil**: `jadvalapi.sud.uz/online-monitoring/CIVIL/findByTin/{TIN}` (1 req, ~0.6s, returns all cases + `result`) — **NEW endpoint, not yet in court-case.ts**
- **Administrative**: `jadvalapi.sud.uz/online-monitoring/CONFLICT/findByTin/{TIN}` (1 req, ~0.8s, returns all cases + `result`)
- **Criminal**: N/A — companies cannot be criminal defendants (only individuals by PINFL)
- All 3 court-type requests fire in parallel → total 2-5 seconds.
- No timespan limit — TIN search returns full history. Each case has `reg_date` for client-side date filtering.
- No name fuzzy-matching needed — TIN-guaranteed party match.

## WIN / LOSE / NEUTRAL classification

### Outcome strings (Cyrillic Uzbek from API → Latin)
| Cyrillic | Latin | English |
|----------|-------|---------|
| Тўлиқ қаноатлантирилган | To'liq qanoatlantirilgan | Fully satisfied |
| Қисман қаноатлантирилган | Qisman qanoatlantirilgan | Partially satisfied |
| Рад этилган | Rad etilgan | Rejected |
| Қайтарилган | Qaytarilgan | Returned/dismissed |
| Кўрмасдан қолдирилган | Ko'rmasdan qoldirilgan | Left without review |
| (other/empty) | — | Pending/in progress |

### Classification rules (user's stated rule — Interpretation A)
| Company role | Outcome | Classification |
|-------------|---------|---------------|
| Plaintiff (da'vogar) | To'liq qanoatlantirilgan | WIN |
| Plaintiff | Qisman qanoatlantirilgan | WIN |
| Plaintiff | Rad etilgan | LOSE |
| Plaintiff | Qaytarilgan | LOSE |
| Plaintiff | Ko'rmasdan qoldirilgan | LOSE |
| Plaintiff | (pending/empty) | PENDING |
| Defendant (javobgar) | Qaytarilgan | NEUTRAL |
| Defendant | Rad etilgan | NEUTRAL |
| Defendant | Qisman qanoatlantirilgan | WIN |
| Defendant | To'liq qanoatlantirilgan | WIN |
| Defendant | (pending/empty) | PENDING |

**Note:** The defendant "to'liq = WIN" rule is the user's stated interpretation (WIN = case reached a decision, dismissals = neutral). Flagged for confirmation — standard legal logic would call a fully-satisfied claim against the defendant a LOSE.

## Folder-tab interface (per user's reference image)

### Layout
A horizontal row of overlapping folder-tab buttons (like physical file folders), each representing a view:
1. **TAHLIL** (Analytics) — the default/first folder, shows overall stats dashboard
2. **IQTISODIY** (Economic) — folder for economic court cases
3. **FUQAROLIK** (Civil) — folder for civil court cases
4. **MA'MURIY** (Administrative) — folder for administrative court cases

Each folder tab shows a count badge (e.g. "IQTISODIY · 23"). Clicking a folder opens that view below. The active folder is visually distinct (solid accent fill, lifted/overlapping the content panel).

### Folder 1: TAHLIL (Analytics overview)
- 4 summary cards: JAMI / YUTDI / YUTQAZDI / NEITRAL (with percentages)
- Role breakdown: Da'vogar (plaintiff) win-rate + Javobgar (defendant) win-rate
- Timeline chart: cases per month (bar chart from reg_date)
- Breakdown by court type (3 mini stat blocks: economic/civil/admin)
- Breakdown by category (top 5 case categories with counts)
- All clickable → clicking a stat filters the case list or jumps to a court-type folder

### Folders 2-4: Court-type case lists
Each folder opens a filterable, sortable list of cases for that court type:
- Filter bar: date span (all-time / 1 year / 6 months / 30 days) + outcome filter (all / win / lose / neutral / pending) + sort (newest / oldest)
- Case cards: case number (mono), reg_date, role badge (da'vogar/javobgar), outcome badge (win/lose/neutral), result text, court name, counterparty
- Each case card is clickable → would jump to "Sud ishlari" tab with case number pre-filled (in the real app; in preview, shows a toast/visual feedback)

## Filters (global, apply to all folders)
1. **Date span**: All-time / 1 year / 6 months / 30 days (client-side filter on reg_date)
2. **Outcome**: All / Win / Lose / Neutral / Pending (client-side filter on classification)
3. **Sort**: Newest first / Oldest first (client-side sort on reg_date)
4. **Role** (optional, in folder lists): All / As plaintiff / As defendant

## Interactive behavior
- Folder tabs switch views with fade-up animation (matching current app's tab-panel transition)
- Filters apply instantly (client-side, no new API calls)
- Case cards have hover lift (panel-hover style)
- Clicking a case card shows "Sud ishlariga o'tish" toast (preview-only; real app would navigate)
- Summary cards in TAHLIL are clickable → jump to the relevant court-type folder with filter pre-applied (e.g. click "YUTDI" → opens economic folder with win-filter on)
- Responsive: folder tabs scroll horizontally on mobile; case list becomes 1-column

## Visual design (MUST match current app — Monochrome Glass)
- Pure black & white (no colors). Accent = black (light) / white (dark).
- border-radius: 0 everywhere (sharp brutalist edges)
- Glassmorphism: backdrop-blur(24px) on hero glass, blur(16px) on panels
- 3px accent top border on hero glass (::before)
- Fonts: Unbounded (display), Plus Jakarta Sans (body), JetBrains Mono (numbers/labels)
- Uppercase mono labels (e.g. "JAMI ISHLAR", "YUTDI", "IQTISODIY SUD")
- Status indication via fill/outline: WIN = solid accent badge, LOSE = outline badge, NEUTRAL = surface-2 badge, PENDING = surface badge
- Animated blob field (3 drifting blurred circles) + grain overlay
- Theme toggle (day/night) with FOUC prevention, persists to localStorage
- Liquid-rail style for the main folder-tab row (matching current app's tab aesthetic, but folder-shaped)

## Sample data (realistic, from live API test of STIR 302678824)
- Company: "ARTIKUL AZIYA KABEL" MChJ, STIR 302678824
- Economic cases: 23 total (mix of plaintiff + defendant, outcomes: rad etilgan, qaytarilgan, to'liq qanoatlantirilgan, ko'rmasdan qoldirilgan)
- Civil cases: 3 total
- Administrative cases: 0 (404)
- Sample case numbers: 4-1001-2309/73488, 4-1001-2311/72627, 4-1001-2307/65093, 4-1001-2328/43727, 2-1005-2609/38122
- Sample outcomes: Рад этилган, Қайтарилган, Тўлиқ қаноатлантирилган, Кўрмасдан қолдирилган
- Date range: 2023-2026 (reg_date field)

## File location
- Preview: `/home/z/my-project/download/stats-tab-preview.html`
- Single self-contained HTML file (inline CSS + JS)
- NOT integrated into the main app
