const {test}=require('node:test');
const assert=require('node:assert/strict');
const gate=(id='one')=>({g8son_version:'1.0',file_id:'file-'+id,gates:[{gate_id:id,type:'AND',conditions:['source condition'],outcomes:{PASS:'continue',FAIL:'stop',INTERMEDIATE:'review'}}]});
let P={}; try { P=require('../../src/packed.js'); } catch(e) { if(e.code!=='MODULE_NOT_FOUND') throw e; }
test('STORE ZIP round trips binary bytes, deterministically; rejects traversal and corruption',()=>{
 assert.equal(typeof P.zipWrite,'function');
 const members={'hello.txt':new TextEncoder().encode('héllo'),'bin.dat':Uint8Array.of(0,255)};
 const a=P.zipWrite(members); assert.deepEqual(a,P.zipWrite(members));
 assert.deepEqual(P.zipRead(a),members);
 assert.throws(()=>P.zipWrite({'../bad':Uint8Array.of(1)}));
 const bad=a.slice(); bad[40]^=1; assert.throws(()=>P.zipRead(bad));
});

test('unit archives validate integrity, canonical review and source state',async()=>{
 assert.equal(typeof P.createUnit,'function');
 const a=await P.createUnit({unit_id:'unit-one',state:{gst_version:'1.0',state_id:'ctx',internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Authoring',outcome_expectation:'Unevaluated',constraints:{},globals:{gestalt:null,variables:{}},sources:[{text:'literal'}]},gateFiles:{'gates/one.g8son':P.json(gate())},timestamp:'2026-01-01T00:00:00Z'});
 const u=await P.readUnit(a);assert.equal(u.manifest.unit_id,'unit-one');
 const q=P.parseJSON(u.members[u.manifest.trace]);assert.equal(q.events[0].event_type,'review');assert.equal(q.events[0].actor.type,'human');assert.equal(q.events[0].result,undefined);
 const m=P.zipRead(a);m['state/context.gst']=P.json({changed:true});await assert.rejects(P.readUnit(P.zipWrite(m)),/integrity/i);
 assert.throws(()=>P.parseJSON('{"a":1,"a":2}'),/duplicate/i);
});
