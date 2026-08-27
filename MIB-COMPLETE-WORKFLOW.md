# MIB.uz — Complete Workflow & Integration Notes

> **STATUS: PAUSED.** All MIB code removed from the app in v98.
> This file preserves everything for future re-integration.
> Last updated: v98 (July 2026)

---

## 1. What mib.uz is

**mib.uz** = *Majburiy Ijro Byurosi* (Bureau of Compulsory Enforcement / BPI),
under the Prosecutor General's Office of Uzbekistan. IP `185.203.236.50`. Helpline **1107**.

Two public services:
1. **Қарздорликни текшириш** (Debt Check) — public, STIR + math captcha. Returns debt list.
2. **Ижро мониторинги** (Enforcement Monitoring) — requires phone + SMS verification. Returns full timeline.

---

## 2. Both services fully reverse-engineered

### Service 1: Debt Check ( automatable with manual captcha)

**Page:** `uz.mibcenter.mibfront.wicket.services.blacklist.BlackListV2Page`
**URL:** `https://mib.uz/bl` → 302 → 302 → 200 (Wicket session page)

**3 search tabs:**
| Tab | Fields | Search by |
|---|---|---|
| Passport | passport_sn(2) + passport_num(7) + captcha | individuals |
| PINFL | pinfl(14) + captcha | individuals |
| **STIR** | **inn(9) + captcha** | **legal entities** |

**Captcha:** Math equation in UZBEK WORDS (not digits). E.g. "саккиз-олти" = 8-6 = 2.
Uzbek number words: nol=0, bir=1, ikki=2, uch=3, to'rt=4, besh=5, olti=6, yetti=7, sakkiz=8, to'qqiz=9, on=10.
Answer is 1-4 digits.

**Submit:** Wicket AJAX POST. Requires:
- `Wicket-Ajax: true` header
- `Wicket-Ajax-BaseURL` header (from page JS)
- `X-Requested-With: XMLHttpRequest`
- `Content-Type: application/x-www-form-urlencoded`
- Body: `<formId>_hf_0=&inn=<STIR>&secure_code=<answer>&submit_button=1`
- Cookie: `JSESSIONID=<from redirect responses>`

**Result (no debt):**
```xml
<li class="feedbackPanelWARNING">
  <span>302678824 СТИР рақамли юридик шахсда қарздорлик аниқланмади</span>
</li>
```

**Result (debt found):** Returns a full debt list with:
- `Умумий қарздорлик` (total debt amount)
- `Жорий қарздорлик` (current debt amount)
- Multiple debt blocks, each with:
  - `Ижро иши рақами` (enforcement case number, 14 digits) — **this is the work_number for monitoring!**
  - `Ҳужжат ҳолати` (status: "Жараёнда" = In progress)
  - `И/Ҳ мазмуни` (subject: "Карз ундириш" = Debt collection)
  - `Ҳужжат иш юритувида` (department)
  - `Ундирувчи` (collector, masked)
  - `Қарздорлик миқдори` (debt amount)
  - `Батафсил...` button → links to full enforcement document

### Service 2: Enforcement Monitoring (requires phone + SMS)

**Page:** Separate Wicket page at `…/6ihd4/MJR84`

**3-step flow:**
1. **Step 1 (form):** STIR + work_number(16-digit) + phone + captcha → plain form POST
2. **Step 2 (SMS):** mib.uz sends SMS code to phone. Form changes to `verify_form` with `verify_code` field (maxlength 7)
3. **Step 3 (result):** Full enforcement document with 15+ fields

**The work_number (enforcement case number) is obtainable from Service 1** (debt check returns it in each debt block). This means we can get enforcement case numbers WITHOUT the monitoring flow.

