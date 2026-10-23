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
  if (!snap) {
    $("list").replaceChildren(el("div", { className: "empty",
      textContent: "Can't reach the conversation tab. Make sure it's still open on claude.ai, chatgpt.com or gemini.google.com, reload it, and open the marker window again from the TExporT button." }));
    $("sub").textContent = "Not connected";
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
async function collect() {
  if (!snap) return;
  const { collections = {} } = await B.storage.local.get("collections");
  const entries = Object.entries(collections).sort((a, b) => b[1].created.localeCompare(a[1].created));
  const sheet = el("div", { className: "sheet" });
  const close = () => sheet.remove();
  sheet.onclick = (e) => { if (e.target === sheet) close(); };
  const name = el("input", { placeholder: "New collection name", value: entries.length ? "" : "My collection" });
  const save = async (colId, col) => {
    close();
    const markers = await getMarkers();
    const convo = {
      key: snap.key, url: snap.url, title: snap.title, site: snap.site, capturedAt: new Date().toISOString(),
      messages: snap.messages,
      markers: markers.map(({ id, msgIndex, excerpt, note, scope }) => ({ id, idx: msgIndex, excerpt, note, scope }))
    };
    const i = col.convos.findIndex((c) => c.key === convo.key);
    if (i >= 0) col.convos[i] = convo; else col.convos.push(convo);
    collections[colId] = col;
    await B.storage.local.set({ collections });
    toast(`${i >= 0 ? "Updated" : "Added"} in “${col.name}”: ${convo.messages.length} messages, ${convo.markers.length} markers.`);
  };
  sheet.append(el("div", {},
    el("h2", { textContent: "Add this conversation to…" }),
    entries.map(([id, c]) => el("button", { className: "opt", textContent: `${c.name} (${c.convos.length})`, onclick: () => save(id, c) })),
    el("div", { style: "margin-top:10px" }, name),
    el("button", { className: "opt primary", textContent: "Create new collection", onclick: () => {
      const n = name.value.trim();
      if (!n) { name.focus(); return; }
      save(uid(), { name: n, created: new Date().toISOString(), convos: [] });
    } }),
    el("button", { className: "opt", textContent: "Cancel", onclick: close })));
  document.body.append(sheet);
}

$("loadAll").onclick = () => load(true);
$("collect").onclick = collect;
$("cols").onclick = () => B.tabs.create({ url: B.runtime.getURL("export.html") });
B.storage.onChanged.addListener(async (ch) => {
  if (ch.settings) { S = await cmGetSettings(); document.documentElement.style.setProperty("--c", S.color); }
  if (snap && (ch.markers || ch.settings)) render();
});
cmGetSettings().then((s) => { S = s; document.documentElement.style.setProperty("--c", S.color); load(false); });
