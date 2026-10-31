const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js');
const plain=()=>P.zipWrite({'a.txt':P.bytes('data')});
test('portable paths, duplicate JSON keys and finite JSON are enforced',()=>{
 for(const p of ['é.txt','a b','a//b','a/./b','a/../b','C:/x','\\host','/absolute','a\x00b'])assert.throws(()=>P.zipWrite({[p]:P.bytes('x')}),p);
 assert.throws(()=>P.parseJSON('{"x":1e999}'),/finite/i);
 assert.throws(()=>P.parseJSON('{"a":1,"\\u0061":2}'),/duplicate/i);
});
test('ZIP rejects special Unix entries, encryption, compression, size/CRC/name/local mismatch and malformed bounds',()=>{
 const mutate=fn=>{const b=plain(),v=new DataView(b.buffer);fn(b,v,v.getUint32(b.length-6,true));return b;};
 const cases=[(b,v,c)=>v.setUint32(c+38,0x10000000,true),(b,v,c)=>v.setUint32(c+38,0xa0000000,true),(b,v,c)=>v.setUint16(c+8,1,true),(b,v,c)=>v.setUint16(c+10,8,true),(b,v,c)=>v.setUint16(8,8,true),(b,v,c)=>v.setUint32(22,9999,true),(b,v,c)=>v.setUint32(14,0,true),(b,v,c)=>b[30]=120,(b,v,c)=>v.setUint32(c+42,999999,true),(b,v,c)=>v.setUint16(28,65535,true)];
 for(const fn of cases)assert.throws(()=>P.zipRead(mutate(fn)));
 for(let i=0;i<plain().length;i++)assert.throws(()=>P.zipRead(plain().slice(0,i)));
});
test('reserved object member names are data, not prototype mutations',()=>{
 const m=Object.fromEntries([['__proto__',P.bytes('data')]]),read=P.zipRead(P.zipWrite(m));assert.ok(Object.hasOwn(read,'__proto__'));assert.equal(P.text(read.__proto__),'data');
});
