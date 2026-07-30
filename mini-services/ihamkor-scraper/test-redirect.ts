import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

// Load home page first
console.log('Loading home page...')
await page.goto('https://ihamkor.uz/oz', { waitUntil: 'networkidle2', timeout: 30000 })
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  if (!title.includes('Just a moment')) break
}
console.log('Home loaded')

// Instead of navigating to search, try going directly to organization page
// The home page passed Cloudflare — maybe organization pages do too
// (the first test showed "Afsuski sahifa topilmadi" = app's 404, NOT Cloudflare)

// Try different URL patterns
const urls = [
  '/oz/organization/302678824',
  '/oz/organizations/302678824', 
  '/oz/company/302678824',
  '/oz/firma/302678824',
  '/oz/org/302678824',
  '/oz/firm/302678824',
  '/oz/business/302678824',
  '/oz/yuridik/302678824',
]

for (const urlPath of urls) {
  console.log(`\nTrying ${urlPath}...`)
  try {
    const response = await page.goto(`https://ihamkor.uz${urlPath}`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 15000 
    })
    
    // Quick check — is it Cloudflare or app?
    await new Promise(r => setTimeout(r, 3000))
    const title = await page.title()
    const body = await page.evaluate(() => document.body?.innerText?.substring(0, 300) || '')
    
    if (title.includes('Just a moment')) {
      console.log('  → Cloudflare challenge (blocked)')
      // Go back to home page to reset
      await page.goto('https://ihamkor.uz/oz', { waitUntil: 'networkidle2', timeout: 15000 })
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const t = await page.title()
        if (!t.includes('Just a moment')) break
      }
    } else if (body.includes('Afsuski') || body.includes('topilmadi')) {
      console.log('  → App 404 (wrong URL, but Cloudflare PASSED!)')
      console.log(`  Body: ${body.substring(0, 100)}`)
    } else if (body.includes('Kompaniyalar') || body.includes('Indeks') || body.includes('STIR') || body.includes('302678824')) {
      console.log('  → *** FOUND COMPANY DATA! ***')
      console.log(`  Title: ${title}`)
      console.log(`  Body: ${body.substring(0, 500)}`)
      break
    } else {
      console.log(`  → Unknown (title: ${title.substring(0,30)}, body: ${body.substring(0, 100)})`)
    }
  } catch (e) {
    console.log(`  → Error: ${e instanceof Error ? e.message.substring(0, 50) : e}`)
  }
}

await browser.close()
