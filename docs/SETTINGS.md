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
| Highlight color | `color` | `#f59e0b` | Highlight, left border and badge color. Over-limit markers are always red. |
| Size badge on each marker | `showBadges` | on | Small `#n · size` tag at the start of each marker. Click it to open the panel. |
| Marker panel on the page | `showPanel` | on | Bottom-right panel listing every marker with its size, plus totals and the budget bar. |
| Marked-passages register | `registerPlacement` | `both` | See [EXPORT_FORMAT.md](EXPORT_FORMAT.md). |
| Conversation text | `exportContent` | `full` | `full` · `marked`. |
| Show sizes in the register | `exportCounts` | on | |
| Extra instructions for the reading AI | `extraInstructions` | empty | Appended to the reader instructions of every export. |

## Keyboard shortcuts
| Shortcut | Action |
|---|---|
| Alt+Shift+M | Mark the selected text |
| Alt+Shift+K | Show or hide the marker panel |

You can change them in Firefox under Add-ons → ⚙ → **Manage Extension Shortcuts**, or in Chrome at `chrome://extensions/shortcuts`.
