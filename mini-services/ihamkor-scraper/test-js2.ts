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
  const title = await page.title()
  if (!title.includes('Just a moment')) break
}

// Get ALL JS files and search ALL of them
const scripts = await page.evaluate(() => 
  Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
)

let allRoutes: string[] = []
let allApis: string[] = []

for (const scriptUrl of scripts) {
  if (!scriptUrl.includes('ihamkor.uz')) continue
  try {
    const jsContent = await page.evaluate(async (url) => {
      const res = await fetch(url)
      return await res.text()
    }, scriptUrl)
    
    const routes = jsContent.match(/\/oz\/[a-z_]+/g)
    if (routes) allRoutes.push(...routes)
    
    const apis = jsContent.match(/\/api\/[a-z/_]+/g)
    if (apis) allApis.push(...apis)
  } catch {}
}

console.log('=== ALL ROUTES ===')
console.log([...new Set(allRoutes)].sort())
console.log('\n=== ALL API ENDPOINTS ===')
console.log([...new Set(allApis)].sort())

await browser.close()
