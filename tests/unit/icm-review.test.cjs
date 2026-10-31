const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js'),I=require('../../src/icm.js');
const col={name:'Example',convos:[{key:'key',url:'https://example.invalid',title:'T',site:'offline',capturedAt:'2026-01-01T00:00:00Z',messages:[{role:'user',text:'Keep value under 10'}],markers:[{id:'original',idx:0,note:'strict gate',scope:'message'}]}]};
test('reviewed conditions split 4 gates into two files and preserve complete state inside real MG8',async()=>{
 assert.equal(typeof I.validatePlan,'function');const p=I.directPlan(col);p.groups[0].conditions=Array.from({length:4},(_,i)=>({text:'Keep value under '+(10-i),source_marker_ids:['M1']}));
 const out=await I.workspace(col,p,{timestamp:'2026-01-01T00:00:00Z'});assert.equal(out.units.length,1);const u=await P.readUnit(out.units[0].bytes);assert.equal(u.manifest.gates.length,2);
 for(const path of u.manifest.gates)assert.ok(P.parseJSON(u.members[path]).gates.length<=3);
 const state=P.parseJSON(u.members[u.manifest.state[0]]);assert.deepEqual(state.source_snapshot,col);assert.equal(state.sources[0].marker_id,'original');assert.equal(state.globals.gestalt,null);assert.equal(typeof state.state_id,'string');assert.deepEqual(state.internal,{prior:null,current:null});assert.deepEqual(state.external,{prior:null,current:null});assert.ok(state.intent.trim());assert.ok(state.outcome_expectation.trim());assert.deepEqual(state.continuity,{});assert.deepEqual(state.constraints,{});assert.equal(state.context_id,undefined);
});
test('proposals reject missing/duplicate/unknown IDs, paths, foreign conditions, unsupported payloads',()=>{
 assert.equal(typeof I.validatePlan,'function');const cases=[p=>p.groups[0].marker_ids=[],p=>p.groups[0].marker_ids.push('M1'),p=>p.groups[0].marker_ids.push('M99'),p=>p.groups[0].name='../escape',p=>p.code='eval',p=>p.groups[0].conditions=[{text:'made up',source_marker_ids:['M2']}],p=>p.groups[0].conditions=[{text:'bad',source_marker_ids:[],path:'x'}],p=>p.variables={x:{code:'anything'}}];
 for(const change of cases){const p=I.directPlan(col);change(p);assert.throws(()=>I.validatePlan(col,p));}
});
