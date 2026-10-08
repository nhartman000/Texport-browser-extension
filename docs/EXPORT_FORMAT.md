# Export format

An export is one collection rendered as a single document. The PDF (made with the browser's Save as PDF) and the Markdown file have the same structure and the same text. The format is built to survive the trip into another AI model: plain-text tags, so nothing depends on colors or formatting surviving PDF text extraction.

## Structure (default settings)

```
# <Collection name>
Compiled <date> · <N> conversation(s) · <K> marker(s) · marked text: <words> words, ≈<tokens> tokens

READER INSTRUCTIONS — for any AI model processing this document
  …6 numbered requirements, see below…

## MARKED PASSAGES REGISTER
### M1 — Conversation 1 ("<title>"), message 2, assistant — paragraph — 17 words, ≈25 tokens
Note: <note, if any>
[[MARK M1 START]]
<the exact marked text>
[[MARK M1 END]]
…M2…MK

## CONVERSATION 1: <title>
Source: <site> · <url> · captured <date time>
### USER (message 1)
<text>
### ASSISTANT (message 2) ★ MARKED
…text… [[MARK M1 START]] (Note: …) <marked text>[[MARK M1 END]] …text…
…
## CONVERSATION 2: …

## MARKED PASSAGES REGISTER (repeated — verify every ID before finishing)
…same entries as at the top…
```

## Marker IDs
- IDs are `M1…MK`, numbered across the whole collection in document order: conversation by conversation, message by message, and left to right inside a message.
- **Inline:** when the marked text is found inside the message, it is wrapped exactly where it occurs. The match tolerates differences in whitespace.
- **Whole message:** when a marker covers the whole message, or two selections overlap, the message is wrapped as a block with `[[MARK Mn START]]` above it and `[[MARK Mn END]]` below.
- **Not located:** if a marked message had disappeared from the page when the conversation was captured, the marker still gets an ID. The register shows its saved excerpt with scope "position not found", so nothing is silently dropped.

## Reader instructions (verbatim)
```
1. Read the entire document, not just the register.
2. Treat every marked passage as high priority. Do not drop, compress, or paraphrase away its specifics (numbers, names, definitions, decisions, code, wording).
3. When summarizing or answering, keep marked content verbatim where precision matters and cite it by ID (e.g. M3).
4. If a marked passage conflicts with other content, flag the conflict instead of silently resolving it.
5. Notes attached to a marker are the compiler's explanation of why it matters — follow them.
6. Before finishing any summary, confirm every ID M1–MK is accounted for.
```
Text from the **Extra instructions** setting is appended under "Additional instructions from the compiler:".

## Options that change the output
| Setting | Values | Effect |
|---|---|---|
| Marked-passages register | both (default) · top · end | Where the register appears. "Both" is recommended because models read the start and end of long inputs most reliably. |
| Conversation text | full (default) · marked | "Marked" keeps only messages that contain a marker and replaces each run of skipped messages with `[… n unmarked message(s) omitted …]`. |
| Show sizes in the register | on (default) · off | Adds or removes the "— 17 words, ≈25 tokens" part of each register heading. |

You can also change these per export, under **Export settings** on the export page.

## Checking a model's answer
Ask the model to cite markers by ID. Every ID from M1 to MK should appear in its answer, and the key values in each marked passage should appear verbatim. The TExporT Linux app runs this check automatically for its own captures (**Verify…**: marker coverage, anchor fidelity, no phantom IDs), and both apps use the same tag format.

## Stability
The tag syntax `[[MARK Mn START]]` / `[[MARK Mn END]]` and the register heading format are a stable interface. Other TExporT tools parse them. Any change to either will be called out in [CHANGELOG.md](../CHANGELOG.md) as breaking.
