import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

// Track ALL responses
page.on('response', async (res) => {
  const url = res.url()
  if (url.includes('ihamkor.uz') && !url.includes('.css') && !url.includes('.js') && !url.includes('.png') && !url.includes('.svg') && !url.includes('.woff')) {
    const status = res.status()
    if (status !== 403) {
      try {
        const body = await res.text()
        console.log(`  [${status}] ${url.substring(0, 80)}`)
        if (body.length < 500 && !body.includes('<!DOCTYPE')) {
          console.log(`       Body: ${body.substring(0, 200)}`)
        }
      } catch {}
    }
  }
})

// Load home page
console.log('Loading home page...')
await page.goto('https://ihamkor.uz/oz', { waitUntil: 'networkidle2', timeout: 30000 })
for (let i = 0; i < 15; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  if (!title.includes('Just a moment')) break
}
console.log('Home loaded:', await page.title())

// Wait for page to fully render
await new Promise(r => setTimeout(r, 3000))

// Find the search input and type
console.log('\nSearching for TIN 302678824...')
const input = await page.$('input[name="search"]')
if (input) {
  await input.click()
  await input.type('302678824', { delay: 50 })
  await new Promise(r => setTimeout(r, 1000))
  
  // Look for a search button or dropdown
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, [role="button"]')).map(b => ({
      tag: b.tagName,
      text: (b.textContent || '').trim().substring(0, 40),
      class: b.className,
      href: b.getAttribute('href') || ''
    })).filter(b => b.text || b.href)
  })
  console.log('Buttons/links:', JSON.stringify(buttons.slice(0, 10)))
  
  // Press Enter
  await page.keyboard.press('Enter')
  await new Promise(r => setTimeout(r, 8000))
  
  // Check current URL + title
  console.log('Current URL:', page.url())
  console.log('Title:', await page.title())
  
  // Check body content
  const body = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '')
  console.log('Body:', body.substring(0, 1000))
  
  // Find any organization links
  const links = await page.evaluate(() => 
    Array.from(document.querySelectorAll('a')).map(a => ({
      href: a.getAttribute('href') || '',
      text: (a.textContent || '').trim().substring(0, 60)
    })).filter(l => l.href && l.href !== '#' && !l.href.includes('cloudflare'))
  )
  console.log('\nLinks:', JSON.stringify(links.slice(0, 15)))
}

await browser.close()
