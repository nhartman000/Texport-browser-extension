# ICM and packed MG8 authoring

Author: Nicholas Hartman / American Milestone Inc. Existing project attribution and license apply.

## Export page

Open a saved collection → **Export ICM / AI organization**. The editable default JSON is deterministic: every compiled register marker goes into `uncategorized`, unchanged, with no inferred gates. Select **Preview organization and files**, inspect the source IDs, labels, proposed conditions, gestalt and variables, then **Approve and download workspace ZIP**. Editing JSON revokes the preview. The original collection is not modified. A stable source snapshot and approved plan (including its ordering and review timestamp) reproduce the same archive bytes.

Optional AI organization is deliberately two-step, without a paid backend, API key, network request or automatic prompt submission:

1. **Copy AI organization prompt**. The prompt is also shown for manual copying if clipboard access fails. It includes the entire captured collection, marker IDs, original marker identities, notes and provenance. Only paste it into an AI you intend to share those sources with; that service may charge or retain the material.
2. Ask your chosen AI, then paste its JSON into the proposal editor. The source/notes are labelled **untrusted data**. Only organization and proposed source-linked conditions are accepted: no source rewrites, code, file payloads or arbitrary paths. Preview, check the semantic faithfulness yourself, edit if needed and explicitly approve the download. ID validation cannot prove the truth of a condition.

Proposal shape:

```json
{
  "version": 1,
  "groups": [{
    "name": "requirements",
    "title": "Reviewed requirements",
    "marker_ids": ["M1"],
    "conditions": [{"text": "The limit must remain below 10", "source_marker_ids": ["M1"]}]
  }],
  "gestalt": "",
  "variables": {"limit": null}
}
```

Every ID must belong to exactly one group; no omissions or duplicate memberships. Condition source IDs must be nonempty and belong to the same group. Group slugs are lowercase ASCII letters/digits/hyphens, 1–60 characters; titles retain Unicode. There are at most 32 groups, 180 total conditions, 64 variables, 4000 characters per condition/gestalt/string value and 200 characters per title. Variables are scalar values, with unknowns explicitly `null`. Source-linked conditions are **unevaluated human-approved authoring**, not model-generated PASS results. Default direct export never converts marker notes into gates automatically.

## Workspace layout

- `README.md`, `AGENTS.md`, `CONTEXT.md`: developer entry, theme routing and workspace contract
- `sources/CONTEXT.md` and `themes/<slug>/CONTEXT.md`: scoped Inputs/Process/Outputs/Check contracts
- `state/global.gst`: global Gestalt, context, variables and complete source snapshot, including text-only exports
- `sources/compiled-markers.txt`: existing compiler register order and exact selected source text, notes, role and URL
- `sources/snapshot.json`: complete original captured collection, including unmarked messages and original marker IDs
- `sources/provenance.json`: register IDs mapped to original marker/conversation identity, source URL, capture time, role, message position and scope
- `sources/approved-organization.json`
- `themes/<slug>/M1.txt`, etc.: labelled source passages, not AI rewrites
- For groups with reviewed conditions only: companion `manifest.json`, `container.json`, `state/context.gst`, `gates/conditions-N.g8son`, `flow.ork`, `trace/execution.qson`, plus **one complete physical `<slug>.mg8`**.

No conditions means text-only theme folders, not manufactured MG8 units. Each G8SON contains 1–3 gates; additional conditions split into more files. GST retains the complete source snapshot and provenance plus explicit global gestalt, context and variables. Register IDs (`M1`, etc.) are snapshot-local; stable original marker IDs and conversation IDs are preserved separately rather than replaced. The existing compiler's position/whitespace fallback behavior is unchanged; the original snapshot retains original excerpts even when display resolution falls back.

## Load unit / drop gates / save new snapshot

Choose a packed `.mg8` with **Load packed .mg8**. Its integrity and supported authoring flow are checked before showing the content list. Drop multiple external `.g8son` files onto the target, or use the file picker. Imported gate bytes, file IDs and gate IDs remain unchanged. The preview lists all files and explicit appended gate positions in supplied order. It rejects empty/invalid drops, unsafe paths, conflicting filenames and duplicate file/gate IDs atomically. Only **Approve appended gates and save NEW .mg8** downloads the result. It uses an `-updated.mg8` name, does not use filesystem write handles and never overwrites the selected input through the application. Browser destination/name-conflict policy still belongs to the browser/user. Load the resulting file again before a subsequent edit; repeated drops before saving replace the proposal rather than silently accumulate.

Existing member bytes remain unchanged except manifest, flow, QSON and integrity envelope. Existing QSON events remain unchanged; a real human review event is appended. New units begin with a human authoring review event, never a fabricated gate attempt, PASS or state commit. Archives are snapshots, not a trusted append-only store.

## Package units

