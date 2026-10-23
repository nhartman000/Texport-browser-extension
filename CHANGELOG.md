# Changelog

All notable changes to TExporT Markers. Versions follow [Semantic Versioning](https://semver.org/). The export tag format (`[[MARK Mn START]]`) is treated as a public interface, so a change to it is a major version.

## [1.7.0] — 2026-10-22
### Added
- **✨ Smart Marker** (no API key). It's in the popup and the marker window.
  1. TExporT copies a short request.
  2. You paste it into the same chat and send it.
  3. The chat's own AI answers with the key points as exact quotes, in a fixed `TEXPORT-BEGIN … TEXPORT-END` block.
  4. TExporT watches the chat. When the answer finishes, it lays a marker on each quote, with the AI's reason as the marker's note. Matching tolerates case, spacing, markdown and quote marks.
  5. It then adds the conversation to a collection (asked once, then remembered), copies the handoff to the clipboard and downloads the `.md`.

  Quotes that aren't word-for-word in the chat are reported, not marked. The request and the answer are left out of the export. Nothing leaves the browser except through the chat you're already in.

### Changed
- New permission: `clipboardWrite`, so Smart Marker can copy the handoff without an extra tap.

## [1.6.0] — 2026-10-22
### Added
- **Mark any page.** On a page that isn't a supported chat site, such as Google search results and AI answers, articles or docs, the toolbar popup now shows **✎ Mark this page**. Tapping it starts TExporT on that one tab only (`activeTab`) and opens the marker window with the page's main content. It also starts TExporT on a chat tab that was open before the extension was installed.

### Changed
- New permission: `activeTab`. It gives access only to the tab you're on, and only when you tap the button.
- The popup is narrower, so it fits mobile browsers.
- On pages other than the chat sites, markers are keyed by the full URL including the query, so different searches don't share markers.

## [1.5.0] — 2026-10-22
### Added
- **Marker window.** Open it from the toolbar popup (**✎ Open marker window**) or the panel (**Marker window**). It shows the conversation as large paragraphs in its own tab:
  - Tap a paragraph to mark it, and tap it again to add a note or remove the marker.
  - Select words and tap **★ Mark selection** (or **+ Note**).
  - **Mark whole message** works per message.
  - **Load whole chat** and **Add to collection…** use a proper picker, not a pop-up prompt.

  Markers made here also appear on the page itself. This is the dependable way to mark on Android browsers.
- **Site-access check.** Firefox, especially on Android, keeps an extension's access to sites switched off until you allow it, and then nothing works. The popup now says so and offers **Allow access**. On a chat tab that loaded before the extension, it offers **Reload this tab**.

## [1.4.0] — 2026-10-11
### Added
- **✎ Mark button on the TExporT chip.** The chip (bottom-right) is now always shown, even before the first marker. Tap ✎ Mark to enter mark mode, then tap any paragraph to mark it, and tap Done when finished. If text is selected, ✎ Mark marks exactly the selection. Marking no longer needs a right-click or long-press menu, which phones don't give extensions.
- **Whole-chat capture.** "Add whole chat to collection…" first scrolls the conversation up until no older messages load, the same idea as the desktop app's auto-scroll, then captures every message and returns you to where you were.
- **Collection files (`.texport.json`)** for TExporT for Android. Turn on Settings → Companion apps → "I also use TExporT for Android" to get "Send to Android" on a collection and "Import from Android…" on the Collections page.

### Changed
- Marking the same passage twice is ignored ("Already marked").

## [1.3.0] — 2026-10-10
### Added
- **★ Mark button next to selected text.** Select any text in a conversation and a small ★ Mark / + Note bar appears beside it. It works with touch, so you can mark on phones and tablets, where browsers have no right-click menu for extensions. It also works with a mouse. You can turn it off in Settings ("Show a ★ Mark button when you select text").
- **Collections** button in the marker panel, which opens the export page without the toolbar popup.

### Fixed
- The background script no longer stops on browsers without the context-menu or keyboard-shortcut APIs (Firefox for Android, some mobile Chromium browsers).
- Marker panel fits narrow screens, and its buttons are always visible on touch screens (they only appeared on mouse hover).

## [1.2.0] — 2026-10-07
### Added
- **Chrome support** (also Edge, Brave and Opera). One codebase builds a Firefox package and a Chrome package (`build.sh`).
- Unit tests (`npm test`), an end-to-end Chromium test across Claude, ChatGPT and Gemini mock pages (`npm run test:e2e`), and CI and release workflows.
- Store assets: PNG icon set, 1280×800 screenshots, 440×280 promo tile and listing text.
- Privacy policy, license and full documentation in `docs/`.

### Changed
- Renamed from "Convo Markers" to **TExporT Markers**. The Firefox add-on ID changed to `texport-markers@americanmilestone`, so data from the old add-on does not carry over.
- Moved to Manifest V3: `contextMenus`, `action` and `scripting` replace `menus`, `browser_action` and `tabs.executeScript`.
- Replies from content scripts use `sendResponse`, so they work in both browsers.
- The settings page now says where to change shortcuts in both browsers.

### Fixed
- Firefox minimum version raised to 140 (Android 142), the first versions that support `data_collection_permissions`. This clears the AMO validator warnings.
- `cmTrim` dropped the last word when the cut landed exactly on a word boundary.
- Store description shortened to the Chrome Web Store's 132-character limit.

## [1.1.0]
### Added
- Exact-text highlights with size badges, plus a marker panel with per-marker and total sizes.
- Settings page: unit, per-marker limit (warn, trim or block), conversation and collection budgets, paragraph marking, notes, color, badge and panel toggles, and export options.
- Keyboard shortcuts Alt+Shift+M (mark the selection) and Alt+Shift+K (toggle the panel).

## [1.0.0]
### Added
- Right-click markers on Claude, ChatGPT and Gemini conversations.
- Collections that combine several conversations, exported as PDF or Markdown with reader instructions, a marked-passages register and inline `[[MARK]]` tags.

[1.7.0]: https://github.com/nhartman000/Texport-browser-extension/releases/tag/v1.7.0
[1.6.0]: https://github.com/nhartman000/Texport-browser-extension/releases/tag/v1.6.0
[1.5.0]: https://github.com/nhartman000/Texport-browser-extension/releases/tag/v1.5.0
[1.4.0]: https://github.com/nhartman000/Texport-browser-extension/releases/tag/v1.4.0
[1.3.0]: https://github.com/nhartman000/Texport-browser-extension/releases/tag/v1.3.0
[1.2.0]: https://github.com/nhartman000/Texport-browser-extension/releases/tag/v1.2.0
