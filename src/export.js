// ---------- Pure document model (no DOM) ----------

const _measure = typeof cmMeasure !== "undefined" ? cmMeasure : require("./settings.js").cmMeasure;
const EXPORT_DEFAULTS = { placement: "both", content: "full", counts: true, extra: "" };

function locateExcerpt(text, excerpt) {
  if (!excerpt) return null;
  let i = text.indexOf(excerpt);
  if (i >= 0) return [i, i + excerpt.length];
  // Whitespace-tolerant fallback: match on collapsed whitespace, then map back.
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  const ne = norm(excerpt);
  if (ne.length < 4) return null;
  const map = [];
  let collapsed = "";
  for (let k = 0; k < text.length; k++) {
    const ch = /\s/.test(text[k]) ? " " : text[k];
    if (ch === " " && collapsed.endsWith(" ")) continue;
    map.push(k);
    collapsed += ch;
  }
  i = collapsed.indexOf(ne);
  if (i < 0) return null;
  return [map[i], map[i + ne.length - 1] + 1];
}

function buildDoc(col) {
  let n = 0;
  const register = [];
  const convos = col.convos.map((c, ci) => {
    const byMsg = {};
    const orphans = [];
    c.markers.forEach((m) => {
      if (m.idx >= 0 && m.idx < c.messages.length) (byMsg[m.idx] ||= []).push(m);
      else orphans.push(m);
    });

    const messages = c.messages.map((msg, mi) => {
      const ms = byMsg[mi] || [];
      const block = [];
      let inline = [];
      for (const m of ms) {
        const pos = locateExcerpt(msg.text, m.excerpt);
        if (pos) inline.push({ m, start: pos[0], end: pos[1] });
        else block.push(m);
      }
      inline.sort((a, b) => a.start - b.start);
      const kept = [];
      for (const it of inline) {
        if (kept.length && it.start < kept[kept.length - 1].end) block.push(it.m); // overlap → whole-message
        else kept.push(it);
      }
      inline = kept;

      for (const m of block) {
        m.n = ++n;
        register.push({ n: m.n, ci, mi, role: msg.role, convoTitle: c.title, note: m.note,
          text: m.excerpt || msg.text, scope: m.excerpt ? `${m.scope || "selection"} (not located inline)` : "whole message" });
      }
      const parts = [];
      let cursor = 0;
      for (const it of inline) {
        it.m.n = ++n;
        register.push({ n: it.m.n, ci, mi, role: msg.role, convoTitle: c.title, note: it.m.note,
          text: msg.text.slice(it.start, it.end), scope: it.m.scope || "selection" });
        if (it.start > cursor) parts.push({ t: msg.text.slice(cursor, it.start) });
        parts.push({ t: msg.text.slice(it.start, it.end), n: it.m.n, note: it.m.note });
        cursor = it.end;
      }
      if (cursor < msg.text.length || !parts.length) parts.push({ t: msg.text.slice(cursor) });
      return { role: msg.role, index: mi, block: block.map((m) => ({ n: m.n, note: m.note })), parts };
    });

    for (const m of orphans) {
      m.n = ++n;
      register.push({ n: m.n, ci, mi: -1, role: "?", convoTitle: c.title, note: m.note,
        text: m.excerpt || "(marked message could not be located when captured)", scope: "position not found" });
    }
    return { ...c, messages };
  });
  register.sort((a, b) => a.n - b.n);
  const size = { chars: 0, words: 0, tokens: 0 };
  for (const r of register) {
    r.m = _measure(r.text);
    size.chars += r.m.chars; size.words += r.m.words; size.tokens += r.m.tokens;
  }
  return { name: col.name, convos, register, total: n, size };
}

const tag = (n, which) => `[[MARK M${n} ${which}]]`;

function instructionsText(doc, opts = EXPORT_DEFAULTS) {
  const where = opts.placement === "both" ? "at the start and again at the end of this document"
    : opts.placement === "end" ? "at the end of this document" : "directly below";
  const scopeLine = opts.content === "marked"
    ? "\n• Only messages containing markers are included; unmarked messages were omitted by the compiler."
    : "";
  const extra = (opts.extra || "").trim() ? `\n\nAdditional instructions from the compiler:\n${opts.extra.trim()}` : "";
  return `READER INSTRUCTIONS — for any AI model processing this document

This document compiles ${doc.convos.length} AI conversation(s). The person who compiled it marked ${doc.total} passage(s) as critical.

• Every marked passage is wrapped inline between ${tag("n", "START")} and ${tag("n", "END")} (n = its ID).
• Every marked passage is also reproduced in full in the MARKED PASSAGES REGISTER ${where}.${scopeLine}

Requirements:
1. Read the entire document, not just the register.
2. Treat every marked passage as high priority. Do not drop, compress, or paraphrase away its specifics (numbers, names, definitions, decisions, code, wording).
3. When summarizing or answering, keep marked content verbatim where precision matters and cite it by ID (e.g. M3).
4. If a marked passage conflicts with other content, flag the conflict instead of silently resolving it.
5. Notes attached to a marker are the compiler's explanation of why it matters — follow them.
6. Before finishing any summary, confirm every ID M1–M${doc.total || 1} is accounted for.${extra}`;
}

