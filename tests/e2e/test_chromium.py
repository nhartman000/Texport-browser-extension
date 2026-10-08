"""End-to-end smoke test: loads the built Chrome package into Chromium and drives it on
mock Claude / ChatGPT / Gemini pages (network routed locally, nothing leaves the machine).

    ./build.sh && python3 tests/e2e/test_chromium.py
"""
import asyncio
import pathlib
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
EXT = ROOT / "dist" / "chrome"

PAGES = {
    "https://claude.ai/chat/e2e": """<main>
        <div data-testid="user-message">Lay out the gates.</div>
        <div class="font-claude-response"><p>Gate 1 runs build.py.</p><p>Gate 2 checks output.json.</p></div></main>""",
    "https://chatgpt.com/c/e2e": """<main>
        <div data-message-author-role="user">Lay out the gates.</div>
        <div data-message-author-role="assistant"><p>Gate 1 runs build.py.</p><p>Gate 2 checks output.json.</p></div></main>""",
    "https://gemini.google.com/app/e2e": """<main>
        <user-query>Lay out the gates.</user-query>
        <model-response><p>Gate 1 runs build.py.</p><p>Gate 2 checks output.json.</p></model-response></main>""",
}
ASSISTANT_P2 = {
    "claude.ai": ".font-claude-response p:nth-of-type(2)",
    "chatgpt.com": "[data-message-author-role=assistant] p:nth-of-type(2)",
    "gemini.google.com": "model-response p:nth-of-type(2)",
}


def serve(html):
    async def handler(route):
        await route.fulfill(status=200, content_type="text/html", body=html)
    return handler


async def send(sw, url_glob, msg):
    return await sw.evaluate("""async ([g, m]) => {
        const [t] = await chrome.tabs.query({url: g});
        return chrome.tabs.sendMessage(t.id, m);
    }""", [url_glob, msg])


async def main() -> int:
    if not (EXT / "manifest.json").exists():
        print("Build first: ./build.sh", file=sys.stderr)
        return 2
    failures, errors = [], []

    def check(cond, what):
        print(("PASS " if cond else "FAIL ") + what)
        if not cond:
            failures.append(what)

    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context(
            "", headless=True, channel="chromium",
            args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"])
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event("serviceworker", timeout=15000)
        ext_id = sw.url.split("/")[2]
        for url, body in PAGES.items():
            html = f'<html><head><meta charset="utf-8"><title>E2E</title></head><body>{body}</body></html>'
            await ctx.route(url, serve(html))
        await sw.evaluate("() => chrome.storage.local.set({settings: {defaultScope: 'paragraph'}})")

        for url in PAGES:
            host = url.split("/")[2]
            glob = f"https://{host}/*"
            page = await ctx.new_page()
            page.on("pageerror", lambda e, h=host: errors.append(f"{h}: {e}"))
            # first capture names a new collection; later ones pick it from the list ("1")
            answer = "E2E collection" if host == "claude.ai" else "1"
            page.on("dialog", lambda d, a=answer: asyncio.ensure_future(d.accept(a)))
            await page.goto(url)
            await page.wait_for_timeout(1200)
            before = await send(sw, glob, {"cmd": "cm-count"})
            check(before and before["count"] == 0, f"{host}: content script answers, no markers yet")
            await page.click(ASSISTANT_P2[host], button="right")
            await page.keyboard.press("Escape")
            await send(sw, glob, {"cmd": "cm-mark", "selection": ""})
            after = await send(sw, glob, {"cmd": "cm-count"})
            check(after["count"] == 1, f"{host}: right-click → mark paragraph")
            await sw.evaluate("""async (g) => { const [t] = await chrome.tabs.query({url: g});
                chrome.tabs.sendMessage(t.id, {cmd: "cm-capture"}); }""", glob)
            await page.wait_for_timeout(800)
            await page.close()

        stored = await sw.evaluate("() => chrome.storage.local.get('collections')")
        cols = list(stored.get("collections", {}).values())
        check(len(cols) == 1 and len(cols[0]["convos"]) == 3, "one collection holds all three conversations")
        marked = [m["excerpt"] for c in cols[0]["convos"] for m in c["markers"]] if cols else []
        check(marked == ["Gate 2 checks output.json."] * 3, "paragraph markers captured the right text")

        for pg, needle in (("popup.html", "E2E collection"), ("options.html", "Settings"), ("export.html", "Collections")):
            q = await ctx.new_page()
            q.on("pageerror", lambda e, n=pg: errors.append(f"{n}: {e}"))
            await q.goto(f"chrome-extension://{ext_id}/{pg}")
            await q.wait_for_timeout(600)
            check(needle in await q.inner_text("body"), f"{pg} renders")
            await q.close()

        q = await ctx.new_page()
        await q.goto(f"chrome-extension://{ext_id}/export.html")
        await q.wait_for_timeout(500)
        await q.click("a")
        await q.wait_for_timeout(800)
        body = await q.inner_text("body")
        check("[[MARK M3 START]]" in body and "READER INSTRUCTIONS" in body, "export document has instructions and M1–M3")
        await ctx.close()

    check(not errors, "no page errors" + (f": {errors}" if errors else ""))
    print(f"\n{'FAILED' if failures else 'ALL PASSED'}: {len(failures)} failure(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
