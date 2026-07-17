# Sud Billing Lookup — All User-Facing Text for Translation

> **Instructions:** Replace the English text in the "English" column with Uzbek translation in the "Uzbek" column. Keep the Location and Context columns as-is for reference.

---

## 1. Header (`page.tsx` ~line 3600)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Sud Billing Lookup | | Header h1 | App title |
| billing.sud.uz receipt importer | | Header subtitle | App subtitle |
| billing.sud.uz | | Header external link | Link text |
| Why Tor? | | Header button | Why Tor popover trigger |
| Tor routes your lookup through an anonymous network so billing.sud.uz can't tie the request back to your computer. Recent searches are stored only in your browser's localStorage. | | Why Tor popover content | Explanation tooltip |
| Checking Tor… | | Header badge | Tor status: checking |
| Tor… | | Header badge (mobile) | Tor status: checking (short) |
| Tor Active | | Header badge | Tor status: active |
| Tor not detected — click to install | | Header badge | Tor status: inactive |
| Installing Tor… | | Header badge | Tor status: installing |
| Tor is active! You can now search bills. | | Toast message | Tor install success |
| Installation failed | | Toast message | Tor install error |

---

## 2. Tab Labels (`page.tsx` ~line 3596)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Bills | | Tab 1 | Bills tab label |
| Court Cases | | Tab 2 | Court Cases tab label |
| Hearings | | Tab 3 | Upcoming Hearings tab label |

---

## 3. Bills Tab — Search Hero (`page.tsx` ~line 3628)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Uzbekistan · billing.sud.uz | | Eyebrow | Section label |
| Import every bill issued under a company | | H2 heading | Search hero title |
| Enter company TIN / STIR (9 digits) | | Input placeholder | TIN input field |
| Company TIN | | Input aria-label | TIN input accessibility |
| Enter 9 digits — X more to go | | Input hint | Partial TIN hint |
| 9 digits — ready to search | | Input hint | Complete TIN hint |
| Search Bills | | Button text | Search button |
| Searching… {elapsed}s | | Button text | Search button (loading) |
| Try: | | Label | Sample INN section |
| Recent: | | Label | Recent searches section |
| Removed from recent searches | | Toast message | Recent search removed |

---

## 4. Bills Tab — Description Paragraph (`page.tsx` ~line 3637)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Enter a company INN / STIR (9 digits). The app opens billing.sud.uz on the Yuridik shaxs path, solves the captcha and imports all receipts — showing the type (davlat boji / pochta), paid amount, status, court and the court case numbers each bill was used for. | | Description paragraph | Search hero description |

---

## 5. Bills Tab — Feature Cards (Default State) (`page.tsx` ~line 1366)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Import all receipts | | Feature card 1 title | |
| Every bill (kvitansiya) created under the INN is pulled from billing.sud.uz. | | Feature card 1 desc | |
| See type & status | | Feature card 2 title | |
| Each bill is tagged as davlat boji or pochta, with paid amount and payment status. | | Feature card 2 desc | |
| Court case numbers | | Feature card 3 title | |
| For every receipt, the court that used it and the case / work number are listed. | | Feature card 3 desc | |
| Looked up privately | | Feature card 4 title | |
| The request runs over Tor, so the lookup can't be tied back to your device. | | Feature card 4 desc | |

---

## 6. Bills Tab — Loading State (`page.tsx` ~line 1259)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Looking up INN {inn}… | | Loading title | Phase: connecting |
| Importing bills for INN {inn}… | | Loading title | Phase: enriching |
| Opening billing.sud.uz on the Yuridik shaxs path. | | Loading detail | Phase: connecting |
| Fetching detailed status for each receipt from billing.sud.uz. | | Loading detail | Phase: enriching |
| Fetching each bill's court, amount, status and case numbers… | | Loading detail | Progress bar |
| {elapsed}s elapsed | | Loading timer | Elapsed time |
| {loaded} / {total} bills loaded | | Progress counter | Progress bar |
| {elapsed}s · {pct}% | | Progress counter | Progress bar percentage |
| Connecting | | Phase step 1 | Phase timeline |
| Verifying Access | | Phase step 2 | Phase timeline |
| Searching Bills | | Phase step 3 | Phase timeline |
| Fetching Details | | Phase step 4 | Phase timeline |
| Retrying {failed} failed bills (round {n})… | | Phase detail | Retry loop |
| Origin temporarily down — retrying ({n}/{total})… | | Phase detail | 521 retry |

---

