import asyncio
import nodriver as uc

async def main():
    print("Starting nodriver with sandbox disabled...")
    browser = await uc.start(
        headless=False,
        browser_executable_path="/home/z/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome",
        browser_args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080'],
        sandbox=False,
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
            print(f"  {i*2}s: evaluating... (page still loading)")
    
    await asyncio.sleep(3)
    
    try:
        title = await page.evaluate("document.title")
        body = await page.evaluate("document.body.innerText.substring(0, 1500)")
        print(f"\nFinal title: {title}")
        print(f"Body text: {body[:600]}")
    except Exception as e:
        print(f"Error: {e}")
    
    browser.stop()

if __name__ == "__main__":
    asyncio.run(main())
