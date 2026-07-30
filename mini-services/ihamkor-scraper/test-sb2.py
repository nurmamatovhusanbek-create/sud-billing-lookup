from seleniumbase import SB
import time

print("Starting SeleniumBase UC mode...")
with SB(uc=True, xvfb=True) as sb:
    print("Browser started!")
    sb.open("https://ihamkor.uz/oz/search?query=302678824")
    
    for i in range(30):
        time.sleep(2)
        try:
            title = sb.get_title()
            print(f"  {i*2}s: \"{title[:50]}\"")
            if "Just a moment" not in title and "Attention" not in title:
                print("  CLOUDFLARE PASSED!")
                break
        except:
            print(f"  {i*2}s: loading...")
    
    time.sleep(3)
    try:
        title = sb.get_title()
        body = sb.execute_script("return document.body.innerText.substring(0, 1500)")
        print(f"\nFinal title: {title}")
        print(f"Body: {body[:800]}")
    except Exception as e:
        print(f"Error: {e}")
