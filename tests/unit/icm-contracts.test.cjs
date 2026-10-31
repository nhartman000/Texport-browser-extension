const {test}=require('node:test');
const assert=require('node:assert/strict');
const {collection:col}=require('../../examples/icm-input.json');
const I=require('../../src/icm.js');
const P=require('../../src/packed.js');

test('workspace includes scoped ICM contracts and routing, including text-only themes',async()=>{
  const plan=I.directPlan(col);
  for(const gated of [false,true]){
    plan.groups[0].conditions=gated?[{text:'Retain the approved requirement.',source_marker_ids:['M1']}]:[];
    const {members:m}=await I.workspace(col,plan,{timestamp:'2026-01-01T00:00:00Z'});
    for(const name of ['README.md','CONTEXT.md','sources/CONTEXT.md','themes/uncategorized/CONTEXT.md','state/global.gst'])assert.ok(m[name],name);
    for(const name of ['CONTEXT.md','sources/CONTEXT.md','themes/uncategorized/CONTEXT.md']){
      const body=P.text(m[name]);
      for(const heading of ['## Inputs','## Process','## Outputs','## Check'])assert.ok(body.includes(heading),name+' '+heading);
    }
    assert.match(P.text(m['AGENTS.md']),/themes\/uncategorized\/CONTEXT\.md/);
    assert.match(P.text(m['AGENTS.md']),/sources\/CONTEXT\.md/);
    assert.match(P.text(m['themes/uncategorized/CONTEXT.md']),/\[M1\.txt\]\(M1\.txt\)/);
    if(gated)assert.match(P.text(m['themes/uncategorized/CONTEXT.md']),/uncategorized\.mg8/);
    assert.equal(P.parseJSON(m['state/global.gst']).globals.gestalt,null);
  }
});
