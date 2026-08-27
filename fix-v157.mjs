import fs from 'fs';
const changes = [];
const ccFile = 'src/lib/court-case.ts';
if (fs.existsSync(ccFile)) {
  let cc = fs.readFileSync(ccFile, 'utf-8');
  if (cc.includes('resolveCurlBinary')) {
    console.log('  [1/4] court-case.ts: already fixed (skip)');
  } else {
    if (!cc.includes("import fs from 'fs'")) {
      cc = cc.replace("import { spawn } from 'child_process'", "import { spawn } from 'child_process'\nimport fs from 'fs'");
    }
    const insertAfter = "import ZAI from 'z-ai-web-dev-sdk'";
    const insertIdx = cc.indexOf(insertAfter);
    if (insertIdx !== -1) {
      const insertPoint = insertIdx + insertAfter.length;
      const resolver = `\nlet _curlBinResolved = false\nlet _curlBin = 'curl'\nfunction resolveCurlBinary(): string {\n  if (_curlBinResolved) return _curlBin\n  if (process.platform === 'win32') {\n    const system32Curl = 'C:\\\\Windows\\\\System32\\\\curl.exe'\n    if (fs.existsSync(system32Curl)) {\n      _curlBin = system32Curl\n      console.log(\`[court-case] curl binary: \${_curlBin} (Schannel TLS)\`)\n    } else {\n      _curlBin = 'curl'\n      console.log('[court-case] WARNING: System32 curl not found')\n    }\n  } else {\n    _curlBin = 'curl'\n  }\n  _curlBinResolved = true\n  return _curlBin\n}`;
      cc = cc.slice(0, insertPoint) + resolver + cc.slice(insertPoint);
    }
    cc = cc.replace(/const child = spawn\('curl', args,/, "const curlBin = resolveCurlBinary()\n    const child = spawn(curlBin, args,");
    fs.writeFileSync(ccFile, cc, 'utf-8');
    changes.push('court-case.ts: resolveCurlBinary + spawn(curlBin)');
    console.log('  [1/4] court-case.ts: fixed');
  }
}
const pgFile = 'src/app/page.tsx';
if (fs.existsSync(pgFile)) {
  let pg = fs.readFileSync(pgFile, 'utf-8');
  const oldLoop = '      for (const e of list) {\n        kickOffFetch(e.tin)\n      }';
  const newLoop = '      list.forEach((e, i) => {\n        setTimeout(() => kickOffFetch(e.tin), i * 2000)\n      })';
  if (pg.includes(newLoop)) {
    console.log('  [2/4] page.tsx: already staggered (skip)');
  } else if (pg.includes(oldLoop)) {
    pg = pg.replace(oldLoop, newLoop);
    fs.writeFileSync(pgFile, pg, 'utf-8');
    changes.push('page.tsx: staggered watchlist');
    console.log('  [2/4] page.tsx: staggered');
  } else {
    console.log('  [2/4] WARNING: pattern not found');
  }
}
for (const vf of ['src/lib/cache.ts', 'src/app/page.tsx']) {
  if (fs.existsSync(vf)) {
    const vc = fs.readFileSync(vf, 'utf-8');
    if (vc.includes('v156')) {
      fs.writeFileSync(vf, vc.replaceAll('v156', 'v157'), 'utf-8');
      console.log(`  [3] ${vf}: v156 -> v157`);
    }
  }
}
console.log('\nDONE! Changes:', changes.length);
