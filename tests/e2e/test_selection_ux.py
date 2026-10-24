"""Offline real-unpacked-extension UX tests. Dispatch messages, not physical OS shortcuts."""
import asyncio
import os
import pathlib
import sys
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
EXT = pathlib.Path(os.environ.get('TEXPORT_TEST_EXTENSION', ROOT / 'dist/chrome'))
URL = 'https://chatgpt.com/c/selection-ux'
HTML = '''<html><body><main><div data-message-author-role="assistant"><p id="first">Alpha first passage. Beta second passage.</p><p id="second">Other paragraph remains untouched.</p><a href="#link">A working link</a><button id="control">Control</button></div><textarea id="composer"></textarea><div id="edit" contenteditable="true">Editable text</div></main></body></html>'''
SHADOW = "document.querySelectorAll('div')].find(d => d.shadowRoot?.querySelector('.panel')).shadowRoot"
ROOT_JS = "[..." + SHADOW

async def main():
    async with async_playwright() as p:
        ctx = await p.chromium.launch_persistent_context('', headless=True, channel='chromium', executable_path=os.environ.get('E2E_CHROMIUM'), args=[f'--disable-extensions-except={EXT}', f'--load-extension={EXT}'])
        sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event('serviceworker')
        await ctx.route('https://chatgpt.com/**', lambda r: r.fulfill(status=200, content_type='text/html', body=HTML))
        errors = []
        page = await ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(URL)
        await page.wait_for_timeout(700)
        async def command(cmd):
            return await sw.evaluate("async ([url, cmd]) => {const [t]=await chrome.tabs.query({url}); return chrome.tabs.sendMessage(t.id,{cmd});}", [URL, cmd])
        async def stored():
            return (await sw.evaluate("() => chrome.storage.local.get('markers')")).get('markers', {}).get(URL, [])
        async def ui_click(selector):
            await page.evaluate(f"() => ({ROOT_JS}).querySelector({selector!r}).click()")
            await page.wait_for_timeout(150)
        async def select(start, end):
            await page.evaluate("([a,b]) => {const n=document.querySelector('#first').firstChild,r=document.createRange();r.setStart(n,a);r.setEnd(n,b);getSelection().removeAllRanges();getSelection().addRange(r)}", [start,end])
        # Real pointer drag fires a click after mouseup: never mark its entire paragraph.
        await ui_click('.markbtn')
        box = await page.locator('#first').bounding_box()
        await page.mouse.move(box['x']+2, box['y']+box['height']/2)
        await page.mouse.down()
        await page.mouse.move(box['x']+120, box['y']+box['height']/2, steps=12)
        await page.mouse.up()
        await page.wait_for_timeout(300)
        assert await page.evaluate('getSelection().toString().length > 0'), 'fixture must drag-select text'
        assert len(await stored()) == 0, 'drag-select in mark mode must not create a paragraph marker'
        print('PASS drag-select preserves selection, no accidental paragraph mark')
        await page.evaluate('getSelection().removeAllRanges()')
        await page.locator('#control').click()
        assert not await stored(), 'controls must not be marked'
        await page.locator('a').click()
        assert page.url.endswith('#link') and not await stored(), 'links keep their native behavior'
        await page.evaluate("history.replaceState(null, '', location.pathname)")
        await select(0, 5)
        await page.evaluate("document.addEventListener('copy', e => window.copyNotPrevented = !e.defaultPrevented)")
        await page.keyboard.press('Control+c')
        assert await page.evaluate("window.copyNotPrevented && getSelection().toString() === 'Alpha'"), 'native copy and text selection remain available'
        await page.evaluate('getSelection().removeAllRanges()')
        await page.locator('#composer').focus()
        await page.keyboard.press('Escape')
        assert await page.evaluate(f"({ROOT_JS}).querySelector('.markbtn').textContent.includes('Click-to-mark')"), 'editing Escape must not change mark mode'
        await page.locator('#composer').evaluate('(e) => e.blur()')
        await page.keyboard.press('Escape')
        assert await page.evaluate(f"({ROOT_JS}).querySelector('.markbtn').textContent.includes('Selection mode')"), 'Escape outside editing exits mark mode'
        await command('cm-toggle-mark-mode')
        assert await page.evaluate(f"({ROOT_JS}).querySelector('.markbtn').textContent.includes('Click-to-mark')"), 'native dispatch toggles mode'
        await command('cm-toggle-mark-mode')
        await page.locator('#edit').evaluate("e => {e.focus();const r=document.createRange();r.selectNodeContents(e);getSelection().removeAllRanges();getSelection().addRange(r)}")
        await command('cm-mark-key')
        assert not await stored(), 'keyboard marking refuses editable selection'
        print('PASS modes, controls, Escape editing scope, editable mark refusal')
        await page.locator('#edit').evaluate('e => e.blur()')
        await page.evaluate('getSelection().removeAllRanges()')
        await select(0, 19)
        await command('cm-mark-key')
        await select(21, 40)
        await command('cm-mark-key')
        await page.wait_for_timeout(200)
        markers = await stored()
        assert len(markers) == 2
        # Keep distinct IDs/notes and a historical snapshot to detect unintended mutation.
        markers[0]['note'] = 'keep first note'
        markers[1]['note'] = 'keep second note'
        await sw.evaluate("([u,m]) => chrome.storage.local.set({markers:{[u]:m},collections:{history:{convos:[{markers:m}]}}})", [URL, markers])
        await page.wait_for_timeout(200)
        await page.evaluate('getSelection().removeAllRanges()')
        await command('cm-delete-marker')
        assert await stored() == markers, 'no selected marker must refuse deletion'
        await select(0, 40)
        await command('cm-delete-marker')
        assert await stored() == markers, 'ambiguous overlap must refuse deletion'
        await select(3, 8)
        await command('cm-delete-marker')
        assert [m['id'] for m in await stored()] == [markers[1]['id']], 'unique range deletes exactly original ID, not all markers in message'
        assert (await stored())[0]['note'] == 'keep second note'
        history = await sw.evaluate("() => chrome.storage.local.get('collections')")
        assert history['collections']['history']['convos'][0]['markers'] == markers, 'historical snapshot must not change'
        await page.evaluate('getSelection().removeAllRanges()')
        await ui_click('.pill')
        await ui_click('.row')
        await page.locator('#composer').focus()
        await command('cm-delete-marker')
        assert len(await stored()) == 1, 'editable focus overrides explicit prior target'
        await page.locator('#composer').evaluate('e => e.blur()')
        await select(0, 5)
        await command('cm-delete-marker')
        assert len(await stored()) == 1, 'new unmatched native selection must not fall back to panel target'
        await select(25, 25)
        await command('cm-delete-marker')
        assert not await stored(), 'unique caret overlap deletes exactly one'
        assert await page.locator('#first').inner_text() == 'Alpha first passage. Beta second passage.'
        print('PASS single vs ambiguous/caret/no-target/editable deletion, notes/IDs/text/snapshot preservation')
        async def seed():
            await sw.evaluate("([u,m]) => chrome.storage.local.set({markers:{[u]:m}})", [URL, markers])
            await page.wait_for_timeout(250)
            await page.evaluate('getSelection().removeAllRanges()')
        await seed()
        await ui_click('.row button')  # Show explicitly chooses the original ID
        await select(0, 40)
        await command('cm-delete-marker')
        assert await stored() == markers, 'ambiguous native selection overrides chosen marker'
        await ui_click('.row button')
        await command('cm-delete-marker')
        assert [m['id'] for m in await stored()] == [markers[1]['id']], 'Show chooses exactly one marker'
        await seed()
        await ui_click('.badge')
        await command('cm-delete-marker')
        assert [m['id'] for m in await stored()] == [markers[1]['id']], 'badge chooses exactly one marker'
        await seed()
        await ui_click('.row button')
        await page.locator('#first').evaluate("e => e.textContent = 'Changed source no longer resolves either marker.'")
        await command('cm-delete-marker')
        assert await stored() == markers, 'stale chosen marker must refuse'
        await page.locator('#first').evaluate("e => e.textContent = 'Alpha first passage. Beta second passage.'")
        await seed()
        # Every row exposes Delete without needing hover, with a meaningful accessible name.
        assert await page.evaluate(f"[...({ROOT_JS}).querySelectorAll('.row button')].some(b => b.textContent === 'Delete' && getComputedStyle(b.parentElement).display !== 'none' && b.getAttribute('aria-label')?.includes('Delete marker'))"), 'Delete must always be exposed and labelled'
        cancel = lambda d: asyncio.ensure_future(d.dismiss())
        page.on('dialog', cancel)
        await ui_click('.clear-markers')
        assert await stored() == markers, 'clear-all cancellation preserves records and notes'
        page.remove_listener('dialog', cancel)
        accept = lambda d: asyncio.ensure_future(d.accept())
        page.on('dialog', accept)
        await ui_click('.clear-markers')
        assert not await stored(), 'confirmed clear-all removes conversation markers'
        page.remove_listener('dialog', accept)
        assert (await sw.evaluate("() => chrome.storage.local.get('collections')")) == history
        print('PASS explicit Show/badge, ambiguity precedence, stale refusal, visible Delete, confirmed clear-all')
        await seed()
        options = await ctx.new_page()
        await options.goto(f"chrome-extension://{sw.url.split('/')[2]}/options.html")
        assert await options.locator('#showHighlights').is_checked(), 'highlights default on'
        async def highlight_keys():
            return await sw.evaluate("""async url => {const [t]=await chrome.tabs.query({url});return (await chrome.scripting.executeScript({target:{tabId:t.id},func:()=>[...CSS.highlights.keys()]}))[0].result}""", URL)
        await options.locator('#showHighlights').uncheck()
        await page.wait_for_timeout(250)
        assert await stored() == markers, 'hiding highlights retains markers and notes'
        assert await page.locator('.cm-marked').count() == 0
        await ui_click('.row button')
        assert not [k for k in await highlight_keys() if k.startswith('cm-')], 'all and active CSS highlights disabled'
        assert await page.evaluate(f"({ROOT_JS}).querySelectorAll('.row').length") == 2, 'records remain in panel'
        await options.locator('#showHighlights').check()
        await page.wait_for_timeout(250)
        assert await page.locator('.cm-marked').count() == 1
        assert 'cm-all' in await highlight_keys()
        assert await stored() == markers, 'restoring highlights retains notes and IDs'
        print('PASS Options showHighlights hides/restores edges and CSS highlights without changing notes')
        assigned = await options.evaluate('browser.commands.getAll()')
        assert next(c for c in assigned if c['name'] == 'delete-marker')['shortcut'] == 'Alt+Shift+U', 'delete shortcut must register in the clean Chromium profile'
        rows = await options.locator('#shortcuts li').all_text_contents()
        assert len(rows) == len(assigned) and {'delete-marker', 'mark-selection', 'toggle-mark-mode', 'toggle-panel'} <= {c['name'] for c in assigned}, f'Options lists actual browser commands: {rows!r}; API {assigned!r}'
        for cmd in assigned:
            assert any(cmd['name'] in row and (cmd.get('shortcut') or 'Unassigned') in row for row in rows), cmd
        await options.evaluate("""async () => {const actual=browser.commands.getAll;browser.commands.getAll=async()=>[{name:'delete-marker',description:'Delete one marker',shortcut:''}];await refreshShortcuts();browser.commands.getAll=actual;}""")
        assert 'Unassigned' in await options.locator('#shortcuts').inner_text()
        assert 'Alt+Shift+U' not in await options.locator('#shortcuts').inner_text(), 'never advertise suggested key as an assignment'
        async with ctx.expect_page() as opened:
            await options.locator('#editShortcuts').click()
        editor = await opened.value
        await editor.wait_for_load_state()
        assert editor.url == 'chrome://extensions/shortcuts'
        await options.evaluate('browser.runtime.getBrowserInfo = async () => ({name:"Firefox"})')
        await options.locator('#editShortcuts').click()
        assert 'Ctrl+Shift+A' in await options.locator('#shortcutHelp').inner_text()
        assert 'Manage Extension Shortcuts' in await options.locator('#shortcutHelp').inner_text()
        # Legacy records carry prefix/index evidence, not historical DOM identity.
        # Observe each fixture before mutating; never transfer authority to a replacement.
        async def identity_case(name, html, mutate, target, allowed=False, row_delete=False):
            await sw.evaluate("() => chrome.storage.local.set({markers:{}})")
            await page.reload()
            await page.wait_for_function("Array.from(document.querySelectorAll('div')).some(e => e.shadowRoot?.querySelector('.panel'))")
            await page.locator('main').evaluate('(e, html) => e.innerHTML = html', html)
            record = {'id': 'legacy-' + name, 'msgIndex': 0, 'role': 'assistant',
                      'prefix': 'Same source passage.', 'excerpt': 'source', 'scope': 'selection',
                      'note': 'legacy note must survive', 'created': '2020-01-01T00:00:00Z'}
            await sw.evaluate("([u,m]) => chrome.storage.local.set({markers:{[u]:[m]}})", [URL, record])
            await page.wait_for_timeout(1000)
            if mutate:
                await page.evaluate(mutate)
                await page.wait_for_timeout(1000)  # display re-resolution must not renew authority
            await page.evaluate("selector => {const n=document.querySelector(selector).firstChild,r=document.createRange();r.setStart(n,5);r.setEnd(n,11);getSelection().removeAllRanges();getSelection().addRange(r)}", target)
            await command('cm-delete-marker')
            assert await stored() == ([] if allowed else [record]), name + ': shortcut must not rebind stale/ambiguous source'
            if not allowed:
                await page.locator('.pill .dot').click()
                await page.get_by_role('button', name='Show', exact=True).click()
                await command('cm-delete-marker')
                assert await stored() == [record], name + ': Show/display must not renew deletion authority'
            if row_delete:
                await page.get_by_role('button', name='Delete marker #1', exact=True).click()
                await page.wait_for_timeout(200)
                assert not await stored(), 'explicit row Delete intentionally removes an unresolved record'
            print('PASS source identity ' + name)
        duplicate = '<div id="original" data-message-author-role="assistant">Same source passage.</div><div id="duplicate" data-message-author-role="assistant">Same source passage.</div>'
        unique = '<div id="original" data-message-author-role="assistant">Same source passage.</div><div id="other" data-message-author-role="assistant">Different answer.</div>'
        await identity_case('duplicate-removal', duplicate, "document.querySelector('#original').remove()", '#duplicate', row_delete=True)
        await identity_case('duplicate-reorder', duplicate, "document.querySelector('main').prepend(document.querySelector('#duplicate'))", '#duplicate')
        await identity_case('unique-reorder', unique, "document.querySelector('main').prepend(document.querySelector('#other'))", '#original')
        await identity_case('mutation-with-prefix-retained', unique, "document.querySelector('#original').append(' Changed ending.')", '#original')
        await identity_case('mutation-restored', unique, "const e=document.querySelector('#original');e.firstChild.data='Changed';e.firstChild.data='Same source passage.'", '#original')
        await identity_case('detached-replacement', unique, "const e=document.querySelector('#original');e.replaceWith(e.cloneNode(true))", '#original')
        await identity_case('detached-reinserted', unique, "const e=document.querySelector('#original'),p=e.parentElement;e.remove();p.prepend(e)", '#original')
        await identity_case('normal-unique', unique, None, '#original', allowed=True)
        assert not errors, errors
        artifact = os.environ.get('TEXPORT_UX_ARTIFACTS')
        if artifact:
            dest = pathlib.Path(artifact)
            dest.mkdir(parents=True, exist_ok=True)
            await options.screenshot(path=str(dest / 'options.png'), full_page=True)
            await page.screenshot(path=str(dest / 'marker-panel.png'), full_page=True)
        print('PASS actual command assignment list, unassigned warning, native editor, Firefox instructions, no page errors')
        await ctx.close()

if __name__ == '__main__':
    asyncio.run(main())
