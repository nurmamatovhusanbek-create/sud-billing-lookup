#!/usr/bin/env node
import fs from 'fs';

const FILE = 'src/lib/court-case.ts';
if (!fs.existsSync(FILE)) {
  console.error(`ERROR: ${FILE} not found. Run from project root.`);
  process.exit(1);
}

const content = fs.readFileSync(FILE, 'utf-8');

if (content.includes("const child = spawn('curl'")) {
  console.log('ALREADY FIXED. Nothing to do.');
  process.exit(0);
}

const backup = `${FILE}.bak.${Date.now()}`;
fs.copyFileSync(FILE, backup);
console.log(`Backup: ${backup}\n`);

let u = content;

u = u.replace(
  "import { execSync } from 'child_process'",
  "import { spawn } from 'child_process'"
);
console.log('  [1/5] Import: execSync -> spawn');

const docStart = '/**\n * v149: curl-based fetch for jadval.sud.uz.';
const di = u.indexOf(docStart);
if (di !== -1) {
  const de = u.indexOf('*/\n', di);
  if (de !== -1) {
    u = u.slice(0, di) + '/**\n * v149/v156: curl-based fetch for jadval.sud.uz.\n' + u.slice(de + 3);
  }
}

const fnStart = 'function curlFetch(url: string): Promise<string> {';
const si = u.indexOf(fnStart);
if (si === -1) { console.error('ERROR: curlFetch not found'); process.exit(1); }

const after = si + fnStart.length;
let ei = u.length;
for (const m of ['\n/**\n', '\ninterface ', '\nfunction ', '\nexport ']) {
  const idx = u.indexOf(m, after);
  if (idx !== -1 && idx < ei) ei = idx;
}

