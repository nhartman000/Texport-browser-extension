// Chrome exposes the same promise-based WebExtension API as `chrome`.
if (!globalThis.browser && typeof chrome !== "undefined") globalThis.browser = chrome;

// Shared settings + measuring helpers (content script, popup, export page, options page).
var CM_DEFAULTS = {
  unit: "tokens",            // tokens | words | characters — used for limits, budgets, badges
  limitAmount: 0,            // per-marker limit (0 = none)
  limitMode: "warn",         // warn | trim | block
  convoBudget: 0,            // total marked per conversation (0 = none)
  convoBudgetMode: "warn",   // warn | block
  collectionBudget: 0,       // total marked per collection (0 = none)
  defaultScope: "message",   // what a right-click marks when nothing is selected: message | paragraph
  askNote: false,            // always ask for a note
  color: "#f59e0b",
  showBadges: true,          // size badge at the start of each marker
  showPanel: true,           // floating marker panel on the page
  registerPlacement: "both", // top | both | end
  exportContent: "full",     // full | marked
  exportCounts: true,        // show sizes in the export register
  extraInstructions: ""
};

async function cmGetSettings() {
  const r = await browser.storage.local.get("settings");
  return Object.assign({}, CM_DEFAULTS, r.settings || {});
}

function cmMeasure(text) {
  const t = (text || "").trim();
  return { chars: t.length, words: t ? t.split(/\s+/).length : 0, tokens: Math.ceil(t.length / 4) };
}

function cmUnitValue(m, unit) {
  return unit === "words" ? m.words : unit === "characters" ? m.chars : m.tokens;
}

function cmUnitLabel(unit, short) {
  if (short) return unit === "words" ? "w" : unit === "characters" ? "ch" : "tok";
  return unit === "words" ? "words" : unit === "characters" ? "characters" : "≈tokens";
}

function cmFmt(n) {
  if (n >= 10000) return Math.round(n / 1000) + "k";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

// Trim text to a limit, cutting at a word boundary.
function cmTrim(text, amount, unit) {
  const t = (text || "").trim();
  if (unit === "words") return t.split(/\s+/).slice(0, amount).join(" ");
  const maxChars = unit === "characters" ? amount : amount * 4;
  if (t.length <= maxChars) return t;
  const cut = t.slice(0, maxChars);
  if (/\s/.test(t[maxChars])) return cut.trim();          // the cut already ends on a whole word
  const sp = cut.search(/\s\S*$/);
  return (sp > maxChars * 0.6 ? cut.slice(0, sp) : cut).trim();
}

if (typeof module !== "undefined") module.exports = { CM_DEFAULTS, cmMeasure, cmUnitValue, cmUnitLabel, cmFmt, cmTrim };
