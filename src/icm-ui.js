/* Explicit local review workflow. No automatic model submission or source-file writes. */
(function(root){
'use strict';
function mountICM(app,col){
 const P=root.TexportPacked,I=root.TexportICM;
 const el=(tag,props={},...kids)=>{const e=Object.assign(document.createElement(tag),props);for(const k of kids.flat())if(k!=null)e.append(k);return e;};
 const download=(name,b)=>{const url=URL.createObjectURL(new Blob([b],{type:'application/zip'})),a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
 const status=el('p',{id:'icm-status',role:'status'}),panel=el('section',{className:'icm-panel',hidden:true});
 const action=(fn)=>async()=>{try{await fn();}catch(e){status.textContent=e.message;}};
 const button=(label,id,fn)=>el('button',{textContent:label,id,onclick:action(fn)});
 const opener=button('Export ICM / AI organization','icm-open',()=>{panel.hidden=!panel.hidden;});
 const plan=el('textarea',{id:'icm-plan',rows:14,value:JSON.stringify(I.directPlan(col),null,2),'ariaLabel':'Organization proposal JSON'});
 const prompt=el('textarea',{id:'icm-prompt',rows:6,readOnly:true,'ariaLabel':'AI organization prompt'}),fileList=el('pre',{id:'icm-file-list'});
 let reviewed=null,reviewedText='',generation=0;
 const save=button('Approve and download workspace ZIP','icm-save',()=>{if(!reviewed||reviewedText!==plan.value)throw new Error('Preview current edits first');download('texport-icm.zip',reviewed.bytes);status.textContent='Human-approved workspace downloaded. Authoring only; no execution.';});save.disabled=true;
 const unitDownloads=el('div');
 plan.oninput=()=>{generation++;reviewed=null;save.disabled=true;unitDownloads.textContent='';};
 const preview=button('Preview organization and files','icm-preview',async()=>{save.disabled=true;reviewed=null;unitDownloads.textContent='';const token=++generation,candidate=plan.value;
 const parsed=P.parseJSON(candidate);I.validatePlan(col,parsed);const out=await I.workspace(col,parsed);if(token!==generation)return;
 reviewed=out;reviewedText=candidate;fileList.textContent=Object.keys(out.members).join('\n');save.disabled=false;
 for(const u of out.units)unitDownloads.append(button('Approve and download '+u.name,'',()=>download(u.name,u.bytes)));
 status.textContent='Preview ready: verify source coverage, group labels, conditions, gestalt and variables. Download explicitly approves this snapshot. No gates evaluated.';});
 const copy=button('1. Copy AI organization prompt','icm-copy-prompt',async()=>{prompt.value=I.organizationPrompt(col);try{await navigator.clipboard.writeText(prompt.value);status.textContent='Prompt copied. Paste into your chosen AI, then paste its JSON below. Source may contain untrusted instructions.';}catch(_){status.textContent='Clipboard unavailable. Select and copy the displayed prompt manually.';}});
 let loaded=null,loadedName='',pending=null,dropVersion=0;
 const unitContent=el('pre',{id:'icm-unit-content'}),drop=el('div',{id:'icm-drop-unit',tabIndex:0,className:'icm-drop',textContent:'Drop multiple .g8son files onto the loaded unit, or choose gate files below. Appends in displayed order. Original file is never changed.'});
 const saveUnit=button('Approve appended gates and save NEW .mg8','icm-save-unit',()=>{if(!pending)throw new Error('Drop and review gate files first');download(loadedName.replace(/\.mg8$/,'')+'-updated.mg8',pending);pending=null;saveUnit.disabled=true;status.textContent='New unit saved; source remains unchanged. Load the new unit before further edits.';});saveUnit.disabled=true;
 const describe=async(b,prefix)=>{const u=await P.readUnit(b);return prefix+'\n'+Object.keys(u.members).join('\n')+'\nGate positions (authoring only):\n'+P.parseJSON(u.members[u.manifest.entry]).flow.map((g,i)=>(i+1)+'. '+g).join('\n');};
 const readFile=async(f,max=16*1024*1024)=>{if(f.size>max)throw new Error('File size limit');return new Uint8Array(await f.arrayBuffer());};
 const load=el('input',{id:'icm-load-unit',type:'file',accept:'.mg8'});load.onchange=action(async()=>{const token=++dropVersion;loaded=null;pending=null;saveUnit.disabled=true;unitContent.textContent='';const f=load.files[0];if(!f)throw new Error('Choose a unit');const b=await readFile(f),info=await describe(b,'Loaded '+f.name);if(token!==dropVersion)return;loaded=b;loadedName=f.name;unitContent.textContent=info;status.textContent='Unit loaded and integrity verified.';});
 const acceptGates=async(files)=>{const token=++dropVersion;pending=null;saveUnit.disabled=true;if(!loaded)throw new Error('Load an MG8 unit first');if(!files.length||files.length>64)throw new Error('Drop 1..64 G8SON files');const additions=[];for(const f of files)additions.push({name:f.name,bytes:await readFile(f,1024*1024)});
 const b=await P.addGates(loaded,additions),info=await describe(b,'PROPOSED NEW unit — appended in drop order: '+additions.map(f=>f.name).join(', '));if(token!==dropVersion)return;pending=b;unitContent.textContent=info;saveUnit.disabled=false;status.textContent='Review appended gate positions, then explicitly approve/save NEW MG8. Original unchanged.';};
 drop.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';};drop.ondrop=e=>{e.preventDefault();action(()=>acceptGates(Array.from(e.dataTransfer.files)))();};
 const gates=el('input',{id:'icm-gate-files',type:'file',accept:'.g8son',multiple:true});gates.onchange=action(()=>acceptGates(Array.from(gates.files)));
 let ordered=[],packageVersion=0;
 const order=el('ol',{id:'icm-package-order'});
 const savePackage=button('Approve order and download .mg8pk','icm-save-package',async()=>{
  if (!ordered.length) throw new Error('Choose MG8 units before approving');
  const token = packageVersion;
  const snapshot = Object.freeze(ordered.map(f => Object.freeze({name:f.name,bytes:f.bytes.slice()})));
  try {
   const b = await P.createPackage({package_id:'texport-ordered-package',units:snapshot});
   if (token !== packageVersion) return;
   await P.readPackage(b);
   if (token !== packageVersion) return;
   download('texport-ordered.mg8pk',b);
   status.textContent='Ordered authoring topology saved; not a runtime execution claim.';
  } catch (error) {
   if (token === packageVersion) throw error;
  }
 });savePackage.disabled=true;
 function changedOrder(){packageVersion++;renderOrder();status.textContent='Package order changed. Review before approving download.';}
 function renderOrder(){order.textContent='';ordered.forEach((f,i)=>{const up=button('Up','',()=>{[ordered[i-1],ordered[i]]=[ordered[i],ordered[i-1]];changedOrder();});up.disabled=i===0;
 const down=button('Down','',()=>{[ordered[i+1],ordered[i]]=[ordered[i],ordered[i+1]];changedOrder();});down.disabled=i===ordered.length-1;
 const remove=button('Remove','',()=>{ordered.splice(i,1);changedOrder();});
 order.append(el('li',{},f.name+' ',up,down,remove));});savePackage.disabled=!ordered.length;}
 const packageFiles=el('input',{id:'icm-package-files',type:'file',accept:'.mg8',multiple:true});packageFiles.onchange=action(async()=>{const token=++packageVersion;ordered=[];renderOrder();const fs=Array.from(packageFiles.files);if(!fs.length||fs.length>32)throw new Error('Choose 1..32 MG8 units');const next=[];for(const f of fs)next.push({name:f.name,bytes:await readFile(f)});await P.createPackage({package_id:'preview',units:next});if(token!==packageVersion)return;ordered=next;renderOrder();status.textContent='Package validated. Review order with Up/Down before approving download.';});
 panel.append(el('h2',{textContent:'ICM / packed MG8 authoring'}),el('p',{textContent:'Direct deterministic organization keeps uncategorized markers as text. Optional AI: copy prompt → use your chosen AI → paste/edit JSON → preview → explicitly approve download. No API keys, backend, automatic AI calls or execution. A condition needs source_marker_ids and text. Each G8SON holds at most 3 gates.'}),
 copy,prompt,el('label',{htmlFor:'icm-plan',textContent:'2. Paste or edit organization JSON (source text stays unchanged)'}),plan,preview,save,fileList,unitDownloads,
 el('h3',{textContent:'Load unit / non-destructive gate import'}),el('label',{htmlFor:'icm-load-unit',textContent:'Load packed .mg8'}),load,drop,gates,unitContent,saveUnit,
 el('h3',{textContent:'Package ordered units'}),el('label',{htmlFor:'icm-package-files',textContent:'Select multiple MG8 files; review their order'}),packageFiles,order,savePackage,status);
 app.append(opener,panel);
}
root.mountTexportICM=mountICM;
})(globalThis);
