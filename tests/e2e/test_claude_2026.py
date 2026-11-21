"""Claude's Oct-2026 layout (data-testid rows, assistant chrome, virtualized list).

    ./build.sh && python3 tests/e2e/test_claude_2026.py
Checks that marking, the marker panel, whole-chat capture and the Markdown export all keep real text.
"""
import asyncio
import json
import pathlib
import sys

from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
EXT = ROOT / "dist" / "chrome"
PAGE = (pathlib.Path(__file__).parent / "pages" / "claude_2026_10.html").read_text()
URL = "https://claude.ai/chat/virtual"


async def main() -> int:
    fails = []

    def check(ok, what):
        print(("PASS " if ok else "FAIL ") + what)
        if not ok:
            fails.append(what)

    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context("", headless=True, channel="chromium", accept_downloads=True,
            args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}"])
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event("serviceworker", timeout=15000)
        ext = sw.url.split("/")[2]

        async def serve(route):
            await route.fulfill(status=200, content_type="text/html", body=PAGE)
        await ctx.route(URL, serve)
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("dialog", lambda d: asyncio.ensure_future(d.accept("Claude 2026")))
        await page.goto(URL)
        await page.wait_for_timeout(1500)

        async def send(msg):
            return await sw.evaluate("""async (m) => { const [t] = await chrome.tabs.query({url: "https://claude.ai/*"});
                return chrome.tabs.sendMessage(t.id, m); }""", msg)

        # 1. select words in the last assistant reply and mark them (right-click path)
        await page.evaluate("""() => { const ps = document.querySelectorAll('[data-testid="assistant-message"] .standard-markdown p');
            const p = ps[ps.length - 2]; const r = document.createRange(); r.selectNodeContents(p);
            const s = getSelection(); s.removeAllRanges(); s.addRange(r); }""")
        target = await page.evaluate("() => getSelection().toString()")
        await page.click('[data-testid="assistant-message"] >> nth=-1', button="right")
        await page.keyboard.press("Escape")
        await send({"cmd": "cm-mark", "selection": target})
        # 2. mark a whole user message (no selection) near the bottom
        await page.evaluate("() => getSelection().removeAllRanges()")
        await page.click('[data-testid="user-message"] >> nth=-1', button="right")
        await page.keyboard.press("Escape")
        await send({"cmd": "cm-mark", "selection": ""})
        await page.wait_for_timeout(600)
        stored = (await sw.evaluate("() => chrome.storage.local.get('markers')"))["markers"]
        mks = stored.get(URL, [])
        check(len(mks) == 2, f"two markers saved ({len(mks)})")
        check(any(m["excerpt"] == target for m in mks), f"selection marker saved the selected words ({target!r})")

        def panel_text():
            return page.evaluate("""() => { const h = [...document.querySelectorAll('div')].find(d => d.shadowRoot && d.shadowRoot.querySelector('.panel'));
                const p = h.shadowRoot.querySelector('.panel'); return p.innerText; }""")
        # open the panel
        await page.evaluate("""() => { const h = [...document.querySelectorAll('div')].find(d => d.shadowRoot && d.shadowRoot.querySelector('.pill'));
            h.shadowRoot.querySelector('.pill').click(); }""")
        await page.wait_for_timeout(500)
        pt = await panel_text()
        check(target in pt, "panel shows the marked text")
        check("Claude responded" not in pt and "Retry" not in pt, "panel text has no Claude page chrome")

        # 3. scroll to the top: the marked rows unmount; the panel must still show the marked text, not "not found"
        await page.evaluate("() => { document.getElementById('scroller').scrollTop = 0; }")
        await page.wait_for_timeout(1500)
        pt = await panel_text()
        check(target in pt and "Question 20" in pt, "panel keeps the marked text after the rows scroll away (virtualized)")

        # 4. whole-chat capture: every message, clean text, markers placed on the right messages
        await page.evaluate("() => { document.getElementById('scroller').scrollTop = 99999; }")
        await page.wait_for_timeout(800)
        await send({"cmd": "cm-capture"})
        await page.wait_for_timeout(1000)
        for _ in range(60):
            cols = (await sw.evaluate("() => chrome.storage.local.get('collections')")).get("collections", {})
            if cols:
                break
            await page.wait_for_timeout(500)
        col = next(iter(cols.values()), None)
        conv = col["convos"][0] if col else {"messages": [], "markers": []}
        msgs = conv["messages"]
        check(len(msgs) == 40, f"capture saved all 40 messages despite virtualization ({len(msgs)})")
        check(all("Claude responded" not in m["text"] and "Retry" not in m["text"] and "Thought for" not in m["text"] for m in msgs),
              "captured replies contain only the reply text")
        check([m["role"] for m in msgs[:4]] == ["user", "assistant", "user", "assistant"], "roles in order")
        okm = [m for m in conv["markers"] if 0 <= m["idx"] < len(msgs)]
        check(len(okm) == 2, f"both markers placed on messages ({[m['idx'] for m in conv['markers']]})")
        whole = [m for m in conv["markers"] if not m["excerpt"]]
        check(bool(whole) and msgs[whole[0]["idx"]]["text"] == "Question 20: what is gate 20?", "whole-message marker points at the right message")

        # 5. the Markdown export contains the conversation and the marked text inline
        ex = await ctx.new_page()
        await ex.goto(f"chrome-extension://{ext}/export.html")
        md = await ex.evaluate("([c]) => renderMarkdown(buildDoc(c))", [col])
        check("Question 1: what is gate 1?" in md and "Gate 20 runs step20.py --strict." in md, "Markdown export holds the whole conversation")
        reg = md.split("## MARKED PASSAGES REGISTER")[1].split("## CONVERSATION")[0]
        check("[[MARK M1 START]]" in reg and target in reg and "Question 20: what is gate 20?" in reg, "Markdown register holds both marked passages")
        # 6. keyboard workflow: select → Ctrl+M (straight into the panel) → … → Ctrl+Q picker → Export
        await page.evaluate("() => { document.getElementById('scroller').scrollTop = 99999; }")
        await page.wait_for_timeout(800)
        for nth in (-4, -6):
            await page.evaluate("""(n) => { const ps = document.querySelectorAll('[data-testid="assistant-message"] .standard-markdown p');
                const p = ps[ps.length + n]; const r = document.createRange(); r.selectNodeContents(p);
                const s = getSelection(); s.removeAllRanges(); s.addRange(r); }""", nth)
            await page.keyboard.press("Control+m")
            await page.wait_for_timeout(500)
        mk2 = (await sw.evaluate("() => chrome.storage.local.get('markers')"))["markers"].get(URL, [])
        check(len(mk2) == 4, f"Ctrl+M twice added two markers ({len(mk2)})")
        pt = await panel_text()
        check("4 markers" in pt, "the new markers are already in the panel (no extra step)")
        await page.keyboard.press("Control+q")
        await page.wait_for_timeout(500)
        has_picker = await page.evaluate("""() => { const h = [...document.querySelectorAll('div')].find(d => d.shadowRoot && d.shadowRoot.querySelector('.panel'));
            return !!h.shadowRoot.querySelector('.picker'); }""")
        check(has_picker, "Ctrl+Q opens the collection picker")
        await page.evaluate("""() => { const h = [...document.querySelectorAll('div')].find(d => d.shadowRoot && d.shadowRoot.querySelector('.picker'));
            const i = h.shadowRoot.querySelector('.picker input'); i.focus(); }""")
        await page.keyboard.type("Keyboard collection")
        await page.keyboard.press("Enter")
        for _ in range(60):
            cols = (await sw.evaluate("() => chrome.storage.local.get('collections')")).get("collections", {})
            kc = [c for c in cols.values() if c["name"] == "Keyboard collection"]
            if kc:
                break
            await page.wait_for_timeout(500)
        check(bool(kc) and len(kc[0]["convos"][0]["messages"]) == 40 and len(kc[0]["convos"][0]["markers"]) == 4,
              "picker saved the whole chat with all 4 markers")
        await page.wait_for_timeout(500)
        async with ctx.expect_page() as newp:
            await page.evaluate("""() => { const h = [...document.querySelectorAll('div')].find(d => d.shadowRoot && d.shadowRoot.querySelector('.picker'));
                [...h.shadowRoot.querySelectorAll('.picker .opt')].find(b => b.textContent === 'Export').click(); }""")
        exp = await newp.value
        await exp.wait_for_timeout(1000)
        body = await exp.inner_text("body")
        check("Keyboard collection" in body and "Save as PDF" in body and "Gate 18 runs step18.py --strict." in body, "Export opens that collection's export page with the text")
        check(not errors, f"no page errors {errors}")
        await ctx.close()
    print(f"\n{'FAILED' if fails else 'ALL PASSED'}: {len(fails)} failure(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
