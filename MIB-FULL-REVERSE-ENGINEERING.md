# mib.uz — Complete Reverse-Engineering (from saved HTML)

> Fully reverse-engineered from 6 saved HTML files. All forms, fields, and result
> structures mapped below. Live scraping blocked by geo-filter (see MIB-RESUMPTION.md).

## Saved HTML artifacts (in /home/z/my-project/upload/)

| File | What it is | Key content |
|---|---|---|
| `Ўзбекистон...html` | BlackListV2Page (debt check) | STIR tab form, STIR 302678824 result: "қарздорлик аниқланмади" (clean) |
| `js.html` | EnforcementMonitoringPage (monitoring) | 3-tab form (passport/pinfl/juridical), no result |
| `ijrovaraqa1.html` | Monitoring — juridical form (step 1) | inn + work_number + phone + captcha form |
| `ijrovaraqa2.html` | Monitoring — SMS step (step 2) | verify_form with verify_code field, "код sent to +998917732272" |
| `ijrovaraqa3.html` | Monitoring — SMS step (timer running) | Same as #2, countdown timer at 19s |
| `ijrovaraqa4.html` | Monitoring — **FULL RESULT** (step 3) | Complete enforcement document data + actions timeline |

---

## Service 1: "Қарздорликни текшириш" (Debt Check) — FULLY AUTOMATABLE

### Page
`uz.mibcenter.mibfront.wicket.services.blacklist.BlackListV2Page`

### 3 tabs
| Tab | DOM id | Fields | Search by |
|---|---|---|---|
| Passport | `tab_individual` | passport_sn(2) + passport_num(7) + captcha | individuals |
| PINFL | `tab_pinfl` | pinfl(14) + captcha | individuals |
| **STIR** | `tab_juridical` | **inn(9) + captcha** | **legal entities** ✅ |

### STIR form (we use this)
```html
<form id="id33" method="post" action="…/6ihd4/Dzvcf">
  <input type="hidden" name="id33_hf_0">
  <input name="inn" maxlength="9" required>
  <img id="id3f" src="…/Rz_86">  <!-- math captcha image -->
  <input name="secure_code" maxlength="4" required>
  <button name="submit_button" id="id34">Қидириш</button>
</form>
```

### Submit = Wicket AJAX POST
```http
POST /<obfuscated-url>/6ihd4/vkV60
Wicket-Ajax: true
Wicket-Ajax-BaseURL: <from page JS>
Accept: application/json
Content-Type: application/x-www-form-urlencoded
Cookie: JSESSIONID=<from initial GET>

id33_hf_0=&inn=302678824&secure_code=<VLM-solved>&submit_button=1
```

### Result (STIR 302678824 — clean)
```html
<span class="feedback_bb" id="id41">
  <ul class="feedbackPanel">
    <li class="feedbackPanelWARNING">
      <span>302678824 СТИР рақамли юридик шахсда қарздорлик аниқланмади</span>
    </li>
  </ul>
</span>
```
Status classes: `feedbackPanelWARNING` = no debt · `feedbackPanelINFO` = debt found · `feedbackPanelERROR` = bad captcha

---

## Service 2: "Ижро мониторинги" (Enforcement Monitoring) — 3-STEP FLOW

### Page
Separate Wicket page at `…/6ihd4/MJR84`

### Juridical form (step 1)
```html
<form id="juridical_form" method="post" action="…/6ihd4/1W932">
  <input type="hidden" name="juridical_form_hf_0">
  <input name="inn" maxlength="9" required>           <!-- STIR -->
  <input name="work_number" maxlength="16" required>  <!-- enforcement case # -->
  <input name="phone" data-ms="phone" required>       <!-- (99) 999 99 99 -->
  <img id="id5a" src="…/lMoad">                       <!-- math captcha -->
  <input name="secure_code" maxlength="4" required>
  <button id="id56">Қидириш</button>
</form>
```
Plain form POST (not AJAX). Wicket AJAX only for captcha refresh.

