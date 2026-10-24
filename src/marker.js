// Marker window: the conversation's messages in an extension page, with big tap targets.
// Works where the page overlay can't (phones, small screens, sites that cover the chip).
// Markers are written to the same storage the content script uses, so they also appear on the page.
const B = browser;
const $ = (id) => document.getElementById(id);
const tabId = Number(new URLSearchParams(location.search).get("tab"));
let snap = null;            // {key, url, title, site, messages:[{role,text}]}
let S = Object.assign({}, CM_DEFAULTS);
let selCache = null;        // {mi, text}

const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => k != null && e.append(k));
  return e;
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let toastTimer;
function toast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = el("div", { className: "toast" }); document.body.append(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}

async function getMarkers() {
  const r = await B.storage.local.get("markers");
  return ((r.markers || {})[snap.key]) || [];
}
async function setMarkers(list) {
  const r = await B.storage.local.get("markers");
  const all = r.markers || {};
  if (list.length) all[snap.key] = list; else delete all[snap.key];
  await B.storage.local.set({ markers: all });
}

async function load(loadAll) {
  if (!tabId) { $("sub").textContent = "Open this from the TExporT button while a conversation is open."; return; }
  $("sub").textContent = loadAll ? "Loading the whole conversation (scrolling the chat tab)…" : "Reading the conversation…";
  try {
    snap = await B.tabs.sendMessage(tabId, { cmd: "cm-snapshot", loadAll: !!loadAll });
  } catch (e) {
    snap = null;
  }
  if (!snap || snap.error) {
    $("list").replaceChildren(el("div", { className: "empty",
      textContent: snap?.error || "Can't reach the conversation tab. Make sure it's still open on claude.ai, chatgpt.com or gemini.google.com, reload it, and open the marker window again from the TExporT button." }));
    $("sub").textContent = snap?.error ? "Capture unavailable" : "Not connected";
    snap = null;
    return;
  }
  document.title = "Mark: " + snap.title;
  $("title").textContent = snap.title;
  $("sub").textContent = `${snap.site} · ${snap.messages.length} messages`;
  render();
}

// Split a message into paragraphs the way it reads on screen.
function paragraphs(text) {
  return text.split(/\n\s*\n|\n(?=\s*[-*•\d]+[.)]?\s)|\n/).map((p) => p.trim()).filter(Boolean);
}

async function render() {
  const markers = await getMarkers();
  const list = $("list");
  list.replaceChildren();
  if (!snap.messages.length) {
    list.append(el("div", { className: "empty", textContent: "No messages found on that page." }));
  }
  // number markers in page order, like the export
  const order = [...markers].sort((a, b) => a.msgIndex - b.msgIndex || snap.messages[a.msgIndex]?.text.indexOf(a.excerpt) - snap.messages[b.msgIndex]?.text.indexOf(b.excerpt));
  const num = new Map(order.map((m, i) => [m.id, i + 1]));

  snap.messages.forEach((m, mi) => {
    const mine = markers.filter((x) => x.msgIndex === mi);
    const whole = mine.find((x) => !x.excerpt);
    const box = el("div", { className: "msg " + (m.role === "user" ? "user" : "assistant") + (whole ? " whole" : "") });
    box.dataset.mi = mi;
    const wholeBtn = el("button", { textContent: whole ? `#${num.get(whole.id)} whole message ✓` : "Mark whole message" });
    wholeBtn.onclick = () => (whole ? markerMenu(whole, num.get(whole.id)) : addMarker(mi, "", "message"));
    box.append(el("div", { className: "role" }, el("span", { textContent: m.role }), wholeBtn));
    if (whole && whole.note) box.append(el("div", { className: "note", textContent: "Note: " + whole.note }));
    const paras = el("div", { className: "paras" });
    for (const p of paragraphs(m.text)) {
      const hits = mine.filter((x) => x.excerpt && (p.includes(x.excerpt) || x.excerpt.includes(p)));
      const div = el("div", { className: "p" + (hits.length ? " marked" : "") });
      const exact = hits.find((x) => x.excerpt === p || x.excerpt.includes(p));
      if (exact) {
        div.append(el("span", { className: "tag", textContent: "#" + num.get(exact.id) }), p);
      } else if (hits.length) {
        // selection markers inside this paragraph: highlight them
        let rest = p;
        const parts = [];
        for (const h of hits.sort((a, b) => p.indexOf(a.excerpt) - p.indexOf(b.excerpt))) {
          const i = rest.indexOf(h.excerpt);
          if (i < 0) continue;
          parts.push(rest.slice(0, i), el("span", { className: "tag", textContent: "#" + num.get(h.id) }), el("mark", { textContent: h.excerpt }));
          rest = rest.slice(i + h.excerpt.length);
        }
        div.append(...parts, rest);
      } else {
        div.textContent = p;
      }
      for (const h of hits) if (h.note) div.append(el("div", { className: "note", textContent: `#${num.get(h.id)} — ${h.note}` }));
      div.onclick = () => {
        if (selectionText()) return;                       // they're selecting words, not tapping
        if (hits.length) markerMenu(exact || hits[0], num.get((exact || hits[0]).id));
        else addMarker(mi, p, "paragraph");
      };
      paras.append(div);
    }
    box.append(paras);
    list.append(box);
  });
  const total = markers.reduce((s, x) => s + cmUnitValue(cmMeasure(x.excerpt || (snap.messages[x.msgIndex] || {}).text || ""), S.unit), 0);
  $("count").textContent = `${markers.length} marker${markers.length === 1 ? "" : "s"} · ${cmFmt(total)} ${cmUnitLabel(S.unit, true)}`;
}

