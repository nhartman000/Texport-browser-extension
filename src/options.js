const KEYS = Object.keys(CM_DEFAULTS);
const $ = (id) => document.getElementById(id);
let savedTimer;

function fill(s) {
  for (const k of KEYS) {
    const el = $(k);
    if (!el) continue;
    if (el.type === "checkbox") el.checked = !!s[k];
    else el.value = s[k];
  }
  document.querySelectorAll(".unitlbl").forEach((e) => (e.textContent = cmUnitLabel(s.unit)));
}

async function save() {
  const s = {};
  for (const k of KEYS) {
    const el = $(k);
    if (!el) continue;
    if (el.type === "checkbox") s[k] = el.checked;
    else if (el.type === "number") s[k] = Math.max(0, parseInt(el.value, 10) || 0);
    else s[k] = el.value;
  }
  await browser.storage.local.set({ settings: s });
  document.querySelectorAll(".unitlbl").forEach((e) => (e.textContent = cmUnitLabel(s.unit)));
  $("saved").textContent = "Saved ✓";
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => ($("saved").textContent = ""), 1500);
}

cmGetSettings().then(fill);
document.addEventListener("change", save);
document.addEventListener("input", (e) => { if (e.target.tagName === "TEXTAREA" || e.target.type === "color") save(); });
$("reset").onclick = async () => {
  await browser.storage.local.set({ settings: { ...CM_DEFAULTS } });
  fill(CM_DEFAULTS);
  $("saved").textContent = "Defaults restored ✓";
};

async function refreshShortcuts() {
  const list = $("shortcuts");
  list.textContent = "";
  try {
    const commands = await browser.commands.getAll();
    for (const command of commands) {
      const row = document.createElement("li");
      row.textContent = `${command.name} — ${command.description || command.name}: ${command.shortcut || "Unassigned — assign a shortcut in the browser editor"}`;
      list.appendChild(row);
    }
  } catch (_) {
    const row = document.createElement("li");
    row.textContent = "Shortcut assignments unavailable. Check the browser shortcut editor; suggested keys may be unassigned.";
    list.appendChild(row);
  }
}
$("editShortcuts").onclick = async () => {
  // Firefox has no supported direct shortcut-editor URL. Do not invent one.
  if (browser.runtime.getBrowserInfo) {
    $("shortcutHelp").textContent = "Firefox: open Add-ons and themes (Ctrl+Shift+A), choose Extensions, then ⚙ → Manage Extension Shortcuts. Assign or change the TExporT commands there.";
    $("shortcutHelp").setAttribute("role", "status");
    return;
  }
  try { await browser.tabs.create({ url: "chrome://extensions/shortcuts" }); }
  catch (_) { $("shortcutHelp").textContent = "Open chrome://extensions/shortcuts in a browser tab to assign or change shortcuts."; }
};
refreshShortcuts();
window.addEventListener("focus", refreshShortcuts);