### SMS verification (step 2) — `verify_form`
After step 1 submits, mib.uz sends an SMS code to the phone. Form changes to:
```html
<form id="verify_form" method="post" action="…/6ihd4/...">
  <input type="hidden" name="verify_form_hf_0">
  <input name="verify_code" maxlength="7" required>  <!-- SMS code, 7 digits -->
  <button id="id2b">Юбориш</button>
</form>
```
UI shows: "+998917732272 рақамга текшириш коди жунатилди" + countdown timer (40s) + "Қайта юбориш" (resend) link.

### Full result (step 3) — enforcement document data
After correct SMS code, the complete enforcement document is shown:

```
Ким томондан ижрога юборилган    Фуқаролик ишлари бўйича Яккасарой туманларо суди
Ижро варақа тури                  Cуд буйруғи
И/ҳ рақами                        2-1005-2607/16236-2-3957
И/Ҳ санаси                        14.04.2026
Қонуний кучга кирган сана         14.04.2026
Қарздор                           AB***SI KR***NA BA***NA  (masked)
Ундирувчи                         "**R B**" AK***IK JA***TI  (masked)
И/Ҳ кўрсатилган сумма             20 600.00
И/Ҳ мазмуни                       Карз ундириш
МИБ га келиб тушган сана          17.04.2026
Ижро иши юритувни қўзғатиш санаси 18.04.2026 09:28:03
Бўлим                             Тошкент шаҳри
Давлат ижрочиси                   MURODOV TAVAKKAL ULUGBEK O'G'LI
Ижрочи телефони                   887716107

Ижро ҳаракатлари (Enforcement Actions timeline):
  Ҳаракат санаси                  23-Модда (Ижро иши юритишни қўзғатиш)   18.04.2026
                                  Ижро йигимини ундириш тугрисида          29.04.2026
```

### Can we skip phone/SMS?
**No.** The phone field is `required="required"` server-side (Wicket enforces). The SMS step is a deliberate identity-verification gate — without it, only step 1's form is shown, no result data. The phone+SMS cannot be bypassed for the full timeline.

**However**: Service 1 (debt check) needs NO phone/SMS at all — just STIR + captcha. So we CAN fully automate the debt check. We CANNOT fully automate the monitoring timeline.

---

## Complete field map for the result (ijrovaraqa4)

### Enforcement document (main result)
| UZ label | Meaning | Example | Parser note |
|---|---|---|---|
| Ким томондан ижрога юборилган | Sent by (court) | Фуқаролик ишлари бўйича Яккасарой туманларо суди | |
| Ижро варақа тури | Doc type | Cуд буйруғи | |
| И/ҳ рақами | Case number | 2-1005-2607/16236-2-3957 | mono |
| И/Ҳ санаси | Doc date | 14.04.2026 | DD.MM.YYYY |
| Қонуний кучга кирган сана | Effective date | 14.04.2026 | DD.MM.YYYY |
| Қарздор | Debtor | AB***SI KR***NA BA***NA | masked |
| Ундирувчи | Collector | "**R B**" AK***IK JA***TI | masked |
| И/Ҳ кўрсатилган сумма | Amount | 20 600.00 | number |
| И/Ҳ мазмуни | Subject | Карз ундириш | |
| МИБ га келиб тушган сана | MIB received date | 17.04.2026 | DD.MM.YYYY |
| Ижро иши юритувни қўзғатиш санаси | Proceedings opened | 18.04.2026 09:28:03 | datetime |
| Бўлим | Department | Тошкент шаҳри | |
| Давлат ижрочиси | State executor (bailiff) | MURODOV TAVAKKAL ULUGBEK O'G'LI | |
| Ижрочи телефони | Executor phone | 887716107 | |
| Ижро ҳаракатлари | Actions timeline | [{action, date}] | repeating |

