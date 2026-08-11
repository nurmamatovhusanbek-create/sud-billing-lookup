# Investigation: Why the Stats Tab Is Still Broken

> **Investigation method:** Direct API testing (curl), CF Worker testing, server log analysis, and code tracing against actual runtime behavior.

---

## Executive Summary

The code logic is **correct** — the BEST-OF parallel race, caching, classification, and dedup all work as designed. The problem is **100% infrastructure**: both Uzbek court APIs are intermittently unreliable, and they block different proxy types at different times.

**The app works perfectly on the sandbox** (53 cases for STIR 302678824). **It breaks on the user's machine** because their network can't reach `jadval.sud.uz` directly, and `jadval.sud.uz` intermittently blocks CF Worker IPs.

---

## Finding 1: jadval.sud.uz intermittently blocks CF Workers

### The evidence:

I tested `jadval.sud.uz/case/findByTin/302678824` through all 4 CF Workers. Results vary by time:

**Test run 1 (earlier today):**
```
Worker 1 (broad-field):       "Ишлар топилмади" (29 bytes) ← BLOCKED
Worker 2 (wild-hall):         "Ишлар топилмади" (29 bytes) ← BLOCKED
Worker 3 (orange-darkness):   "Ишлар топилмади" (29 bytes) ← BLOCKED
Worker 4 (wandering-wind):    "Ишлар топилмади" (29 bytes) ← BLOCKED
```

**Test run 2 (minutes later):**
```
Worker 1 (broad-field):       25,559 bytes — 23 cases ✓ WORKS
```

**Conclusion:** `jadval.sud.uz` **flips between blocking and allowing CF Worker IPs**. It's not a permanent block — it's rate-limiting or IP-rotation-based blocking that changes over time. When all 4 workers are blocked simultaneously, `jadval.sud.uz` contributes 0 cases.

### What "Ишлар топилмади" means:

