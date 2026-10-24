"""Offline regression for ChatGPT turn capture using the real unpacked extension.

Set TEXPORT_TEST_EXTENSION to the built chrome directory. Uses a fresh temporary
profile, locally fulfilled pages, and no user browser state or model calls.
"""
import asyncio
import json
import os
from pathlib import Path
import tempfile
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[2]
EXT = Path(os.environ.get('TEXPORT_TEST_EXTENSION', ROOT / 'dist/chrome'))

async def main():
    async with async_playwright() as p:
        with tempfile.TemporaryDirectory(prefix='texport-chatgpt-test-') as profile:
            ctx = await p.chromium.launch_persistent_context(
                profile, headless=True, channel='chromium', executable_path=os.environ.get('E2E_CHROMIUM'),
                args=[f'--disable-extensions-except={EXT}', f'--load-extension={EXT}'])
            try:
                sw = ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event('serviceworker')
                body = '''<main><div>Loading older messages…</div>
                <article data-testid="conversation-turn-0" data-turn="user">
                <h5>You said:</h5><div class="whitespace-pre-wrap">Preserve original IDs.</div><button>Edit</button></article>
                <article data-testid="conversation-turn-1" data-turn="assistant">
                <h6>ChatGPT said:</h6><div class="markdown"><p>Keep the limit at 48 MB.</p><pre>run --strict</pre></div><button>Copy response</button></article>
                <footer>ChatGPT can make mistakes.</footer></main>'''
                async def serve(route):
                    await route.fulfill(status=200, content_type='text/html', body='<html><meta charset="utf-8"><title>Capture fixture</title><body>'+body+'</body></html>')
                await ctx.route('https://**/*', serve)
                page = await ctx.new_page()
                await page.goto('https://chatgpt.com/c/capture-regression')
                await page.wait_for_function("Array.from(document.querySelectorAll('div')).some(e => e.shadowRoot && e.shadowRoot.querySelector('.markbtn'))")
                async def send(message):
                    return await sw.evaluate('''async (message) => {
                        const [t] = await chrome.tabs.query({url:'https://chatgpt.com/c/capture-regression'});
                        return chrome.tabs.sendMessage(t.id,message);
                    }''', message)
                snap = await send({'cmd':'cm-snapshot','loadAll':False})
                assert [m['role'] for m in snap['messages']] == ['user','assistant'], json.dumps(snap)
                assert snap['messages'][0]['text'] == 'Preserve original IDs.'
                assert '48 MB' in snap['messages'][1]['text'] and 'run --strict' in snap['messages'][1]['text']
                assert not any(x in m['text'] for m in snap['messages'] for x in ['Loading older','Copy response','ChatGPT can make mistakes','You said:','Edit'])
                print('PASS alternate ChatGPT turn attributes: roles, order, content and code retained; page controls excluded')
                original_body = body
                body = body.replace('<div class="whitespace-pre-wrap">', '<div data-message-author-role="user" class="whitespace-pre-wrap">')
                await page.reload()
                await page.wait_for_function("Array.from(document.querySelectorAll('div')).some(e => e.shadowRoot && e.shadowRoot.querySelector('.markbtn'))")
                snap = await send({'cmd':'cm-snapshot','loadAll':False})
                assert [m['role'] for m in snap['messages']] == ['user','assistant'], json.dumps(snap)
                print('PASS mixed old/new turn markup does not silently omit a message')
                body = original_body.replace(' data-turn="user"', '').replace(' data-turn="assistant"', '')
                await page.reload()
                await page.wait_for_function("Array.from(document.querySelectorAll('div')).some(e => e.shadowRoot && e.shadowRoot.querySelector('.markbtn'))")
                snap = await send({'cmd':'cm-snapshot','loadAll':False})
                assert [m['role'] for m in snap['messages']] == ['user','assistant']
                print('PASS explicit turn headings identify roles without alternating-role guesses')
                accept_collection = lambda d: asyncio.ensure_future(d.accept('Capture regression'))
                page.on('dialog', accept_collection)
                await send({'cmd':'cm-capture'})
                saved = await sw.evaluate("() => chrome.storage.local.get('collections')")
                collection = next(iter(saved['collections'].values()))
                assert [m['role'] for m in collection['convos'][0]['messages']] == ['user','assistant']
                export_page = await ctx.new_page()
                await export_page.goto('chrome-extension://' + sw.url.split('/')[2] + '/export.html')
                await export_page.get_by_role('link', name='Capture regression', exact=False).click()
                async with export_page.expect_download() as download_info:
                    await export_page.get_by_role('button', name='Download Markdown', exact=True).click()
                download = await download_info.value
                result_path = Path(profile) / 'capture-result.md'
                await download.save_as(result_path)
                markdown = result_path.read_text()
                assert '### USER (message 1)' in markdown and '### ASSISTANT (message 2)' in markdown, markdown
                assert 'Preserve original IDs.' in markdown and 'run --strict' in markdown
                assert 'PAGE (message 1)' not in markdown and 'Copy response' not in markdown
                await export_page.close()
                page.remove_listener('dialog', accept_collection)
                print('PASS real whole-chat capture → collection → downloaded Markdown retains separate roles and code')
                body = '<main><article data-testid="conversation-turn-0" data-turn="user"><div data-message-author-role="user">Keep this.</div></article><article data-testid="conversation-turn-1" data-turn="assistant"><section>Unrecognized answer body.</section></article></main>'
                await page.reload()
                await page.wait_for_function("Array.from(document.querySelectorAll('div')).some(e => e.shadowRoot && e.shadowRoot.querySelector('.markbtn'))")
                partial = await send({'cmd':'cm-snapshot','loadAll':False})
                assert partial and partial.get('error') and not partial.get('messages'), json.dumps(partial)
                print('PASS partially recognized conversation is refused instead of silently dropping a turn')
                body = '<main><div>Loading older messages…</div><div>You said: Unstructured text ChatGPT said: answer</div><button>Latest response</button></main>'
                await page.reload()
                await page.wait_for_function("Array.from(document.querySelectorAll('div')).some(e => e.shadowRoot && e.shadowRoot.querySelector('.markbtn'))")
                snap = await send({'cmd':'cm-snapshot','loadAll':False})
                assert snap and snap.get('error') and not snap.get('messages'), json.dumps(snap)
                dialogs = []
                page.on('dialog', lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.dismiss())))
                result = await send({'cmd':'cm-capture'})
                assert result and result.get('error'), json.dumps(result)
                assert not dialogs, 'failed capture must not prompt for or overwrite a collection'
                stored = await sw.evaluate("() => chrome.storage.local.get('collections')")
                assert stored == saved, 'failed capture must leave existing collections unchanged'
                print('PASS unsupported ChatGPT conversation returns explicit error; no collection prompt or write')
                # Actual panel event path must catch rejection as well as runtime commands.
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                for layout in [
                    '<main><section>Unsupported conversation body.</section></main>',
                    '<main><article data-testid="conversation-turn-0"><div data-message-author-role="user">Known user.</div></article><article data-testid="conversation-turn-1"><section>Unknown answer.</section></article></main>'
                ]:
                    body = layout
                    await page.reload()
                    await page.wait_for_function("Array.from(document.querySelectorAll('div')).some(e => e.shadowRoot?.querySelector('.markbtn'))")
                    await page.locator('.pill .dot').click()
                    await page.get_by_role('button', name='Add whole chat to collection…', exact=True).click()
                    await page.wait_for_timeout(4200)  # real loadWholeConversation stabilization
                    warning = page.locator('.toast.warn')
                    assert await warning.count() == 1 and 'Nothing was saved' in await warning.inner_text(), f'panel capture must show adapter error toast; pageerrors={errors}'
                    assert not errors, f'panel capture must handle rejection, got pageerrors: {errors}'
                    assert not dialogs, 'invalid panel capture must not ask for a collection'
                    assert await sw.evaluate("() => chrome.storage.local.get('collections')") == saved
                    response = await send({'cmd':'cm-snapshot','loadAll':False})
                    assert response.get('error') and not response.get('messages'), response
                print('PASS actual panel capture rejects unsupported/partial layouts with toast, no unhandled error, no prompt/write; runtime errors preserved')
            finally:
                await ctx.close()

if __name__ == '__main__':
    asyncio.run(main())
