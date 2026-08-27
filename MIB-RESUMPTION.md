# MIB.uz Integration — RESUMPTION NOTES

> **Pick up from here next time.** This file is the single source of truth for the mib.uz work.
> Last updated: after reverse-engineering both services from user-saved HTML.

## Status: RESEARCH COMPLETE, LIVE SCRAPING BLOCKED BY GEO-FILTER

mib.uz (185.203.236.50) is **geo-blocked at the TCP layer** — it only accepts connections from Uzbekistan IP ranges. ALL foreign IPs time out (522/000), including:
- 4 CF Workers (after redeploy with full Chrome browser headers)
- allorigins proxy
- direct curl from sandbox
- Agent Browser (real Chromium)

Other Uzbek gov sites (billing.sud.uz, my.sud.uz, jadval.sud.uz) work fine through the same workers — mib.uz is uniquely geo-filtered. The full browser-fingerprint headers did NOT help because the block happens before HTTP (TCP connection itself times out).

**The reverse-engineering is COMPLETE** (saved HTML has everything: form structure, Wicket AJAX config, captcha type, field names, STIR 302678824 test result). We just can't make LIVE requests to mib.uz from outside Uzbekistan.

---

## The two mib.uz services

### Service 1 — "Қарздорликни текшириш" (Debt Check) ✅ fully mapped, fully automatable

- **Page class:** `uz.mibcenter.mibfront.wicket.services.blacklist.BlackListV2Page`
- **Inputs:** STIR (9-digit `inn` field) + math captcha (4-digit `secure_code`, VLM-solvable)
- **Submit:** Wicket AJAX POST (`Wicket-Ajax: true`, `Accept: application/json`)
- **Result:** `<li class="feedbackPanelWARNING|INFO|ERROR">` with message
- **STIR 302678824 tested result:** "302678824 СТИР рақамли юридик шахсда қарздорлик аниқланмади" = **clean, no debt**
- **Automatable from STIR alone?** ✅ YES — build this now

### Service 2 — "Ижро мониторинги" (Enforcement Monitoring) ⚠️ mapped, gated

- **Page:** separate Wicket page at `…/6ihd4/MJR84`
- **Inputs:** STIR (`inn`) + **work_number** (16-digit enforcement case #) + phone (`(99) 999 99 99`) + math captcha
- **Then:** SMS code sent to phone → second form (not captured) → full timeline
- **Submit:** plain form POST (simpler than debt-check)
- **Automatable from STIR alone?** ❌ NO — needs work_number (printed on MIB enforcement document) + phone + SMS
- **Full result shows:** all enforcement stages, MIB measures, enforcement actions
- **Public exception:** per Cabinet Resolution #379 (21 May 2018), energy/water/gas utility debtor data is public — SMS gate may be relaxed for those (untested)

### Can we skip the phone for monitoring?
- `phone` has `required="required"` (Wicket server-side enforces)
- **Likely not skippable** for the full timeline (it's an identity-verification gate)
- BUT step 1 might return partial case data before the SMS gate — needs live testing
- **Plan:** try submitting without phone once worker is unblocked; if server returns partial data, show that; only ask phone+SMS for full timeline

---

## Saved HTML artifacts (in /home/z/my-project/upload/)

| File | What it is |
|---|---|
| `Ўзбекистон Республикаси Бош прокуратураси ҳузуридаги Мажбурий ижро бюроси.html` | BlackListV2Page (debt-check) with STIR 302678824 result loaded |
| `js.html` | EnforcementMonitoringPage (monitoring) — 3-tab form, no result (user lacked work_number) |

Both are full Wicket page saves with obfuscated session URLs.

---

## Build plan (when ready)

### Phase 0 — Unblock network (USER, ~1 min)
Add to `cloudflare-worker/proxy.js` `ALLOWED_HOSTS`:
```diff
+   'mib.uz',
+   'www.mib.uz',
```
Redeploy all 4 CF workers. Tell main agent it's done.

### Phase 1 — `src/lib/mib.ts` (debt check, full auto)
Mirror `src/lib/billing.ts` pattern:
1. GET BlackListV2Page via CF worker → parse form action, captcha img src, JSESSIONID
2. Download captcha image via CF worker → base64 → VLM math solve (reuse `solveCaptchaMath` from billing.ts)
3. Wicket AJAX POST: `id33_hf_0=&inn=<STIR>&secure_code=<VLM>&submit_button=1`
   Headers: `Wicket-Ajax: true`, `Wicket-Ajax-BaseURL: <from page>`, `Accept: application/json`, `Cookie: JSESSIONID=...`
4. Parse `<li class="feedbackPanel*">` → status + message (+ debt amounts if INFO)

Return:
```ts
interface MibDebtResult {
  tin: string
  hasDebt: boolean
  status: 'clean' | 'debt' | 'error' | 'captcha_failed'
  message: string
  debts?: Array<{ enforcementDocNo, amount, bailiff, openedAt, status }>
  checkedAt: number
}
```

### Phase 2 — `/api/mib-debt` route
```
GET /api/mib-debt?tin=302678824 → MibDebtResult
```
- Multi-worker CF rotation (from billing.ts)
- 30s timeout, 1 captcha retry, 10-min memory cache

### Phase 3 — UI debt-check button (full auto)
- Bill card expand section: "MIB'dan tekshirish" button next to Ko'rish
- Top of bills results: company-wide "MIB'dan tekshirish" ghost button
- Inline result: 🟢 clean / 🔴 debt found (expandable)

### Phase 4 — `src/lib/mib-monitoring.ts` (assisted, human-in-loop)
- Modal: pre-fill STIR, user enters work_number + phone
- Backend: parse form, solve captcha, POST step 1
- If SMS step needed: modal shows SMS field → POST step 2 → display timeline
- Test whether phone is truly required (try without first)

### Phase 5 — Cross-link
If debt-check returns case numbers, auto-offer "Monitor this case" with pre-filled work_number.

---

## What we still want from the user (optional, helps but not blocking)

1. **Saved HTML of the SMS-code step** (after submitting monitoring step 1 with real work_number+phone) — maps step 2's field names
2. **Saved HTML of a debt-found result** (any STIR with actual MIB debt) — maps debt-list fields. STIR 302678824 was clean so we have no debt-found sample.

---

## Key file references

- Full workflow doc: `/home/z/my-project/download/MIB-UZ-INTEGRATION-WORKFLOW.md`
- CF worker to edit: `/home/z/my-project/cloudflare-worker/proxy.js`
- Existing pattern to mirror: `/home/z/my-project/src/lib/billing.ts` (multi-worker rotation, VLM captcha)
- Existing API route pattern: `/home/z/my-project/src/app/api/bills/route.ts` (NDJSON stream)
- Captcha solver in billing.ts: `solveCaptchaMath()` — reuse for mib.uz math captcha
- Wicket form hidden field naming: `<formId>_hf_0` (e.g. `id33_hf_0`, `juridical_form_hf_0`)

---

## Resume command for next session

> "Continue the mib.uz integration. Read `/home/z/my-project/MIB-RESUMPTION.md` for full context. The user has [already redeployed the CF worker / not yet redeployed]. Start from Phase [N]."
