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

const { serializeCollection, parseCollectionFile } = require("../../src/export.js");

test("collection files round-trip (.texport.json, shared with TExporT for Android)", () => {
  const col = collection();
  const back = parseCollectionFile(serializeCollection(col));
  assert.equal(back.name, col.name);
  assert.equal(back.convos[0].messages.length, 3);
  assert.deepEqual(back.convos[0].markers.map((m) => m.idx), [1, 0, 9]);
  assert.equal(buildDoc(back).total, 3);
});

test("Android snippet collections render: each snippet is a fully marked message", () => {
  const file = JSON.stringify({ format: "texport.collection", version: 1, app: "TExporT for Android", collection: {
    name: "Phone snippets", created: "2026-10-11T09:00:00Z",
    convos: [{ key: "android:claude", title: "From Claude app", site: "Android", url: "", capturedAt: "2026-10-11T09:00:00Z",
      messages: [{ role: "excerpt", text: "Gate 3 publishes only on tag v1.2.0." }],
      markers: [{ id: "a1", idx: 0, excerpt: "", note: "release rule", scope: "selection" }] }] } });
  const md = renderMarkdown(buildDoc(parseCollectionFile(file)));
  assert.match(md, /\[\[MARK M1 START\]\] Note: release rule\nGate 3 publishes only on tag v1\.2\.0\.\n\[\[MARK M1 END\]\]/);
});

test("parseCollectionFile rejects other files and sanitizes fields", () => {
  assert.throws(() => parseCollectionFile("not json"), /not valid JSON/);
  assert.throws(() => parseCollectionFile('{"format":"other"}'), /Not a TExporT collection/);
  assert.throws(() => parseCollectionFile('{"format":"texport.collection","version":2,"collection":{"convos":[]}}'), /update TExporT/);
  const c = parseCollectionFile('{"format":"texport.collection","version":1,"collection":{"convos":[{"messages":[{"text":5}],"markers":[{"idx":"x"}]}]}}');
  assert.equal(c.name, "Imported collection");
  assert.equal(c.convos[0].messages[0].text, "");
  assert.equal(c.convos[0].markers[0].idx, -1);
});
