from seleniumbase import SB
import time

print("Starting SeleniumBase UC mode with xvfb...")
with SB(uc=True, xvfb=True, no_sandbox=True) as sb:
    print("Browser started!")
    sb.open("https://ihamkor.uz/oz/search?query=302678824")
    
    for i in range(30):
        time.sleep(2)
        title = sb.get_title()
        print(f"  {i*2}s: \"{title[:50]}\"")
        if "Just a moment" not in title and "Attention" not in title:
            print("  CLOUDFLARE PASSED!")
            break
    
    time.sleep(3)
    title = sb.get_title()
    body = sb.execute_script("return document.body.innerText.substring(0, 1500)")
    print(f"\nFinal title: {title}")
    print(f"Body: {body[:800]}")
    
    links = sb.execute_script("""
        return Array.from(document.querySelectorAll('a')).map(a => ({
            href: a.getAttribute('href') || '',
            text: (a.textContent || '').trim().substring(0, 60)
        })).filter(l => l.href && !l.href.includes('cloudflare') && l.href !== '#')
    """)
    print(f"Links: {links[:10]}")