## 7. Bills Tab — Error & No Results (`page.tsx` ~line 3753)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Lookup failed | | Alert title | Error state |
| billing.sud.uz is temporarily unreachable. The server may be down or rate-limiting. | | Alert description | Error message |
| Try Again | | Button text | Error CTA |
| No bills found | | Card title | No results state |
| No receipts are registered under TIN {tin} in the billing.sud.uz database. The company may be newly registered or hasn't paid any court fees yet. | | Card description | No results detail |
| Search another TIN | | Button text | No results CTA |
| No bills match the current filters. | | Empty filter text | Filter no results |
| Detail unavailable | | Alert title | Bill-level error |
| INN must be exactly 9 digits | | Toast error | Validation |
| No bills found for this INN | | Toast info | Empty results |
| Imported {count} bill(s) | | Toast success | Bills imported |

---

## 8. Bills Tab — Summary Cards (`page.tsx` ~line 1093)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Summary | | Section label | Summary cards header |
| Total Bills | | Card label | Summary card 1 |
| Paid | | Card label | Summary card 2 |
| Unpaid | | Card label | Summary card 3 |
| Total Amount | | Card label | Summary card 4 |
| Total Paid | | Card label | Summary card 5 |
| Outstanding | | Card label | Summary card 6 |
| so'm | | Card sub-label | Currency unit |

---

## 9. Bills Tab — Sticky Mini-Summary (`page.tsx` ~line 1167)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| bills | | Mini-summary | Count label |
| paid | | Mini-summary | Count label |
| unpaid | | Mini-summary | Count label |
| Refresh | | Button text | Refresh button |

---

## 10. Bills Tab — Sort + Filter Bar (`page.tsx` ~line 3865)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Sort by date: | | Label | Sort section |
| Newest First | | Select option | Sort dropdown |
| Oldest First | | Select option | Sort dropdown |
| Sort order | | Select placeholder | Sort dropdown |
| Filter: | | Label | Filter section |
| Paid | | Filter chip | Filter button |
| Unpaid | | Filter chip | Filter button |
| Davlat boji | | Filter chip | Filter button (already Uzbek) |
| Pochta | | Filter chip | Filter button (already Uzbek) |
| Cards | | View toggle | View button |
| Table | | View toggle | View button |
| Per page: | | Label | Page size selector |
| 10 per page | | Select option | Page size |
| 20 per page | | Select option | Page size |
| 50 per page | | Select option | Page size |
| 100 per page | | Select option | Page size |
| No results | | Page nav | No results text |
| {start}–{end} of {total} | | Page nav | Result range |
| Page {current} / {total} | | Page nav | Page indicator |
| Previous page | | Page nav | Aria-label |
| Next page | | Page nav | Aria-label |

---

## 11. Bill Card — Money Cells (`page.tsx` ~line 779)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Receipt Amount | | Cell label | Money cell 1 |
| Paid | | Cell label | Money cell 2 |
| Unpaid | | Cell label | Money cell 3 |
| Spent | | Cell label | Money cell 4 |
| Balance | | Cell label | Money cell 5 |
| so'm | | Cell sub-label | Currency unit |

---

## 12. Bill Card — Court + Dates (`page.tsx` ~line 835)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Court | | Field label | Court name |
| first instance | | Field sub-label | Instance type (lowercase) |
| Issued | | Field label | Issue date |
| Valid Until | | Field label | Expiry date |
| Purpose: | | Field label | Purpose text |
| Type: | | Field label | Type text |
| Total: | | Field label | Total amount |

---

## 13. Bill Card — Court Usage Accordion (`page.tsx` ~line 916)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Court usage & case numbers ({count}) | | Accordion title | Court usage section |
| № Claim case number: | | Label | Claim case number box |
| Case / work number | | Table header | Case numbers table |
| Status | | Table header | Case status column |
| Amount | | Table header | Amount column |
| Date | | Table header | Date column |

---

## 14. Bill Table (`page.tsx` ~line 993)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| # | | Table header | Index column |
| Bill number | | Table header | Bill number column |
| Court type | | Table header | Court type column |
| Category | | Table header | Category column |
| Status | | Table header | Status column |
| Amount | | Table header | Amount column |
| Paid | | Table header | Paid column |
| Court | | Table header | Court column |
| Date | | Table header | Date column |

---

## 15. Status Badges (`page.tsx` ~line 195)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Not paid | | STATUS_META | CREATED status |
| Partially paid | | STATUS_META | PARTIALLY_PAID status |
| Fully paid | | STATUS_META | PAID status |
| Awaiting confirmation | | STATUS_META | CHECKING status |
| Cancelled | | STATUS_META | CANCELLED status |
| Used | | STATUS_META | USED status |
| Error | | STATUS_META | BREAKED status |
| Sent to BPI | | STATUS_META | SENT_TO_MIB status |
| Unknown | | StatusBadge | Unknown status fallback |