async function addMarker(mi, excerpt, scope, note = "") {
  const m = snap.messages[mi];
  if (!m) return;
  const list = await getMarkers();
  if (list.some((x) => x.msgIndex === mi && (x.excerpt || "") === excerpt)) { toast("Already marked."); return; }
  let text = excerpt || m.text;
  let size = cmMeasure(text);
  if (S.limitAmount > 0 && cmUnitValue(size, S.unit) > S.limitAmount) {
    if (S.limitMode === "block") { toast(`Not marked: over your ${S.limitAmount} ${cmUnitLabel(S.unit)} limit.`); return; }
    if (S.limitMode === "trim") { excerpt = cmTrim(text, S.limitAmount, S.unit); scope += " · trimmed"; size = cmMeasure(excerpt); }
  }
  if (!note && S.askNote) {
    const n = prompt("Note for this marker — why it matters:", "");
    if (n === null) return;
    note = n.trim();
  }
  list.push({ id: uid(), msgIndex: mi, role: m.role, prefix: m.text.slice(0, 120), excerpt, scope, note, created: new Date().toISOString() });
  await setMarkers(list);
  toast(`Marked ${scope}: ${size.words} words · ≈${size.tokens} tokens`);
}

function markerMenu(mk, n) {
  const sheet = el("div", { className: "sheet" });
  const close = () => sheet.remove();
  sheet.onclick = (e) => { if (e.target === sheet) close(); };
  sheet.append(el("div", {},
    el("h2", { textContent: `Marker #${n}` }),
    el("button", { className: "opt", textContent: mk.note ? "Edit note" : "Add note", onclick: async () => {
      close();
      const v = prompt("Note for this marker — why it matters:", mk.note || "");
      if (v === null) return;
      const list = await getMarkers();
      const x = list.find((y) => y.id === mk.id);
      if (x) { x.note = v.trim(); await setMarkers(list); }
    } }),
    el("button", { className: "opt", textContent: "Remove marker", onclick: async () => {
      close();
      await setMarkers((await getMarkers()).filter((y) => y.id !== mk.id));
    } }),
    el("button", { className: "opt", textContent: "Cancel", onclick: close })));
  document.body.append(sheet);
}

// ---- marking a selection inside this window
function selectionText() {
  const s = window.getSelection();
  return s && !s.isCollapsed ? s.toString().trim() : "";
}
document.addEventListener("selectionchange", () => {
  const s = window.getSelection();
  const text = selectionText();
  const node = s && s.anchorNode ? (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) : null;
  const msg = node && node.closest(".msg");
  selCache = text.length >= 2 && msg ? { mi: Number(msg.dataset.mi), text } : null;
  $("markSel").disabled = $("markNote").disabled = !selCache;
});
for (const [id, withNote] of [["markSel", false], ["markNote", true]]) {
  $(id).addEventListener("pointerdown", (e) => e.preventDefault());   // keep the selection
  $(id).onclick = async () => {
    if (!selCache) return;
    const c = selCache;
    let note = "";
    if (withNote) { const v = prompt("Note for this marker — why it matters:", ""); if (v === null) return; note = v.trim(); }
    window.getSelection().removeAllRanges();
    await addMarker(c.mi, c.text, "selection", note);
  };
}

// ---- add to collection (no prompt dialogs: a proper picker that works on phones)
// ---- collections
function convoForCollection(markers, skip = new Set()) {
  // leave out the Smart Marker request/answer, renumbering the remaining messages
  const keep = [], newIdx = new Map();
  snap.messages.forEach((m, i) => { if (!skip.has(i)) { newIdx.set(i, keep.length); keep.push(m); } });
  return {
    key: snap.key, url: snap.url, title: snap.title, site: snap.site, capturedAt: new Date().toISOString(),
    messages: keep,
    markers: markers.filter((m) => newIdx.has(m.msgIndex))
      .map(({ id, msgIndex, excerpt, note, scope }) => ({ id, idx: newIdx.get(msgIndex), excerpt, note, scope }))
  };
}

