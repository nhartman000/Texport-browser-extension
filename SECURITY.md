# Security policy

## Reporting a problem
Please don't open a public issue for security problems. Report them privately through GitHub's **Security → Report a vulnerability** on this repository. You'll get an answer within 7 days.

## Scope and design
- The extension makes **no network requests** and loads **no remote code**. Every script is in the package.
- It runs only on the hosts listed in `manifest.base.json` (claude.ai, chatgpt.com, chat.openai.com, gemini.google.com).
- Data lives only in the browser's `storage.local` (see [PRIVACY.md](PRIVACY.md)).
- Conversation text is never inserted as HTML. It is always set with `textContent`. The only `innerHTML` is the fixed markup of the on-page overlay, which contains no page or user text.
- Permissions: `contextMenus`, `storage`, `scripting`. The reason for each is in [store/LISTING.md](store/LISTING.md).

## Supported versions
Only the latest version published on addons.mozilla.org and the Chrome Web Store receives fixes.
