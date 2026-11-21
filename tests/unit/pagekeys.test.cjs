// Page shortcut matching (Ctrl+M / Ctrl+Q).  Run: node --test tests/unit
const test = require("node:test");
const assert = require("node:assert/strict");
const { cmKeyMatches, CM_DEFAULTS } = require("../../src/settings.js");
const ev = (code, key, mods = {}) => ({ code, key, ctrlKey: !!mods.ctrl, altKey: !!mods.alt, shiftKey: !!mods.shift, metaKey: !!mods.meta });

test("defaults", () => {
  assert.equal(CM_DEFAULTS.markKey, "Ctrl+M");
  assert.equal(CM_DEFAULTS.collectKey, "Ctrl+Q");      // Node has no Firefox user agent
  assert.equal(CM_DEFAULTS.pageKeys, true);
});

test("exact modifiers and physical key", () => {
  assert.ok(cmKeyMatches(ev("KeyM", "m", { ctrl: true }), "Ctrl+M"));
  assert.ok(cmKeyMatches(ev("KeyM", "µ", { ctrl: true }), "ctrl + m"));            // layout-independent
  assert.ok(!cmKeyMatches(ev("KeyM", "M", { ctrl: true, shift: true }), "Ctrl+M"));  // extra modifier
  assert.ok(!cmKeyMatches(ev("KeyM", "m"), "Ctrl+M"));
  assert.ok(cmKeyMatches(ev("KeyQ", "q", { ctrl: true, alt: true }), "Ctrl+Alt+Q"));
  assert.ok(cmKeyMatches(ev("Digit1", "1", { alt: true }), "Alt+1"));
  assert.ok(!cmKeyMatches(ev("KeyQ", "q", { ctrl: true }), ""));
});