function regHead(r, opts) {
  const pos = r.mi >= 0 ? `message ${r.mi + 1}, ${r.role}` : "position unknown";
  const size = opts.counts ? ` — ${r.m.words} words, ≈${r.m.tokens} tokens` : "";
  return `M${r.n} — Conversation ${r.ci + 1} ("${r.convoTitle}"), ${pos} — ${r.scope}${size}`;
}

function isMarked(m) { return m.block.length > 0 || m.parts.some((p) => p.n); }

function renderMarkdown(doc, opts = EXPORT_DEFAULTS) {
  opts = { ...EXPORT_DEFAULTS, ...opts };
  const L = [];
  L.push(`# ${doc.name}`, "",
    `Compiled ${new Date().toISOString().slice(0, 10)} · ${doc.convos.length} conversation(s) · ${doc.total} marker(s) · ` +
    `marked text: ${doc.size.words} words, ≈${doc.size.tokens} tokens`, "");
  L.push(instructionsText(doc, opts), "");
  const register = (label) => {
    L.push("---", "", `## ${label}`, "");
    if (!doc.register.length) L.push("(no markers)", "");
    for (const r of doc.register) {
      L.push(`### ${regHead(r, opts)}`);
      if (r.note) L.push(`Note: ${r.note}`);
      L.push(tag(r.n, "START"), r.text, tag(r.n, "END"), "");
    }
  };
  if (opts.placement !== "end") register("MARKED PASSAGES REGISTER");
  doc.convos.forEach((c, ci) => {
    L.push("---", "", `## CONVERSATION ${ci + 1}: ${c.title}`, `Source: ${c.site} · ${c.url} · captured ${c.capturedAt.slice(0, 16).replace("T", " ")}`, "");
    let skipped = 0;
    const flush = () => { if (skipped) { L.push(`[… ${skipped} unmarked message(s) omitted …]`, ""); skipped = 0; } };
    for (const m of c.messages) {
      if (opts.content === "marked" && !isMarked(m)) { skipped++; continue; }
      flush();
      L.push(`### ${m.role.toUpperCase()} (message ${m.index + 1})${isMarked(m) ? " ★ MARKED" : ""}`);
      for (const b of m.block) L.push(tag(b.n, "START") + (b.note ? ` Note: ${b.note}` : ""));
      L.push(m.parts.map((p) => (p.n ? `${tag(p.n, "START")}${p.note ? ` (Note: ${p.note}) ` : ""}${p.t}${tag(p.n, "END")}` : p.t)).join(""));
      for (const b of [...m.block].reverse()) L.push(tag(b.n, "END"));
      L.push("");
    }
    flush();
  });
  if (opts.placement !== "top") register(opts.placement === "both"
    ? "MARKED PASSAGES REGISTER (repeated — verify every ID before finishing)" : "MARKED PASSAGES REGISTER");
  return L.join("\n");
}

if (typeof module !== "undefined") module.exports = { buildDoc, renderMarkdown, locateExcerpt, instructionsText };

// ---------- Browser page ----------

