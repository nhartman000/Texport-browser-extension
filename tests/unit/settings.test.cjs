// Unit tests for the shared measuring helpers in src/settings.js.  Run: node --test tests/unit
const test = require("node:test");
const assert = require("node:assert/strict");
const { CM_DEFAULTS, cmMeasure, cmUnitValue, cmUnitLabel, cmFmt, cmTrim } = require("../../src/settings.js");

test("defaults are complete and sane", () => {
  for (const k of ["unit", "limitAmount", "limitMode", "convoBudget", "collectionBudget", "defaultScope",
                   "color", "showBadges", "showPanel", "registerPlacement", "exportContent", "exportCounts"])
    assert.ok(k in CM_DEFAULTS, k);
  assert.equal(CM_DEFAULTS.unit, "tokens");
  assert.equal(CM_DEFAULTS.limitAmount, 0);
});

test("cmMeasure counts characters, words and ≈tokens (chars / 4, rounded up)", () => {
  assert.deepEqual(cmMeasure("  one two  three "), { chars: 14, words: 3, tokens: 4 });
  assert.deepEqual(cmMeasure(""), { chars: 0, words: 0, tokens: 0 });
  assert.deepEqual(cmMeasure(null), { chars: 0, words: 0, tokens: 0 });
});

test("unit helpers", () => {
  const m = { chars: 40, words: 7, tokens: 10 };
  assert.equal(cmUnitValue(m, "words"), 7);
  assert.equal(cmUnitValue(m, "characters"), 40);
  assert.equal(cmUnitValue(m, "tokens"), 10);
  assert.equal(cmUnitLabel("tokens", true), "tok");
  assert.equal(cmUnitLabel("words"), "words");
  assert.equal(cmFmt(999), "999");
  assert.equal(cmFmt(1530), "1.5k");
  assert.equal(cmFmt(25400), "25k");
});

test("cmTrim cuts at a word boundary within the limit", () => {
  const t = "alpha beta gamma delta epsilon zeta eta theta";
  assert.equal(cmTrim(t, 3, "words"), "alpha beta gamma");
  const c = cmTrim(t, 20, "characters");
  assert.ok(c.length <= 20 && t.startsWith(c) && !c.endsWith(" "));
  assert.equal(cmTrim(t, 4, "tokens"), "alpha beta gamma");      // 16 chars
  assert.equal(cmTrim("short", 100, "tokens"), "short");
});
