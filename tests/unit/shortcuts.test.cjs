const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');

test('exactly four native suggested shortcuts, no new permissions', () => {
  const manifest = JSON.parse(source('manifest.base.json'));
  assert.deepEqual(Object.fromEntries(Object.entries(manifest.commands).map(([n,c])=>[n,c.suggested_key.default])), {
    'mark-selection':'Alt+Shift+M', 'toggle-panel':'Alt+Shift+K',
    'toggle-mark-mode':'Alt+Shift+H', 'delete-marker':'Alt+Shift+U'
  });
  assert.deepEqual(manifest.permissions, ['activeTab','clipboardWrite','contextMenus','storage','scripting']);
});

test('native onCommand routes all commands only to allowed active current-window tab', async () => {
  let listener, tab = {id:7,url:'https://chatgpt.com/c/test'};
  const sent = [], queries = [];
  const event = {addListener(){}};
  const browser = {runtime:{onInstalled:event,onStartup:event,onMessage:event},
    tabs:{query:async q => {queries.push(q);return tab ? [tab] : [];}, sendMessage:async (...args)=>sent.push(args)},
    commands:{onCommand:{addListener:fn=>listener=fn}}};
  vm.runInNewContext(source('src/background.js'), {browser});
  for (const [name,cmd] of Object.entries({'mark-selection':'cm-mark-key','toggle-panel':'cm-toggle-panel','toggle-mark-mode':'cm-toggle-mark-mode','delete-marker':'cm-delete-marker'})) {
    sent.length=0; await listener(name);
    assert.equal(sent.length,1,name); assert.equal(sent[0][0],7); assert.equal(sent[0][1].cmd,cmd);
    assert.equal(JSON.stringify(queries.at(-1)),JSON.stringify({active:true,currentWindow:true}));
  }
  for (const url of ['https://chatgpt.com.evil.test/c/x','https://evil.test/','chrome://settings/', 'https://sub.chatgpt.com/c/x']) {
    tab={id:8,url}; sent.length=0; await listener('delete-marker'); assert.equal(sent.length,0,url);
  }
  tab=null; await listener('delete-marker'); assert.equal(sent.length,0);
});