if (typeof browser !== "undefined" && typeof document !== "undefined") {
  const B = browser;
  const app = document.getElementById("app");
  const h = (tag, props = {}, ...kids) => {
    const e = Object.assign(document.createElement(tag), props);
    kids.flat().forEach((k) => k != null && e.append(k));
    return e;
  };
  const params = new URLSearchParams(location.search);
  const colId = params.get("c");
  const safeName = (s) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "collection";

  function download(name, text, type) {
    const a = h("a", { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
  }

  async function load() {
    const { collections = {} } = await B.storage.local.get("collections");
    app.textContent = "";
    if (!colId || !collections[colId]) {
      document.title = "TExporT Markers — collections";
      const entries = Object.entries(collections).sort((a, b) => b[1].created.localeCompare(a[1].created));
      app.append(h("h1", { textContent: "Collections" }),
        h("div", { className: "picker" }, entries.length
          ? entries.map(([id, c]) => h("a", { href: "?c=" + encodeURIComponent(id), textContent: `${c.name} — ${c.convos.length} conversation(s)` }))
          : h("p", { textContent: "No collections yet. Right-click a conversation → TExporT Markers → Add this conversation to a collection." })));
      return;
    }
    const col = collections[colId];
    const S = await cmGetSettings();
    const opts = { placement: S.registerPlacement, content: S.exportContent, counts: S.exportCounts, extra: S.extraInstructions };
    const doc = buildDoc(JSON.parse(JSON.stringify(col)));
    document.title = col.name;
    document.documentElement.style.setProperty("--mark-edge", S.color);
    const status = h("span", { className: "status" });
    const sizeVal = cmUnitValue(doc.size, S.unit);
    const overBudget = S.collectionBudget > 0 && sizeVal > S.collectionBudget;

    const save = async () => {
      try {
        const r = await B.tabs.saveAsPDF({ toFileName: safeName(col.name) + ".pdf", shrinkToFit: true, showBackgroundColors: true });
        status.textContent = r === "saved" || r === "replaced" ? "PDF saved." : "PDF not saved (" + r + ").";
      } catch (e) {
        status.textContent = "Direct PDF save unavailable — use Print → Save to PDF.";
      }
    };

    app.append(h("div", { className: "toolbar" },
      h("button", { className: "primary", textContent: "Save as PDF", onclick: save }),
      h("button", { textContent: "Print…", onclick: () => window.print() }),
      h("button", { textContent: "Download Markdown", onclick: () => download(safeName(col.name) + ".md", renderMarkdown(doc, opts), "text/markdown") }),
      h("button", { textContent: "Rename", onclick: async () => {
        const n = prompt("Collection name:", col.name);
        if (n && n.trim()) { collections[colId].name = n.trim(); await B.storage.local.set({ collections }); load(); }
      } }),
      h("button", { textContent: "Export settings", onclick: () => B.runtime.openOptionsPage() }),
      h("button", { textContent: "All collections", onclick: () => { location.search = ""; } }),
      status));

    if (overBudget) {
      app.append(h("div", { className: "budget-warn", textContent:
        `⚠ Marked text is ${cmFmt(sizeVal)} ${cmUnitLabel(S.unit)} — over your collection budget of ${cmFmt(S.collectionBudget)}. ` +
        `Consider trimming markers before handing this to a model.` }));
    }

    app.append(
      h("h1", { textContent: col.name }),
      h("div", { className: "meta", textContent: `Compiled ${new Date().toLocaleString()} · ${doc.convos.length} conversation(s) · ${doc.total} marker(s) · ` +
        `marked text: ${doc.size.words} words, ≈${doc.size.tokens} tokens` + (S.collectionBudget > 0 ? ` (budget ${cmFmt(S.collectionBudget)} ${cmUnitLabel(S.unit)})` : "") }),
      h("div", { className: "instructions", textContent: instructionsText(doc, opts) }));

    const register = (label) => {
      app.append(h("h2", { textContent: label }));
      if (!doc.register.length) app.append(h("p", { textContent: "(no markers)" }));
      for (const r of doc.register) {
        const over = S.limitAmount > 0 && cmUnitValue(r.m, S.unit) > S.limitAmount;
        app.append(h("div", { className: "reg-item" + (over ? " over" : "") },
          h("div", { className: "reg-head", textContent: regHead(r, opts) + (over ? `  ⚠ over ${S.limitAmount} ${cmUnitLabel(S.unit)} limit` : "") }),
          r.note ? h("div", { className: "note", textContent: "Note: " + r.note }) : null,
          h("div", { className: "delim", textContent: tag(r.n, "START") }),
          h("div", { className: "text", textContent: r.text }),
          h("div", { className: "delim", textContent: tag(r.n, "END") })));
      }
    };
    if (opts.placement !== "end") register("MARKED PASSAGES REGISTER");

    doc.convos.forEach((c, ci) => {
      const sec = h("section", { className: "convo" },
        h("h2", {}, `CONVERSATION ${ci + 1}: ${c.title}`,
          h("button", { className: "rm", textContent: "remove from collection", onclick: async () => {
            if (!confirm(`Remove "${c.title}" from this collection?`)) return;
            collections[colId].convos.splice(ci, 1);
            await B.storage.local.set({ collections }); load();
          } })),
        h("div", { className: "meta", textContent: `Source: ${c.site} · ${c.url} · captured ${new Date(c.capturedAt).toLocaleString()}` }));
      let skipped = 0;
      const flush = () => { if (skipped) { sec.append(h("div", { className: "omitted", textContent: `[… ${skipped} unmarked message(s) omitted …]` })); skipped = 0; } };
      for (const m of c.messages) {
        const marked = isMarked(m);
        if (opts.content === "marked" && !marked) { skipped++; continue; }
        flush();
        const body = h("div", { className: "text" }, m.parts.map((p) => p.n
          ? h("mark", {}, h("span", { className: "delim", textContent: tag(p.n, "START") + (p.note ? ` (Note: ${p.note}) ` : "") }), p.t, h("span", { className: "delim", textContent: tag(p.n, "END") }))
          : p.t));
        sec.append(h("div", { className: "msg" + (marked ? " marked" : "") },
          h("div", { className: "role", textContent: `${m.role} — message ${m.index + 1}${marked ? " ★ MARKED" : ""}` }),
          m.block.map((b) => h("div", { className: "delim", textContent: tag(b.n, "START") + (b.note ? `  Note: ${b.note}` : "") })),
          body,
          [...m.block].reverse().map((b) => h("div", { className: "delim", textContent: tag(b.n, "END") }))));
      }
      flush();
      app.append(sec);
    });
    if (opts.placement !== "top") register(opts.placement === "both"
      ? "MARKED PASSAGES REGISTER (repeated — verify every ID before finishing)" : "MARKED PASSAGES REGISTER");
  }
  load();
}
