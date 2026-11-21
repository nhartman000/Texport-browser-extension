# Store listing text

**Name:** TExporT Markers

**Summary** (Chrome: 132 characters max):
Mark key points in Claude, ChatGPT & Gemini chats and export a PDF/Markdown handoff the next AI can't lose. Private, no account.

**Category:** Productivity (Workflow & Planning) · **Language:** English

**Website (homepage URL):** https://nhartman000.github.io/Texport-browser-extension/
**Support URL:** https://github.com/nhartman000/Texport-browser-extension/issues
**Privacy policy URL:** https://nhartman000.github.io/Texport-browser-extension/privacy.html

**Description:**
Long AI conversations bury the details that matter: the exact command, the number, the decision from forty messages ago. When you move to a new chat or a different model, summaries drop those first. TExporT Markers lets you mark them as you read and carry them forward intact.

MARK AS YOU READ
• Highlight text and press Ctrl+M, or right-click. The marker goes straight into the marker panel.
• Every marker shows its size in tokens, words or characters. Set limits and budgets so the handoff fits the next model.
• Add a note to say why a passage matters.

COLLECT AND EXPORT
• Press Ctrl+Q and pick a collection. TExporT reads the whole conversation, even very long chats, and keeps your markers on the right lines.
• Export as PDF or Markdown. Every export opens with reader instructions and a register of all marked passages, and wraps each passage in [[MARK]] tags so the AI keeps the specifics and cites them by ID.

SMART MARKER (NO API KEY)
• Let the chat's own AI pick the key points as exact quotes. TExporT lays the markers, copies the handoff, downloads the .md and files it in a collection.

WORKS EVERYWHERE YOU READ
• Claude, ChatGPT and Gemini, plus any page you choose with "Mark this page" (search results, AI answers, articles).
• The marker window turns a conversation into big tap targets, which makes it easy on phones and tablets.

PRIVATE BY DESIGN
• No account, no analytics, no tracking, no network requests. Markers and collections stay in your browser.

Part of TExporT by American Milestone Inc, which also offers TExporT for Linux and Android. MG8-ready.

**Single purpose (Chrome):**
Mark passages in AI chat conversations (or a page the user chooses) and export them as a document that preserves the marked content.

**Permission justifications (Chrome):**
- activeTab: "Mark this page" lets the user mark the page they're on, for that tab only, when they tap the button.
- clipboardWrite: Smart Marker and the Copy buttons copy the finished handoff document to the clipboard.
- contextMenus: adds the right-click "Mark this point" and collection commands.
- scripting: starts the marker script on a tab that was already open, or on a page the user chooses to mark.
- storage: saves markers, collections and settings locally on the user's device.
- Host permissions (claude.ai, chatgpt.com, chat.openai.com, gemini.google.com): reads the conversation text on these pages so the user can mark and export it. No other sites are accessed without the user's click.

**Remote code:** No. All code is included in the package.

**Data usage:** Website content. It is used only on the device for the single purpose, and is never sold, transferred, or used for anything else.

**Store images** (in `store/`, regenerate with `python3 tools/store_assets.py`):
- Store icon 128×128: `store-icon-128.png`
- Screenshots 1280×800: `screenshot-1-markers.png`, `screenshot-2-collect.png`, `screenshot-3-export.png`, `screenshot-4-marker-window.png`, `screenshot-5-smart-marker.png`
- Small promo tile 440×280: `promo-440x280.png`