Select 1–32 complete MG8 files, review their displayed order and use **Up/Down** to adjust it. **Approve order and download .mg8pk** writes whole unit bytes under `units/<filename>.mg8`, in that exact order, with unique unit IDs and a bounded `system.ork`. No silent sorting, flattening, nested packages or external paths. Tests exercise 4, 6, 8 and 12 units through real browser downloads.

## Physical profile and limits

Packed `.mg8` and `.mg8pk` are actual ZIP_STORED archives, not JSON renamed to another extension. Every member except `container.json` has a lowercase SHA-256 entry in that envelope; unlisted members, wrong hashes or unknown profile/version/kind are rejected. Integrity is not a signature or authorization.

Profiles: `mg8-packed/1.0` / kind `unit`, `mg8pk-packed/1.0` / kind `package`, envelope manifest `manifest.json`. Unit ORK profile: `texport-packed-authoring/1.0`, all gate IDs in approved membership order, `max_iterations: 1`, `on_fail: stop`, `on_unknown: review`. Package ORK: `mg8pk-sequential/1.0`, `flow` exactly matches ordered manifest units, `max_steps` equals their count, with the same failure/review policy.

**These are data-only authoring topologies, not legacy ORK grammar, executable pipelines or an implemented multi-unit runtime.** Unsupported flow profiles are refused rather than rewritten. Evaluation, branching, state handoff, runtime chaining, signatures, concurrent trace updates and improved reasoning claims are outside this feature.

Reader limits: 16 MiB archive and total member data, 128 entries, 1 MiB ordinary unit/member JSON or resource, nested unit members up to 16 MiB within the outer bound, JSON depth 64, ID length 200, portable ASCII path length 240. Reject encrypted/multipart/compressed/ZIP64 entries, symlinks/special files, duplicate/casefold-colliding paths, absolute/drive/UNC/traversal paths, control characters, missing references, duplicate JSON keys and nonfinite numbers. Ordinary well-formed timestamp ZIP extras and Unix regular-file attributes from Python are supported. ZIP local/central names, method, flags, lengths, CRC and bounds are checked. Streaming data descriptors, archive comments, directory entries, reordered central directories and self-extracting prefixes are intentionally not supported; use the packed writer/standard seekable Python ZIP_STORED output. No archive extraction, `eval`, imported code, provider calls or native messaging is involved.

The surrounding workspace ZIP has the same 16 MiB / 128-file writer cap; very large collections or many themes fail visibly rather than truncate sources. Packed nested `.mg8` files in workspaces are not intended as ordinary 1 MiB resources of a unit archive. This feature does not change older Markdown/PDF/Android collection formats or capture logic.

## Interop API (Node/CommonJS or browser globals)

```js
const P = require('./src/packed.js');
const I = require('./src/icm.js');
// Browser: TexportPacked and TexportICM.
const out = await I.workspace(collection, I.directPlan(collection), {timestamp: '2026-01-01T00:00:00Z'});
// out.bytes: workspace ZIP Uint8Array; out.members: path -> Uint8Array;
// out.units: [{name, bytes}] for reviewed gated groups.
const unit = await P.createUnit({unit_id, state, gateFiles, timestamp});
// state: canonical GST object; gateFiles: {'gates/example.g8son': Uint8Array}.
const read = await P.readUnit(unit); // {manifest, members}
const next = await P.addGates(unit, [{name:'external.g8son', bytes:gateBytes}], timestamp);
const pkg = await P.createPackage({package_id:'example', units:[{name:'first.mg8',bytes:unit}, {name:'second.mg8',bytes:otherUnit}]});
await P.readPackage(pkg); // validates all nested units and unique unit IDs
```

`P.json(object)` returns UTF-8 JSON bytes; `P.parseJSON(bytesOrString)` is duplicate-key/depth/size/finite-number checked. `zipWrite`/`zipRead` expose physical STORE serialization; use the higher-level readers for semantic/integrity validation. Never consider `zipRead` alone validation of MG8.

CLI writes only to stdout (caller chooses a new destination), errors to stderr/nonzero exit:

```sh
node tools/packed-cli.cjs workspace examples/icm-input.json > test-results/example-workspace.zip
node tools/packed-cli.cjs inspect test-results/icm/original.mg8
node tools/packed-cli.cjs inspect-package test-results/icm/ordered-4.mg8pk
# '-' reads stdin. workspace input: {collection, plan?, timestamp?}.
```

## Verification

`npm test` runs the pure exporter, proposal/security, binary parser, Python ZIP compatibility and CLI checks. `npm run test:e2e` builds and runs all offline browser suites including ICM; activate a Python environment with Playwright installed. No live user profile is used. Example evidence from `tests/e2e/test_icm.py`: `test-results/icm/original.mg8`, `updated.mg8`, `ordered-{4,6,8,12}.mg8pk`, source-preserving workspace downloads and `export-review.png`. Chromium UI is exercised; Firefox packages are built/manifest checked but Firefox UI is not exercised by this suite. These offline fixtures do not establish capture completeness on live provider websites.
