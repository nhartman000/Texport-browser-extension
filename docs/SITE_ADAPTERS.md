# Site adapters

Each chat site marks up its messages differently. `content.js` starts with a `SITES` table that says, for each site, which elements are messages and whose message each one is:

```js
const SITES = [
  { match: /(^|\.)claude\.ai$/, name: "Claude",
    sel: [['[data-testid="user-message"]', "user"], [".font-claude-response", "assistant"],
          [".font-claude-message", "assistant"], ['[data-testid="assistant-message"]', "assistant"]] },
  { match: /(^|\.)(chatgpt\.com|chat\.openai\.com)$/, name: "ChatGPT",
    sel: [["[data-message-author-role]", (el) => el.getAttribute("data-message-author-role")]] },
  { match: /(^|\.)gemini\.google\.com$/, name: "Gemini",
    sel: [["user-query", "user"], ["model-response", "assistant"]] }
];
```

- `sel` is a list of `[CSS selector, role]` pairs. The role can be a fixed string or a function of the element.
- All matches are combined, nested matches are dropped (the outermost wins), and the rest are sorted in page order.
- If nothing matches, the whole `<main>` (or `<body>`) is treated as one message, so marking still works, only less precisely.

## When a site changes its markup
Symptoms:
- "Couldn't tell which message that is"
- the whole page captured as one message
- user and assistant mixed up

To fix:
1. Open the conversation, right-click a message and choose **Inspect**. Find a stable attribute on the element that wraps one whole message. Prefer `data-*` attributes or custom element names; avoid generated class names.
2. Add or replace the selector in `SITES`. Keep the old selector too while both page versions are live.
3. Add the new markup to the mock pages in `tests/e2e/test_chromium.py` and run `npm run test:e2e`.
4. Bump the patch version, update CHANGELOG.md and publish.

## Adding a site
1. Add an entry to `SITES`.
2. Add its URL pattern to `host_permissions` and `content_scripts.matches` in `manifest.base.json`, and to `PATTERNS` in `background.js`.
3. Add a mock page and a selector to the e2e test.
4. Update the supported-sites list in README.md and the store listing. A new host permission makes both stores ask existing users to approve it again.