---

## 16. Court Type Badges (`page.tsx` ~line 373)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Criminal court | | COURT_TYPES | CRIMINAL |
| Civil court | | COURT_TYPES | CITIZEN |
| Administrative court | | COURT_TYPES | ADMINISTRATIVE |
| Economic court | | COURT_TYPES | ECONOMIC |
| Military court | | COURT_TYPES | MILITARY |

---

## 17. Court Cases Tab — Search Hero (`page.tsx` ~line 2855)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Uzbekistan · my.sud.uz | | Eyebrow | Section label |
| Search court cases | | H2 heading | Search hero title |
| Search cases in the {courtType} ({courtTypeUz}) portal. Look up by company TIN (СТИР), individual PINFL (ЖШШИР), or case number (Иш рақами) — see hearings, decisions and documents for each instance. | | Description paragraph | Search hero description |
| Court type | | Label | Court type select |
| Search mode | | Label | Search mode select |
| Economic Courts (Иқтисодий) | | Select option | Court type dropdown |
| Civil Courts (Фуқаролик) | | Select option | Court type dropdown |
| Criminal Courts (Жиноят) | | Select option | Court type dropdown |
| Administrative Courts (Маъмурий) | | Select option | Court type dropdown |
| By TIN (СТИР) | | Select option | Search mode dropdown |
| By Case Number (Иш рақами) | | Select option | Search mode dropdown |
| By PINFL (ЖШШИР) | | Select option | Search mode dropdown |
| Enter 9-digit TIN | | Input placeholder | TIN input |
| Enter 14-digit PINFL | | Input placeholder | PINFL input |
| e.g. 4-1001-2605/14720 | | Input placeholder | Case number input |
| e.g. 2-1005-2611/33772 | | Input placeholder | Civil case number |
| e.g. 1-0001-2601/12345 | | Input placeholder | Criminal case number |
| Enter search value | | Input placeholder | Generic fallback |
| Search cases | | Button text | Search button |
| Searching… {elapsed}s | | Button text | Search button (loading) |
| Try: | | Label | Sample searches |
| TIN | | Recent search label | Recent TIN |
| Enter a search value | | Toast error | Validation |
| TIN must be exactly 9 digits | | Toast error | Validation |
| PINFL must be exactly 14 digits | | Toast error | Validation |
| Case number format: X-XXXX-XXXX/XXXXX | | Toast error | Validation |
| No court cases found | | Toast info | Empty results |
| Found {count} case(s) | | Toast success | Cases found |

---

## 18. Court Cases Tab — Loading State (`page.tsx` ~line 1473)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Searching court cases for "{value}"… | | Loading title | Search loading |
| Opening my.sud.uz, solving the captcha and querying the case monitoring portal. | | Loading detail | Search loading detail |
| {elapsed}s elapsed | | Loading timer | Elapsed time |
| Connecting | | Phase step 1 | Phase timeline |
| Verifying Access | | Phase step 2 | Phase timeline |
| Searching cases | | Phase step 3 | Phase timeline |

---

## 19. Court Cases Tab — Error & No Results (`page.tsx` ~line 2984)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Search failed | | Alert title | Error state |
| my.sud.uz is temporarily unreachable. The server may be down or rate-limiting. | | Alert description | Error message |
| Try Again | | Button text | Error CTA |
| No court cases found | | Card title | No results state |
| No cases match {value} in the {courtType}. | | Card description | No results detail |
| No cases match the current filters. | | Empty filter text | Filter no results |

---

## 20. Court Cases Tab — Results Bar & Sort (`page.pyx` ~line 3040)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Results | | Section label | Results bar |
| {count} case(s) | | Results value | Case count |
| Refresh | | Button text | Refresh button |
| Sort: | | Label | Sort section |
| Newest First | | Select option | Sort dropdown |
| Oldest First | | Select option | Sort dropdown |
| By Case Type | | Select option | Sort dropdown |
| By Status | | Select option | Sort dropdown |
| Status: | | Label | Status filter |
| All | | Filter button | Status filter (all) |

---

