import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

const page = await browser.newPage()
await page.setViewport({ width: 1920, height: 1080 })
await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')

// Step 1: Visit home page
console.log('Step 1: Home page...')
await page.goto('https://ihamkor.uz/oz', { waitUntil: 'domcontentloaded', timeout: 30000 })
for (let i = 0; i < 20; i++) {
  await new Promise(r => setTimeout(r, 2000))
  const title = await page.title()
  if (!title.includes('Just a moment') && !title.includes('Attention')) break
}
console.log('Home page resolved:', await page.title())

// Step 2: DON'T navigate to a new URL. Instead, use the search box ON the page.
console.log('\nStep 2: Looking for search input on home page...')
const searchInput = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input'))
  return inputs.map(i => ({ type: i.type, placeholder: i.placeholder, name: i.name, id: i.id }))
})
console.log('Inputs found:', JSON.stringify(searchInput))

// Type the TIN into the search input and press Enter
if (searchInput.length > 0) {
  const inputSelector = searchInput[0].id ? `#${searchInput[0].id}` : 
                        searchInput[0].name ? `input[name="${searchInput[0].name}"]` :
                        'input[type="text"]'
  console.log(`Typing into: ${inputSelector}`)
  await page.click(inputSelector)
  await page.type(inputSelector, '302678824')
  await new Promise(r => setTimeout(r, 500))
  await page.keyboard.press('Enter')
  
  // Wait for navigation
  await new Promise(r => setTimeout(r, 5000))
  
  // Wait for any Cloudflare challenge
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const title = await page.title()
    console.log(`  ${i*2}s: "${title.substring(0,50)}"`)
    if (!title.includes('Just a moment') && !title.includes('Attention')) break
  }
  
  await new Promise(r => setTimeout(r, 3000))
  
  const url = page.url()
  console.log('Current URL:', url)
  
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || '')
  console.log('Body text:', bodyText.substring(0, 1500))
  
  const links = await page.evaluate(() => 
    Array.from(document.querySelectorAll('a')).map(a => ({ href: a.getAttribute('href') || '', text: (a.textContent||'').trim().substring(0,60) }))
      .filter(l => l.href && !l.href.includes('cloudflare') && l.href !== '#')
  )
  console.log('Links:', JSON.stringify(links.slice(0, 15)))
}

await browser.close()
