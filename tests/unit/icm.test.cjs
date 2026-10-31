const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js');let I={};try{I=require('../../src/icm.js');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const col={name:'Example',created:'2026-01-01',convos:[{key:'conversation-id',url:'https://example.invalid/chat',title:'Source',site:'fixture',capturedAt:'2026-01-01T00:00:00Z',messages:[{role:'user',text:'exact important condition'},{role:'assistant',text:'full unmarked context'}],markers:[{id:'original-id',idx:0,excerpt:'exact important condition',note:'retain me',scope:'selection'}]}]};
test('deterministic workspace preserves source snapshot, register and attribution; no invented gates',async()=>{
 assert.equal(typeof I.workspace,'function');const plan=I.directPlan(col),a=await I.workspace(col,plan,{timestamp:'2026-01-01T00:00:00Z'}),b=await I.workspace(col,plan,{timestamp:'2026-01-01T00:00:00Z'});
 assert.deepEqual(a.bytes,b.bytes);const m=P.zipRead(a.bytes);for(const p of ['README.md','AGENTS.md','CONTEXT.md','sources/compiled-markers.txt','sources/snapshot.json','sources/provenance.json','themes/uncategorized/M1.txt'])assert.ok(m[p],p);
 assert.deepEqual(P.parseJSON(m['sources/snapshot.json']),col);assert.match(P.text(m['themes/uncategorized/M1.txt']),/retain me/);assert.equal(Object.keys(m).some(p=>p.endsWith('.mg8')),false);
 assert.match(I.organizationPrompt(col),/untrusted/i);assert.match(I.organizationPrompt(col),/original-id/);
});
module.exports={col};
