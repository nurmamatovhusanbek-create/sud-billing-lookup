import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

console.log('Navigating to search...')
await page.goto('https://ihamkor.uz/oz/search?query=302678824', { waitUntil: 'networkidle2', timeout: 30000 })

await page.waitForFunction(() => !document.title.includes('Just a moment'), { timeout: 20000 }).catch(() => {})
await new Promise(r => setTimeout(r, 5000))

const title = await page.title()
console.log('Title:', title)

const links = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a')).map(a => ({
    href: a.getAttribute('href'),
    text: a.textContent?.trim().substring(0, 50)
  })).filter(l => l.href && l.href.includes('/'))
})
console.log('Links with org:', links.filter(l => l.href?.includes('org') || l.href?.includes('company') || l.href?.includes('302678824')))
console.log('All links:', JSON.stringify(links.slice(0, 15)))

const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '')
console.log('Body text:', bodyText)

// Check if there are any XHR/fetch calls
console.log('\nTrying direct API from browser context...')
const apiResult = await page.evaluate(async () => {
  try {
    const res = await fetch('https://api.birdarcha.uz/v1/reference/organizations?tin=302678824')
    return { status: res.status, body: (await res.text()).substring(0, 500) }
  } catch (e) {
    return { error: e.message }
  }
})
console.log('API result:', JSON.stringify(apiResult))

await browser.close()
