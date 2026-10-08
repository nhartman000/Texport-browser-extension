# Changelog

All notable changes to TExporT Markers. Versions follow [Semantic Versioning](https://semver.org/). The export tag format (`[[MARK Mn START]]`) is treated as a public interface, so a change to it is a major version.

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

[1.2.0]: https://github.com/nhartman000/Texport-browser-extension/releases/tag/v1.2.0
