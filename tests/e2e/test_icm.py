"""Offline real extension export, proposal review, multi-file drop and ordered package downloads."""
import asyncio, json, pathlib, sys, zipfile, io
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'test-results'/'icm'
COL={'name':'ICM offline','created':'2026-01-01','convos':[{'key':'original-chat','url':'https://example.invalid/chat','title':'Offline source','site':'fixture','capturedAt':'2026-01-01T00:00:00Z','messages':[{'role':'user','text':'Keep limit below 10'},{'role':'assistant','text':'Full unmarked context retained'}],'markers':[{'id':'source-marker','idx':0,'note':'Strict requirement','scope':'message'}]}]}
def gate(n):return json.dumps({'g8son_version':'1.0','file_id':'drop-file-'+n,'gates':[{'gate_id':'drop-'+n,'type':'AND','conditions':['Bounded condition '+n]}]})
async def main():
 OUT.mkdir(parents=True,exist_ok=True)
 errors=[];checks=0
 def check(ok,label):
  nonlocal checks
  assert ok,label
  checks+=1;print('PASS '+label)
 async with async_playwright() as p:
  ctx=await p.chromium.launch_persistent_context('',headless=True,channel='chromium',accept_downloads=True,args=[f'--disable-extensions-except={ROOT}/dist/chrome',f'--load-extension={ROOT}/dist/chrome'])
  sw=ctx.service_workers[0] if ctx.service_workers else await ctx.wait_for_event('serviceworker')
  await sw.evaluate('(col)=>chrome.storage.local.set({collections:{fixture:col}})',COL)
  page=await ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto('chrome-extension://'+sw.url.split('/')[2]+'/export.html?c=fixture')
  await page.get_by_role('button',name='Export ICM / AI organization').click(timeout=3000)
  check(await page.locator('#icm-save').is_disabled(),'cannot export before review')
  await page.locator('#icm-preview').click()
  check('themes/uncategorized/M1.txt' in await page.locator('#icm-file-list').inner_text(),'deterministic preview exposes labelled marker file')
  async with page.expect_download() as d:await page.locator('#icm-save').click()
  await (await d.value).save_as(OUT/'direct.zip')
  with zipfile.ZipFile(OUT/'direct.zip') as z:
   check(json.loads(z.read('sources/snapshot.json'))==COL,'download retains exact complete snapshot')
   check(not any(n.endswith('.mg8') for n in z.namelist()),'direct defaults do not invent gates')
  await page.locator('#icm-copy-prompt').click()
  check('UNTRUSTED' in await page.locator('#icm-prompt').input_value(),'two-step AI prompt shown locally')
  plan=json.loads(await page.locator('#icm-plan').input_value())
  plan['groups'][0]['conditions']=[{'text':'Keep limit below 10','source_marker_ids':['M1']}]
  await page.locator('#icm-plan').fill(json.dumps(plan));await page.locator('#icm-preview').click()
  async with page.expect_download() as d:await page.locator('#icm-save').click()
  await (await d.value).save_as(OUT/'reviewed.zip')
  with zipfile.ZipFile(OUT/'reviewed.zip') as z:unit=z.read('themes/uncategorized/uncategorized.mg8')
  (OUT/'original.mg8').write_bytes(unit)
  await page.locator('#icm-load-unit').set_input_files(str(OUT/'original.mg8'))
  await page.wait_for_function("() => document.querySelector('#icm-unit-content').textContent.includes('flow.ork')")
  check('gates/conditions-1.g8son' in await page.locator('#icm-unit-content').inner_text(),'loaded unit content listed')
  await page.evaluate('''files=>{const dt=new DataTransfer();for(const [name,body] of files)dt.items.add(new File([body],name,{type:'application/json'}));document.querySelector('#icm-drop-unit').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}''',[['first.g8son',gate('first')],['second.g8son',gate('second')]])
  await page.wait_for_function("() => !document.querySelector('#icm-save-unit').disabled")
  check('drop-first' in await page.locator('#icm-unit-content').inner_text(),'drop preview shows appended gate positions')
  async with page.expect_download() as d:await page.locator('#icm-save-unit').click()
  await (await d.value).save_as(OUT/'updated.mg8')
  with zipfile.ZipFile(io.BytesIO(unit)) as old,zipfile.ZipFile(OUT/'updated.mg8') as new:
   check(old.read('state/context.gst')==new.read('state/context.gst'),'new unit preserves original GST bytes')
   check(new.read('gates/first.g8son').decode()==gate('first'),'dropped gate bytes preserved')
   q=json.loads(new.read('trace/execution.qson'));check(len(q['events'])==2 and q['events'][-1]['event_type']=='review','real review appended, not fabricated PASS')
  check((OUT/'original.mg8').read_bytes()==unit,'source unit not overwritten')
  for files in ([],[['invalid.g8son','not JSON']],[['first.g8son',gate('same')],['second.g8son',gate('same')]]):
   await page.evaluate("() => document.querySelector('#icm-status').textContent=''")
   await page.evaluate('''files=>{const dt=new DataTransfer();for(const [name,body] of files)dt.items.add(new File([body],name));document.querySelector('#icm-drop-unit').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));}''',files)
   await page.wait_for_function("() => /Drop 1|Invalid JSON|Duplicate/.test(document.querySelector('#icm-status').textContent)")
   check(await page.locator('#icm-save-unit').is_disabled(),'invalid/empty/colliding drop refuses save: '+str(len(files))+' files')
  # 4/6/8/12 distinct source-grounded units generated through the real browser module.
  generated=await page.evaluate('''async col=>{const a=[];for(let i=0;i<12;i++){const p=TexportICM.directPlan(col);p.groups[0].name='unit-'+i;p.groups[0].conditions=[{text:'Keep limit below 10',source_marker_ids:['M1']}];const w=await TexportICM.workspace(col,p);a.push(Array.from(w.units[0].bytes));}return a;}''',COL)
  paths=[]
  for i,b in enumerate(generated):
   path=OUT/f'unit-{i}.mg8';path.write_bytes(bytes(b));paths.append(str(path))
  for count in (4,6,8,12):
   await page.locator('#icm-package-files').set_input_files(paths[:count])
   await page.wait_for_function('(n) => document.querySelectorAll("#icm-package-order li").length===n',arg=count)
   await page.locator('#icm-package-order li').nth(1).get_by_role('button',name='Up').click()
   async with page.expect_download() as d:await page.locator('#icm-save-package').click()
   destination=OUT/f'ordered-{count}.mg8pk'
   await (await d.value).save_as(destination)
   with zipfile.ZipFile(destination) as z:
    m=json.loads(z.read('manifest.json'));f=json.loads(z.read('system.ork'));check(m['units'][0]=='units/unit-1.mg8' and f['flow']==m['units'] and f['max_steps']==count,f'{count}-unit package download respects reviewed order and bounded topology')
  # Hold actual browser API promises while approval is revoked in the DOM.
  race_downloads=[]
  page.on('download',lambda d:race_downloads.append(d.suggested_filename))
  for stage in ('createPackage','readPackage'):
   for change in ('cancel','reorder','remove'):
    await page.locator('#icm-package-files').set_input_files([])
    await page.locator('#icm-package-files').set_input_files(paths[:2])
    await page.wait_for_function('() => document.querySelectorAll("#icm-package-order li").length===2')
    await page.evaluate('''stage=>{window.race={stage,original:TexportPacked[stage],held:false};TexportPacked[stage]=async function(...args){race.held=true;await new Promise(r=>race.resume=r);return race.original.apply(this,args);};race.saving=document.querySelector('#icm-save-package').onclick();}''',stage)
    await page.wait_for_function('() => race.held')
    if change=='cancel':await page.locator('#icm-package-files').set_input_files([])
    else:await page.locator('#icm-package-order li').first.get_by_role('button',name='Down' if change=='reorder' else 'Remove',exact=True).click()
    before=await page.locator('#icm-status').inner_text()
    await page.evaluate('''async()=>{race.resume();await race.saving;TexportPacked[race.stage]=race.original;}''')
    check(not race_downloads and await page.locator('#icm-status').inner_text()==before,f'actual DOM stale {change} during {stage}: no download/status overwrite')
  await page.locator('#icm-plan').fill('{"version":1,"groups":[]}');await page.locator('#icm-preview').click()
  check(await page.locator('#icm-save').is_disabled(),'invalid edits revoke export approval')
  check('Invalid' in await page.locator('#icm-status').inner_text(),'invalid proposal error surfaced')
  await page.screenshot(path=str(OUT/'export-review.png'),full_page=True)
  check(not errors,'no page errors: '+str(errors));await ctx.close()
 print(f'ALL PASSED: {checks} ICM UI checks; evidence {OUT}')
 return 0
if __name__=='__main__':sys.exit(asyncio.run(main()))
