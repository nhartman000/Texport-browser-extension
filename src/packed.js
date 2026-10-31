/* TEXporT packed authoring profile. Data only: no evaluation, extraction or network. */
(function(root){
'use strict';
const enc=new TextEncoder(), dec=new TextDecoder('utf-8',{fatal:true});
const MAX=16*1024*1024, MEMBER=1024*1024;
const fail=s=>{throw new Error(s);};
const bytes=v=>typeof v==='string'?enc.encode(v):new Uint8Array(v);
const text=v=>dec.decode(v);
const json=v=>enc.encode(JSON.stringify(v,(_k,value)=>{if(typeof value==='number'&&!Number.isFinite(value))fail('JSON numbers must be finite');return value;},2)+'\n');
function safePath(s){
 if(typeof s!=='string'||!s||s.length>240||! /^[A-Za-z0-9_-][A-Za-z0-9_./-]*$/.test(s)||s.split('/').some(p=>!p||p==='.'||p==='..')) fail('Unsafe member path');
 return s;
}
function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function zipWrite(members){
 const names=Object.keys(members), seen=new Set(); if(!names.length||names.length>128)fail('Member count limit');
 let pos=0;const local=[],central=[];
 for(const name of names){safePath(name);const key=name.toLowerCase();if(seen.has(key))fail('Duplicate member');seen.add(key);
  const n=enc.encode(name),b=bytes(members[name]); if(b.length>MAX)fail('Member size limit');
  const c=crc32(b), l=new Uint8Array(30+n.length+b.length),v=new DataView(l.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,33,true);v.setUint32(14,c,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,n.length,true);l.set(n,30);l.set(b,30+n.length);local.push(l);
  const d=new Uint8Array(46+n.length),w=new DataView(d.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint16(14,33,true);w.setUint32(16,c,true);w.setUint32(20,b.length,true);w.setUint32(24,b.length,true);w.setUint16(28,n.length,true);w.setUint32(42,pos,true);d.set(n,46);central.push(d);pos+=l.length;
 }
 const cd=central.reduce((s,b)=>s+b.length,0), out=new Uint8Array(pos+cd+22);if(out.length>MAX)fail('Archive size limit');
 let at=0;for(const b of [...local,...central]){out.set(b,at);at+=b.length;}
 const e=new DataView(out.buffer,at);e.setUint32(0,0x06054b50,true);e.setUint16(8,names.length,true);e.setUint16(10,names.length,true);e.setUint32(12,cd,true);e.setUint32(16,pos,true);return out;
}
function zipRead(input,{packageMembers=false}={}){
 const b=bytes(input),v=new DataView(b.buffer,b.byteOffset,b.byteLength),u16=o=>v.getUint16(o,true),u32=o=>v.getUint32(o,true);
 if(b.length<22||b.length>MAX)fail('Archive size limit');
 const end=b.length-22;if(u32(end)!==0x06054b50||u16(end+4)||u16(end+6)||u16(end+20))fail('Unsupported ZIP trailer');
 const count=u16(end+10),start=u32(end+16),size=u32(end+12);
 if(!count||count>128||u16(end+8)!==count||start+size!==end)fail('Invalid ZIP directory');
 const extras=(offset,length)=>{const end=offset+length;if(end>b.length)fail('Invalid ZIP extras');while(offset<end){if(offset+4>end)fail('Invalid ZIP extras');const tag=u16(offset),n=u16(offset+2);if(tag===1)fail('ZIP64 unsupported');offset+=4+n;if(offset>end)fail('Invalid ZIP extras');}};
 const out={},seen=new Set();let at=start,next=0,total=0;
 for(let i=0;i<count;i++){
  if(at+46>end||u32(at)!==0x02014b50)fail('Invalid central header');
  const flags=u16(at+8),method=u16(at+10),crc=u32(at+16),sz=u32(at+24),nl=u16(at+28),ex=u16(at+30),co=u16(at+32),off=u32(at+42);
  if(u16(at+6)>20||(u32(at+38)&0x10)||flags&~0x800||method||u32(at+20)!==sz||u16(at+34)||(u32(at+38)>>>16&0xf000)!==0&&(u32(at+38)>>>16&0xf000)!==0x8000||at+46+nl+ex+co>end)fail('Unsupported ZIP entry');
  const name=safePath(text(b.slice(at+46,at+46+nl))),key=name.toLowerCase();
  if(seen.has(key))fail('Duplicate member');seen.add(key);
  const limit=packageMembers&&/^units\/[^/]+\.mg8$/.test(name)?MAX:MEMBER;
  total+=sz;if(sz>limit||total>MAX)fail('Decoded size limit');
  if(off!==next||off+30>start||u32(off)!==0x04034b50||u16(off+4)>20||u16(off+6)!==flags||u16(off+8)!==method||u32(off+14)!==crc||u32(off+18)!==sz||u32(off+22)!==sz||u16(off+26)!==nl)fail('Local header mismatch');
  const data=off+30+nl+u16(off+28);if(data+sz>start||text(b.slice(off+30,off+30+nl))!==name)fail('Invalid local entry');
  extras(at+46+nl,ex);extras(off+30+nl,u16(off+28));
  const content=b.slice(data,data+sz);if(crc32(content)!==crc)fail('CRC mismatch');Object.defineProperty(out,name,{value:content,enumerable:true,writable:true,configurable:true});next=data+sz;at+=46+nl+ex+co;
 }
 if(at!==end||next!==start)fail('Unlisted ZIP data');return out;
}
// Parse JSON ourselves to reject duplicate decoded keys before JSON.parse can discard them.
function parseJSON(input){
 const s=typeof input==='string'?input:text(input);if(enc.encode(s).length>MEMBER)fail('JSON size limit');
 let i=0,depth=0;const ws=()=>{while(/\s/.test(s[i]||'')&&i<s.length)i++;};
 const str=()=>{const start=i++;while(i<s.length){if(s[i]==='\\'){i+=2;continue;}if(s[i++]==='"')return JSON.parse(s.slice(start,i));}fail('Invalid JSON string');};
 function value(){ws();if(++depth>64)fail('JSON depth limit');const ch=s[i];
  if(ch==='{'){i++;ws();const seen=new Set();if(s[i]!=='}')while(true){ws();if(s[i]!=='"')fail('Invalid JSON key');const k=str();if(seen.has(k))fail('Duplicate JSON key');seen.add(k);ws();if(s[i++]!==':')fail('Invalid JSON');value();ws();if(s[i]!==',')break;i++;}if(s[i++]!=='}')fail('Invalid JSON');}
  else if(ch==='['){i++;ws();if(s[i]!==']')while(true){value();ws();if(s[i]!==',')break;i++;}if(s[i++]!==']')fail('Invalid JSON');}
  else if(ch==='"')str();else {const m=s.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);if(!m)fail('Invalid JSON');if(!['true','false','null'].includes(m[0])&&!Number.isFinite(Number(m[0])))fail('JSON numbers must be finite');i+=m[0].length;}depth--;
 }
 value();ws();if(i!==s.length)fail('Invalid JSON suffix');return JSON.parse(s);
}
const id=s=>{if(typeof s!=='string'||!s.trim()||[...s].length>200||/[\x00-\x1f\x7f-\x9f]/.test(s))fail('Invalid ID');return s;};
function validateGate(g){
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(!object(g)||g.g8son_version!=='1.0'||!Array.isArray(g.gates)||g.gates.length<1||g.gates.length>3)fail('G8SON requires 1..3 gates');id(g.file_id);
 if(g.metadata!==undefined&&!object(g.metadata))fail('Invalid G8SON metadata');
 if(Object.keys(g).some(k=>!['g8son_version','file_id','gates','metadata'].includes(k)))fail('Unsupported G8SON field');
 const seen=new Set();for(const a of g.gates){id(a.gate_id);id(a.type);if(seen.has(a.gate_id))fail('Duplicate gate_id');seen.add(a.gate_id);
 if(!Array.isArray(a.conditions)||!a.conditions.length||a.conditions.some(c=>!(typeof c==='string'&&c.trim())&&!(c&&typeof c==='object'&&!Array.isArray(c))))fail('Invalid gate conditions');
 if(a.order!==undefined&&(!Number.isInteger(a.order)||a.order<1))fail('Invalid gate order');
 if(a.metadata!==undefined&&!object(a.metadata))fail('Invalid gate metadata');
 if(a.outcomes!==undefined&&(!object(a.outcomes)||Object.entries(a.outcomes).some(([k,v])=>!['PASS','FAIL','INTERMEDIATE'].includes(k)||!(v===null||typeof v==='string'||object(v)))))fail('Invalid outcomes');
 }return g;
}
async function sha256(b){const crypto=globalThis.crypto||(typeof require!=='undefined'?require('node:crypto').webcrypto:null);return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(b))),x=>x.toString(16).padStart(2,'0')).join('');}
async function pack(members,kind){
 const m={...members};delete m['container.json'];const integrity={};for(const [p,b] of Object.entries(m))integrity[p]=await sha256(b);
 m['container.json']=json({profile:kind==='unit'?'mg8-packed/1.0':'mg8pk-packed/1.0',kind,manifest:'manifest.json',integrity});return zipWrite(m);
}
function fields(o,allowed){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!allowed.includes(k)))fail('Unsupported profile fields');if(o.metadata!==undefined&&(!o.metadata||typeof o.metadata!=='object'||Array.isArray(o.metadata)))fail('Invalid metadata');}
async function unpack(b,kind){
 const m=zipRead(b,{packageMembers:kind==='package'}),c=parseJSON(m['container.json']||fail('Missing container.json'));
 fields(c,['profile','kind','manifest','integrity']);
 if(c.profile!==(kind==='unit'?'mg8-packed/1.0':'mg8pk-packed/1.0')||c.kind!==kind||c.manifest!=='manifest.json'||!c.integrity||typeof c.integrity!=='object')fail('Unsupported packed profile');
 const paths=Object.keys(m).filter(p=>p!=='container.json');if(Object.keys(c.integrity).length!==paths.length||Object.hasOwn(c.integrity,'container.json'))fail('Integrity member set mismatch');
 for(const p of paths)if(c.integrity[p]!==await sha256(m[p]))fail('Integrity mismatch: '+p);
 return {members:m,manifest:parseJSON(m[c.manifest]||fail('Missing manifest'))};
}
function resource(m,p,ext){safePath(p);if(!p.endsWith(ext)||!Object.hasOwn(m,p))fail('Missing/invalid resource '+p);return parseJSON(m[p]);}
function gateIndex(m,paths){const files=new Set(),gates=new Set(),order=[];for(const p of paths){const g=validateGate(resource(m,p,'.g8son'));if(files.has(g.file_id))fail('Duplicate file_id');files.add(g.file_id);for(const a of g.gates){if(gates.has(a.gate_id))fail('Duplicate gate_id');gates.add(a.gate_id);order.push(a.gate_id);}}return order;}
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const nonblank = v => typeof v === 'string' && v.trim().length > 0 && [...v.trim()].length <= 4096;
const canonicalId = v => nonblank(v) && [...v].length <= 200 && !/[\x00-\x1f\x7f-\x9f]/.test(v);
function validateState(s) {
 const pair = v => object(v) && Object.hasOwn(v, 'prior') && Object.hasOwn(v, 'current');
 if (!object(s) || s.gst_version !== '1.0' || !canonicalId(s.state_id) ||
     !pair(s.internal) || !pair(s.external) || !object(s.continuity) ||
     !nonblank(s.intent) || !nonblank(s.outcome_expectation) || !object(s.constraints)) fail('Invalid GST');
 return s;
}
function validTimestamp(value) {
 if (typeof value !== 'string') return false;
 const m = value.match(/^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/);
 if (!m) return false;
 const [, y, mo, d, h, mi, s, , oh = '0', om = '0'] = m;
 const year = Number(y), month = Number(mo), day = Number(d);
 const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,31,30,31,30,31,31,30,31,30,31];
 return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month-1] && Number(h) < 24 && Number(mi) < 60 && Number(s) < 60 && Number(oh) < 24 && Number(om) < 60;
}
function validateLedger(q) {
 fields(q, ['qson_version','run_id','events','metadata']);
 if (q.qson_version !== '1.0' || !canonicalId(q.run_id) || !Array.isArray(q.events) || (!q.events.length || q.events.length > 10000)) fail('Invalid QSON ledger');
 const traces = new Set();
 const types = ['review','gate_attempt','override','correction','state_commit','external_input','runtime_error'];
 for (const [i, e] of q.events.entries()) {
  if (!object(e) || !canonicalId(e.trace_id) || traces.has(e.trace_id) || e.run_id !== q.run_id ||
      e.sequence !== i+1 || !types.includes(e.event_type) || !object(e.actor) ||
      !canonicalId(e.actor.type) || !canonicalId(e.actor.id)) fail('Invalid QSON event');
  traces.add(e.trace_id);
  for (const k of ['file_id','gate_id','input_state_id','reason','previous_event_hash','event_hash'])
   if (e[k] !== undefined && typeof e[k] !== 'string') fail('Invalid QSON '+k);
  for (const k of ['file_id','gate_id','input_state_id'])
   if (e[k] !== undefined && !canonicalId(e[k])) fail('Invalid QSON identity '+k);
  if (e.result !== undefined && !['PASS','FAIL','INTERMEDIATE'].includes(e.result)) fail('Invalid QSON result');
  for (const k of ['action','operation'])
   if (e[k] !== undefined && e[k] !== null && typeof e[k] !== 'string' && !object(e[k])) fail('Invalid QSON '+k);
  if (e.output_state_id !== undefined && e.output_state_id !== null && !canonicalId(e.output_state_id)) fail('Invalid QSON output_state_id');
  if (e.timestamp !== undefined && !validTimestamp(e.timestamp)) fail('Invalid QSON timestamp');
  if (e.metadata !== undefined && !object(e.metadata)) fail('Invalid QSON metadata');
  if (e.references !== undefined && (!Array.isArray(e.references) || e.references.some(r => typeof r !== 'string' || !r.length) || new Set(e.references).size !== e.references.length)) fail('Invalid QSON references');
 }
 return q;
}
const authorFlow=ids=>({ork_profile:'texport-packed-authoring/1.0',flow:ids,max_iterations:1,on_fail:'stop',on_unknown:'review'});
async function review(run,sequence,reason,timestamp){const identity=await sha256(json({run,sequence,reason,timestamp}));return {trace_id:'texport-review-'+identity,run_id:run,sequence,event_type:'review',actor:{type:'human',id:'texport-user'},timestamp,reason};}
async function createUnit({unit_id,state,gateFiles,timestamp=new Date().toISOString()}){
 id(unit_id);const m={...gateFiles},gates=Object.keys(m);if(!gates.length)fail('No gates: export text-only workspace instead');const ids=gateIndex(m,gates);
 m['manifest.json']=json({mg8_version:'1.0',unit_id,entry:'flow.ork',state:['state/context.gst'],gates,trace:'trace/execution.qson',metadata:{authoring_only:true}});
 m['flow.ork']=json(authorFlow(ids));m['state/context.gst']=json(state);
 const resources={};for(const [p,b] of Object.entries(m))resources[p]=await sha256(b);
 const run='texport-authoring-'+await sha256(json({resources,timestamp}));m['trace/execution.qson']=json({qson_version:'1.0',run_id:run,events:[await review(run,1,'Assembled and exported after human review; no execution performed.',timestamp)]});
 const b=await pack(m,'unit');await readUnit(b);return b;
}
function checkResources(members, listed) {
 const approved = new Set(['container.json','manifest.json',...listed]);
 for (const [path, content] of Object.entries(members)) {
  if (approved.has(path)) continue;
  if (/\.(?:gst|g8son|ork|qson|mg8|mg8pk|zip)$/i.test(path)) fail('Unlisted execution resource: '+path);
  if (content[0] === 0x50 && content[1] === 0x4b && content[2] === 3 && content[3] === 4) fail('Nested archive: '+path);
 }
}
async function readUnit(b){
 const u=await unpack(b,'unit'),m=u.members,a=u.manifest;fields(a,['mg8_version','unit_id','entry','state','gates','trace','metadata']);id(a.unit_id);
 if(a.mg8_version!=='1.0'||!Array.isArray(a.state)||!a.state.length||!Array.isArray(a.gates)||!a.gates.length||new Set([...a.state,...a.gates,a.entry,a.trace]).size!==a.state.length+a.gates.length+2)fail('Invalid unit manifest');
 checkResources(m, [...a.state,...a.gates,a.entry,a.trace]);
 for(const p of a.state) validateState(resource(m,p,'.gst'));
 const ids=gateIndex(m,a.gates),f=resource(m,a.entry,'.ork');fields(f,['ork_profile','flow','max_iterations','on_fail','on_unknown']);
 if(f.ork_profile!=='texport-packed-authoring/1.0'||!Array.isArray(f.flow)||f.flow.length!==ids.length||new Set(f.flow).size!==ids.length||f.flow.some(g=>!ids.includes(g))||f.max_iterations!==1||f.on_fail!=='stop'||f.on_unknown!=='review')fail('Unsupported authoring flow');
 validateLedger(resource(m,a.trace,'.qson'));
 return u;
}
async function addGates(original,additions,timestamp=new Date().toISOString()){
 if(!Array.isArray(additions)||!additions.length)fail('No dropped gate files');
 const u=await readUnit(original),m={...u.members},a={...u.manifest,gates:[...u.manifest.gates]};
 for(const f of additions){safePath(f.name);if(f.name.includes('/')||!f.name.endsWith('.g8son'))fail('Expected G8SON filename');const p='gates/'+f.name;
 if(Object.keys(m).some(x=>x.toLowerCase()===p.toLowerCase()))fail('Duplicate member filename');validateGate(parseJSON(f.bytes));m[p]=bytes(f.bytes);a.gates.push(p);}
 gateIndex(m,a.gates);
 const flow = resource(m,a.entry,'.ork');
 const importedIds = gateIndex(m,a.gates.slice(u.manifest.gates.length));
 m[a.entry]=json({...flow,flow:[...flow.flow,...importedIds]});m['manifest.json']=json(a);
 const q=resource(m,a.trace,'.qson'),seq=q.events[q.events.length-1].sequence+1;
 const imported=[];for(const f of additions)imported.push(f.name+':'+await sha256(f.bytes));
 q.events.push(await review(q.run_id,seq,'Human reviewed and appended gate files (SHA-256): '+imported.join(', ')+'; no execution performed.',timestamp));m[a.trace]=json(q);
 const b=await pack(m,'unit');await readUnit(b);return b;
}
async function createPackage({package_id,units}){
 id(package_id);if(!Array.isArray(units)||!units.length||units.length>32)fail('Package requires 1..32 ordered units');
 const m={},paths=[],ids=new Set();for(const f of units){safePath(f.name);if(f.name.includes('/')||!f.name.endsWith('.mg8'))fail('Expected MG8 filename');const p='units/'+f.name;
 if(Object.keys(m).some(x=>x.toLowerCase()===p.toLowerCase()))fail('Duplicate unit filename');const u=await readUnit(f.bytes);if(ids.has(u.manifest.unit_id))fail('Duplicate unit_id');ids.add(u.manifest.unit_id);m[p]=bytes(f.bytes);paths.push(p);}
 m['manifest.json']=json({mg8pk_version:'1.0',package_id,entry:'system.ork',units:paths,metadata:{authoring_only:true}});
 m['system.ork']=json({ork_profile:'mg8pk-sequential/1.0',flow:paths,max_steps:paths.length,on_fail:'stop',on_unknown:'review'});return pack(m,'package');
}
async function readPackage(b){
 const p=await unpack(b,'package'),a=p.manifest,m=p.members;fields(a,['mg8pk_version','package_id','entry','units','metadata']);id(a.package_id);
 if(a.mg8pk_version!=='1.0'||!Array.isArray(a.units)||!a.units.length||a.units.length>32||new Set(a.units).size!==a.units.length)fail('Invalid package manifest');
 checkResources(m, [...a.units,a.entry]);
 const f=resource(m,a.entry,'.ork');fields(f,['ork_profile','flow','max_steps','on_fail','on_unknown']);if(f.ork_profile!=='mg8pk-sequential/1.0'||JSON.stringify(f.flow)!==JSON.stringify(a.units)||f.max_steps!==a.units.length||f.on_fail!=='stop'||f.on_unknown!=='review')fail('Unsupported package topology');
 const ids=new Set();for(const path of a.units){safePath(path);if(!/^units\/[^/]+\.mg8$/.test(path)||!Object.hasOwn(m,path))fail('Missing unit');const u=await readUnit(m[path]);if(ids.has(u.manifest.unit_id))fail('Duplicate unit_id');ids.add(u.manifest.unit_id);}return p;
}
const API={zipWrite,zipRead,safePath,crc32,bytes,text,json,parseJSON,validateGate,sha256,pack,unpack,createUnit,readUnit,addGates,createPackage,readPackage};
if(typeof module!=='undefined')module.exports=API;root.TexportPacked=API;
})(typeof globalThis!=='undefined'?globalThis:this);
