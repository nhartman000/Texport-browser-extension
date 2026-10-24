# Settings reference

To open Settings, click **⚙ Settings** in the toolbar popup, choose **Settings** in the marker panel, or right-click → **TExporT Markers → Settings…**. Changes save as you make them and apply to open conversations immediately. **Reset to defaults** restores the table below.

| Setting | Key | Default | Values and effect |
|---|---|---|---|
| Measure markers in | `unit` | `tokens` | `tokens` (≈ characters ÷ 4) · `words` · `characters`. Used for badges, the panel, limits and budgets. |
| Per-marker limit | `limitAmount` | `0` (none) | Maximum size of one marker, in the chosen unit. |
| When a marker is over the limit | `limitMode` | `warn` | `warn`: mark it, show it in red and warn · `trim`: cut it to the limit at a word boundary · `block`: don't mark it. |
| Budget per conversation | `convoBudget` | `0` (none) | Total marked size allowed in one conversation. |
| When the budget is exceeded | `convoBudgetMode` | `warn` | `warn` · `block` (refuse new markers). |
| Budget per collection | `collectionBudget` | `0` (none) | Checked when a conversation is added to a collection and shown on the export page. Useful for keeping a handoff inside a model's context window. |
| Right-click with nothing selected marks | `defaultScope` | `message` | `message`: the whole message · `paragraph`: the paragraph, list item, code block, quote, heading or table cell you clicked. |
| Always ask for a note | `askNote` | off | Prompts for a note on every marker. |
| Show a ★ Mark button when you select text | `selectionButton` | on | A ★ Mark / + Note bar appears beside any text you select in a message. It is how you mark on phones and tablets. |
| I also use TExporT for Android | `companionAndroid` | off | Shows **Send to Android (.texport.json)** on a collection and **Import from Android…** on the Collections page. |
| Highlight color | `color` | `#f59e0b` | Highlight, left border and badge color. Over-limit markers are always red. |
| Highlight marked text and message edges | `showHighlights` | on | Turn off page CSS highlights (including active/over-limit highlights) and message edges without deleting markers or notes. Panel records remain; badges have their own setting. |
| Size badge on each marker | `showBadges` | on | Small `#n · size` tag at the start of each marker. Click it to open the panel. |
| Marker panel on the page | `showPanel` | on | Bottom-right panel listing every marker with its size, plus totals and the budget bar. |
| Marked-passages register | `registerPlacement` | `both` | See [EXPORT_FORMAT.md](EXPORT_FORMAT.md). |
| Conversation text | `exportContent` | `full` | `full` · `marked`. |
| Show sizes in the register | `exportCounts` | on | |
| Extra instructions for the reading AI | `extraInstructions` | empty | Appended to the reader instructions of every export. |

## Keyboard shortcuts and selection

| Suggested key (not guaranteed assigned) | Native command | Action |
|---|---|---|
| Alt+Shift+M | `mark-selection` | Mark selected conversation text |
| Alt+Shift+K | `toggle-panel` | Show or hide the panel |
| Alt+Shift+H | `toggle-mark-mode` | Toggle Selection / Click-to-mark mode |
| Alt+Shift+U | `delete-marker` | Delete exactly one chosen or uniquely overlapping marker |

Settings lists **actual** `commands.getAll()` assignments. **Unassigned** means the browser has not assigned a key, even if a suggestion appears above. Conflicting browser/OS/extension bindings need remapping. The Settings button opens Chrome/Chromium's native `chrome://extensions/shortcuts` editor. On Firefox it displays the supported manual route: **Add-ons and themes (Ctrl+Shift+A) → Extensions → ⚙ → Manage Extension Shortcuts**; there is no supported direct shortcut-editor URL. Return to Settings to refresh assignments. No new permissions are required.

**Practical workflow:** stay in **Selection mode** (the default). Drag across a passage, then click **★ Mark** or use the actual assigned `mark-selection` shortcut. For keyboard selection, enable the browser's caret browsing with **F7**, position the caret in conversation text, then **Shift+Arrow** extends the selection and **Ctrl+Shift+Arrow** extends it by words (platform conventions may differ). **Ctrl+C**, **Ctrl+A**, plain **Delete/Backspace**, and native selection keys are not intercepted. Composer/input/contenteditable text is not a conversation selection; marking and deletion shortcuts refuse it. Finish editing and focus conversation text first.

For whole paragraphs, choose **Selection mode · Click to mark** or the assigned mode shortcut. The chip explicitly indicates **Click-to-mark mode**. Click a paragraph to mark it; drag selection and copy still work. Inputs, editable fields, links and controls are not click-to-mark targets. **Done** or **Escape** outside editable fields returns to Selection mode. Escape in a composer keeps its native behavior.

### Delete one, hide highlights, or clear all

- Choose a marker through its **panel row**, **Show**, or **badge**, then use the assigned delete shortcut. The chosen row is outlined. Hovering never chooses a deletion target.
- Alternatively, select text or place a caret inside **exactly one resolved marker**. A new native selection/caret takes precedence over the earlier panel choice. Multiple overlaps, no overlap, stale/unresolved text, repeated excerpt locations, or editable focus refuse deletion with a toast; they never delete all markers on a message or fall back to the earlier choice. When text changed, use a specific row's visible **Delete** button to remove its record deliberately.
- **Deletion evidence limit:** keyboard deletion uses a conservative source binding for this document session, not the display resolver's nearest-index choice. At first observation the stored prefix must identify one message at the stored index; initially duplicate/missing sources remain unauthorized even if a duplicate later disappears. Detachment, replacement, reordering, or source-text changes permanently revoke that binding for the session, including remove/reinsert and change/restore. Marker IDs, notes, and the persisted schema are unchanged. Legacy prefix/index records cannot establish historical identity before this session (or across reloads); a visible highlight is not proof of identity. Use the row's **Delete** button for intentional record removal when shortcut evidence is insufficient.
- Per-marker **Delete** is always visible and has an accessible label. It deletes that original marker ID only, preserving other IDs/notes and page text.
- To hide page coloring without removing data, disable **Highlight marked text and message edges**. Turn it back on to restore the visuals. Badges and panel visibility are independent.
- **Clear conversation markers** in the panel is a separate bulk action and always asks for confirmation. Cancel preserves all records and notes.
- Deletion/clear affects live conversation markers only. Saved historical collection snapshots are unchanged unless you **explicitly recapture** the conversation into that collection.

Browser references: [Chrome caret browsing](https://support.google.com/accessibility/answer/10129654), [Chrome keyboard shortcuts](https://support.google.com/chrome/answer/157179), [native commands and assignment reporting](https://developer.chrome.com/docs/extensions/reference/api/commands).
