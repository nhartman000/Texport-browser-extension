(() => {
  if (window.__convoMarkersLoaded) return;
  window.__convoMarkersLoaded = true;

  const B = browser;
  const PREFIX_LEN = 120;
  let S = Object.assign({}, CM_DEFAULTS);
  let panelOpen = false;
  let panelHidden = null;  // null = follow settings, true = user hid it, false = user showed it
  let items = [];          // resolved markers currently on the page

  // ---- Site adapters (update selectors here if a site changes its markup)
  const SITES = [
    { match: /(^|\.)claude\.ai$/, name: "Claude",
      sel: [['[data-testid="user-message"]', "user"], [".font-claude-response", "assistant"],
            [".font-claude-message", "assistant"], ['[data-testid="assistant-message"]', "assistant"]] },
    { match: /(^|\.)(chatgpt\.com|chat\.openai\.com)$/, name: "ChatGPT",
      sel: [["[data-message-author-role]", (el) => el.getAttribute("data-message-author-role")]] },
    { match: /(^|\.)gemini\.google\.com$/, name: "Gemini",
      sel: [["user-query", "user"], ["model-response", "assistant"]] }
  ];
  const site = SITES.find((s) => s.match.test(location.hostname)) || { name: location.hostname, sel: [] };

  const convoKey = () => location.origin + location.pathname;
  const textOf = (el) => (el.innerText || el.textContent || "").trim();
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const unitShort = () => cmUnitLabel(S.unit, true);

  function getMessages() {
    let found = [];
    for (const [sel, role] of site.sel) {
      document.querySelectorAll(sel).forEach((el) =>
        found.push({ el, role: typeof role === "function" ? role(el) : role }));
    }
    const set = new Set(found.map((f) => f.el));
    const seen = new Set();
    found = found.filter((f) => {
      if (seen.has(f.el)) return false;
      seen.add(f.el);
      for (let p = f.el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
      return true;
    });
    found.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    if (!found.length) found = [{ el: document.querySelector("main") || document.body, role: "page" }];
    return found;
  }

  function indexOfNode(msgs, node) {
    if (!node) return -1;
    if (node.nodeType !== 1) node = node.parentElement;
    return msgs.findIndex((m) => m.el.contains(node));
  }

  function resolve(markers, msgs) {
    const texts = msgs.map((m) => textOf(m.el));
    return markers.map((mk) => {
      let best = -1, bestDist = Infinity;
      if (mk.prefix) texts.forEach((t, i) => {
        if (t.startsWith(mk.prefix)) { const d = Math.abs(i - mk.msgIndex); if (d < bestDist) { best = i; bestDist = d; } }
      });
      if (best < 0 && mk.excerpt) {
        const flat = mk.excerpt.replace(/\s+/g, "");
        best = texts.findIndex((t) => t.replace(/\s+/g, "").includes(flat));
      }
      if (best < 0 && mk.msgIndex < texts.length) best = mk.msgIndex;
      return { ...mk, idx: best };
    });
  }

  // Whitespace-insensitive search for an excerpt inside an element -> DOM Range.
  function findRange(el, needle) {
    const target = (needle || "").replace(/\s+/g, "");
    if (!target) return null;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const chars = [], map = [];
    while (walker.nextNode()) {
      const n = walker.currentNode, d = n.data;
      for (let i = 0; i < d.length; i++) {
        const c = d[i];
        if (c !== " " && c !== "\n" && c !== "\t" && c !== "\r" && c !== " ") { chars.push(c); map.push([n, i]); }
      }
    }
    const at = chars.join("").indexOf(target);
    if (at < 0) return null;
    const [sn, so] = map[at], [en, eo] = map[at + target.length - 1];
    const r = document.createRange();
    r.setStart(sn, so);
    r.setEnd(en, eo + 1);
    return r;
  }

  function paragraphOf(node, msgEl) {
    if (!node) return null;
    let el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el !== msgEl) {
      if (el.matches("p, li, pre, blockquote, h1, h2, h3, h4, h5, h6, td, th")) return el;
      el = el.parentElement;
    }
    return null;
  }

  async function getMarkers() {
    const r = await B.storage.local.get("markers");
    return (r.markers || {})[convoKey()] || [];
  }
  async function setMarkers(list) {
    const r = await B.storage.local.get("markers");
    const all = r.markers || {};
    if (list.length) all[convoKey()] = list; else delete all[convoKey()];
    await B.storage.local.set({ markers: all });
  }

  // ---- Page styles (::highlight must live in the page's own stylesheet)
  const pageStyle = document.createElement("style");
  document.documentElement.appendChild(pageStyle);
  function applyPageStyle() {
    const c = S.color;
    pageStyle.textContent = `
      .cm-marked { box-shadow: -4px 0 0 0 ${c} !important; }
      ::highlight(cm-all) { background-color: color-mix(in srgb, ${c} 38%, transparent); }
      ::highlight(cm-over) { background-color: color-mix(in srgb, #ef4444 35%, transparent); }
      ::highlight(cm-active) { background-color: color-mix(in srgb, ${c} 80%, transparent); color: #111; }`;
  }

  // ---- Overlay (shadow DOM: badges, panel, toast)
  const host = document.createElement("div");
  host.style.cssText = "all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483646;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: system-ui, sans-serif; }
      .badge { position: fixed; pointer-events: auto; cursor: pointer; transform: translateY(-100%);
        font: 600 10.5px/1.5 system-ui, sans-serif; padding: 0 6px; border-radius: 4px; white-space: nowrap;
        background: var(--c); color: #111; box-shadow: 0 1px 3px rgba(0,0,0,.25); }
      .badge.over { background: #ef4444; color: #fff; }
      .panel { position: fixed; right: 16px; bottom: 16px; pointer-events: auto; color: #f4f4f5;
        background: rgba(24,24,27,.94); border: 1px solid rgba(255,255,255,.12); border-radius: 12px;
        box-shadow: 0 8px 28px rgba(0,0,0,.35); font-size: 12px; max-width: 360px; }
      .pill { display: flex; align-items: center; gap: 8px; padding: 7px 12px; cursor: pointer; user-select: none; }
      .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--c); flex: none; }
      .body { width: 360px; max-height: 60vh; display: flex; flex-direction: column; border-top: 1px solid rgba(255,255,255,.1); }
      .bar { height: 5px; background: rgba(255,255,255,.12); border-radius: 3px; overflow: hidden; margin: 8px 12px 0; }
      .bar > i { display: block; height: 100%; background: var(--c); }
      .bar.over > i { background: #ef4444; }
      .sum { padding: 6px 12px 8px; color: #a1a1aa; }
      .list { overflow-y: auto; padding: 0 6px 6px; }
      .row { padding: 7px 8px; border-radius: 8px; cursor: pointer; }
      .row:hover { background: rgba(255,255,255,.08); }
      .rh { display: flex; gap: 6px; align-items: baseline; }
      .num { font-weight: 700; color: var(--c); }
      .row.over .num, .row.over .size { color: #fca5a5; }
      .scope { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #a1a1aa; }
      .size { margin-left: auto; font-variant-numeric: tabular-nums; color: #e4e4e7; }
      .pv { color: #d4d4d8; margin-top: 3px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .note { color: #fcd34d; font-style: italic; margin-top: 2px; }
      .missing { color: #fca5a5; }
      .acts { display: none; gap: 4px; margin-top: 5px; }
      .row:hover .acts { display: flex; }
      button { font: inherit; font-size: 11px; color: #f4f4f5; background: rgba(255,255,255,.1);
        border: 1px solid rgba(255,255,255,.16); border-radius: 5px; padding: 2px 8px; cursor: pointer; }
      button:hover { background: rgba(255,255,255,.2); }
      .foot { display: flex; gap: 6px; padding: 8px 12px; border-top: 1px solid rgba(255,255,255,.1); flex-wrap: wrap; }
      .empty { padding: 10px 12px; color: #a1a1aa; }
      .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); pointer-events: none;
        background: #1f2937; color: #fff; font-size: 13.5px; padding: 10px 16px; border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,.3); max-width: 70vw; }
      .toast.warn { background: #7f1d1d; }
    </style>
    <div class="badges"></div>
    <div class="panel" hidden></div>`;
  (document.body || document.documentElement).appendChild(host);
  const badgeLayer = root.querySelector(".badges");
  const panel = root.querySelector(".panel");

  let toastTimer;
  function toast(msg, warn) {
    let t = root.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; root.appendChild(t); }
    t.className = "toast" + (warn ? " warn" : "");
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), warn ? 4500 : 2600);
  }

  const hasHL = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
  function setActive(item) {
    if (!hasHL) return;
    if (item && item.range) CSS.highlights.set("cm-active", new Highlight(item.range));
    else CSS.highlights.delete("cm-active");
  }

  function sizeText(m) { return `${cmFmt(cmUnitValue(m, S.unit))} ${unitShort()}`; }
  function isOver(m) { return S.limitAmount > 0 && cmUnitValue(m, S.unit) > S.limitAmount; }
  function totals() {
    const t = { chars: 0, words: 0, tokens: 0 };
    items.forEach((it) => { t.chars += it.m.chars; t.words += it.m.words; t.tokens += it.m.tokens; });
    return t;
  }

  // ---- Highlights, badges, panel
  let applying = false;
  async function applyHighlights() {
    if (applying) return;
    applying = true;
    try {
      document.querySelectorAll(".cm-marked").forEach((el) => el.classList.remove("cm-marked"));
      if (hasHL) ["cm-all", "cm-over"].forEach((k) => CSS.highlights.delete(k));
      const markers = await getMarkers();
      const msgs = getMessages();
      items = resolve(markers, msgs).map((r) => {
        const el = r.idx >= 0 ? msgs[r.idx].el : null;
        let range = null;
        if (el) {
          if (r.excerpt) range = findRange(el, r.excerpt);
          else { range = document.createRange(); range.selectNodeContents(el); }
        }
        const text = r.excerpt || (el ? textOf(el) : "");
        return { ...r, el, range, text, m: cmMeasure(text) };
      });
      items.sort((a, b) => (a.idx - b.idx) ||
        (a.range && b.range ? a.range.compareBoundaryPoints(Range.START_TO_START, b.range) : 0));
      items.forEach((it, i) => { it.n = i + 1; if (it.el) it.el.classList.add("cm-marked"); });
      if (hasHL) {
        const normal = items.filter((i) => i.range && !isOver(i.m)).map((i) => i.range);
        const over = items.filter((i) => i.range && isOver(i.m)).map((i) => i.range);
        if (normal.length) CSS.highlights.set("cm-all", new Highlight(...normal));
        if (over.length) CSS.highlights.set("cm-over", new Highlight(...over));
      }
      renderPanel();
      placeBadges();
    } finally {
      applying = false;
    }
  }

  function placeBadges() {
    badgeLayer.textContent = "";
    if (!S.showBadges) return;
    const vh = window.innerHeight;
    for (const it of items) {
      if (!it.range) continue;
      const rect = it.range.getClientRects()[0];
      if (!rect || rect.bottom < 0 || rect.top > vh) continue;
      const b = document.createElement("div");
      b.className = "badge" + (isOver(it.m) ? " over" : "");
      b.style.setProperty("--c", S.color);
      b.style.left = Math.max(4, rect.left) + "px";
      b.style.top = Math.max(16, rect.top - 2) + "px";
      b.textContent = `#${it.n} · ${sizeText(it.m)}` + (isOver(it.m) ? " ⚠" : "");
      b.title = `${it.m.words} words · ${it.m.chars} characters · ≈${it.m.tokens} tokens` +
        (it.note ? `\nNote: ${it.note}` : "") + "\nClick to show in the marker panel";
      b.onmouseenter = () => setActive(it);
      b.onmouseleave = () => setActive(null);
      b.onclick = () => { panelOpen = true; renderPanel(); };
      badgeLayer.appendChild(b);
    }
  }

  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; placeBadges(); }); };
  document.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderPanel() {
    panel.style.setProperty("--c", S.color);
    panel.hidden = panelHidden === true ||
      (panelHidden !== false && (!S.showPanel || (!items.length && !panelOpen)));
    panel.textContent = "";
    const t = totals();
    const tv = cmUnitValue(t, S.unit);
    const over = S.convoBudget > 0 && tv > S.convoBudget;

    const pill = el("div", "pill");
    pill.append(el("span", "dot"),
      el("span", null, `${items.length} marker${items.length === 1 ? "" : "s"} · ${cmFmt(tv)} ${unitShort()}` +
        (S.convoBudget > 0 ? ` / ${cmFmt(S.convoBudget)}` : "") + (over ? " ⚠" : "")),
      el("span", null, panelOpen ? "▾" : "▴"));
    pill.onclick = () => { panelOpen = !panelOpen; renderPanel(); };
    panel.appendChild(pill);
    if (!panelOpen) return;

    const body = el("div", "body");
    if (S.convoBudget > 0) {
      const bar = el("div", "bar" + (over ? " over" : ""));
      const fill = el("i");
      fill.style.width = Math.min(100, (tv / S.convoBudget) * 100) + "%";
      bar.appendChild(fill);
      body.appendChild(bar);
    }
    body.appendChild(el("div", "sum",
      `Total marked: ${t.words} words · ${t.chars} chars · ≈${t.tokens} tokens` +
      (S.convoBudget > 0 ? ` — budget ${S.convoBudget} ${cmUnitLabel(S.unit)}` : "")));

    const list = el("div", "list");
    if (!items.length) list.appendChild(el("div", "empty", "No markers yet. Right-click a message → TExporT Markers → Mark this point."));
    for (const it of items) {
      const row = el("div", "row" + (isOver(it.m) ? " over" : ""));
      const rh = el("div", "rh");
      rh.append(el("span", "num", `#${it.n}`), el("span", "scope", it.scope || (it.excerpt ? "selection" : "message")),
        el("span", "size", `${it.m.words} w · ≈${it.m.tokens} tok`));
      row.appendChild(rh);
      if (!it.range) row.appendChild(el("div", "pv missing", "Not found on the page right now (scroll it into view, or the text changed)."));
      else row.appendChild(el("div", "pv", it.text.slice(0, 220)));
      if (it.note) row.appendChild(el("div", "note", it.note));
      const acts = el("div", "acts");
      const go = el("button", null, "Show");
      go.onclick = (e) => { e.stopPropagation(); jump(it); };
      const nt = el("button", null, it.note ? "Edit note" : "Add note");
      nt.onclick = async (e) => {
        e.stopPropagation();
        const v = prompt("Note for this marker (why it matters):", it.note || "");
        if (v === null) return;
        await updateMarker(it.id, { note: v.trim() });
      };
      const del = el("button", null, "Delete");
      del.onclick = async (e) => { e.stopPropagation(); await setMarkers((await getMarkers()).filter((m) => m.id !== it.id)); };
      acts.append(go, nt, del);
      row.appendChild(acts);
      row.onmouseenter = () => setActive(it);
      row.onmouseleave = () => setActive(null);
      row.onclick = () => jump(it);
      list.appendChild(row);
    }
    body.appendChild(list);

    const foot = el("div", "foot");
    const add = el("button", null, "Add to collection…");
    add.onclick = () => capture();
    const settings = el("button", null, "Settings");
    settings.onclick = () => B.runtime.sendMessage({ cmd: "open-options" });
    const hide = el("button", null, "Hide panel");
    hide.onclick = () => { panelHidden = true; renderPanel(); toast("Panel hidden — right-click → TExporT Markers → Show marker panel to bring it back."); };
    foot.append(add, settings, hide);
    body.appendChild(foot);
    panel.appendChild(body);
  }

  function jump(it) {
    if (!it.range) { toast("That marker isn't on the page right now.", true); return; }
    const node = it.range.startContainer.nodeType === 1 ? it.range.startContainer : it.range.startContainer.parentElement;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setActive(it);
    setTimeout(() => setActive(null), 1600);
  }

  async function updateMarker(id, patch) {
    const list = await getMarkers();
    const m = list.find((x) => x.id === id);
    if (m) { Object.assign(m, patch); await setMarkers(list); }
  }

  // ---- Track what was right-clicked
  let lastTarget = null, lastSelection = "", lastAnchor = null;
  document.addEventListener("contextmenu", (e) => {
    lastTarget = e.target;
    const sel = window.getSelection();
    lastSelection = sel ? sel.toString() : "";
    lastAnchor = sel && sel.rangeCount ? sel.anchorNode : null;
  }, true);

  // ---- Commands
  async function mark(withNote, selectionText, fromKeyboard) {
    S = await cmGetSettings();
    if (fromKeyboard) {
      const sel = window.getSelection();
      lastSelection = sel ? sel.toString() : "";
      lastAnchor = sel && sel.rangeCount ? sel.anchorNode : null;
      lastTarget = lastAnchor;
      if (!lastSelection.trim()) { toast("Select some text first, then press the shortcut."); return; }
    }
    const msgs = getMessages();
    let idx = indexOfNode(msgs, lastTarget);
    if (idx < 0) idx = indexOfNode(msgs, lastAnchor);
    if (idx < 0) { toast("Couldn't tell which message that is — right-click directly on the message text.", true); return; }
    const msgEl = msgs[idx].el;

    let excerpt = (lastSelection || selectionText || "").trim();
    let scope = excerpt ? "selection" : "message";
    if (!excerpt && S.defaultScope === "paragraph") {
      const p = paragraphOf(lastTarget, msgEl);
      if (p && textOf(p)) { excerpt = textOf(p); scope = "paragraph"; }
    }
    let text = excerpt || textOf(msgEl);
    let m = cmMeasure(text);
    const warnings = [];

    if (S.limitAmount > 0 && cmUnitValue(m, S.unit) > S.limitAmount) {
      const what = `${cmFmt(cmUnitValue(m, S.unit))} ${cmUnitLabel(S.unit)} (limit ${S.limitAmount})`;
      if (S.limitMode === "block") { toast(`Not marked: this is ${what}. Select a smaller part.`, true); return; }
      if (S.limitMode === "trim") {
        excerpt = cmTrim(text, S.limitAmount, S.unit);
        text = excerpt; m = cmMeasure(text); scope += " · trimmed";
        warnings.push(`trimmed to the first ${S.limitAmount} ${cmUnitLabel(S.unit)}`);
      } else warnings.push(`over your per-marker limit: ${what}`);
    }

    const list = await getMarkers();
    if (S.convoBudget > 0) {
      const used = items.reduce((s, it) => s + cmUnitValue(it.m, S.unit), 0);
      const after = used + cmUnitValue(m, S.unit);
      if (after > S.convoBudget) {
        const what = `${cmFmt(after)} / ${cmFmt(S.convoBudget)} ${cmUnitLabel(S.unit)}`;
        if (S.convoBudgetMode === "block") { toast(`Not marked: conversation budget would be ${what}.`, true); return; }
        warnings.push(`conversation budget exceeded: ${what}`);
      }
    }

    let note = "";
    if (withNote || S.askNote) {
      const n = prompt(`Note for this marker (${sizeText(m)}) — why it matters:`, "");
      if (n === null) return;
      note = n.trim();
    }
    list.push({
      id: uid(), msgIndex: idx, role: msgs[idx].role, prefix: textOf(msgEl).slice(0, PREFIX_LEN),
      excerpt, scope, note, created: new Date().toISOString()
    });
    await setMarkers(list);
    await applyHighlights();
    const head = `Marked ${scope}: ${m.words} words · ≈${m.tokens} tokens`;
    toast(warnings.length ? `${head} — ⚠ ${warnings.join("; ")}` : head, warnings.length > 0);
  }

  async function unmark() {
    const msgs = getMessages();
    let idx = indexOfNode(msgs, lastTarget);
    if (idx < 0) idx = indexOfNode(msgs, lastAnchor);
    if (idx < 0) { toast("Right-click on a marked message to remove its markers."); return; }
    const list = await getMarkers();
    const resolved = resolve(list, msgs);
    const keep = list.filter((_, i) => resolved[i].idx !== idx);
    const removed = list.length - keep.length;
    if (!removed) { toast("No markers on this message."); return; }
    await setMarkers(keep);
    toast(`Removed ${removed} marker(s).`);
  }

  async function clearAll() {
    const list = await getMarkers();
    if (!list.length) { toast("No markers in this conversation."); return; }
    if (!confirm(`Remove all ${list.length} markers from this conversation?`)) return;
    await setMarkers([]);
    toast("All markers cleared.");
  }

  async function capture() {
    S = await cmGetSettings();
    const r = await B.storage.local.get("collections");
    const cols = r.collections || {};
    const entries = Object.entries(cols).sort((a, b) => a[1].created.localeCompare(b[1].created));
    let promptText = "Add this conversation to which collection (one collection = one PDF)?\n\n";
    entries.forEach(([, c], i) => { promptText += `${i + 1}. ${c.name}  (${c.convos.length} convo${c.convos.length === 1 ? "" : "s"})\n`; });
    promptText += entries.length ? "\nType a number, or type a new name to start a new collection:" : "Name for the new collection:";
    const ans = prompt(promptText, entries.length ? "1" : "My collection");
    if (ans === null || !ans.trim()) return;

    let colId, col;
    const num = parseInt(ans.trim(), 10);
    if (String(num) === ans.trim() && num >= 1 && num <= entries.length) [colId, col] = entries[num - 1];
    else { colId = uid(); col = { name: ans.trim(), created: new Date().toISOString(), convos: [] }; }

    await applyHighlights();
    const msgs = getMessages();
    const convo = {
      key: convoKey(), url: location.href,
      title: document.title.replace(/\s*[-|–]\s*(Claude|ChatGPT|Gemini)\s*$/i, "").trim() || site.name + " conversation",
      site: site.name, capturedAt: new Date().toISOString(),
      messages: msgs.map((m) => ({ role: m.role, text: textOf(m.el) })),
      markers: items.map(({ id, idx, excerpt, note, scope }) => ({ id, idx, excerpt, note, scope }))
    };
    const existing = col.convos.findIndex((c) => c.key === convo.key);
    if (existing >= 0) col.convos[existing] = convo; else col.convos.push(convo);
    cols[colId] = col;
    await B.storage.local.set({ collections: cols });

    let colTotal = 0;
    for (const c of col.convos) for (const mk of c.markers) {
      const t = mk.excerpt || (c.messages[mk.idx] || {}).text || "";
      colTotal += cmUnitValue(cmMeasure(t), S.unit);
    }
    const base = `${existing >= 0 ? "Updated" : "Added"} in "${col.name}": ${convo.messages.length} messages, ${convo.markers.length} markers. ` +
      `Collection total: ${cmFmt(colTotal)} ${cmUnitLabel(S.unit)}`;
    if (S.collectionBudget > 0 && colTotal > S.collectionBudget) toast(`${base} — ⚠ over your ${S.collectionBudget} budget`, true);
    else toast(base + (S.collectionBudget > 0 ? ` / ${S.collectionBudget}` : ""));
  }

  B.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const r = handle(msg);
    if (r && typeof r.then === "function") {
      r.then(sendResponse, () => sendResponse(undefined));
      return true;                 // reply comes later (works in Chrome and Firefox)
    }
    return false;
  });

  function handle(msg) {
    switch (msg.cmd) {
      case "cm-mark": return mark(false, msg.selection);
      case "cm-mark-note": return mark(true, msg.selection);
      case "cm-mark-key": return mark(false, "", true);
      case "cm-unmark": return unmark();
      case "cm-clear": return clearAll();
      case "cm-capture": return capture();
      case "cm-toggle-panel":
        panelHidden = !panel.hidden;
        if (!panelHidden) panelOpen = true;
        renderPanel();
        return Promise.resolve(true);
      case "cm-count": {
        const t = totals();
        return Promise.resolve({ count: items.length, key: convoKey(), total: cmUnitValue(t, S.unit), unit: S.unit, budget: S.convoBudget });
      }
    }
  }

  B.storage.onChanged.addListener(async (changes) => {
    if (changes.settings) { S = await cmGetSettings(); applyPageStyle(); applyHighlights(); }
    else if (changes.markers) applyHighlights();
  });

  let debounce;
  new MutationObserver((muts) => {
    if (muts.every((m) => host.contains(m.target) || m.target === host)) return;
    clearTimeout(debounce);
    debounce = setTimeout(applyHighlights, 800);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  cmGetSettings().then((s) => { S = s; applyPageStyle(); applyHighlights(); });
})();
