import asyncio
import nodriver as uc

async def main():
    print("Starting nodriver (undetected Chrome)...")
    browser = await uc.start(
        headless=False,
        browser_args=['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
    )
    
    print("Navigating to ihamkor.uz search...")
    page = await browser.get('https://ihamkor.uz/oz/search?query=302678824')
    
    # Wait for Cloudflare to resolve
    for i in range(30):
        await asyncio.sleep(2)
        title = await page.evaluate("document.title")
        print(f"  {i*2}s: \"{title[:50]}\"")
        if "Just a moment" not in title and "Attention" not in title:
            print("  CLOUDFLARE PASSED!")
            break
    
    await asyncio.sleep(3)
    
    title = await page.evaluate("document.title")
    body = await page.evaluate("document.body.innerText.substring(0, 2000)")
    print(f"Final title: {title}")
    print(f"Body text: {body[:800]}")
    
    # Get links
    links = await page.evaluate("""
        Array.from(document.querySelectorAll('a')).map(a => ({
            href: a.getAttribute('href') || '',
            text: (a.textContent || '').trim().substring(0, 60)
        })).filter(l => l.href && !l.href.includes('cloudflare') && l.href !== '#')
    """)
    print(f"Links: {links[:10]}")
    
    browser.stop()

if __name__ == "__main__":
    asyncio.run(main())