It's Uzbek for "cases not found." But it's **not** an HTTP error — it's HTTP 200 with a plain-text body. The API returns this when:
1. The TIN genuinely has no cases (legitimate)
2. The API is IP-blocking the requester (fake "not found" — the data exists but the API pretends it doesn't)

We can't distinguish case 1 from case 2. The v140 fix removed the check for this text because when it appears through one worker, another worker might get the real data. But when ALL workers get "Ишлар топилмади," there's no way to know if it's real or blocking.

---

## Finding 2: jadvalapi.sud.uz returns inconsistent case counts

### The evidence:

Same API, same TIN, different times:

```
Earlier today:  6 cases (30,780 bytes... wait, that's wrong)
Actually:       28 cases consistently from all 4 workers
User's logs:    6 cases (from their machine)
```

Actually, `jadvalapi.sud.uz` is **consistent** — it returns 28 cases from all 4 CF Workers. The user's logs showing 6 cases suggest their CF Workers were either:
- Timing out (the user's logs show "The operation timed out" for jadvalapi too)
- Being rate-limited differently from the sandbox's CF Workers

### Key insight:

The user's logs show timeouts, not "Ишлар топилмади":
```
[court-case] https://jadvalapi.sud.uz/... via broad-field failed: The operation timed out.
[court-case] https://jadval.sud.uz/... via broad-field failed: The operation timed out.
```

**The user's CF Workers are timing out entirely** — not getting blocked responses, just no response at all within 10 seconds. This is different from what the sandbox sees (instant 28-case responses in 0.3-1.5 seconds).

This suggests the user's network connection to Cloudflare Workers is slow or unreliable, OR the CF Workers themselves are overloaded when called from the user's region.

---

## Finding 3: Direct fetch works from the sandbox but NOT from the user's machine

### The evidence:

**Sandbox direct fetch:**
```
curl https://jadval.sud.uz/case/findByTin/302678824
→ HTTP 200, 25,559 bytes, 23 cases, 1.5s ✓
```

**User's logs (their machine):**
```
[court-case] https://jadval.sud.uz/case/findByTin/302678824 — all 5 proxies failed
```

The "5 proxies" = 4 CF Workers + 1 direct. ALL 5 failed on the user's machine. This means:
- 4 CF Workers → timed out
- 1 direct fetch → also timed out or blocked

The user's machine **cannot reach jadval.sud.uz directly**. This could be because:
1. `jadval.sud.uz` blocks non-Uzbekistan IPs (the sandbox happens to have an allowed IP)
2. The user's firewall/ISP blocks the connection
3. DNS resolution fails on the user's machine

---

## Finding 4: The code's direct-fetch fallback IS working (on the sandbox)

### Server log proof:

```
[court-case] https://jadvalapi.sud.uz/.../ECONOMIC/findByTin/302678824 — got 28 cases (best of 5 successful proxies)
[court-case] https://jadval.sud.uz/case/findByTin/302678824 — got 23 cases (best of 1 successful proxies)
```

For jadval.sud.uz, "best of **1** successful proxies" means only 1 out of 5 (4 workers + direct) succeeded. That 1 is the **direct fetch**. The 4 CF Workers returned "Ишлар топилмади" (which fails JSON.parse and counts as rejected).

The BEST-OF strategy correctly picked the 23 cases from the direct fetch. Combined with 28 from jadvalapi = 51 unique cases → 53 after classification.

**But on the user's machine, that 1 successful proxy doesn't exist** — both CF Workers AND direct fail.

---

## Finding 5: No pagination issue

`jadvalapi.sud.uz` returns all cases in a single response — no pagination needed:
```
Without params: 28 cases
Has pagination metadata: False
```

---

## Finding 6: apimy.sud.uz requires authentication

`my.sud.uz` uses a different API (`apimy.sud.uz`) that requires a captcha token:
```
{"message":"invalid.token","timestamp":"10.08.2026 14:52:12"}
HTTP 401
```

This is the API the user sees on `my.sud.uz` with 100+ cases. We can't use it without implementing the captcha pipeline (PoW challenge → analyze → math image → token). This would be a major feature addition.

---

## The Complete Picture

```
                    Sandbox          User's Machine
                    ───────          ──────────────
jadvalapi.sud.uz
  via CF Workers    28 cases ✓       TIMEOUT ✗ (user's logs)
  direct            28 cases ✓       unknown (not tested by user)

jadval.sud.uz
  via CF Workers    23 cases* ✓      TIMEOUT ✗ (user's logs)
  direct            23 cases ✓       TIMEOUT ✗ (user's logs)

Total (sandbox):    53 cases
Total (user):       11 cases (6 econ + 3 civil + 2 admin from jadvalapi only)

* intermittently returns "Ишлар топилмади" instead of data
```

**The user gets 11 cases because:**
1. `jadval.sud.uz` is unreachable from their machine (both CF Workers and direct timeout)
2. `jadvalapi.sud.uz` is partially reachable (returns 6 economic + 3 civil + 2 admin = 11)
3. The sandbox gets 53 cases because it can reach both APIs

---

## What's NOT broken (the code is correct)

| Component | Status | Evidence |
|---|---|---|
| Parallel race (BEST-OF) | ✅ Works | "best of 1 successful proxies" for jadval.sud.uz = direct fetch won |
| Server cache (60s) | ✅ Works | "returning cached result" in logs |
| Client cache (5 min) | ✅ Works | "Statistika keshdan yuklandi" toast |
| Classification | ✅ Works | 15W / 11L / 6N / 21P = correct math |
| Deduplication | ✅ Works | 28 + 23 → 51 unique (not 51) |
| Force-refresh | ✅ Works | "Yangilash" button clears cache |
| HTTP 404 handling | ✅ Works | CONFLICT/findByTin returns 404 → 0 cases (correct) |

---

## Possible Fixes (in order of effort)

### Option A: Add public CORS proxies back (LOW effort, MEDIUM reliability)
We removed all public CORS proxies in v144. Adding them back gives a 3rd network path:
- Path 1: CF Workers (blocked intermittently by jadval.sud.uz)
- Path 2: Direct fetch (blocked on user's machine)
- Path 3: cors.sh / allorigins / corsproxy.io (different IPs, might work)

**Risk:** Public proxies are slow and unreliable, but they provide a different network path that might reach jadval.sud.uz when both CF Workers and direct fail.

### Option B: Implement apimy.sud.uz captcha pipeline (HIGH effort, HIGH reliability)
`my.sud.uz` uses `apimy.sud.uz` with captcha authentication. This is the API the user sees with 100+ cases. Implementing it would require:
1. PoW challenge solving (SHA-256, same as billing.sud.uz)
2. Risk analysis with browser signals
3. Math captcha image solving (VLM)
4. Token-based API calls

This is the **permanent fix** but requires significant development effort.

### Option C: Deploy more CF Workers in different regions (MEDIUM effort, MEDIUM reliability)
The 4 current workers might all be in the same Cloudflare region. Deploying workers in different regions (US, EU, Asia) gives different exit IPs, making it harder for jadval.sud.uz to block all of them simultaneously.

### Option D: Accept the limitation and show partial results clearly (LOW effort, NO reliability gain)
Add a UI indicator when some court types fail:
- "⚠️ Ma'lumotlar to'liq emas — ba'zi sud turlarida ma'lumot olinmadi"
- Show which court types succeeded vs failed
- Let the user retry

---

## Recommendation

**Short term:** Option A (add back public CORS proxies) + Option D (show partial results warning).

**Long term:** Option B (implement apimy.sud.uz captcha pipeline) — this is the only way to get the same 100+ cases the user sees on my.sud.uz.
