"""Generate Chrome Web Store / AMO assets from the built Chrome package:
   store/store-icon-128.png, store/screenshot-[1-5]-*.png (1280x800), store/promo-440x280.png

    ./build.sh && python3 tools/store_assets.py
"""
import asyncio
import pathlib
from PIL import Image, ImageDraw, ImageFont
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXT = ROOT / "dist" / "chrome"
OUT = ROOT / "store"
TMP = OUT / ".raw"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

CHAT = """<html><head><meta charset="utf-8"><title>Release pipeline plan</title><style>
body{margin:0;background:#f7f6f2;font:16px/1.65 system-ui,sans-serif;color:#1f2937}
header{height:52px;border-bottom:1px solid #e5e2da;display:flex;align-items:center;padding:0 24px;font-weight:600;color:#4b5563}
#scroller{height:calc(100vh - 53px);overflow-y:auto}
main{max-width:760px;margin:0 auto;padding:28px 24px 120px}
[data-testid=user-message]{background:#ebe8e0;border-radius:16px;padding:12px 18px;margin:20px 0 20px auto;max-width:72%}
[data-testid=assistant-message]{margin:6px 0 18px}
code{background:#ece9e1;border-radius:4px;padding:0 4px;font-size:14px}
</style></head><body><header>Release pipeline plan</header><div id="scroller"><main>
<div data-testid="user-message">We need a release pipeline with three gates. Keep the exact file names and exit codes.</div>
<div data-testid="assistant-message"><div data-transcript-engine-root><div class="standard-markdown">
<p>Here's a gate order that leaves nothing to interpretation.</p>
<p>Gate 1 runs <code>build.py --strict</code>. It passes only if the exit code is 0 and <code>dist/manifest.json</code> exists.</p>
<p>Gate 2 runs <code>verify_output.py</code> against <code>output.json</code>. It requires exactly 3 entries and no null fields.</p>
<p>Gate 3 runs <code>publish.py</code> only when Gate 2 passed and the tag matches <code>v1.2.0</code>. If the tag is missing, exit with code 2.</p>
<p>Everything else can change freely, but these three conditions are the contract.</p></div></div></div>
<div data-testid="user-message">What happens if Gate 2 fails on a Friday release?</div>
<div data-testid="assistant-message"><div data-transcript-engine-root><div class="standard-markdown">
<p>Then the release stops and nothing is published. Re-run Gate 2 after fixing <code>output.json</code>; Gate 1 doesn't need to run again unless the build changed.</p>
<p>Keep a rollback tag, <code>v1.1.9</code>, so you can redeploy the last good version in one step.</p></div></div></div>
</main></div></body></html>"""


def caption(raw, out, title, sub):
    W, H, BAND = 1280, 800, 96
    canvas = Image.new("RGB", (W, H), "#0b1020")
    shot = Image.open(raw).convert("RGB").resize((W, H - BAND), Image.LANCZOS)
    canvas.paste(shot, (0, BAND))
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, BAND - 3, W, BAND], fill="#f59e0b")
    d.text((36, 18), title, font=ImageFont.truetype(FONT, 30), fill="#f9fafb")
    d.text((36, 58), sub, font=ImageFont.truetype(FONT_R, 18), fill="#9aa4b8")
    canvas.save(out)


