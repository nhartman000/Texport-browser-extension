const {test}=require('node:test'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),P=require('../../src/packed.js');
test('accepts Python ZIP_STORED with ordinary Unix attributes and timestamp extras',()=>{
 const b=execFileSync('python3',['-c',`import io,zipfile,sys
b=io.BytesIO()
with zipfile.ZipFile(b,'w',compression=zipfile.ZIP_STORED) as z:
 i=zipfile.ZipInfo('state/context.gst');i.extra=bytes.fromhex('555405000100000000');i.external_attr=0o100644<<16;z.writestr(i,b'{}')
sys.stdout.buffer.write(b.getvalue())`]);
 assert.equal(P.text(P.zipRead(b)['state/context.gst']),'{}');
});
test('interop CLI inspects complete packed units from binary stdin',async()=>{
 const b=await P.createUnit({unit_id:'cli',state:{gst_version:'1.0',state_id:'cli',internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Authoring',outcome_expectation:'Unevaluated',constraints:{}},gateFiles:{'gates/a.g8son':P.json({g8son_version:'1.0',file_id:'a',gates:[{gate_id:'a',type:'AND',conditions:['test']}]})}});
 const out=JSON.parse(execFileSync(process.execPath,['tools/packed-cli.cjs','inspect','-'],{input:b}));assert.equal(out.manifest.unit_id,'cli');assert.ok(out.members.includes('flow.ork'));
});
test('interop CLI creates and inspects a workspace from stdin',()=>{
 const col={name:'CLI example',convos:[]};
 const b=execFileSync(process.execPath,['tools/packed-cli.cjs','workspace','-'],{input:JSON.stringify({collection:col})});
 assert.ok(P.zipRead(b)['sources/snapshot.json']);
});
