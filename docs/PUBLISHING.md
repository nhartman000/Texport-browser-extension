# Publishing TExporT Markers

Run `./build.sh` first (or download both zips from the latest GitHub release). Upload the zips from `dist/`.

## Firefox: addons.mozilla.org
1. Sign in at https://addons.mozilla.org/developers/ and choose **Submit a New Add-on**.
2. Pick **On this site** (a public listing) or **On your own** (unlisted: signed, but you host the file).
3. Upload `texport-markers-firefox-<ver>.zip`.
4. Source code: answer **No**. The code is not minified or bundled, so reviewers read it directly.
5. Listing: use the text in `store/LISTING.md`, the icon `src/icons/icon-128.png`, and the screenshots in `store/`.
6. Privacy policy: paste the contents of `PRIVACY.md`. AMO accepts the text itself.
7. License: choose **All Rights Reserved** (custom), so it stays proprietary.

## Chrome Web Store
1. Register at https://chrome.google.com/webstore/devconsole. There is a one-time US$5 fee, and Google verifies your identity.
2. Choose **New item** and upload `texport-markers-chrome-<ver>.zip`.
3. Store listing: the description from `store/LISTING.md`, the category (Productivity), a 128×128 icon, at least one 1280×800 screenshot (in `store/`), and the 440×280 small promo tile (`store/promo-440x280.png`).
4. Privacy practices tab:
   - Single purpose: use the text in LISTING.md.
   - Permission justifications: use the text in LISTING.md.
   - Data usage: check **Website content**, used only locally for the extension's single purpose, not sold or transferred.
   - Privacy policy URL: Chrome requires a public URL (see below).
5. Submit for review. It typically takes a few days.

### Privacy policy URL
This repository is public, so use:
`https://github.com/nhartman000/Texport-browser-extension/blob/main/PRIVACY.md`

## Updating
Bump `version` in `manifest.base.json` and `package.json`, add a CHANGELOG entry, then tag (`git tag vX.Y.Z && git push --tags`). The release workflow attaches both zips to a GitHub release; upload them to both stores.
