import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

await page.goto('https://ihamkor.uz/oz', { waitUntil: 'networkidle2', timeout: 30000 })
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000))
  if (!(await page.title()).includes('Just a moment')) break
}
console.log('Home loaded')

// The search API is /api/search/quick?q=TIN
// Call it from the browser context (same session, same cookies)
console.log('\nCalling /api/search/quick?q=302678824 from browser context...')
const result = await page.evaluate(async () => {
  try {
    const res = await fetch('/api/search/quick?q=302678824', {
      headers: { 'Accept': 'application/json' }
    })
    const status = res.status
    const text = await res.text()
    return { status, text: text.substring(0, 2000) }
  } catch (e) {
    return { error: e.message }
  }
})
console.log('Status:', result.status)
console.log('Response:', result.text || result.error)

// If it returned JSON with company data, look for the organization URL/ID
if (result.status === 200 && result.text) {
  try {
    const data = JSON.parse(result.text)
    console.log('\nParsed JSON:', JSON.stringify(data).substring(0, 1000))
  } catch {
    console.log('\nNot JSON — checking if HTML...')
    if (result.text.includes('Just a moment')) {
      console.log('Cloudflare blocked the API call too')
    }
  }
}

await browser.close()
