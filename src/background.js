if (!globalThis.browser && typeof chrome !== "undefined") globalThis.browser = chrome;   // Chrome (service worker)
const menus = browser.menus || browser.contextMenus;

const PATTERNS = [
  "*://claude.ai/*",
  "*://chatgpt.com/*",
  "*://chat.openai.com/*",
  "*://gemini.google.com/*"
];
const CTX = ["page", "selection", "link", "image"];

function setupMenus() {
  menus.removeAll().then(() => {
    menus.create({ id: "cm-root", title: "TExporT Markers", contexts: CTX, documentUrlPatterns: PATTERNS });
    const items = [
      ["cm-mark", "Mark this point"],
      ["cm-mark-note", "Mark this point with a note…"],
      ["cm-unmark", "Remove marker(s) on this message"],
      ["sep1", null],
      ["cm-toggle-panel", "Show / hide marker panel"],
      ["cm-capture", "Add this conversation to a collection…"],
      ["cm-clear", "Clear all markers in this conversation"],
      ["sep2", null],
      ["cm-open", "Open collections"],
      ["cm-options", "Settings…"]
    ];
    for (const [id, title] of items) {
      if (title === null) menus.create({ id, parentId: "cm-root", type: "separator", contexts: CTX, documentUrlPatterns: PATTERNS });
      else menus.create({ id, parentId: "cm-root", title, contexts: CTX, documentUrlPatterns: PATTERNS });
    }
  });
}

browser.runtime.onInstalled.addListener(setupMenus);
browser.runtime.onStartup.addListener(setupMenus);
setupMenus();

async function send(tabId, msg, frameId) {
  try {
    return await browser.tabs.sendMessage(tabId, msg, { frameId: frameId || 0 });
  } catch (_) {
    // Content script missing (tab opened before install) — inject and retry once.
    await browser.scripting.executeScript({ target: { tabId, frameIds: [frameId || 0] }, files: ["settings.js", "content.js"] });
    return browser.tabs.sendMessage(tabId, msg);
  }
}

menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "cm-open") return browser.tabs.create({ url: browser.runtime.getURL("export.html") });
  if (info.menuItemId === "cm-options") return browser.runtime.openOptionsPage();
  send(tab.id, { cmd: info.menuItemId, selection: info.selectionText || "" }, info.frameId);
});

browser.commands.onCommand.addListener(async (command) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !PATTERNS.some((p) => new RegExp("^" + p.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$").test(tab.url || ""))) return;
  if (command === "mark-selection") send(tab.id, { cmd: "cm-mark-key" });
  if (command === "toggle-panel") send(tab.id, { cmd: "cm-toggle-panel" });
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg && msg.cmd === "open-options") browser.runtime.openOptionsPage();
});
