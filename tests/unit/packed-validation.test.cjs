const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js');
const g={g8son_version:'1.0',file_id:'f',gates:[{gate_id:'g',type:'AND',conditions:['literal']}]};
const unit=()=>P.createUnit({unit_id:'id',state:{gst_version:'1.0',state_id:'ctx',internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Authoring',outcome_expectation:'Unevaluated',constraints:{}},gateFiles:{'gates/one.g8son':P.json(g)},timestamp:'2026-01-01T00:00:00Z'});
test('writers reject non-finite state instead of silently converting unknown values to null',async()=>{
 await assert.rejects(P.createUnit({unit_id:'id',state:{gst_version:'1.0',state_id:'c',internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Authoring',outcome_expectation:'Unevaluated',constraints:{},globals:{limit:Infinity}},gateFiles:{'gates/one.g8son':P.json(g)}}),/finite/i);
});
test('units are reproducible for identical authoring snapshot including review timestamp',async()=>assert.deepEqual(await unit(),await unit()));
test('packed readers fail closed on profile, integrity set, missing resources, duplicate identities and unsupported flows',async()=>{
 const a=await unit();
 for(const change of [m=>{const c=P.parseJSON(m['container.json']);c.profile='future/2';m['container.json']=P.json(c);},m=>{const c=P.parseJSON(m['container.json']);delete c.integrity['flow.ork'];m['container.json']=P.json(c);},m=>m['extra.txt']=P.bytes('unlisted')]){
 const m=P.zipRead(a);change(m);await assert.rejects(P.readUnit(P.zipWrite(m)));
 }
 for(const change of [m=>delete m['state/context.gst'],m=>m['flow.ork']=P.json({ork_profile:'execute-arbitrary',flow:['g']}),m=>{m['gates/two.g8son']=P.json(g);const a=P.parseJSON(m['manifest.json']);a.gates.push('gates/two.g8son');m['manifest.json']=P.json(a);},m=>{const a=P.parseJSON(m['manifest.json']);a.state=['../external.gst'];m['manifest.json']=P.json(a);}]){
 const m=P.zipRead(a);change(m);await assert.rejects(P.readUnit(await P.pack(m,'unit')));
 }
});
test('G8SON shape rejects empty/oversized gates, empty identities, noncanonical fields and condition types',()=>{
 for(const change of [g=>g.gates=[],g=>g.gates=Array(4).fill(g.gates[0]),g=>g.file_id='',g=>g.gates[0].gate_id='',g=>g.extra='x',g=>g.gates[0].conditions=[42],g=>g.gates[0].conditions=[],g=>g.gates[0].order=0,g=>g.gates[0].outcomes={MAYBE:'go'}]){const c=structuredClone(g);change(c);assert.throws(()=>P.validateGate(c));}
});
