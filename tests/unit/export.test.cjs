// Unit tests for the export document model in src/export.js.  Run: node --test tests/unit
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildDoc, renderMarkdown, locateExcerpt } = require("../../src/export.js");

const collection = () => ({
  name: "Release pipeline",
  convos: [{
    key: "https://claude.ai/chat/1", url: "https://claude.ai/chat/1", title: "Gate plan", site: "Claude",
    capturedAt: "2026-10-07T06:00:00.000Z",
    messages: [
      { role: "user", text: "Lay out the gates." },
      { role: "assistant", text: "Gate 1 runs build.py.\nGate 2 checks output.json has 3 entries.\nDone." },
      { role: "user", text: "Thanks." }
    ],
    markers: [
      { id: "a", idx: 1, excerpt: "Gate 2 checks output.json has 3 entries.", note: "exit condition", scope: "selection" },
      { id: "b", idx: 0, excerpt: "", note: "", scope: "message" },
      { id: "c", idx: 9, excerpt: "lost", note: "", scope: "selection" }
    ]
  }]
});

test("locateExcerpt finds exact and whitespace-tolerant matches", () => {
  assert.deepEqual(locateExcerpt("abc def ghi", "def"), [4, 7]);
  const text = "Gate 1 runs\n  build.py now";
  const [s, e] = locateExcerpt(text, "Gate 1 runs build.py");
  assert.equal(text.slice(s, e), "Gate 1 runs\n  build.py");
  assert.equal(locateExcerpt("abc", "zzzz"), null);
  assert.equal(locateExcerpt("abc", ""), null);
});

test("buildDoc numbers every marker once, in document order, including orphans", () => {
  const doc = buildDoc(collection());
  assert.equal(doc.total, 3);
  assert.deepEqual(doc.register.map((r) => r.n), [1, 2, 3]);
  assert.equal(doc.register[0].scope, "whole message");          // message 1 (user) marked whole
  assert.equal(doc.register[1].text, "Gate 2 checks output.json has 3 entries.");
  assert.equal(doc.register[2].scope, "position not found");      // idx 9 doesn't exist
  assert.ok(doc.size.words > 0 && doc.size.tokens > 0);
});

test("renderMarkdown wraps marks inline and repeats the register", () => {
  const md = renderMarkdown(buildDoc(collection()));
  assert.match(md, /READER INSTRUCTIONS/);
  assert.match(md, /\[\[MARK M2 START\]\] \(Note: exit condition\) Gate 2 checks output\.json has 3 entries\.\[\[MARK M2 END\]\]/);
  assert.equal(md.match(/## MARKED PASSAGES REGISTER/g).length, 2);           // placement "both"
  assert.match(md, /confirm every ID M1–M3/);
});

test("export options: register at end only, marked messages only, no counts", () => {
  const md = renderMarkdown(buildDoc(collection()), { placement: "end", content: "marked", counts: false, extra: "Answer in French." });
  assert.equal(md.match(/## MARKED PASSAGES REGISTER/g).length, 1);
  assert.ok(md.indexOf("## CONVERSATION 1") < md.indexOf("## MARKED PASSAGES REGISTER"));
  assert.match(md, /\[… 1 unmarked message\(s\) omitted …\]/);
  assert.doesNotMatch(md, /— \d+ words, ≈\d+ tokens/);
  assert.match(md, /Additional instructions from the compiler:\nAnswer in French\./);
});
