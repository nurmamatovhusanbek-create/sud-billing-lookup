import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

// Load home page first (passes Cloudflare)
console.log('Loading home page...')
await page.goto('https://ihamkor.uz/oz', { waitUntil: 'networkidle2', timeout: 30000 })
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  if (!title.includes('Just a moment')) break
}
console.log('Home loaded')

// Get cookies
const cookies = await page.cookies()
const cfCookie = cookies.find(c => c.name === 'cf_clearance')
console.log('cf_clearance:', cfCookie ? 'present' : 'missing')

// Try calling the search API from the browser context (same-origin, same cookies)
console.log('\n=== Trying API call from browser context ===')
const apiResult = await page.evaluate(async () => {
  try {
    const res = await fetch('/api/search/quick?q=302678824', {
      headers: { 'Accept': 'application/json' }
    })
    const text = await res.text()
    return { status: res.status, body: text.substring(0, 1000) }
  } catch (e) {
    return { error: e.message }
  }
})
console.log('API result:', JSON.stringify(apiResult).substring(0, 500))

// Try different organization URL patterns
const urls = [
  '/oz/organization/302678824',
  '/oz/org/302678824',
  '/oz/company/302678824',
  '/oz/firma/302678824',
  '/oz/organizations/302678824',
  '/oz/organization?tin=302678824',
  '/oz/search?s=302678824',
]

console.log('\n=== Testing URL patterns ===')
for (const url of urls) {
  try {
    const response = await page.goto(`https://ihamkor.uz${url}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const status = response?.status()
    const title = await page.title()
    
    // Check if it's Cloudflare challenge or actual page
    const isCloudflare = title.includes('Just a moment') || title.includes('Attention')
    const body = await page.evaluate(() => document.body?.innerText?.substring(0, 200) || '')
    const is404 = body.includes('Afsuski') || body.includes('topilmadi')
    
    console.log(`  ${url}: status=${status}, cf=${isCloudflare}, 404=${is404}, title="${title.substring(0,30)}"`)
    if (!isCloudflare && !is404) {
      console.log(`    *** FOUND! Body: ${body.substring(0, 200)}`)
    }
  } catch (e) {
    console.log(`  ${url}: error: ${e instanceof Error ? e.message.substring(0, 50) : e}`)
  }
}

// Also check the JS bundle for route patterns
console.log('\n=== Checking JS for route patterns ===')
const jsResponse = await page.goto('https://ihamkor.uz', { waitUntil: 'domcontentloaded' })
const html = await page.content()
const jsUrls = html.match(/src="([^"]*\.js)"/g)?.map(s => s.replace('src="', '').replace('"', ''))
if (jsUrls) {
  for (const jsUrl of jsUrls.slice(0, 3)) {
    const fullUrl = jsUrl.startsWith('http') ? jsUrl : `https://ihamkor.uz${jsUrl}`
    console.log(`Checking JS: ${fullUrl.substring(0, 60)}`)
    const jsPage = await browser.newPage()
    await jsPage.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {})
    const jsContent = await jsPage.content()
    // Search for organization/company route patterns
    const routes = jsContent.match(/\/oz\/[a-z_]+\/?\$?[a-z]*/g)
    if (routes) {
      console.log('  Routes found:', [...new Set(routes)].slice(0, 15))
    }
    await jsPage.close()
  }
}

await browser.close()
