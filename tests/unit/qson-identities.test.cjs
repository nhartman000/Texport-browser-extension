const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js');
const gate=id=>P.json({g8son_version:'1.0',file_id:id,gates:[{gate_id:id,type:'AND',conditions:['condition']}]});
const unit=timestamp=>P.createUnit({unit_id:'source',state:{gst_version:'1.0',state_id:'ctx',internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Authoring',outcome_expectation:'Unevaluated',constraints:{}},gateFiles:{'gates/source.g8son':gate('source')},timestamp});
const events=async b=>{const u=await P.readUnit(b);return P.parseJSON(u.members[u.manifest.trace]).events;};
test('distinct real authoring events do not reuse trace identities across exports or import forks',async()=>{
 const t='2026-01-01T00:00:00Z',a=await unit(t),b=await unit('2026-01-02T00:00:00Z');
 assert.notEqual((await events(a))[0].trace_id,(await events(b))[0].trace_id);
 const x=await P.addGates(a,[{name:'x.g8son',bytes:gate('x')}],t),y=await P.addGates(a,[{name:'y.g8son',bytes:gate('y')}],t);
 assert.deepEqual((await events(x))[0],(await events(a))[0]);assert.notEqual((await events(x))[1].trace_id,(await events(y))[1].trace_id);
});
