// Checks the manifest template and every file it references.  Run: node --test tests/unit
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const m = JSON.parse(fs.readFileSync(path.join(root, "manifest.base.json"), "utf8"));
const src = (p) => path.join(root, "src", p);

test("MV3 manifest with a semver version", () => {
  assert.equal(m.manifest_version, 3);
  assert.match(m.version, /^\d+\.\d+\.\d+$/);
  assert.ok(m.description.length <= 132, "Chrome Web Store limit: 132 chars");
});

test("every referenced file exists", () => {
  const files = [...Object.values(m.icons), ...Object.values(m.action.default_icon), m.action.default_popup,
                 m.options_ui.page, ...m.content_scripts.flatMap((c) => c.js), "background.js", "export.html"];
  for (const f of files) assert.ok(fs.existsSync(src(f)), f);
});

test("content scripts only run on the declared hosts", () => {
  const hosts = new Set(m.host_permissions);
  for (const cs of m.content_scripts) for (const p of cs.matches) assert.ok(hosts.has(p), p);
});

test("permissions are the minimal set", () => {
  assert.deepEqual([...m.permissions].sort(), ["contextMenus", "scripting", "storage"]);
});