**Full result fields (from saved ijrovaraqa4.html):**
- Ким томондан ижрога юборилган (sending court)
- Ижро варақа тури (doc type)
- И/ҳ рақами (case number, e.g. 2-1005-2607/16236-2-3957)
- И/Ҳ санаси, Қонуний кучга кирган сана (dates)
- Қарздор (debtor, masked), Ундирувчи (collector, masked)
- И/Ҳ кўрсатилган сумма, И/Ҳ мазмуни
- МИБ га келиб тушган сана, Ижро иши юритувни қўзғатиш санаси
- Бўлим (department), Давлат ижрочиси (bailiff name), Ижрочи телефони
- Ижро ҳаракатлари (actions timeline)
- Ижро ID, Ҳолати (status)
- QR codes (document + payment)
- Payment URLs (Payme, Click, Uzcard, Smst) with amount + worknum pre-filled
- Payment breakdown (main debt + enforcement fee + fine + costs = total)
- Bank transfer details

---

## 3. Network reachability

**mib.uz geo-blocks non-Uzbekistan IPs at the TCP level.** Connection to port 443 times out.

| Method | Result |
|---|---|
| Direct from cloud sandbox | TCP timeout |
| CF Workers (4 workers) | TCP timeout (workers are non-UZ IPs) |
| User's local machine (in Uzbekistan) | ✅ Works — 302 → 302 → 200 |
| Free UZ HTTP proxies (195.158.8.123:3128, 86.62.2.25:3128) | ✅ Work but flaky (~50% success) |