### Status + Execution ID (NEW — found in ijrovaraqa3_files.zip)
| UZ label | Meaning | Example |
|---|---|---|
| Ижро ID | Execution ID | 10072616893301 (= RegNum + "01" suffix) |
| Ҳолати | Status | Жараёнда (In progress) |
| Timestamp | Last updated | 07.07.2026 10:47:14 |

### QR codes (NEW)
Two QR codes are generated client-side via jquery.qrcode:
1. **Document QR** (`.qrcode`): encodes `date=07.07.2026&&RegNum=100726168933`
2. **Payment QR** (`.qrcode_pay`): encodes `id=10072616893301`

### Payment integration (NEW — direct pay links!)
The result page includes ready-to-use payment URLs for 4 providers:
| Provider | URL pattern | Key params |
|---|---|---|
| **Payme** | `https://payme.uz/fallback/merchant/?id=5d245b8e659a204299fc01f4&payment_type=01&amount=2163000.0&worknum=10072616893301` | merchant id, amount (in tiyins), worknum |
| **Click** | `https://my.click.uz/services/pay/?service_id=13949&merchant_id=9571&amount=21630.0&return_url=https://mib.uz&transaction_param=10072616893301` | service_id, merchant_id, amount, transaction_param |
| **Uzcard** | `https://myuzcard.uz/payment/1648` | service id only |
| **Smst** | `https://pay.smst.uz/prePay.do?personalAccount=10072616893301&amount=21630.0&serviceId=522&apiVersion=1` | personalAccount, amount, serviceId |

### Payment breakdown (NEW)
| UZ label | Meaning | Example |
|---|---|---|
| асосий қарздорлик | Main debt | 20 600 |
| ижро йиғими | Enforcement fee | 1 030 |
| жарима | Fine | 0 |
| ижро харажатлари | Execution costs | 0 |
| Жами | Total | 21 630 |

### Bank details (for direct bank transfer)
| UZ label | Example |
|---|---|
| Банк номи | АТБ "Бизнесни ривожлантириш банк" Тошкент ш. Минтақавий филиали |
| ҳ/р (bank account) | 20203000100786308002 |
| БММ рақами / МФО | 01037 |
| Тўловчининг номи | ABBASI KRISTINA BAXTIYAROVNA (debtor name, unmasked!) |
| Тўлов мақсади | Карз ундириш |

---

## Build plan (when geo-block is solved)

### Phase 1 — `src/lib/mib.ts` (debt check, full auto)
1. GET BlackListV2Page via UZ proxy → parse form action, captcha img src, JSESSIONID
2. Download captcha → base64 → VLM math solve (reuse solveCaptchaMath)
3. Wicket AJAX POST: `id33_hf_0=&inn=<STIR>&secure_code=<VLM>&submit_button=1`
4. Parse `<li class="feedbackPanel*">` → status + message

### Phase 2 — `/api/mib-debt` route
`GET /api/mib-debt?tin=302678824` → `{ tin, hasDebt, status, message, debts?, checkedAt }`

### Phase 3 — UI debt-check button
Bill card expand section: "MIB'dan tekshirish" → calls /api/mib-debt → inline badge

### Phase 4 — `src/lib/mib-monitoring.ts` (assisted, human-in-loop)
Modal: user enters work_number + phone → backend submits step 1 → user enters SMS code → backend submits step 2 → parse + display full timeline

### Phase 5 — User-pastes-HTML fallback (works TODAY, no proxy needed)
If geo-block can't be solved: user opens mib.uz in their browser, fills the form, saves the result HTML, uploads it to our app. Parser extracts all fields from the saved HTML (we have the complete structure from ijrovaraqa4).

---

## Geo-block status
mib.uz (185.203.236.50) **only accepts connections from Uzbekistan IPs**. CF Workers, allorigins, direct curl, Agent Browser ALL time out. Other Uzbek gov sites (billing.sud.uz, my.sud.uz, jadval.sud.uz) work fine through the same workers. Need either:
1. Uzbekistan-based VPS/proxy, OR
2. User-pastes-HTML mode (Phase 5), OR
3. Browser extension that runs in user's UZ browser
