const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js');
const gate=id=>P.json({g8son_version:'1.0',file_id:'file-'+id,gates:[{gate_id:id,type:'AND',conditions:['bounded source condition']}]});
const unit=id=>P.createUnit({unit_id:id,state:{gst_version:'1.0',state_id:id,internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Authoring',outcome_expectation:'Unevaluated',constraints:{}},gateFiles:{'gates/base.g8son':gate('gate-'+id)},timestamp:'2026-01-01T00:00:00Z'});
test('multiple gate additions preserve original bytes and events, reject collisions atomically',async()=>{
 assert.equal(typeof P.addGates,'function');const a=await unit('one'),before=await P.readUnit(a);
 const additions=[{name:'x.g8son',bytes:gate('x')},{name:'y.g8son',bytes:gate('y')}];
 const b=await P.addGates(a,additions,'2026-01-02T00:00:00Z'),after=await P.readUnit(b);
 assert.deepEqual(after.members['gates/base.g8son'],before.members['gates/base.g8son']);
 assert.deepEqual(after.members['state/context.gst'],before.members['state/context.gst']);
 assert.deepEqual(after.members['gates/x.g8son'],additions[0].bytes);
 assert.deepEqual(P.parseJSON(after.members['trace/execution.qson']).events.slice(0,1),P.parseJSON(before.members['trace/execution.qson']).events);
 assert.deepEqual(P.parseJSON(after.members['flow.ork']).flow,['gate-one','x','y']);
 await assert.rejects(P.addGates(a,[]));await assert.rejects(P.addGates(a,[{name:'x.g8son',bytes:gate('gate-one')}]));
 assert.deepEqual((await P.readUnit(a)).manifest.gates,['gates/base.g8son']);
});
test('4, 6, 8, 12 ordered units package without sorting, preserve bytes and bound topology',async()=>{
 assert.equal(typeof P.createPackage,'function');for(const n of [4,6,8,12]){
 const units=[];for(let i=n;i>0;i--)units.push({name:'unit-'+i+'.mg8',bytes:await unit('unit-'+i)});
 const b=await P.createPackage({package_id:'pack',units}),p=await P.readPackage(b);
 assert.deepEqual(p.manifest.units,units.map(x=>'units/'+x.name));
 assert.deepEqual(P.parseJSON(p.members['system.ork']).flow,p.manifest.units);
 assert.deepEqual(p.members[p.manifest.units[0]],units[0].bytes);
 }const a=await unit('same');await assert.rejects(P.createPackage({package_id:'p',units:[{name:'a.mg8',bytes:a},{name:'b.mg8',bytes:a}]}),/unit_id/);
});
