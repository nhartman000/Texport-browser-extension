# Architecture

TExporT Markers is a Manifest V3 WebExtension. There is no build step: the files in `src/` are the extension. `build.sh` copies them twice and writes a manifest for each browser.

```
            ┌──────────────────────── browser ─────────────────────────┐
            │                                                          │
 right-click│  background.js  ── tabs.sendMessage ──▶  content.js      │  chat page
 shortcuts ─┼▶ (context menus, commands)               (on claude.ai,  │  (Claude,
            │        │                                  chatgpt.com,   │   ChatGPT,
            │        │ openOptionsPage / tabs.create    gemini…)       │   Gemini)
            │        ▼                                     │           │
            │  options.html / export.html / popup.html     │           │
            │        │                                     │           │
            │        └──────────── storage.local ◀─────────┘           │
            │                  {settings, markers, collections}        │
            └──────────────────────────────────────────────────────────┘
```

## Components

| File | Runs in | Job |
|---|---|---|
| `src/background.js` | Firefox: background script. Chrome: service worker. | Builds the right-click menu and handles the keyboard shortcuts. Forwards each command to the content script in the active tab. If that tab was open before the extension was installed, re-injects the content script with `scripting.executeScript` and retries once. |
| `src/settings.js` | Content script, popup, settings page, export page (and Node for tests) | The default settings (`CM_DEFAULTS`), `cmGetSettings()`, measuring (`cmMeasure`: characters, words, ≈tokens = characters ÷ 4), unit labels and `cmTrim`. It also sets `browser = chrome` on Chrome. |
| `src/content.js` | Each supported chat page | Finds the messages through the site adapters, remembers what you right-clicked, creates and removes markers, draws highlights, badges and the marker panel, and captures the conversation into a collection. |
| `src/popup.html/js` | Toolbar popup | Marker count for the current tab and the list of collections, with Export and Delete for each. |
| `src/options.html/js` | Settings page | Edits `settings`. Changes save immediately and every open page picks them up through `storage.onChanged`. |
| `src/export.html/js` | Extension page | Turns a collection into the handoff document (see [EXPORT_FORMAT.md](EXPORT_FORMAT.md)). The top half of `export.js` is a pure document model with no DOM, shared with the unit tests. The bottom half renders the page and handles PDF (print), Markdown download, rename and per-conversation removal. |

## Messages (background → content script)

| `cmd` | Sent by | Effect | Reply |
|---|---|---|---|
| `cm-mark` | menu "Mark this point" | Mark the selection, the paragraph or the whole message (see settings) | — |
| `cm-mark-note` | menu "…with a note" | Same, and ask for a note | — |
| `cm-mark-key` | Alt+Shift+M | Mark the current selection | — |
| `cm-unmark` | menu | Remove the markers on the right-clicked message | — |
| `cm-clear` | menu, popup | Remove all markers in this conversation (asks to confirm) | — |
| `cm-capture` | menu, panel, popup | Add or update this conversation in a collection | — |
| `cm-toggle-panel` | menu, Alt+Shift+K, popup | Show or hide the marker panel | `true` |
| `cm-count` | popup | — | `{count, key, total, unit, budget}` |

The content script answers through `sendResponse` and returns `true`, so asynchronous replies work in both Chrome and Firefox. The content script sends one message to the background script: `{cmd: "open-options"}`.

## Storage (`storage.local`, on the device only)

```jsonc
{
  "settings": { /* overrides of CM_DEFAULTS, see SETTINGS.md */ },

  "markers": {                                   // live markers, keyed by conversation
    "https://claude.ai/chat/<id>": [             // key = origin + pathname
      {
        "id": "muxq0d5x7sg9o",
        "msgIndex": 1,                           // message position when marked
        "role": "assistant",
        "prefix": "Here's the gate order…",      // first 120 chars of the message, used to re-find it
        "excerpt": "Gate 2 runs verify_output.py…", // "" = the whole message
        "scope": "selection | paragraph | message [· trimmed]",
        "note": "exit condition",
        "created": "2026-10-07T06:22:31.111Z"
      }
    ]
  },

  "collections": {
    "<id>": {
      "name": "Release pipeline",
      "created": "<ISO time>",
      "convos": [                                // snapshot taken by "Add to collection"
        {
          "key": "https://claude.ai/chat/<id>", "url": "…", "title": "Gate plan",
          "site": "Claude", "capturedAt": "<ISO time>",
          "messages": [ { "role": "user", "text": "…" } ],
          "markers":  [ { "id": "…", "idx": 1, "excerpt": "…", "note": "…", "scope": "…" } ]
        }
      ]
    }
  }
}
```

**Re-finding markers.** Chat pages are rebuilt dynamically, so a stored marker isn't tied to a DOM node. On every page change (with an 800 ms debounce) `content.js` looks for the message whose text starts with the marker's `prefix`, preferring the one nearest the original `msgIndex`. It then locates the `excerpt` inside that message and draws the highlight. A marker it can't find yet stays in the panel and is drawn once the message appears (for example after scrolling up).

**Collections are snapshots.** Adding a conversation copies its text and markers as they are at that moment. Adding the same conversation again replaces its snapshot. Later edits to markers don't change the collection until you add the conversation again.

## Rendering on the page

- **Highlights** use the CSS Custom Highlight API (`CSS.highlights`). They never modify the site's DOM, so they can't break the page. On browsers without the API, marked messages still get the colored left border.
- **The overlay** (badges, panel and toasts) lives in its own shadow root. Site CSS can't restyle it and its CSS can't leak into the site.
- **Site adapters**: see [SITE_ADAPTERS.md](SITE_ADAPTERS.md).

## Per-browser packaging (`build.sh`)

| | Firefox (`dist/firefox`) | Chrome (`dist/chrome`) |
|---|---|---|
| Background | `"background": {"scripts": ["background.js"]}` | `"background": {"service_worker": "background.js"}` |
| Extra keys | `browser_specific_settings.gecko`: ID `texport-markers@americanmilestone`, `strict_min_version` 140 (Android 142), `data_collection_permissions: none` | `minimum_chrome_version` 110 |
| API namespace | `browser.*` (native) | `chrome.*`, aliased to `browser` in `settings.js` and `background.js` |

Everything else, including all source files, is identical.
