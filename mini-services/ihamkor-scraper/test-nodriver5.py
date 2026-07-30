import asyncio
import nodriver as uc

async def main():
    print("Starting nodriver with sandbox=False...")
    browser = await uc.start(
        headless=False,
        browser_executable_path="/home/z/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome",
        browser_args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        sandbox=False,
    )
    print("Browser connected!")
    
    page = await browser.get('https://ihamkor.uz/oz/search?query=302678824')
    print("Navigated to search page")
    
    for i in range(30):
        await asyncio.sleep(2)
        try:
            title = await page.evaluate("document.title")
            print(f"  {i*2}s: {title[:50]}")
            if "Just a moment" not in str(title) and "Attention" not in str(title):
                print("  PASSED!")
                break
        except:
            print(f"  {i*2}s: loading...")
    
    await asyncio.sleep(3)
    try:
        body = await page.evaluate("document.body.innerText.substring(0, 1000)")
        print(f"Body: {body[:500]}")
    except Exception as e:
        print(f"Error: {e}")
    
    browser.stop()

asyncio.run(main())