## 21. Court Cases Tab — Feature Cards (Default State) (`page.tsx` ~line 2255)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Search by TIN / PINFL | | Feature card 1 title | |
| Find every case linked to a company (TIN) or individual (PINFL) across Economic and Civil courts. | | Feature card 1 desc | |
| Search by case number | | Feature card 2 title | |
| Look up a specific case by its number (e.g. 4-1001-2605/14720) to see full details. | | Feature card 2 desc | |
| 4 court types | | Feature card 3 title | |
| Economic, Civil, Criminal, Administrative — the 4 main Uzbek court systems. | | Feature card 3 desc | |
| Hearings timeline | | Feature card 4 title | |
| Each case expands to show its hearings, judges, courtrooms, and decisions across all instances. | | Feature card 4 desc | |

---

## 22. Court Case Card (`page.tsx` ~line 2107)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Court | | Field label | Court name |
| Date filed | | Field label | Date filed |
| Plaintiff | | Field label | Plaintiff name |
| Defendant | | Field label | Defendant name |
| Result: | | Box label | Result type box |
| View details | | Button text | Expand button |
| Hide details | | Button text | Collapse button |
| Copy | | Button text | Copy button |

---

## 23. Case Detail View — General Information (`page.tsx` ~line 1961)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Умумий маълумотлар · General Information | | Section label | Already bilingual — keep or adjust |
| Court | | InfoRow label | Court name |
| Case number | | InfoRow label | Case number |
| Case type | | InfoRow label | Case type |
| Case status | | InfoRow label | Case status |
| Judge | | InfoRow label | Judge name |
| Claim subject | | InfoRow label | Claim subject |
| Secretary | | InfoRow label | Secretary name |
| Plaintiff | | InfoRow label | Plaintiff name |
| Plaintiff TIN | | InfoRow label | Plaintiff TIN |
| Looking up... | | InfoRow value | TIN auto-lookup loading |
| Defendant | | InfoRow label | Defendant name |
| Defendant TIN | | InfoRow label | Defendant TIN |
| Third party | | InfoRow label | Third party |
| Representative | | InfoRow label | Representative |
| Prosecutor | | InfoRow label | Prosecutor |
| Claim amount | | InfoRow label | Claim amount |
| State duty | | InfoRow label | State duty |
| Application date | | InfoRow label | Application date |
| First hearing | | InfoRow label | First hearing date |
| Deadline date | | InfoRow label | Deadline date |
| Loading case details… | | Loading title | Detail loading |
| Failed to load case details | | Alert title | Detail error |
| Connecting | | Phase step 1 | Detail loading timeline |
| Verifying Access | | Phase step 2 | Detail loading timeline |
| Fetching Details | | Phase step 3 | Detail loading timeline |

---

## 24. Instance View — Accordions (`page.tsx` ~line 2068)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| First Instance | | Accordion title | Instance 1 |
| Appellate | | Accordion title | Instance 2 |
| Cassation | | Accordion title | Instance 3 |
| {count} hearings, {docs} docs | | Accordion sub-label | Instance summary |
| Hearings | | Section label | Hearings section |
| No instance data available. | | Empty state | No instance data |

---

## 25. Hearing Details (`page.tsx` ~line 1654)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Courtroom: {courtroom} | | Hearing detail | Courtroom |
| Judge: {judge} | | Hearing detail | Judge |
| Postponed: {reason} | | Hearing detail | Postponement reason |

---

## 26. Decision Box (`page.tsx` ~line 1697)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Decision | | Section label | Decision box |
| Date: | | Field label | Decision date |
| Type: | | Field label | Decision type |
| Text: | | Field label | Decision text |
| Awarded: | | Field label | Awarded amount |
| State duty recovered: | | Field label | State duty recovered |
| Enforced: | | Field label | Enforced date |
| Appeal deadline: | | Field label | Appeal deadline |

---

## 27. Case Status Badges (`court-case-types.ts` ~line 91)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| In Proceedings | | CASE_STATUSES | Иш юритувда |
| Under Review | | CASE_STATUSES | Кўриб чиқилмоқда |
| Completed | | CASE_STATUSES | Тугатилган |
| Suspended | | CASE_STATUSES | Тўхтатилган |
| Cancelled | | CASE_STATUSES | Бекор қилинган |
| In Appeal | | CASE_STATUSES | Апелляцияда |
| In Cassation | | CASE_STATUSES | Кассацияда |
| Under Supervisory Review | | CASE_STATUSES | Назоратда |
| Under Enforcement | | CASE_STATUSES | Ижро этилмоқда |

---

