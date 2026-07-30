import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

// Set extra headers to look more human
await page.setExtraHTTPHeaders({
  'Accept-Language': 'uz,en;q=0.9,ru;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
})

console.log('Navigating to ihamkor.uz home...')
await page.goto('https://ihamkor.uz/oz', { waitUntil: 'domcontentloaded', timeout: 30000 })

// Wait longer for Cloudflare — check every 2s for up to 40s
console.log('Waiting for Cloudflare challenge to resolve...')
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  console.log(`  ${i*2}s: title = "${title}"`)
  if (!title.includes('Just a moment') && !title.includes('Attention')) {
    console.log('Challenge resolved!')
    break
  }
}

await new Promise(r => setTimeout(r, 3000))

const title = await page.title()
console.log('Final title:', title)

const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || '')
console.log('Body text:', bodyText)

// Try search
console.log('\nNavigating to search...')
await page.goto('https://ihamkor.uz/oz/search?query=302678824', { waitUntil: 'domcontentloaded', timeout: 30000 })

for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const t = await page.title()
  if (!t.includes('Just a moment') && !t.includes('Attention')) break
}

await new Promise(r => setTimeout(r, 3000))

const searchText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || '')
console.log('Search body text:', searchText)

const links = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a')).map(a => ({
    href: a.getAttribute('href') || '',
    text: (a.textContent || '').trim().substring(0, 60)
  })).filter(l => l.href && !l.href.includes('cloudflare'))
})
console.log('Links:', JSON.stringify(links.slice(0, 20)))

await browser.close()