async function saveToCollection(colId, col, convo) {
  const { collections = {} } = await B.storage.local.get("collections");
  const target = collections[colId] || col;
  const i = target.convos.findIndex((c) => c.key === convo.key);
  if (i >= 0) target.convos[i] = convo; else target.convos.push(convo);
  collections[colId] = target;
  await B.storage.local.set({ collections });
  return { name: target.name, updated: i >= 0, col: target };
}

/** Collection picker sheet; calls done(colId, col) or nothing if cancelled. */
async function pickCollection(title, done) {
  const { collections = {} } = await B.storage.local.get("collections");
  const entries = Object.entries(collections).sort((a, b) => b[1].created.localeCompare(a[1].created));
  const sheet = el("div", { className: "sheet" });
  const close = () => sheet.remove();
  sheet.onclick = (e) => { if (e.target === sheet) close(); };
  const name = el("input", { placeholder: "New collection name", value: entries.length ? "" : "My collection" });
  sheet.append(el("div", {},
    el("h2", { textContent: title }),
    entries.map(([id, c]) => el("button", { className: "opt", textContent: `${c.name} (${c.convos.length})`, onclick: () => { close(); done(id, c); } })),
    el("div", { style: "margin-top:10px" }, name),
    el("button", { className: "opt primary", textContent: "Create new collection", onclick: () => {
      const n = name.value.trim();
      if (!n) { name.focus(); return; }
      close();
      done(uid(), { name: n, created: new Date().toISOString(), convos: [] });
    } }),
    el("button", { className: "opt", textContent: "Cancel", onclick: close })));
  document.body.append(sheet);
}

async function collect() {
  if (!snap) return;
  pickCollection("Add this conversation to…", async (colId, col) => {
    const r = await saveToCollection(colId, col, convoForCollection(await getMarkers(), smartMessageIndexes(snap.messages)));
    toast(`${r.updated ? "Updated" : "Added"} in “${r.name}”.`);
  });
}