const NEW_FN = Buffer.from(
  'ZnVuY3Rpb24gY3VybEZldGNoKHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHsKICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gewogICAgY29uc3QgYXJncyA9IFsKICAgICAgJy0tc2lsZW50JywgJy0tc2hvdy1lcnJvcicsCiAgICAgICctLW1heC10aW1lJywgJzE1JywKICAgICAgJy0tY29tcHJlc3NlZCcsCiAgICAgICctSCcsICdBY2NlcHQ6IGFwcGxpY2F0aW9uL2pzb24sIHRleHQvcGxhaW4sICovKicsCiAgICAgICctSCcsICdBY2NlcHQtTGFuZ3VhZ2U6IGVuLUdCLGVuO3E9MC41JywKICAgICAgJy1IJywgJ09yaWdpbjogaHR0cHM6Ly9teS5zdWQudXonLAogICAgICAnLUgnLCAnUmVmZXJlcjogaHR0cHM6Ly9teS5zdWQudXovJywKICAgICAgJy1IJywgJ1NlYy1GZXRjaC1EZXN0OiBlbXB0eScsCiAgICAgICctSCcsICdTZWMtRmV0Y2gtTW9kZTogY29ycycsCiAgICAgICctSCcsICdTZWMtRmV0Y2gtU2l0ZTogc2FtZS1zaXRlJywKICAgICAgJy1IJywgJ1VzZXItQWdlbnQ6IE1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDEwLjA7IFdpbjY0OyB4NjQpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xNTEuMC4wLjAgU2FmYXJpLzUzNy4zNicsCiAgICAgICctSCcsICdzZWMtY2gtdWE6ICJOb3Q9QT9CcmFuZCI7dj0iOTkiLCAiQnJhdmUiO3Y9IjE1MSIsICJDaHJvbWl1bSI7dj0iMTUxIicsCiAgICAgICctSCcsICdzZWMtY2gtdWEtbW9iaWxlOiA/MCcsCiAgICAgICctSCcsICdzZWMtY2gtdWEtcGxhdGZvcm06ICJXaW5kb3dzIicsCiAgICAgICctLScsIHVybCwKICAgIF0KCiAgICAvLyB2MTU2OiBzcGF3biB3aXRoIE5PIHNoZWxsLiBPbiBXaW5kb3dzIHRoaXMgZmluZHMgU3lzdGVtMzIgY3VybCAoU2NoYW5uZWwKICAgIC8vIFRMUykgd2hpY2ggamFkdmFsLnN1ZC51eiBhY2NlcHRzLiBleGVjU3luYyB2aWEgYmFzaCBmaW5kcyBNU1lTMiBjdXJsCiAgICAvLyAoT3BlblNTTCBUTFMpIHdoaWNoIGphZHZhbC5zdWQudXogUkVKRUNUUyAocmV0dXJucyA1MDIgQmFkIEdhdGV3YXkpLgogICAgLy8gZXhlY1N5bmMgd2l0aG91dCBzaGVsbCB1c2VzIGNtZC5leGUgd2hpY2ggc3BsaXRzIGhlYWRlcnMgb24gc3BhY2VzLgogICAgLy8gVGhpcyBpcyB0aGUgdjE1MC92MTUyIGFwcHJvYWNoIHRoZSB1c2VyIGNvbmZpcm1lZCB3b3Jrcy4KICAgIGNvbnN0IGNoaWxkID0gc3Bhd24oJ2N1cmwnLCBhcmdzLCB7CiAgICAgIHRpbWVvdXQ6IDE4MDAwLAogICAgICB3aW5kb3dzSGlkZTogdHJ1ZSwKICAgIH0pCgogICAgbGV0IHN0ZG91dCA9ICcnCiAgICBsZXQgc3RkZXJyID0gJycKCiAgICBjaGlsZC5zdGRvdXQub24oJ2RhdGEnLCAoZGF0YSkgPT4geyBzdGRvdXQgKz0gZGF0YS50b1N0cmluZygpIH0pCiAgICBjaGlsZC5zdGRlcnIub24oJ2RhdGEnLCAoZGF0YSkgPT4geyBzdGRlcnIgKz0gZGF0YS50b1N0cmluZygpIH0pCgogICAgY2hpbGQub24oJ2Vycm9yJywgKGVycikgPT4gewogICAgICBjb25zb2xlLmVycm9yKGBbY291cnQtY2FzZV0gY3VybCBzcGF3biBlcnJvciBmb3IgJHt1cmx9OiAke2Vyci5tZXNzYWdlfWApCiAgICAgIGlmIChlcnIubWVzc2FnZS5pbmNsdWRlcygnRU5PRU5UJykgfHwgZXJyLm1lc3NhZ2UuaW5jbHVkZXMoJ3NwYXduJykpIHsKICAgICAgICBjb25zb2xlLmVycm9yKCdbY291cnQtY2FzZV0gY3VybCBiaW5hcnkgbm90IGZvdW5kISBJbnN0YWxsIGN1cmwgb3IgYWRkIHRvIFBBVEguJykKICAgICAgfQogICAgICByZWplY3QobmV3IEVycm9yKGBjdXJsIHNwYXduIGZhaWxlZDogJHtlcnIubWVzc2FnZX1gKSkKICAgIH0pCgogICAgY2hpbGQub24oJ2Nsb3NlJywgKGNvZGUpID0+IHsKICAgICAgaWYgKGNvZGUgPT09IDAgJiYgc3Rkb3V0Lmxlbmd0aCA+IDApIHsKICAgICAgICBpZiAoc3Rkb3V0LmluY2x1ZGVzKCfRgtC+0L/QuNC70LzQsNC00LgnKSB8fCBzdGRvdXQuaW5jbHVkZXMoJ9C80LDQstC20YPQtCDRjdC80LDRgScpKSB7CiAgICAgICAgICBjb25zb2xlLmxvZyhgW2NvdXJ0LWNhc2VdIGN1cmwgZ290ICdub3QgZm91bmQnIHRleHQgZnJvbSAke3VybH0gKCR7c3Rkb3V0Lmxlbmd0aH0gYnl0ZXMpYCkKICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ2N1cmw6IG5vdCBmb3VuZCB0ZXh0IHJlc3BvbnNlJykpCiAgICAgICAgICByZXR1cm4KICAgICAgICB9CiAgICAgICAgY29uc29sZS5sb2coYFtjb3VydC1jYXNlXSBjdXJsIGdvdCAke3N0ZG91dC5sZW5ndGh9IGJ5dGVzIGZyb20gJHt1cmx9YCkKICAgICAgICByZXNvbHZlKHN0ZG91dCkKICAgICAgfSBlbHNlIHsKICAgICAgICBjb25zb2xlLmVycm9yKGBbY291cnQtY2FzZV0gY3VybCBleGl0IGNvZGUgJHtjb2RlfSBmb3IgJHt1cmx9LCBzdGRlcnI6ICR7c3RkZXJyLnNsaWNlKDAsIDIwMCl9LCBzdGRvdXQ6ICR7c3Rkb3V0LnNsaWNlKDAsIDEwMCl9YCkKICAgICAgICByZWplY3QobmV3IEVycm9yKGBjdXJsIGV4aXQgJHtjb2RlfTogJHtzdGRlcnIuc2xpY2UoMCwgMTAwKSB8fCBzdGRvdXQuc2xpY2UoMCwgMTAwKSB8fCAnbm8gb3V0cHV0J31gKSkKICAgICAgfQogICAgfSkKICB9KQp9CgovKioKICogdjE1NjogSGVscGVyIC0gcnVuIGN1cmxGZXRjaCArIEpTT04gcGFyc2UgKyBtYXAgdG8gQ291cnRDYXNlW10uCiAqIEV4dHJhY3RlZCBzbyBhbGwgMyByZXRyeSB0aWVycyBjYW4gdXNlIGN1cmwsIG5vdCBqdXN0IHRoZSBpbml0aWFsIHJhY2UuCiAqIEluY2x1ZGVzIGRpYWdub3N0aWMgbG9nZ2luZzogaWYgdGhlIHJlc3BvbnNlIGlzbid0IHZhbGlkIEpTT04sIGxvZ3MgdGhlCiAqIGZpcnN0IDMwMCBjaGFycyBzbyB3ZSBjYW4gc2VlIHdoYXQgamFkdmFsLnN1ZC51eiBhY3R1YWxseSByZXR1cm5lZAogKiAoZXJyb3IgcGFnZSwgY2FwdGNoYSwgcmF0ZS1saW1pdCwgZXRjLikgaW5zdGVhZCBvZiBqdXN0ICJwYXJzZSBmYWlsZWQiLgogKi8KYXN5bmMgZnVuY3Rpb24gY3VybEZldGNoQ2FzZXModXJsOiBzdHJpbmcsIG1hcHBlcjogKHJhdzogYW55KSA9PiBDb3VydENhc2UpOiBQcm9taXNlPENvdXJ0Q2FzZVtdPiB7CiAgY29uc3QgdGV4dCA9IGF3YWl0IGN1cmxGZXRjaCh1cmwpCiAgdHJ5IHsKICAgIGNvbnN0IGRhdGEgPSBKU09OLnBhcnNlKHRleHQpCiAgICBjb25zdCBpdGVtcyA9IEFycmF5LmlzQXJyYXkoZGF0YSkgPyBkYXRhIDogKGRhdGEuZGF0YSB8fCBbXSkKICAgIGNvbnNvbGUubG9nKGBbY291cnQtY2FzZV0gY3VybCBmZXRjaCBnb3QgJHtpdGVtcy5sZW5ndGh9IGNhc2VzIGZyb20gJHt1cmx9YCkKICAgIHJldHVybiBpdGVtcy5tYXAobWFwcGVyKQogIH0gY2F0Y2ggKHBhcnNlRXJyKSB7CiAgICBjb25zdCBwcmV2aWV3ID0gdGV4dC5zbGljZSgwLCAzMDApLnJlcGxhY2UoL1xuL2csICcgJykKICAgIGNvbnNvbGUuZXJyb3IoYFtjb3VydC1jYXNlXSBjdXJsIGdvdCAke3RleHQubGVuZ3RofSBieXRlcyBmcm9tICR7dXJsfSBidXQgSlNPTi5wYXJzZSBmYWlsZWQgLSBmaXJzdCAzMDAgY2hhcnM6ICR7cHJldmlld31gKQogICAgdGhyb3cgbmV3IEVycm9yKGBjdXJsOiByZXNwb25zZSBpcyBub3QgdmFsaWQgSlNPTiAoJHt0ZXh0Lmxlbmd0aH0gYnl0ZXMpYCkKICB9Cn0K',
  'base64'
).toString('utf-8');

