const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js');
test('gate metadata/outcomes must retain canonical object shapes',()=>{
 const base={g8son_version:'1.0',file_id:'f',gates:[{gate_id:'g',type:'AND',conditions:['condition']}]};
 for(const edit of [g=>g.metadata=[],g=>g.metadata=null,g=>g.gates[0].metadata=42,g=>g.gates[0].outcomes=42,g=>g.gates[0].outcomes=null,g=>g.gates[0].outcomes={PASS:42},g=>g.gates[0].outcomes={PASS:[]}]){
 const g=structuredClone(base);edit(g);assert.throws(()=>P.validateGate(g));
 }
});