## 28. Hearing Status Badges (`court-case-types.ts` ~line 103)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Scheduled | | HEARING_STATUSES | Тайинланган |
| Postponed | | HEARING_STATUSES | Кечиктирилган |
| Conducted | | HEARING_STATUSES | Ўтказилган |
| Cancelled | | HEARING_STATUSES | Бекор қилинган |
| Finalized | | HEARING_STATUSES | Якунланган |

---

## 29. Upcoming Hearings Tab — Search Hero (`page.tsx` ~line 2398)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Uzbekistan · my.sud.uz | | Eyebrow | Section label |
| Upcoming Hearings | | H2 heading | Search hero title |
| Save your companies and track their upcoming court hearings across all 4 court types (Economic, Civil, Criminal, Administrative). Shows judge, court, date, time, and parties. | | Description paragraph | Search hero description |
| TIN (9 digits) | | Input placeholder | TIN input |
| Company name (optional) | | Input placeholder | Name input |
| Save | | Button text | Save company button |

---

## 30. Upcoming Hearings Tab — Saved Companies (`page.tsx` ~line 2445)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Saved Companies ({count}) | | Section label | Saved companies header |
| Remove | | Button aria-label | Remove company |
| Loading… {elapsed}s | | Card status | Loading status |
| {count} upcoming | | Card status | Hearing count |
| Searching all 4 court types for TIN {tin}… | | Loading title | Search loading |
| Querying Economic, Civil, Criminal, and Administrative courts for upcoming hearings. | | Loading detail | Search loading detail |
| {elapsed}s elapsed | | Loading timer | Elapsed time |

---

## 31. Upcoming Hearings Tab — Results (`page.tsx` ~line 2523)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Upcoming Hearings | | Section label | Results bar |
| {count} hearing(s) for {tin} | | Results value | Hearing count |
| Refresh | | Button text | Refresh button |
| Failed to fetch hearings | | Alert title | Error state |
| No upcoming hearings | | Card title | No results state |
| No upcoming hearings found for TIN {tin} across all 4 court types. The company may not have any scheduled hearings. | | Card description | No results detail |

---

## 32. Upcoming Hearing Card (`page.tsx` ~line 2618)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Hearing Date | | Field label | Hearing date+time |
| Court | | Field label | Court name |
| Judge | | Field label | Judge name |
| Plaintiff | | Field label | Plaintiff name |
| Defendant | | Field label | Defendant name |
| Copy | | Button text | Copy button |

---

## 33. Upcoming Hearings Tab — Feature Cards (Default State) (`page.tsx` ~line 2570)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Save companies | | Feature card 1 title | |
| Add company TINs you want to monitor for upcoming hearings. | | Feature card 1 desc | |
| All 4 court types | | Feature card 2 title | |
| Searches Economic, Civil, Criminal, and Administrative courts in parallel. | | Feature card 2 desc | |
| Full case info | | Feature card 3 title | |
| Shows judge, court, date, time, plaintiff, and defendant for each hearing. | | Feature card 3 desc | |
| Refresh anytime | | Feature card 4 title | |
| Click a saved company to see its latest upcoming hearings. | | Feature card 4 desc | |

---

## 34. Glossary Tooltips (`page.tsx` ~line 99)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| "Legal entity" — a registered company or organization, as opposed to an individual person. | | GLOSSARY | yuridik-shaxs |
| "State duty" — a government filing fee, usually paid to file a court case. | | GLOSSARY | davlat-boji |
| "Postal fee" — a fee for delivering court documents by mail. | | GLOSSARY | pochta |
| The court's internal reference number for a specific case this bill is linked to. | | GLOSSARY | case-number |
| The 9-digit tax ID every registered company in Uzbekistan has. | | GLOSSARY | inn-stir |

---

## 35. Footer (`page.tsx` ~line 3964)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Icons by Icons8 | | Footer text | Attribution |

---

## 36. Appellate Metadata (`page.tsx` ~line 1617)

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Appellant: | | Field label | Appellate metadata |
| Filed: | | Field label | Appeal filed date |
| Appellate court: | | Field label | Appellate court |
| Outcome: | | Field label | Appellate outcome |

---

## 37. Misc / Shared

| English | Uzbek | Location | Context |
|---------|-------|----------|---------|
| Copy | | Button text | Copy button (shared) |
| copied | | Toast text | Copy success (after label) |
| Connecting to billing.sud.uz… | | Phase detail | Bills search connecting |
| Searching bills for INN {inn}… | | Phase detail | Bills search searching |
| Search returned empty - retrying with fresh captcha (attempt {n})… | | Phase detail | Captcha retry |
| Retrying with fresh captcha (attempt {n})… | | Phase detail | Captcha retry |