u = u.slice(0, si) + NEW_FN + '\n' + u.slice(ei);
console.log('  [2/5] curlFetch: execSync -> spawn + curlFetchCases helper');

const t1Start = u.indexOf("// v149: For jadval.sud.uz, ALSO try curl");
if (t1Start !== -1) {
  const t1End = u.indexOf('})())\n    }', t1Start);
  if (t1End !== -1) {
    const t1EndFull = t1End + '})())\n    }'.length;
    const t1New = "// v149/v156: For jadval.sud.uz, ALSO try curl (bypasses TLS fingerprinting)\n    if (isJadvalSudUz) {\n      fetchPromises.push(curlFetchCases(url, mapper))\n    }";
    u = u.slice(0, t1Start) + t1New + u.slice(t1EndFull);
    console.log('  [3/5] Tier 1: inline curl -> curlFetchCases');
  } else {
    console.log('  [3/5] WARNING: tier 1 end not found');
  }
} else {
  console.log('  [3/5] WARNING: tier 1 start not found (may be already fixed)');
}

const t2Marker = "      const retrySettled = await Promise.allSettled(retryPromises)";
const t2Insert = "      // v156: Also retry curl for jadval.sud.uz in tier 2\n      if (isJadvalSudUz) {\n        retryPromises.push(curlFetchCases(url, mapper))\n      }\n\n      const retrySettled = await Promise.allSettled(retryPromises)";
if (u.includes(t2Marker)) {
  u = u.replace(t2Marker, t2Insert);
  console.log('  [4/5] Tier 2: added curl retry');
} else {
  console.log('  [4/5] WARNING: tier 2 marker not found');
}

