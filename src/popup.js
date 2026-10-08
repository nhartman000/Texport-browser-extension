const B = browser;
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  kids.forEach((k) => k != null && e.append(k));
  return e;
};

function collectionSize(c, unit) {
  let n = 0;
  for (const cv of c.convos) for (const mk of cv.markers) {
    n += cmUnitValue(cmMeasure(mk.excerpt || (cv.messages[mk.idx] || {}).text || ""), unit);
  }
  return n;
}

function bar(value, budget) {
  if (!budget) return null;
  const over = value > budget;
  return el("div", { className: "bar" + (over ? " over" : "") },
    el("i", { style: `width:${Math.min(100, (value / budget) * 100)}%` }));
}

async function render() {
  const S = await cmGetSettings();
  document.documentElement.style.setProperty("--c", S.color);
  const u = cmUnitLabel(S.unit, true);
  const here = document.getElementById("here");
  here.textContent = "";
  const [tab] = await B.tabs.query({ active: true, currentWindow: true });
  let info = null;
  try { info = await B.tabs.sendMessage(tab.id, { cmd: "cm-count" }); } catch (_) {}
  if (info) {
    here.append(
      el("div", { className: "big", textContent: `${info.count} marker${info.count === 1 ? "" : "s"} · ${cmFmt(info.total)} ${u}` +
        (info.budget ? ` of ${cmFmt(info.budget)}` : "") + (info.budget && info.total > info.budget ? " ⚠" : "") }),
      bar(info.total, info.budget),
      el("div", { className: "actions" },
        el("button", { className: "primary", textContent: "Add to collection…", onclick: () => { B.tabs.sendMessage(tab.id, { cmd: "cm-capture" }); window.close(); } }),
        el("button", { textContent: "Marker panel", onclick: () => { B.tabs.sendMessage(tab.id, { cmd: "cm-toggle-panel" }); window.close(); } }),
        el("button", { className: "danger", textContent: "Clear", onclick: async () => { await B.tabs.sendMessage(tab.id, { cmd: "cm-clear" }); window.close(); } })),
      el("div", { className: "muted small", textContent: "Right-click a message → TExporT Markers → Mark this point. Select text first to mark only that part (or Alt+Shift+M)." })
    );
  } else {
    here.append(el("div", { className: "muted", textContent: "Open a Claude, ChatGPT or Gemini conversation to mark it." }));
  }

  const { collections = {} } = await B.storage.local.get("collections");
  const box = document.getElementById("cols");
  box.textContent = "";
  const entries = Object.entries(collections).sort((a, b) => b[1].created.localeCompare(a[1].created));
  if (!entries.length) box.append(el("div", { className: "muted", textContent: "None yet." }));
  for (const [id, c] of entries) {
    const marks = c.convos.reduce((s, cv) => s + cv.markers.length, 0);
    const size = collectionSize(c, S.unit);
    box.append(el("div", { className: "row" },
      el("div", { className: "name" }, el("div", { textContent: c.name }),
        el("div", { className: "sub", textContent: `${c.convos.length} convo${c.convos.length === 1 ? "" : "s"} · ${marks} marker${marks === 1 ? "" : "s"} · ${cmFmt(size)} ${u}` +
          (S.collectionBudget && size > S.collectionBudget ? " ⚠" : "") }),
        bar(size, S.collectionBudget)),
      el("button", { textContent: "Export", onclick: () => B.tabs.create({ url: B.runtime.getURL("export.html?c=" + encodeURIComponent(id)) }) }),
      el("button", { className: "danger", textContent: "✕", title: "Delete collection", onclick: async () => {
        if (!confirm(`Delete collection "${c.name}"?`)) return;
        delete collections[id];
        await B.storage.local.set({ collections });
        render();
      } })));
  }
}
document.getElementById("settings").onclick = () => { B.runtime.openOptionsPage(); window.close(); };
render();
