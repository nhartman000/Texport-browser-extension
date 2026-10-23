// Smart Marker (no API key): the conversation's own AI picks the key points as exact quotes,
// TExporT reads its answer back off the page and lays markers on the quoted text.
// Pure functions (no DOM, no browser APIs) so they're unit-tested in Node.

const SMART_TAG = "TExporT Smart Marker request";

function smartPrompt(max = 12) {
  return `${SMART_TAG}: list the key points of our conversation above that a new AI session must not lose ` +
    `(decisions, numbers, names, file names, commands, code, definitions, constraints, open questions).

Rules:
- Up to ${max} points, most important first.
- Each point is an EXACT quote copied character for character from the conversation above (one sentence or a short passage, no paraphrasing, no "..."), plus a few words on why it matters.
- Put the whole list inside ONE code block, exactly in this format, with nothing else in the block:

TEXPORT-BEGIN
QUOTE: <exact text from the conversation> | WHY: <why it matters>
QUOTE: <exact text from the conversation> | WHY: <why it matters>
TEXPORT-END`;
}

/** Index of the AI's answer: the last message with a complete TEXPORT-BEGIN…END block that isn't the request. */
function findAnswer(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const t = messages[i].text || "";
    if (t.includes(SMART_TAG)) continue;
    if (/TEXPORT-BEGIN[\s\S]*TEXPORT-END/.test(t)) return i;
  }
  return -1;
}

/** Messages to leave out of the search and the export: the request and the answer. */
function smartMessageIndexes(messages) {
  const out = new Set();
  messages.forEach((m, i) => { if ((m.text || "").includes(SMART_TAG) || /TEXPORT-BEGIN[\s\S]*TEXPORT-END/.test(m.text || "")) out.add(i); });
  return out;
}

function parseAnswer(text) {
  const m = /TEXPORT-BEGIN([\s\S]*?)TEXPORT-END/.exec(text || "");
  if (!m) return [];
  const points = [];
  for (let line of m[1].split("\n")) {
    line = line.trim().replace(/^[-*•\d.)\s]+(?=QUOTE)/i, "");
    const q = /^QUOTE:\s*(.+?)(?:\s*\|\s*WHY:\s*(.*))?$/i.exec(line);
    if (!q) continue;
    const quote = q[1].trim().replace(/^["“'`]+|["”'`]+$/g, "").trim();
    if (quote.length >= 4) points.push({ quote, why: (q[2] || "").trim() });
  }
  return points;
}

// Normalize for matching: lower case, unify quotes/dashes, drop markdown punctuation, collapse spaces.
// Returns the normalized string and, for each of its characters, the index in the original.
function normalizeMap(s) {
  let out = "";
  const map = [];
  for (let k = 0; k < s.length; k++) {
    let ch = s[k];
    if ("“”„\"".includes(ch)) ch = '"';
    else if ("‘’`´".includes(ch)) ch = "'";
    else if ("–—‐".includes(ch)) ch = "-";
    else if ("*_#>".includes(ch)) continue;
    if (/\s/.test(ch)) { if (!out.length || out.endsWith(" ")) continue; ch = " "; }
    out += ch.toLowerCase();
    map.push(k);
  }
  if (out.endsWith(" ")) { out = out.slice(0, -1); map.pop(); }
  return { out, map };
}

/** [start, end) of quote in text, tolerant of case, whitespace, quotes and markdown; null if absent. */
function locateQuote(text, quote) {
  const T = normalizeMap(text), Q = normalizeMap(quote).out;
  if (Q.length < 4) return null;
  let i = T.out.indexOf(Q);
  let len = Q.length;
  if (i < 0) {
    // models sometimes trim or end a quote differently: try the longest piece around "..." or sentence breaks
    const pieces = Q.split(/\s*(?:\.\.\.|…)\s*|(?<=[.!?])\s+/).filter((p) => p.length >= 20).sort((a, b) => b.length - a.length);
    for (const p of pieces) { i = T.out.indexOf(p); if (i >= 0) { len = p.length; break; } }
  }
  if (i < 0) return null;
  return [T.map[i], T.map[i + len - 1] + 1];
}

/** Best place for a quote across messages (skipping the given indexes). */
function findQuote(messages, quote, skip = new Set()) {
  for (let mi = 0; mi < messages.length; mi++) {
    if (skip.has(mi)) continue;
    const pos = locateQuote(messages[mi].text || "", quote);
    if (pos) return { mi, start: pos[0], end: pos[1] };
  }
  return null;
}

if (typeof module !== "undefined") module.exports = { SMART_TAG, smartPrompt, findAnswer, smartMessageIndexes, parseAnswer, locateQuote, findQuote };
