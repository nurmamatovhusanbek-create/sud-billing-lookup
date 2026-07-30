import asyncio
import nodriver as uc

async def main():
    print("Starting nodriver...")
    browser = await uc.start(
        headless=False,
        browser_executable_path="/home/z/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome",
        browser_args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1920,1080'],
    )
    
    print("Browser started! Navigating...")
    page = await browser.get('https://ihamkor.uz/oz/search?query=302678824')
    
    for i in range(30):
        await asyncio.sleep(2)
        try:
            title = await page.evaluate("document.title")
            print(f"  {i*2}s: \"{title[:50]}\"")
            if "Just a moment" not in str(title) and "Attention" not in str(title):
                print("  CLOUDFLARE PASSED!")
                break
        except:
            print(f"  {i*2}s: loading...")
    
    await asyncio.sleep(3)
    try:
        title = await page.evaluate("document.title")
        body = await page.evaluate("document.body.innerText.substring(0, 1000)")
        print(f"\nTitle: {title}")
        print(f"Body: {body[:500]}")
    except Exception as e:
        print(f"Read error: {e}")
    
    browser.stop()

asyncio.run(main())
