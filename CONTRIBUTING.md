# Contributing

TExporT Markers is proprietary software from American Milestone Inc (see [LICENSE](LICENSE)). The source is public so you can read and audit it.

- **Issues are welcome:** bugs, sites that changed their markup, feature ideas. Use the issue templates.
- **Pull requests** are accepted at the maintainer's discretion. By opening one you agree that American Milestone Inc may use, modify and distribute your contribution under the project's license, and you confirm you have the right to grant that.

## Working on the code
See the Development section of [README.md](README.md#development). In short:

```bash
npm test                 # unit tests (Node 20+, no dependencies)
npm run build            # dist/firefox, dist/chrome and the two store zips
npm run test:e2e         # build, then drive Chromium on mock chat pages (needs: pip install playwright)
```

Before you open a PR:
- `npm test` and `npm run test:e2e` pass.
- You tried the change by hand in both Firefox and Chrome (load it unpacked, see the README).
- CHANGELOG.md has an entry under an "Unreleased" heading.
- There are no new permissions or hosts unless the PR is about exactly that.
- There are no network calls, analytics or remote code. These are hard rules for this extension.