def icons():
    # Chrome Web Store: 128x128, 96x96 artwork centred with 16px transparent padding
    src = Image.open(ROOT / "src/icons/icon-128.png").convert("RGBA")
    bbox = src.getbbox()
    art = src.crop(bbox).resize((96, 96), Image.LANCZOS)
    icon = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    icon.paste(art, (16, 16), art)
    icon.save(OUT / "store-icon-128.png")
    # small promo tile 440x280
    W, H, S = 440, 280, 2
    im = Image.new("RGB", (W * S, H * S), "#0b1020")
    d = ImageDraw.Draw(im)
    big = src.crop(bbox).resize((104 * S, 104 * S), Image.LANCZOS)
    im.paste(big, (28 * S, (H // 2 - 52) * S), big)
    d.text((152 * S, 78 * S), "TExporT", font=ImageFont.truetype(FONT, 40 * S), fill="#f9fafb")
    d.text((154 * S, 128 * S), "Markers", font=ImageFont.truetype(FONT, 22 * S), fill="#f59e0b")
    d.text((154 * S, 166 * S), "Mark it. Export it.\nThe next AI keeps it.", font=ImageFont.truetype(FONT_R, 14 * S), fill="#9aa4b8", spacing=5 * S)
    im.resize((W, H), Image.LANCZOS).save(OUT / "promo-440x280.png")


async def shots():
    TMP.mkdir(exist_ok=True)
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context("", headless=True, channel="chromium",
            viewport={"width": 1280, "height": 704}, device_scale_factor=1,
            args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"])
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event("serviceworker")
        ext = sw.url.split("/")[2]

        async def serve(route):
            await route.fulfill(status=200, content_type="text/html", body=CHAT)
        await ctx.route("https://claude.ai/**", serve)
        page = await ctx.new_page()
        await page.goto("https://claude.ai/chat/release-plan")
        await page.wait_for_timeout(1500)

        async def select_mark(text_has):
            await page.evaluate("""(t) => { const p = [...document.querySelectorAll('.standard-markdown p')].find(x => x.textContent.includes(t));
                const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }""", text_has)
            await page.keyboard.press("Control+m")
            await page.wait_for_timeout(500)
        for t in ("Gate 1 runs", "Gate 2 runs", "Gate 3 runs", "rollback tag"):
            await select_mark(t)
        await page.wait_for_timeout(2700)          # let the toast fade
        # 1. markers + panel
        await page.evaluate("""() => { const h = [...document.querySelectorAll('div')].find(d => d.shadowRoot && d.shadowRoot.querySelector('.pill'));
            h.shadowRoot.querySelector('.pill').click(); }""")
        await page.wait_for_timeout(600)
        await page.screenshot(path=TMP / "1.png")
        caption(TMP / "1.png", OUT / "screenshot-1-markers.png", "Mark what matters as you read",
                "Highlight text and press Ctrl+M (or right-click). Every marker shows its size; the panel lists them all.")
        await page.evaluate("""() => { const h = [...document.querySelectorAll('div')].find(d => d.shadowRoot && d.shadowRoot.querySelector('.pill'));
            h.shadowRoot.querySelector('.pill').click(); }""")
        # 2. Ctrl+Q picker
        await sw.evaluate("""async () => chrome.storage.local.set({collections: {a: {name: "Release pipeline", created: "2026-11-01T00:00:00Z", convos: []},
            b: {name: "Client handoff", created: "2026-11-02T00:00:00Z", convos: []}}})""")
        await page.keyboard.press("Control+q")
        await page.wait_for_timeout(700)
        await page.screenshot(path=TMP / "2.png")
        caption(TMP / "2.png", OUT / "screenshot-2-collect.png", "Ctrl+Q: save the whole chat to a collection",
                "TExporT reads every message, even in long chats, and keeps your markers on the right lines.")
        await page.evaluate("""() => { const h = [...document.querySelectorAll('div')].find(d => d.shadowRoot && d.shadowRoot.querySelector('.picker'));
            [...h.shadowRoot.querySelectorAll('.picker .opt')].find(b => b.textContent.includes('Release pipeline')).click(); }""")
        await page.wait_for_timeout(4000)
        # 3. export page
        cols = await sw.evaluate("() => chrome.storage.local.get('collections')")
        ex = await ctx.new_page()
        await ex.goto(f"chrome-extension://{ext}/export.html?c=a")
        await ex.wait_for_timeout(1200)
        await ex.screenshot(path=TMP / "3.png")
        caption(TMP / "3.png", OUT / "screenshot-3-export.png", "Export a handoff the next AI can't quietly lose",
                "PDF or Markdown with reader instructions, a register of every marked passage, and [[MARK]] tags inline.")
        # 4. marker window
        tid = await sw.evaluate("async () => (await chrome.tabs.query({url: 'https://claude.ai/*'}))[0].id")
        mw = await ctx.new_page()
        await mw.goto(f"chrome-extension://{ext}/marker.html?tab={tid}")
        await mw.wait_for_timeout(1200)
        await mw.screenshot(path=TMP / "4.png")
        caption(TMP / "4.png", OUT / "screenshot-4-marker-window.png", "Marker window: big tap targets, works on phones",
                "Tap a paragraph to mark it, or select words and tap ★ Mark selection. Works on any page you choose.")
        # 5. Smart Marker result
        await mw.evaluate("""() => { const prompt = smartPrompt(); }""")
        await mw.click("#smart")
        await mw.wait_for_timeout(800)
        await mw.screenshot(path=TMP / "5.png")
        caption(TMP / "5.png", OUT / "screenshot-5-smart-marker.png", "Smart Marker: the chat's own AI picks the key points",
                "No API key. TExporT lays the markers, copies the handoff, downloads the .md and files it in a collection.")
        await ctx.close()


if __name__ == "__main__":
    icons()
    asyncio.run(shots())
    for f in sorted(TMP.glob("*.png")):
        f.unlink()
    TMP.rmdir()
    print("\n".join(str(p.relative_to(ROOT)) for p in sorted(OUT.glob("*.png"))))
