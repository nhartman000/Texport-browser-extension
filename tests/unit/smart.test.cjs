// Smart Marker matching.  Run: node --test tests/unit
const test = require("node:test");
const assert = require("node:assert/strict");
const { SMART_TAG, smartPrompt, findAnswer, smartMessageIndexes, parseAnswer, locateQuote, findQuote } = require("../../src/smart.js");

const convo = [
  { role: "user", text: "Lay out the gates for the release." },
  { role: "assistant", text: "Here's the plan.\nGate 1 runs **build.py --strict** and passes only if the exit code is 0.\nGate 2 needs exactly 3 entries in output.json.\nGate 3 publishes only when the tag matches v1.2.0." },
  { role: "user", text: smartPrompt() },
  { role: "assistant", text: "Here are the key points:\nTEXPORT-BEGIN\nQUOTE: Gate 1 runs build.py --strict and passes only if the exit code is 0. | WHY: exit condition\n- QUOTE: “Gate 2 needs exactly 3 entries in output.json.” | WHY: data contract\nQUOTE: Gate 3 publishes only when the tag matches v1.2.0 | WHY: release rule\nQUOTE: something that was never said in this chat | WHY: hallucination\nTEXPORT-END" }
];

test("the prompt carries the tag and the exact output format", () => {
  const p = smartPrompt(5);
  assert.ok(p.startsWith(SMART_TAG));
  assert.match(p, /Up to 5 points/);
  assert.match(p, /TEXPORT-BEGIN\nQUOTE: .* \| WHY: .*\n/);
});

test("finds the answer, not the request (which also mentions the format)", () => {
  assert.equal(findAnswer(convo), 3);
  assert.equal(findAnswer(convo.slice(0, 3)), -1);
  assert.deepEqual([...smartMessageIndexes(convo)].sort(), [2, 3]);
});

test("parses quotes and reasons, tolerating bullets and curly quotes", () => {
  const pts = parseAnswer(convo[3].text);
  assert.equal(pts.length, 4);
  assert.deepEqual(pts[1], { quote: "Gate 2 needs exactly 3 entries in output.json.", why: "data contract" });
});

test("locates quotes despite markdown, case, spacing and a missing final period", () => {
  const t = convo[1].text;
  const [s, e] = locateQuote(t, "gate 1 runs build.py --strict and passes only if the exit code is 0.");
  assert.equal(t.slice(s, e), "Gate 1 runs **build.py --strict** and passes only if the exit code is 0.");
  const [s3, e3] = locateQuote(t, "Gate 3 publishes only when the tag matches v1.2.0");
  assert.equal(t.slice(s3, e3), "Gate 3 publishes only when the tag matches v1.2.0");
  assert.equal(locateQuote(t, "something that was never said in this chat"), null);
});

test("findQuote skips the request and answer messages", () => {
  const skip = smartMessageIndexes(convo);
  const hits = parseAnswer(convo[3].text).map((p) => findQuote(convo, p.quote, skip));
  assert.deepEqual(hits.map((h) => h && h.mi), [1, 1, 1, null]);
});
