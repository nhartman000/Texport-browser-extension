const {test}=require('node:test');
const assert=require('node:assert/strict');
const P=require('../../src/packed.js');
const I=require('../../src/icm.js');
const input=require('../../examples/icm-input.json');

test('all resource and audit identifiers reject control characters and actor ID overflow',async()=>{
 const w=await I.workspace(input.collection,input.plan,{timestamp:input.timestamp});
 const original=w.units[0].bytes;
 for(const field of ['unit','state','file','gate','run','trace','package','actor','event_file','event_gate','input_state','output_state']){
  for(const control of ['\x00','\x1f','\x7f']){
   const u=await P.readUnit(original),m={...u.members},a=u.manifest,bad='bad'+control+'id';
   if(field==='package'){
    const b=await P.createPackage({package_id:'control-test',units:[{name:'one.mg8',bytes:original}]});
    const pkg=await P.readPackage(b);pkg.manifest.package_id=bad;pkg.members['manifest.json']=P.json(pkg.manifest);
    await assert.rejects(P.readPackage(await P.pack(pkg.members,'package')),undefined,field);continue;
   }
   if(field==='unit'){a.unit_id=bad;m['manifest.json']=P.json(a);}
   else if(field==='state'){const s=P.parseJSON(m[a.state[0]]);s.state_id=bad;m[a.state[0]]=P.json(s);}
   else if(field==='file'||field==='gate'){
    const g=P.parseJSON(m[a.gates[0]]);
    if(field==='file')g.file_id=bad;
    else{const old=g.gates[0].gate_id;g.gates[0].gate_id=bad;const f=P.parseJSON(m[a.entry]);f.flow=f.flow.map(x=>x===old?bad:x);m[a.entry]=P.json(f);}
    m[a.gates[0]]=P.json(g);
   }else{
    const q=P.parseJSON(m[a.trace]),e=q.events[0];
    if(field==='run'){q.run_id=bad;q.events.forEach(x=>x.run_id=bad);}
    else if(field==='trace')e.trace_id=bad;
    else if(field==='actor')e.actor.id=bad;
    else e[{event_file:'file_id',event_gate:'gate_id',input_state:'input_state_id',output_state:'output_state_id'}[field]]=bad;
    m[a.trace]=P.json(q);
   }
   await assert.rejects(P.readUnit(await P.pack(m,'unit')),undefined,field+' '+JSON.stringify(control));
  }
 }
 const u=await P.readUnit(original),q=P.parseJSON(u.members[u.manifest.trace]);q.events[0].actor.id='a'.repeat(201);
 u.members[u.manifest.trace]=P.json(q);await assert.rejects(P.readUnit(await P.pack(u.members,'unit')));
});
