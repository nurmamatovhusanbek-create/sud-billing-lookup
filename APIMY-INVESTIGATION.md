# apimy.sud.uz Investigation — Can We Use It?

> **Investigation method:** Direct API testing, captcha pipeline reproduction, JS bundle reverse-engineering, and network interception via browser automation.

---

## Executive Summary

**No, we cannot use apimy.sud.uz.** It requires Uzbekistan government SSO (Single Sign-On) authentication via `sso.egov.uz` — an e-ID login system. The captcha token alone is NOT sufficient. The user sees 100+ cases on my.sud.uz because they are **logged in with their e-ID account**.

---

## What I Found

### 1. my.sud.uz uses the SAME captcha system as billing.sud.uz ✓

```
Captcha API:  recaptcha.sud.uz/api/v1/captcha/pow/challenge
Site key:     site_835080654e60bd9283ac263c5ebbaaef
Action:       check_case (vs billing's "my_checks")
```

I successfully reproduced the captcha pipeline:
- PoW challenge → solved (nonce: 93037, 40ms)
- Analyze → score 0.85, token obtained (no math image needed)
- **Token works for recaptcha.sud.uz** ✓

### 2. BUT apimy.sud.uz rejects the captcha token ❌

I tried 6 different ways to pass the token:

| Method | Result |
|---|---|
| `?captchaToken=TOKEN` | 401 invalid.token |
| `X-Captcha-Token: TOKEN` header | 401 invalid.token |
| `?token=TOKEN` | 401 invalid.token |
| `captcha-token: TOKEN` header | 401 invalid.token |
| `?recaptchaToken=TOKEN` | 401 invalid.token |
| `Authorization: TOKEN` (no Bearer) | 401 invalid.token |
| `Authorization: Bearer TOKEN` | 401 invalid.token |

**All return `{"message":"invalid.token"}`.** The captcha token is NOT the type of token apimy.sud.uz expects.

### 3. The REAL authentication: Government SSO (e-ID login)

From the JS bundle (`main-NJDDB42Q.js`):

```javascript
// API base URL
apiUrl: "https://apimy.sud.uz"

// Authentication: Bearer token from SSO
e.Authorization = `Bearer ${n}`
// where n = localStorage.getItem(ACCESS_TOKEN_KEY)

// SSO login URL
"https://sso.egov.uz/sso/oauth/Authorization.do?response_type=one_code&cli..."
```

**The flow is:**
1. User clicks "КИРИШ" (Login) on my.sud.uz
2. Redirected to `sso.egov.uz` — Uzbekistan's government e-ID portal
3. User logs in with their e-ID (Uzbekistan national ID)
4. SSO redirects back to my.sud.uz with an access token
5. App stores token in `localStorage`
6. All API calls to apimy.sud.uz use `Authorization: Bearer ${token}`
7. The captcha is an ADDITIONAL security layer for the "check_case" action, NOT the primary authentication

### 4. The captcha's role

The captcha is used for the **case number search** ("Онлайн кузатув" / Online monitoring) feature. Even with SSO login, the user must solve a captcha before searching for a case. But the captcha token is sent ALONGSIDE the SSO token — not instead of it.

The captcha token might be:
- Sent as an additional header alongside the Bearer token
- Verified server-side before the API processes the request
- Used for rate-limiting (prevent automated scraping even for logged-in users)

### 5. Why the user sees 100+ cases on my.sud.uz

The user is **logged in** with their e-ID. When they search by TIN or case number, the request goes to `apimy.sud.uz` with their SSO Bearer token, which gives them access to the full database. The public APIs we use (`jadvalapi.sud.uz` and `jadval.sud.uz`) return fewer cases because they're unauthenticated public endpoints with limited data.

---

## What This Means for Our App

| | billing.sud.uz (bills) | apimy.sud.uz (court cases) |
|---|---|---|
| **Authentication** | Captcha token only | SSO e-ID login + captcha |
| **Can we automate?** | ✅ Yes — we solve the captcha | ❌ No — requires human e-ID login |
| **Data access** | Public (anyone with captcha) | Authenticated (logged-in users only) |
| **Our current approach** | Works correctly | N/A — we use jadvalapi/jadval instead |

### Why our current approach (jadvalapi + jadval.sud.uz) returns fewer cases:

- `jadvalapi.sud.uz` — public, returns ~28 economic cases (what we get)
- `jadval.sud.uz` — public, returns ~23 cases (intermittently blocked)
- `apimy.sud.uz` — authenticated, returns 100+ cases (requires e-ID login)

The ~70 case difference between our 28+23=51 and the user's 100+ is the data that's only available to authenticated users.

---

## Possible Workarounds (none ideal)

### Option A: Ask user for their SSO token
The user could log in to my.sud.uz, extract their Bearer token from localStorage, and paste it into our app. We'd use it for API calls.

**Pro:** Gets the full 100+ cases
**Con:** Token expires, user must re-login periodically, security risk (sharing auth tokens)

### Option B: Implement SSO login flow
Implement the full `sso.egov.uz` OAuth flow in our app.

**Pro:** Fully automated
**Con:** Requires the user's e-ID credentials, complex OAuth implementation, may violate terms of service

### Option C: Accept the limitation
Our public API approach gets ~50 cases. The remaining ~50 are only available to authenticated users. Add a UI note explaining this.

**Pro:** No security risk, no ToS issues
**Con:** User still sees fewer cases than on my.sud.uz

### Option D: Fix the infrastructure issues (the real problem)
The user's real complaint is getting 11 cases instead of 50. That's an infrastructure problem (CF Workers timing out), not a data-access problem. If we fix the CF Worker reliability, the user gets 50 cases — which is the maximum available from public APIs.

**Pro:** Solves the actual reported problem
**Con:** Can't reach 100+ without authentication

---

## Recommendation

**Option D** (fix infrastructure) + **Option C** (accept limitation with UI note).

The user's immediate problem is getting 11 cases instead of 50 — that's the CF Workers timing out on their machine. Fixing that gets them to 50 cases, which is the maximum from public APIs. The remaining 50+ cases require e-ID login and cannot be automated without the user's credentials.