// ---- ✨ Smart Marker (no API key): the chat's own AI picks the key points
let smartPoll = null;
function sheetBox(title) {
  document.querySelectorAll(".sheet").forEach((x) => x.remove());
  const sheet = el("div", { className: "sheet" });
  const box = el("div", {}, el("h2", { textContent: title }));
  sheet.append(box);
  document.body.append(sheet);
  return { sheet, box, close: () => { sheet.remove(); } };
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (_) {}
  try {                                    // fallback for browsers without async clipboard in extension pages
    const ta = el("textarea", { value: t });
    document.body.append(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch (_) { return false; }
}

async function smartStart() {
  if (!snap) return;
  const prompt = smartPrompt();
  const copied = await copyText(prompt);
  const { box, close } = sheetBox("✨ Smart Marker");
  box.append(
    el("ol", { className: "steps" },
      el("li", { textContent: copied ? "The request is copied." : "Copy the request below." }),
      el("li", { textContent: "Go back to the chat, paste it into the message box and send it." }),
      el("li", { textContent: "TExporT watches the chat and, as soon as the answer is finished, lays the markers, copies the handoff, downloads the .md and adds it to your collection." })),
    copied ? null : el("textarea", { value: prompt, style: "width:100%;height:120px;font:12px monospace" }),
    el("button", { className: "opt primary", textContent: "Go to the chat tab", onclick: () => B.tabs.update(tabId, { active: true }) }),
    el("button", { className: "opt", textContent: "Copy the request again", onclick: () => copyText(prompt).then((ok) => toast(ok ? "Copied." : "Copy failed: select the text and copy it.")) }),
    el("button", { className: "opt", textContent: "Read the answer now", onclick: () => smartCheck(true) }),
    el("button", { className: "opt", textContent: "Cancel", onclick: () => { stopPoll(); close(); } }),
    el("div", { className: "hint", id: "smartStatus", textContent: "Waiting for the answer…" }));
  stopPoll();
  let lastText = null;
  smartPoll = setInterval(async () => {
    const s = await B.tabs.sendMessage(tabId, { cmd: "cm-snapshot" }).catch(() => null);
    if (!s) return;
    const ai = findAnswer(s.messages);
    if (ai < 0) return;
    const t = s.messages[ai].text;
    if (t === lastText) { snap = s; smartFinish(ai); }    // unchanged for one interval: the answer has finished
    else { lastText = t; const st = $("smartStatus"); if (st) st.textContent = "Answer arriving…"; }
  }, 2500);
}
function stopPoll() { if (smartPoll) { clearInterval(smartPoll); smartPoll = null; } }

async function smartCheck(manual) {
  const s = await B.tabs.sendMessage(tabId, { cmd: "cm-snapshot" }).catch(() => null);
  if (!s) { toast("Can't reach the chat tab."); return; }
  const ai = findAnswer(s.messages);
  if (ai < 0) { if (manual) toast("No finished answer with TEXPORT-BEGIN … TEXPORT-END yet."); return; }
  snap = s;
  smartFinish(ai);
}

async function smartFinish(ai) {
  stopPoll();
  const points = parseAnswer(snap.messages[ai].text);
  const skip = smartMessageIndexes(snap.messages);
  const list = await getMarkers();
  let laid = 0, missing = 0, dup = 0;
  for (const p of points) {
    const hit = findQuote(snap.messages, p.quote, skip);
    if (!hit) { missing++; continue; }
    const m = snap.messages[hit.mi];
    const excerpt = m.text.slice(hit.start, hit.end);
    if (list.some((x) => x.msgIndex === hit.mi && x.excerpt === excerpt)) { dup++; continue; }
    list.push({ id: uid(), msgIndex: hit.mi, role: m.role, prefix: m.text.slice(0, 120), excerpt, scope: "smart", note: p.why, created: new Date().toISOString() });
    laid++;
  }
  await setMarkers(list);
  await render();

  // Then: add to a collection (asked once, remembered), copy the handoff, download the .md
  const { smartCollectionId } = await B.storage.local.get("smartCollectionId");
  const { collections = {} } = await B.storage.local.get("collections");
  const go = async (colId, col) => {
    await B.storage.local.set({ smartCollectionId: colId });
    const r = await saveToCollection(colId, col, convoForCollection(list, skip));
    const opts = { placement: S.registerPlacement, content: S.exportContent, counts: S.exportCounts, extra: S.extraInstructions };
    const md = renderMarkdown(buildDoc(JSON.parse(JSON.stringify(r.col))), opts);
    const fname = (r.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "collection") + ".md";
    try { const me = await B.tabs.getCurrent(); if (me) await B.tabs.update(me.id, { active: true }); } catch (_) {}
    const copied = await copyText(md);
    let downloaded = true;
    try {
      const a = el("a", { href: URL.createObjectURL(new Blob([md], { type: "text/markdown" })), download: fname });
      document.body.append(a); a.click(); a.remove();
    } catch (_) { downloaded = false; }
    const { box } = sheetBox("✨ Smart Marker done");
    const line = (ok, t) => el("div", { className: ok ? "ok" : "bad", textContent: (ok ? "✓ " : "✗ ") + t });
    box.append(
      line(laid > 0, `${laid} marker${laid === 1 ? "" : "s"} laid` + (dup ? ` (${dup} already marked)` : "") +
        (missing ? ` · ${missing} quote${missing === 1 ? "" : "s"} not found word-for-word in the chat` : "")),
      line(true, `Added to “${r.name}”`),
      line(copied, copied ? "Handoff copied to the clipboard" : "Couldn't copy automatically. Tap Copy handoff."),
      line(downloaded, downloaded ? `Downloaded ${fname}` : "Download blocked by the browser"),
      el("button", { className: "opt primary", textContent: "Copy handoff", onclick: () => copyText(md).then((ok) => toast(ok ? "Copied." : "Copy failed.")) }),
      el("button", { className: "opt", textContent: "Open the collection", onclick: () => B.tabs.create({ url: B.runtime.getURL("export.html?c=" + encodeURIComponent(colId)) }) }),
      el("button", { className: "opt", textContent: "Change Smart Marker's collection", onclick: async () => { await B.storage.local.remove("smartCollectionId"); toast("Next run will ask again."); } }),
      el("button", { className: "opt", textContent: "Close", onclick: () => document.querySelectorAll(".sheet").forEach((x) => x.remove()) }));
  };
  if (smartCollectionId && collections[smartCollectionId]) go(smartCollectionId, collections[smartCollectionId]);
  else pickCollection(`✨ ${laid} markers laid. Save to which collection? (asked once)`, go);
}

$("smart").onclick = smartStart;
$("loadAll").onclick = () => load(true);
$("collect").onclick = collect;
$("cols").onclick = () => B.tabs.create({ url: B.runtime.getURL("export.html") });
B.storage.onChanged.addListener(async (ch) => {
  if (ch.settings) { S = await cmGetSettings(); document.documentElement.style.setProperty("--c", S.color); }
  if (snap && (ch.markers || ch.settings)) render();
});
cmGetSettings().then(async (s) => {
  S = s; document.documentElement.style.setProperty("--c", S.color);
  await load(false);
  if (new URLSearchParams(location.search).get("smart") === "1" && snap) smartStart();
});
