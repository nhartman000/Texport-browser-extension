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
