"""Regenerate the 1280×800 store screenshots in store/ from the built Chrome package.
    ./build.sh && python3 tools/screenshots.py"""
import asyncio
import pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parents[1]
EXT = ROOT / "dist" / "chrome"
OUT = ROOT / "store"
CSS = """body{margin:0;background:#f5f4ef;font:16px/1.6 system-ui,sans-serif;color:#1f2937}
main{max-width:760px;margin:0 auto;padding:40px 24px}
[data-testid=user-message]{background:#e7e5df;border-radius:14px;padding:12px 16px;margin:18px 0 18px auto;max-width:70%}
.font-claude-response{padding:4px 2px} h2{font-size:15px;color:#6b7280;font-weight:600;margin:0 0 20px}"""
PAGE = f"""<html><head><meta charset="utf-8"><style>{CSS}</style><title>Gate plan — Claude</title></head><body><main><h2>Gate plan for the build pipeline</h2>
<div data-testid="user-message">Lay out the three gates for the release pipeline. Keep the exact file names.</div>
<div class="font-claude-response">
<p>Here's the gate order I'd use, with the exit conditions spelled out so nothing is left to interpretation.</p>
<p>Gate 1 runs <code>build.py --strict</code>. It passes only if the exit code is 0 and <code>dist/manifest.json</code> exists.</p>
<p>Gate 2 runs <code>verify_output.py</code> against <code>output.json</code>. It requires exactly 3 entries and no null fields; anything else fails the run.</p>
<p>Gate 3 runs <code>publish.py</code> only when Gate 2 passed and the version tag matches <code>v1.2.0</code>. If the tag is missing, exit with code 2 and stop.</p>
<p>Everything else in the pipeline can change freely, but these three conditions are the contract.</p></div>
<div data-testid="user-message">Perfect — mark those and export them for the next session.</div>
</main></body></html>"""
async def main():
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context("", headless=True, channel="chromium",
            viewport={"width": 1280, "height": 800},
            args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"])
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event("serviceworker")
        eid = sw.url.split("/")[2]
        await ctx.route("https://claude.ai/**", lambda r: r.fulfill(status=200, content_type="text/html", body=PAGE))
        page = await ctx.new_page()
        await page.goto("https://claude.ai/chat/gate-plan")
        await page.wait_for_timeout(1200)
        async def mark(i, note=""):
            await page.click(f".font-claude-response p:nth-of-type({i})", button="right")
            await page.keyboard.press("Escape")
            await sw.evaluate("async () => { const [t] = await chrome.tabs.query({url:'https://claude.ai/*'}); await chrome.tabs.sendMessage(t.id, {cmd:'cm-mark', selection:''}); }")
            await page.wait_for_timeout(400)
        await sw.evaluate("async () => chrome.storage.local.set({settings: {defaultScope: 'paragraph', showPanel: true}})")
        await page.wait_for_timeout(500)
        for i in (2, 3, 4):
            await mark(i)
        await page.wait_for_timeout(1000)
        await page.wait_for_timeout(2500)
        await page.mouse.click(1180, 768)
        await page.wait_for_timeout(600)
        await page.screenshot(path=f"{OUT}/screenshot-1-markers.png")
        page.on("dialog", lambda d: asyncio.ensure_future(d.accept("Release pipeline")))
        await sw.evaluate("async () => { const [t] = await chrome.tabs.query({url:'https://claude.ai/*'}); chrome.tabs.sendMessage(t.id, {cmd:'cm-capture'}); }")
        await page.wait_for_timeout(1500)
        q = await ctx.new_page()
        await q.goto(f"chrome-extension://{eid}/export.html")
        await q.wait_for_timeout(1000)
        await q.click("a")
        await q.wait_for_timeout(1200)
        await q.screenshot(path=f"{OUT}/screenshot-2-export.png")
        o = await ctx.new_page()
        await o.goto(f"chrome-extension://{eid}/options.html")
        await o.wait_for_timeout(800)
        await o.screenshot(path=f"{OUT}/screenshot-3-settings.png")
        await ctx.close()
asyncio.run(main())
