import asyncio
from playwright.async_api import async_playwright

async def main():
    print("Starting Playwright (non-headless + xvfb)...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=False,
            args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-blink-features=AutomationControlled']
        )
        
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        )
        
        # Remove webdriver flag
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
            Object.defineProperty(navigator, 'plugins', {get: () => [1,2,3]});
            Object.defineProperty(navigator, 'languages', {get: () => ['uz','en','ru']});
            window.chrome = { runtime: {} };
        """)
        
        page = await context.new_page()
        
        print("Navigating to ihamkor.uz search...")
        await page.goto('https://ihamkor.uz/oz/search?query=302678824', wait_until='domcontentloaded', timeout=30000)
        
        for i in range(30):
            await asyncio.sleep(2)
            title = await page.title()
            print(f"  {i*2}s: \"{title[:50]}\"")
            if "Just a moment" not in title and "Attention" not in title:
                print("  CLOUDFLARE PASSED!")
                break
        
        await asyncio.sleep(3)
        
        title = await page.title()
        body = await page.evaluate("document.body.innerText.substring(0, 1500)")
        print(f"\nFinal title: {title}")
        print(f"Body: {body[:800]}")
        
        links = await page.evaluate("""
            Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.getAttribute('href') || '',
                text: (a.textContent || '').trim().substring(0, 60)
            })).filter(l => l.href && !l.href.includes('cloudflare') && l.href !== '#')
        """)
        print(f"Links: {links[:10]}")
        
        await browser.close()

asyncio.run(main())
