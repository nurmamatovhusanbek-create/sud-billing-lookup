import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: false,  // NON-HEADLESS — real browser with real fingerprints
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080',
  ],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

console.log('Navigating directly to search page...')
await page.goto('https://ihamkor.uz/oz/search?query=302678824', { waitUntil: 'domcontentloaded', timeout: 30000 })

for (let i = 0; i < 25; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  console.log(`  ${i*2}s: "${title.substring(0,50)}"`)
  if (!title.includes('Just a moment') && !title.includes('Attention')) {
    console.log('  CLOUDFLARE PASSED!')
    break
  }
}

await new Promise(r => setTimeout(r, 3000))

const title = await page.title()
console.log('Final title:', title)

const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '')
console.log('Body text:', bodyText.substring(0, 800))

const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a')).map(a => ({ href: a.getAttribute('href') || '', text: (a.textContent||'').trim().substring(0,60) }))
    .filter(l => l.href && !l.href.includes('cloudflare') && l.href !== '#')
)
console.log('Links:', JSON.stringify(links.slice(0, 10)))

await browser.close()
