const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../../src/packed.js');
const state=()=>({gst_version:'1.0',state_id:'s',internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Author reviewed conditions',outcome_expectation:'Unevaluated authoring snapshot',constraints:{}});
const gate=id=>P.json({g8son_version:'1.0',file_id:'file-'+id,gates:[{gate_id:id,type:'AND',conditions:['x']}]});
const make=()=>P.createUnit({unit_id:'u',state:state(),gateFiles:{'gates/a.g8son':gate('a'),'gates/b.g8son':gate('b')}});
async function edit(b,path,fn){const m=P.zipRead(b);m[path]=P.json(fn(P.parseJSON(m[path])));return P.pack(m,'unit');}
test('QSON validates canonical ledger, bindings, contiguous sequence and optional field types',async()=>{
 const b=await make();
 const invalid=[q=>q.run_id=123,q=>q.run_id='r'.repeat(201),q=>q.events[0].trace_id='t'.repeat(201),q=>q.events[0].actor.id='a'.repeat(4097),q=>q.extra=true,q=>q.metadata=[],q=>q.qson_version='2',q=>q.events={},q=>q.events[0].run_id='other',q=>q.events[0].sequence=2,q=>q.events[0].actor={type:42,id:[]},q=>q.events[0].actor.type='',q=>q.events[0].trace_id='',q=>q.events[0].result='PWNED',q=>q.events[0].reason={},q=>q.events[0].file_id=1,q=>q.events[0].gate_id=null,q=>q.events[0].input_state_id=[],q=>q.events[0].output_state_id=1,q=>q.events[0].action=[],q=>q.events[0].operation=false,q=>q.events[0].metadata=[],q=>q.events[0].references=['a','a'],q=>q.events[0].references=[1],q=>q.events[0].previous_event_hash=1,q=>q.events[0].event_hash={},q=>q.events[0].timestamp={},...['2026-01-01','2026-01-01T00:00:00','2026-02-30T00:00:00Z','2026-01-01T24:00:00Z','0000-01-01T00:00:00Z'].map(t=>q=>q.events[0].timestamp=t),q=>q.events.push({...q.events[0],sequence:2})];
 for(const change of invalid)await assert.rejects(P.readUnit(await edit(b,'trace/execution.qson',q=>{change(q);return q;})),/QSON|profile|metadata/,String(change));
 for(const timestamp of ['2026-01-01T00:00:00Z','2026-01-01T12:34:56.123+05:30'])await P.readUnit(await edit(b,'trace/execution.qson',q=>{Object.assign(q.events[0],{timestamp,result:'INTERMEDIATE',action:{},operation:null,output_state_id:null,references:['x'],reason:'',metadata:{},evidence:[1],signature:null,custom:true});return q;}));
});
test('unit and package reject unlisted execution resources and nested archives',async()=>{
 const b=await make();
 for(const name of ['gates/extra.g8son','hidden.mg8','nested.mg8pk','nested.zip','extra.gst','extra.ork','extra.qson']){
  const m=P.zipRead(b);m[name]=name.endsWith('.g8son')?gate('extra'):b;
  await assert.rejects(P.readUnit(await P.pack(m,'unit')),/Unlisted|Nested/);
 }
 const p=await P.createPackage({package_id:'p',units:[{name:'u.mg8',bytes:b}]});
 for(const name of ['units/extra.mg8','extra.g8son','extra.gst','extra.ork','extra.qson','nested.mg8pk','nested.zip']){
  const m=P.zipRead(p,{packageMembers:true});m[name]=b;
  await assert.rejects(P.readPackage(await P.pack(m,'package')),/Unlisted|Nested/);
 }
});
test('reviewed gate flow may permute definitions; import preserves order and appends chosen order',async()=>{
 const b=await edit(await make(),'flow.ork',f=>({...f,flow:['b','a']}));
 await P.readUnit(b);
 const u=await P.readUnit(await P.addGates(b,[{name:'z.g8son',bytes:gate('z')},{name:'c.g8son',bytes:gate('c')}]));
 assert.deepEqual(P.parseJSON(u.members[u.manifest.entry]).flow,['b','a','z','c']);
 for(const flow of [['a','a'],['b'],['b','a','c']])await assert.rejects(P.readUnit(await edit(b,'flow.ork',f=>({...f,flow}))),/flow/);
});
test('ZIP rejects DOS directories and unsupported central/local extraction versions',()=>{
 for(const [kind,version] of [['dos',16],['central',21],['local',21]]){
  const b=P.zipWrite({'a.txt':P.bytes('x')}),v=new DataView(b.buffer),central=v.getUint32(b.length-6,true);
  if(kind==='dos')v.setUint32(central+38,version,true);else v.setUint16(kind==='central'?central+6:4,version,true);
  assert.throws(()=>P.zipRead(b),/ZIP|header/);
 }
});
module.exports={state,gate,make,edit};
test('full canonical GST accepted; context_id-only and incomplete or mistyped GST rejected',async()=>{
 const b=await make();assert.equal(P.parseJSON((await P.readUnit(b)).members['state/context.gst']).state_id,'s');
 for(const s of [{gst_version:'1.0',context_id:123},{gst_version:'1.0',context_id:'c'},...['state_id','internal','external','continuity','intent','outcome_expectation','constraints'].map(k=>{const s=state();delete s[k];return s;}),{...state(),state_id:'s'.repeat(201)},{...state(),intent:'x'.repeat(4097)},{...state(),intent:' '},{...state(),state_id:12},{...state(),internal:{current:null}}]){
  await assert.rejects(P.readUnit(await edit(b,'state/context.gst',()=>s)),/GST/);
 }
});
