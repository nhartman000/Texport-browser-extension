const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js');
const make=()=>P.createUnit({unit_id:'u',state:{gst_version:'1.0',state_id:'c',internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Authoring',outcome_expectation:'Unevaluated',constraints:{}},gateFiles:{'gates/g.g8son':P.json({g8son_version:'1.0',file_id:'f',gates:[{gate_id:'g',type:'AND',conditions:['x']}]})}});
test('rejects unknown manifest/envelope fields and unsupported authoring flow extensions rather than dropping them',async()=>{
 const b=await make();
 for(const [path,field,value] of [['manifest.json','script','code'],['manifest.json','metadata',[]],['flow.ork','branches',['g']]]){
 const m=P.zipRead(b),a=P.parseJSON(m[path]);a[field]=value;m[path]=P.json(a);await assert.rejects(P.readUnit(await P.pack(m,'unit')));
 }
 const m=P.zipRead(b),c=P.parseJSON(m['container.json']);c.extra='unknown';m['container.json']=P.json(c);await assert.rejects(P.readUnit(P.zipWrite(m)));
 const pkg=await P.createPackage({package_id:'p',units:[{name:'u.mg8',bytes:b}]});
 for(const path of ['manifest.json','system.ork']){const p=P.zipRead(pkg,{packageMembers:true}),v=P.parseJSON(p[path]);v.extra='unknown';p[path]=P.json(v);await assert.rejects(P.readPackage(await P.pack(p,'package')));}
});