**Conclusion:** MIB integration only works from inside Uzbekistan (user's local machine or UZ VPS).

---

## 4. Captcha solving

The captcha uses **Uzbek number words**, not digits. Two approaches were tried:

### Approach A: VLM (z-ai-web-dev-sdk) — DOESN'T WORK locally
- The ZAI SDK uses `internal-api.z.ai` which is only accessible from Z.ai's cloud sandbox
- User's local machine gets `ConnectionRefused`
- Would need a public API endpoint (not internal) to work

### Approach B: Manual user input — WORKS
- Show captcha image to user
- User reads the Uzbek math words and types the numeric answer
- Two-phase API: GET returns captcha image, POST submits user's answer
- No external dependencies, works 100%

### Approach C: VLM via z-ai CLI (potential future)
- The `z-ai vision` CLI command works from the sandbox
- Could potentially work from user's machine if z-ai CLI is installed + configured
- Not tested from user's machine

---

## 5. Code structure (removed in v98, preserved here for re-integration)

### `src/lib/mib.ts`
- `fetchDirect()` — Node native fetch with manual redirect following + cookie collection
- `parseBlackListPage(html)` — extracts form ID, hidden field, inn input, submit button, captcha URL, AJAX URL, Wicket base URL
- `resolveUrl(relative, base)` — uses `URL` constructor (NOT string concatenation, which causes trailing-dot TLS errors)
- `parseWicketResponse(xml)` — extracts feedbackPanelWARNING (clean) / INFO (debt) / ERROR (captcha failed) + debt list
- `parseAmount(s)` — converts Uzbek number formatting ("42 989 464.35" → 42989464.35)
- `prepareMibCheck(tin)` — Phase 1: fetch page + captcha, return base64 image + session ID
- `submitMibCheck(tin, sessionId, captchaAnswer)` — Phase 2: submit form with user's answer
- In-memory session store (5-minute TTL) for passing Wicket session between phases

### `src/app/api/mib-debt/route.ts`
- `GET /api/mib-debt?tin=XXX` → Phase 1 (returns captcha image + session ID)
- `POST /api/mib-debt` body `{ tin, sessionId, captchaAnswer }` → Phase 2 (returns debt result)

### `src/app/page.tsx` — MibTab component
- STIR input + "Qarzdorlikni tekshirish" button
- Loading state (spinner)
- Captcha display (base64 image + input field + "Tekshirish" button + "Boshqa captcha" refresh)
- Result display (status badge + total debt + individual debts list with enforcement case numbers)
- Error state

### `src/app/page.tsx` — MibCheckButton (on court case cards)
- Appears on court cases with status containing "Ижро варақа билан"
- Shows "MIB ga ijro uchun yuborilgan" label
- Button calls `/api/mib-debt` and shows inline result

### Key types
```typescript
interface MibDebtResult {
  tin: string
  hasDebt: boolean
  status: 'clean' | 'debt' | 'error' | 'captcha_failed'
  message: string
  totalDebt?: number
  currentDebt?: number
  debts?: MibDebt[]
  checkedAt: number
}

interface MibDebt {
  enforcementCaseNumber: string  // 14-digit, used for monitoring lookup
  status: string                 // "Жараёнда" (In progress)
  subject: string                // "Карз ундириш" (Debt collection)
  department: string             // "Чилонзор тумани"
  collector: string              // masked
  amount: number                 // in so'm
}
```

---

## 6. Saved HTML artifacts

All in `/home/z/my-project/upload/`:

| File | What it is |
|---|---|
| `Ўзбекистон...html` | BlackListV2Page (debt check) with STIR 302678824 result: "қарздорлик аниқланмади" |
| `js.html` | EnforcementMonitoringPage (monitoring) — 3-tab form |
| `ijrovaraqa1.html` | Monitoring step 1 (form) |
| `ijrovaraqa2.html` | Monitoring step 2 (SMS verification form) |
| `ijrovaraqa3.html` | Monitoring step 2 (timer running) |
| `ijrovaraqa4.html` | Monitoring step 3 (FULL RESULT — all 15+ fields) |
| `test1_files.zip` | Debt-check result with DEBT FOUND (PINFL 42203910261534, 5 debts, total 42.9M so'm) |

---

## 7. Cross-linking with court cases

When a court case (from jadval.sud.uz) is sent to MIB for enforcement, its status changes to:
> **`Якунланган (Ижро варақа билан)`** = "Concluded (with enforcement document)"

This means we can detect from jadval.sud.uz (which works via CF workers, no geo-block) that a case was sent to MIB. The court case number suffix (e.g. `-2-3957` in `2-1005-2607/16236-2-3957`) is the enforcement document index, but it's NOT the same as MIB's work_number.

The `isSentToEnforcement(status)` function detects this:
```typescript
function isSentToEnforcement(status: string | null | undefined): boolean {
  if (!status) return false
  return /Ижро варақа|ижро варақа|Ижро ҳужжат|ижро ҳужжат/i.test(status)
}
```

---

## 8. Cloudflare Worker

`cloudflare-worker/proxy.js` has mib.uz in `ALLOWED_HOSTS`. This was for the proxy-based approach (Approach A). Since mib.uz geo-blocks CF worker IPs too, this doesn't help. But keeping it in the allow-list is harmless.

---

## 9. What's needed to re-enable MIB

1. **Unzip `src/lib/mib.ts`** and `src/app/api/mib-debt/route.ts` from v97 zip
2. **Add MibTab component** back to `page.tsx` (from v97)
3. **Add MibCheckButton** back to CourtCaseCard (from v85)
4. **Add 'mib' to tab type** and tab button list
5. **Run from inside Uzbekistan** (mib.uz geo-blocks foreign IPs)
6. User solves captcha manually (Uzbek math words)

The code is complete and was verified working up to STEP 3 (captcha download) on the user's machine. The only remaining step is the form submit + parse, which was tested manually via curl and returned the correct result.

---

## 10. Version history

| Version | What changed |
|---|---|
| v84 | Initial mib.ts with proxy + VLM captcha solver |
| v85 | MibCheckButton on court case cards |
| v86 | Full debt list parsing (enforcement case numbers + amounts) |
| v87 | MIB as a full 4th tab |
| v88 | HTML paste mode (removed in v89) |
| v89 | Removed https-proxy-agent, zero-dependency proxy tunnel |
| v90 | Fixed loading animation + reduced timeouts |
| v91 | Removed proxy, direct only, detailed step logging |
| v92-v93 | Fixed trailing-dot TLS error (URL constructor for redirects) |
| v94 | Fixed cookie collection + form parser |
| v95 | Added .z-ai-config (VLM config) |
| v96 | Replaced VLM with manual captcha (two-phase API) |
| v97 | Restored CF_WORKER_URLS in .env |
| **v98** | **Removed all MIB code, preserved in this file** |
