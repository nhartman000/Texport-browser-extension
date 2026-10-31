'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const P=require('../../src/packed.js'),I=require('../../src/icm.js');
function harness(){
 const elems=[],downloads=[];
 class E{constructor(tag){this.tag=tag;this.children=[];this.value='';this.files=[];elems.push(this);}append(...children){this.children.push(...children);}remove(){}set textContent(v){this.children=[];this._text=v;}get textContent(){return this._text||'';}click(){if(this.tag==='a')downloads.push(this.download);return this.onclick?.();}}
 let stage='',release,entered,seen,reject=false;
 const wrapped={...P,createPackage:async args=>{seen=args;await pause('create');return P.createPackage(args);},readPackage:async b=>{await pause('validate');return P.readPackage(b);}};
 async function pause(s){if(stage!==s)return;stage='';entered();await new Promise(r=>release=r);if(reject)throw new Error('Old save failed');}
 const context={document:{createElement:t=>new E(t),body:new E('body')},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob,setTimeout:()=>{},TexportPacked:wrapped,TexportICM:I};
 vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../../src/icm-ui.js'),'utf8'),context);context.mountTexportICM(new E('app'),{name:'empty',convos:[]});
 const find=id=>elems.find(e=>e.id===id);
 return {find,downloads,select:async files=>{find('icm-package-files').files=files;await find('icm-package-files').onchange();},hold:(s,fail=false)=>{stage=s;reject=fail;return new Promise(r=>entered=r);},resume:()=>release(),seen:()=>seen};
}
async function files(){return Promise.all(['a','b'].map(async id=>{const b=await P.createUnit({unit_id:id,state:{gst_version:'1.0',state_id:id,internal:{prior:null,current:null},external:{prior:null,current:null},continuity:{},intent:'Review',outcome_expectation:'Unevaluated',constraints:{}},gateFiles:{'gates/a.g8son':P.json({g8son_version:'1.0',file_id:id,gates:[{gate_id:id,type:'AND',conditions:['x']}]})}});return {name:id+'.mg8',size:b.length,arrayBuffer:async()=>b.slice().buffer};}));}
for(const stage of ['create','validate'])for(const change of ['cancel','reorder','remove'])test(`package save rejects stale ${change} during ${stage}`,async()=>{
 const h=harness();await h.select(await files());const ready=h.hold(stage),saving=h.find('icm-save-package').click();await ready;
 if(change==='cancel')await h.select([]);
 else {const li=h.find('icm-package-order').children[0];const label=change==='reorder'?'Down':'Remove';const control=li.children.find(e=>e.textContent===label);assert.ok(control,'order control '+label);await control.click();}
 const before=h.find('icm-status').textContent;h.resume();await saving;assert.deepEqual(h.downloads,[]);assert.equal(h.find('icm-status').textContent,before,'stale save must not overwrite current status');
 assert.equal(h.seen().units[0].name,'a.mg8','approved input snapshot is immutable');
});
for(const stage of ['create','validate'])test(`stale ${stage} failure does not overwrite current status`,async()=>{const h=harness();await h.select(await files());const ready=h.hold(stage,true),saving=h.find('icm-save-package').click();await ready;await h.select([]);const before=h.find('icm-status').textContent;h.resume();await saving;assert.equal(h.find('icm-status').textContent,before);assert.deepEqual(h.downloads,[]);});
test('unchanged approved package saves successfully',async()=>{const h=harness();await h.select(await files());await h.find('icm-save-package').click();assert.deepEqual(h.downloads,['texport-ordered.mg8pk']);});
