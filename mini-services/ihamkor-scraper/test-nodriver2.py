import asyncio
import nodriver as uc

async def main():
    print("Starting nodriver...")
    browser = await uc.start(
        headless=False,
        browser_executable_path="/home/z/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome",
        browser_args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
    )
    
    print("Navigating to ihamkor.uz search...")
    page = await browser.get('https://ihamkor.uz/oz/search?query=302678824')
    
    for i in range(30):
        await asyncio.sleep(2)
        try:
            title = await page.evaluate("document.title")
            print(f"  {i*2}s: \"{title[:50]}\"")
            if "Just a moment" not in title and "Attention" not in title:
                print("  CLOUDFLARE PASSED!")
                break
        except Exception as e:
            print(f"  {i*2}s: error: {e}")
    
    await asyncio.sleep(3)
    
    try:
        title = await page.evaluate("document.title")
        body = await page.evaluate("document.body.innerText.substring(0, 2000)")
        print(f"Final title: {title}")
        print(f"Body text: {body[:800]}")
        
        links = await page.evaluate("""
            Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.getAttribute('href') || '',
                text: (a.textContent || '').trim().substring(0, 60)
            })).filter(l => l.href && !l.href.includes('cloudflare') && l.href !== '#')
        """)
        print(f"Links: {links[:10]}")
    except Exception as e:
        print(f"Error reading page: {e}")
    
    browser.stop()

if __name__ == "__main__":
    asyncio.run(main())
