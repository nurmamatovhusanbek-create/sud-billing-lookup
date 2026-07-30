import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

// Load home page
console.log('Loading home page...')
await page.goto('https://ihamkor.uz/oz', { waitUntil: 'networkidle2', timeout: 30000 })
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  if (!title.includes('Just a moment')) break
}
console.log('Home loaded:', await page.title())

// Get all script src URLs
const scripts = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
})
console.log('Scripts:', scripts.slice(0, 10))

// Fetch each JS file and search for route patterns
for (const scriptUrl of scripts.slice(0, 5)) {
  if (!scriptUrl.includes('ihamkor.uz')) continue
  console.log(`\nChecking: ${scriptUrl.substring(0, 70)}`)
  try {
    const jsContent = await page.evaluate(async (url) => {
      const res = await fetch(url)
      return await res.text()
    }, scriptUrl)
    
    // Search for route patterns
    const orgRoutes = jsContent.match(/\/oz\/[a-z_]+\/?\$?[a-z0-9]*/g)
    if (orgRoutes) {
      console.log('  Routes:', [...new Set(orgRoutes)].slice(0, 15))
    }
    
    // Search for "organization" in context
    const orgContexts = jsContent.match(/["'][a-z/]*organization[a-z/]*["']/gi)
    if (orgContexts) {
      console.log('  Org patterns:', [...new Set(orgContexts)].slice(0, 10))
    }
    
    // Search for the API endpoint
    const apis = jsContent.match(/\/api\/[a-z/_]+/g)
    if (apis) {
      console.log('  APIs:', [...new Set(apis)].slice(0, 10))
    }
  } catch (e) {
    console.log(`  Error: ${e}`)
  }
}

await browser.close()
