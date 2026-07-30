import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

// Intercept ALL network requests
const apiCalls: any[] = []
page.on('request', (req) => {
  const url = req.url()
  if (url.includes('api') || url.includes('organization') || url.includes('search') || url.includes('company') || url.includes('reference')) {
    if (!url.includes('.js') && !url.includes('.css') && !url.includes('.png') && !url.includes('.svg')) {
      apiCalls.push({ method: req.method(), url, headers: req.headers() })
    }
  }
})

page.on('response', async (res) => {
  const url = res.url()
  if ((url.includes('api') || url.includes('organization') || url.includes('search')) && !url.includes('.js') && !url.includes('.css')) {
    try {
      const body = await res.text()
      if (body && body.length < 2000) {
        console.log(`RESPONSE ${res.status()} ${url.substring(0, 80)}`)
        console.log(`  Body: ${body.substring(0, 300)}`)
      } else if (body) {
        console.log(`RESPONSE ${res.status()} ${url.substring(0, 80)} (${body.length} bytes)`)
        console.log(`  Preview: ${body.substring(0, 300)}`)
      }
    } catch {}
  }
})

// Step 1: Load home page (Cloudflare passes)
console.log('Loading home page...')
await page.goto('https://ihamkor.uz/oz', { waitUntil: 'networkidle2', timeout: 30000 })
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  if (!title.includes('Just a moment')) break
}
console.log('Home loaded:', await page.title())

// Step 2: Type in search box (SPA should make API calls, NOT navigate)
console.log('\nTyping in search box...')
const input = await page.$('input[name="search"]')
if (input) {
  await input.click()
  await input.type('302678824', { delay: 100 })
  await new Promise(r => setTimeout(r, 2000))
  
  // Press Enter (might trigger search)
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 5000))
  
  // Check if page navigated (bad) or stayed (good - SPA)
  const currentUrl = page.url()
  console.log('Current URL after search:', currentUrl)
  
  // Check page content
  const body = await page.evaluate(() => document.body?.innerText?.substring(0, 1000) || '')
  console.log('Body after search:', body.substring(0, 500))
}

// Print all intercepted API calls
console.log('\n=== INTERCEPTED API CALLS ===')
for (const call of apiCalls) {
  console.log(`${call.method} ${call.url.substring(0, 100)}`)
}

await browser.close()
