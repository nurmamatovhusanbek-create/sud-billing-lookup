import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

// Step 1: Visit home page first to solve Cloudflare + get cookies
console.log('Step 1: Visiting home page to solve Cloudflare...')
await page.goto('https://ihamkor.uz/oz', { waitUntil: 'domcontentloaded', timeout: 30000 })

// Wait for challenge to resolve
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  if (!title.includes('Just a moment') && !title.includes('Attention')) {
    console.log(`  Challenge resolved at ${i*2}s`)
    break
  }
}

// Get cookies (cf_clearance should be set now)
const cookies = await page.cookies()
console.log('Cookies:', cookies.map(c => `${c.name}=${c.value.substring(0,20)}...`).join(', '))

// Step 2: Now navigate to search (same session, cookies preserved)
console.log('\nStep 2: Navigating to search...')
await page.goto('https://ihamkor.uz/oz/search?query=302678824', { waitUntil: 'domcontentloaded', timeout: 30000 })

// Wait for any new challenge
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  console.log(`  ${i*2}s: title = "${title.substring(0,40)}"`)
  if (!title.includes('Just a moment') && !title.includes('Attention')) {
    console.log('  Search page loaded!')
    break
  }
}

await new Promise(r => setTimeout(r, 3000))

const searchText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || '')
console.log('Search body text:', searchText.substring(0, 1000))

// Find links to organization pages
const links = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a')).map(a => ({
    href: a.getAttribute('href') || '',
    text: (a.textContent || '').trim().substring(0, 60)
  })).filter(l => l.href && !l.href.includes('cloudflare') && l.href !== '#')
})
console.log('\nLinks:', JSON.stringify(links.slice(0, 20)))

// Check URL of current page
const currentUrl = page.url()
console.log('Current URL:', currentUrl)

await browser.close()
