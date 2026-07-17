#!/bin/bash
# Starts the tor SOCKS proxy (OPTIONAL) and then launches Next.js.
#
# Tor is only needed if your IP is blocked by billing.sud.uz. The app also
# auto-spawns tor from a local ./tor/ folder (see src/lib/tor.ts), so this
# script is mainly for the Linux sandbox. On Windows, just run `bun run dev`
# directly — tor.ts will find ./tor/tor.exe automatically.
#
# To install tor locally:
#   Windows:  see README.md (PowerShell commands to download tor expert bundle)
#   macOS:    brew install tor
#   Linux:    apt install tor  OR  download the expert bundle to ./tor/

TOR_SOCKS_PORT=9050

# Check if tor is already listening
if (ss -tln 2>/dev/null || netstat -tln 2>/dev/null) | grep -q ":${TOR_SOCKS_PORT} "; then
  echo "[dev-start] tor already running on port ${TOR_SOCKS_PORT}"
else
  echo "[dev-start] tor not detected — app will spawn it from ./tor/ if present"
  echo "[dev-start] → if no ./tor/ folder, requests go direct to billing.sud.uz"
fi

# Start Next.js (foreground)
exec next dev -p 3000 2>&1 | tee dev.log
