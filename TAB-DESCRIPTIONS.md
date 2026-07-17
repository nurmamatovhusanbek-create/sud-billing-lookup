# Sud Billing Lookup — What Each Tab Does

## Tab 1: To'lovlar (Bills)

Searches billing.sud.uz for every payment receipt (kvitansiya) issued to a company. Enter a 9-digit STIR and the app connects to billing.sud.uz, solves a proof-of-work captcha (SHA-256), and downloads the full list of receipts. Each receipt is then enriched with its payment status (paid, unpaid, partial), the amount, the court that issued it, the payment category (davlat boji or pochta), and the court case numbers it was used in. Results stream in progressively — the first receipt appears immediately while the rest load in parallel. You can also search by a single kvitansiya number instead of STIR. Each receipt can be expanded to show the full hearing history and court decision. Clicking "Ko'rish" on any receipt jumps to the Sud ishlari tab with that case pre-loaded.

## Tab 2: Sud ishlari (Court Cases)

Searches my.sud.uz (via jadval.sud.uz and jadvalapi.sud.uz) for court cases. You can search by STIR (company tax ID), PINFL (personal ID), or case number. The app queries both API sources in parallel, merges the results, and removes duplicates. Each case card shows the case number, court type, filing date, plaintiff, defendant, and the case outcome (result). Clicking "Tafsilotlarni ko'rish" expands the card to show full case details: judge, secretary, claim subject, claim amount, state duty, all hearing dates with statuses, the court decision text, and the plaintiff/defendant TINs (auto-looked up from orginfo.uz by company name). When you click "Ko'rish" from any other tab (Bills, Majlislari, Stats), this tab opens with the correct court type pre-selected and the case number pre-filled — it searches automatically.

## Tab 3: Sud majlislari (Upcoming Hearings)

Lets you save companies by STIR and monitor their upcoming scheduled court hearings. Saved companies persist in the browser's localStorage — no server storage needed. When you click a saved company, the app searches all 3 relevant court types (economic, civil, administrative — criminal is skipped because companies cannot be criminal defendants) for cases linked to that STIR, then filters for hearings scheduled from today onward. Each hearing card shows the case number, hearing date and time, court name, judge, plaintiff, and defendant. A refresh button (icon only) re-fetches the latest hearings. Clicking "Ko'rish" on any hearing jumps to the Sud ishlari tab with that case pre-loaded.

## Tab 4: Kompaniya (Company Info)

Fetches a complete company profile from two sources in parallel: orginfo.uz (the public company registry) and admin.chamber.uz (the Chamber of Commerce contractor rating). From orginfo.uz it gets the official name, short name, registration date, status, registering authority, legal form, address, director, charter capital, phone, email, and the full list of founders with their ownership shares. From chamber.uz it gets the contractor rating score (0–100), rating category (AAA to D), taxpayer type (e.g., SDT for large taxpayers), region, district, and the OKED economic activity classification (code, name, section). The rating card appears first (prominent, centered) with the score, category badge, taxpayer type, and full address. Below that is a quick-actions toolbar with buttons to jump to the other tabs (Sud ishlari, To'lovlar, Majlislar) and a link to the orginfo.uz page for that company. Then comes the full company info grid, the OKED industry details, and the founders list.

## Tab 5: Statistika (Stats)

Aggregates all court cases across 3 court types (economic, civil, administrative) for a given STIR and classifies each case as a win, loss, neutral, or pending based on the company's role (plaintiff vs defendant) and the case outcome. The app fires 4 API calls in parallel (orginfo.uz for company name, plus 3 court-type searches) and also falls back to chamber.uz for the company name if orginfo fails. Classification rules: if the company is the plaintiff and the case was fully or partially satisfied, it's a win; if rejected/returned/dismissed, it's a loss. If the company is the defendant and the case was fully or partially satisfied, it's a win (per the user's rule); if rejected/returned, it's neutral. Empty results are pending.

The tab has 5 folder tabs (trapezoidal, overlapping like file folders):

- **TAHLIL** (Analytics): The main dashboard. Shows a download toolbar at the top (select which court types to export, then download an Excel file), 5 summary cards (total, wins, losses, neutral, pending), a donut chart showing the outcome distribution, horizontal win-rate bars per court type, a court-type breakdown (clickable — opens that folder), and a top-5 case category list. Filters at the top let you narrow by date span (all-time, 1 year, 6 months, 30 days) and outcome (all, win, lose, neutral, pending).

- **IQTISODIY / FUQAROLIK / MA'MURIY**: Each shows a filterable, sortable list of cases for that court type. Each case card shows the case number, registration date, role badge (da'vogar or javobgar), outcome badge (win/lose/neutral/pending), the raw result text, the court name, and the counterparty. Clicking any case jumps to the Sud ishlari tab with that case pre-loaded (and passes the case data so it displays instantly without re-fetching).

- **MAJLISLAR**: Lazy-loads upcoming court hearings for the company by scanning jadvalapi.sud.uz (today + 90 days forward, skipping weekends and public holidays). Shows hearing cards with case number, date, time, court, and parties. Clicking a hearing jumps to Sud ishlari.

The Excel export generates an .xlsx file (built manually with jszip — no Excel library dependency) containing columns: Sud (court name), Ish raqami (case number), Da'vogar (plaintiff), Javobgar (defendant), Sana (date), Natija (result), Holat (classification), Sud turi (court type). The file is generated server-side from the case data the client already has (POST request), so it's instant.