const t3Marker = "        const finalSettled = await Promise.allSettled(finalPromises)";
const t3Insert = "        // v156: Also try curl in the final tier for jadval.sud.uz\n        if (isJadvalSudUz) {\n          finalPromises.push(curlFetchCases(url, mapper))\n        }\n        const finalSettled = await Promise.allSettled(finalPromises)";
if (u.includes(t3Marker)) {
  u = u.replace(t3Marker, t3Insert);
  console.log('  [5/5] Tier 3: added curl retry');
} else {
  console.log('  [5/5] WARNING: tier 3 marker not found');
}

fs.writeFileSync(FILE, u, 'utf-8');
console.log('\ncourt-case.ts fixed!');

for (const vf of ['src/lib/cache.ts', 'src/app/page.tsx']) {
  if (fs.existsSync(vf)) {
    const vc = fs.readFileSync(vf, 'utf-8');
    if (vc.includes('v155')) {
      const count = (vc.match(/v155/g) || []).length;
      fs.writeFileSync(vf, vc.replaceAll('v155', 'v156'), 'utf-8');
      console.log(`  [6] ${vf}: v155 -> v156 (${count} occurrences)`);
    } else {
      console.log(`  [6] ${vf}: no v155 found (skip)`);
    }
  } else {
    console.log(`  [6] ${vf}: not found (skip)`);
  }
}

console.log('\n=== DONE! ===');
console.log('Next: bun run lint && bun run dev');
console.log('Test: TIN 200248856 in Stats tab');
console.log(`Backup: ${backup}`);
