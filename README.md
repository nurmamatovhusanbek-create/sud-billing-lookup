# Sud Billing Lookup

A web app that imports every bill (kvitansiya) issued under a company from
**billing.sud.uz** (the Supreme Court of Uzbekistan's electronic payment system).

## What it does

1. You enter a company **INN** (STIR, 9 digits — Yuridik shaxs / legal entity)
2. The app goes to billing.sud.uz, solves the captcha, and imports **all bills**
   created under that INN
3. For each bill it shows:
   - **Type**: Davlat boji (state fee) or Pochta (postal expenses)
   - **Court type**: Economic / Civil / Criminal / Administrative / Military court
   - **Court name**: e.g. "Тошкент шаҳар суди"
   - **Payment status**: Not paid / Paid / Partially paid / Used / Cancelled / etc.
   - **Amounts**: receipt amount, paid, unpaid, spent, balance (in so'm)
   - **Dates**: created date + validity/expiration date
   - **Court case numbers**: the case/work number each bill was used for
     (from the history list)

## Tech stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS 4** + shadcn/ui components
- **z-ai-web-dev-sdk** — used for the VLM (Vision Language Model) that solves
  the math captcha image when billing.sud.uz requires it
- **socks-proxy-agent** — routes requests through Tor when needed (optional)

## Setup

### 1. Install dependencies

```bash
bun install
# or: npm install
```

### 2. Set up the database

The project uses Prisma with SQLite. The schema is already defined — just push it:

```bash
bun run db:push
# or: npx prisma db push
```

Make sure your `.env` file has:
```
DATABASE_URL=file:./db/custom.db
```

### 3. Run the dev server

```bash
bun run dev
# or: npm run dev
```

This starts Next.js on http://localhost:3000.

## How the captcha solving works

billing.sud.uz uses a custom captcha system (not reCAPTCHA) hosted at
recaptcha.sud.uz:

1. **Proof-of-Work**: The server gives a SHA-256 challenge. The app finds a
   nonce so that `SHA-256(challenge + nonce)` has 16 leading zero bits.
2. **Risk analysis**: The app sends browser-like signals (mouse movements,
   timing, fingerprint) to `/api/v1/captcha/analyze`. If the risk score is
   high enough, a token is returned directly.
3. **Math captcha fallback**: If the risk score is low, the server returns a
   math problem as an image. The **VLM** (Vision Language Model via
   z-ai-web-dev-sdk) reads and solves it, then submits the answer to get a
   token.

The token is then used to call `/api/invoice/captcha/search?inn=...` which
returns all bills for the company.

## Tor (optional — only if your IP is blocked)

If billing.sud.uz blocks your IP (connection refused), the app can route
requests through the Tor SOCKS5 proxy. The app auto-detects Tor in this order:

1. **Already running** — if a SOCKS proxy is listening on `127.0.0.1:9050`,
   the app uses it.
2. **Local `./tor/` folder** — if `tor/tor.exe` (Windows) or `tor/tor` (Linux/macOS)
   exists in the project root, the app spawns it automatically.
3. **Direct connection** — if neither is found, requests go direct to
   billing.sud.uz (works fine on most machines).

### Easiest way: click the Tor badge in the app

1. Download the Tor expert bundle (`.tar.gz`) from the official page:
   https://www.torproject.org/download/tor — pick **Windows (x86_64)** or **Windows (i686)**
2. Start the app (`bun run dev`) and open http://localhost:3000
3. In the top-right corner you'll see an amber **"Tor not detected — click to install"** badge
4. **Click it** → a file picker opens → select the `.tar.gz` you downloaded
5. The app extracts it automatically and starts Tor. The badge turns green **"Tor active"**

No manual extraction or PowerShell needed!

### Windows — download Tor with PowerShell

Open **PowerShell** in the project root (the folder containing `package.json`)
and run:

```powershell
# Create the tor folder
New-Item -ItemType Directory -Force -Path "tor"

# Download the Tor expert bundle for Windows x86_64
$url = "https://archive.torproject.org/tor-package-archive/torbrowser/15.0.16/tor-expert-bundle-windows-x86_64-15.0.16.zip"
Invoke-WebRequest -Uri $url -OutFile "tor-bundle.zip"

# Extract into the tor/ folder
Expand-Archive -Path "tor-bundle.zip" -DestinationPath "tor" -Force

# Clean up the zip
Remove-Item "tor-bundle.zip"

# Verify tor.exe is there
Test-Path "tor\tor.exe"
```

That's it — the app will auto-detect `tor/tor.exe` and spawn it when needed.
The first request to billing.sud.uz takes ~30s extra while tor bootstraps.

### macOS

```bash
brew install tor
tor &   # start it in the background
```

### Linux

```bash
sudo apt install tor
# OR download the expert bundle to ./tor/ (same as Windows but the linux-x86_64 URL)
```

If Tor isn't running and no `./tor/` folder exists, the app connects to
billing.sud.uz **directly**.

## API reference (internal)

The app reverse-engineered these billing.sud.uz endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST recaptcha.sud.uz/api/v1/captcha/pow/challenge` | Get PoW challenge |
| `POST recaptcha.sud.uz/api/v1/captcha/analyze` | Submit signals → get token |
| `POST recaptcha.sud.uz/api/v1/captcha/challenge/solve` | Solve math captcha |
| `GET billing.sud.uz/api/invoice/captcha/search?inn=X` | Search bills by INN |
| `GET billing.sud.uz/api/invoice/checkStatus?invoice=N` | Get bill details |

## Project structure

```
src/
├── app/
│   ├── api/bills/route.ts    # NDJSON streaming API: search by INN
│   ├── layout.tsx            # Root layout (sonner toaster)
│   └── page.tsx              # Main UI: search bar, bill cards
├── lib/
│   ├── billing.ts            # Captcha solver + billing API client
│   └── tor.ts                # Optional Tor SOCKS proxy client
scripts/
└── dev-start.sh              # Starts Tor (optional) + Next.js
mini-services/
└── tor-manager/              # Standalone Tor manager (alternative)
```

## Try it

Enter INN `302678824` (or click the sample button) to see 60 bills with full
details — court names, case numbers, payment status, and court types.
