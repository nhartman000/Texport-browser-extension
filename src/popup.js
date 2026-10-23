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
  const HOSTS = ["*://claude.ai/*", "*://chatgpt.com/*", "*://chat.openai.com/*", "*://gemini.google.com/*"];
  const onChatSite = /^https?:\/\/([^/]*\.)?(claude\.ai|chatgpt\.com|chat\.openai\.com|gemini\.google\.com)\//.test(tab.url || "");
  let allowed = true;
  try { allowed = await B.permissions.contains({ origins: HOSTS }); } catch (_) {}
  if (!allowed) {
    // Firefox (especially on Android) leaves site access off until you allow it: nothing works without it.
    here.append(el("div", { className: "warn" },
      el("div", { className: "big", textContent: "TExporT needs access to the chat sites" }),
      el("div", { className: "muted", textContent: "Without it, TExporT can't read or mark conversations on Claude, ChatGPT or Gemini." }),
      el("button", { className: "primary open", textContent: "Allow access", onclick: async () => {
        const ok = await B.permissions.request({ origins: HOSTS }).catch(() => false);
        if (ok && onChatSite) B.tabs.reload(tab.id);
        render();
      } })));
  }
  if (info) {
    here.append(
      el("div", { className: "big", textContent: `${info.count} marker${info.count === 1 ? "" : "s"} · ${cmFmt(info.total)} ${u}` +
        (info.budget ? ` of ${cmFmt(info.budget)}` : "") + (info.budget && info.total > info.budget ? " ⚠" : "") }),
      bar(info.total, info.budget),
      el("button", { className: "primary open", textContent: "✎ Open marker window", onclick: () => {
        B.tabs.create({ url: B.runtime.getURL("marker.html?tab=" + tab.id) }); window.close();
      } }),
      el("div", { className: "muted small", textContent: "The marker window lists this conversation with big tap targets: tap a paragraph to mark it, or select words and tap ★ Mark selection. Best on phones." }),
      el("div", { className: "actions" },
        el("button", { textContent: "Add whole chat to collection…", onclick: () => { B.tabs.sendMessage(tab.id, { cmd: "cm-capture" }); window.close(); } }),
        el("button", { textContent: "Marker panel", onclick: () => { B.tabs.sendMessage(tab.id, { cmd: "cm-toggle-panel" }); window.close(); } }),
        el("button", { className: "danger", textContent: "Clear", onclick: async () => { await B.tabs.sendMessage(tab.id, { cmd: "cm-clear" }); window.close(); } })),
      el("div", { className: "muted small", textContent: "On the page: right-click a message → TExporT Markers, or tap ✎ Mark on the chip (bottom-right), or select text and tap ★ Mark." })
    );
  } else {
    // Any page (a Google AI answer, an article, a chat site that loaded before the extension):
    // clicking here grants TExporT this one tab (activeTab), injects it, and opens the marker window.
    const err = el("div", { className: "muted small" });
    here.append(
      el("button", { className: "primary open", textContent: "✎ Mark this page", onclick: async () => {
        try {
          await B.scripting.executeScript({ target: { tabId: tab.id }, files: ["settings.js", "content.js"] });
        } catch (e) {
          err.textContent = "This page can't be marked (browser pages, new tabs and add-on stores are off-limits to every extension).";
          return;
        }
        B.tabs.create({ url: B.runtime.getURL("marker.html?tab=" + tab.id) });
        window.close();
      } }),
      el("div", { className: "muted small", textContent: onChatSite
        ? "TExporT isn't running in this tab yet. Tap above to start it here, or reload the page."
        : "Works on any page: search results, AI answers, articles. The page opens in the marker window, where you tap paragraphs or select words to mark them." }),
      err);
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
