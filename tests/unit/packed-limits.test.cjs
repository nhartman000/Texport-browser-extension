const {test}=require('node:test'),assert=require('node:assert/strict'),P=require('../../src/packed.js'),{execFileSync}=require('node:child_process');
test('reader rejects ZIP64 extras even when classic fields appear bounded',()=>{
 const b=execFileSync('python3',['-c',`import io,zipfile,sys
b=io.BytesIO()
with zipfile.ZipFile(b,'w') as z:
 i=zipfile.ZipInfo('a.txt');i.extra=bytes.fromhex('01000000');z.writestr(i,b'x')
sys.stdout.buffer.write(b.getvalue())`]);assert.throws(()=>P.zipRead(b),/ZIP64/i);
});
test('archive and unit member bounds apply before reading payloads',()=>{
 assert.throws(()=>P.zipRead(new Uint8Array(16*1024*1024+1)));
 assert.throws(()=>P.zipWrite(Object.fromEntries(Array.from({length:129},(_,i)=>['a'+i,P.bytes('x')]))));
 assert.throws(()=>P.zipRead(P.zipWrite({'a.txt':new Uint8Array(1024*1024+1)})));
});
test('reader rejects duplicate and casefold-colliding names across local/central entries',()=>{
 for(const name of ['a.txt','A.txt']){
 const b=P.zipWrite({'a.txt':P.bytes('a'),'b.txt':P.bytes('b')}),v=new DataView(b.buffer),cd=v.getUint32(b.length-6,true),second=cd+46+5,offset=v.getUint32(second+42,true);
 b.set(P.bytes(name),second+46);b.set(P.bytes(name),offset+30);assert.throws(()=>P.zipRead(b),/Duplicate/);
 }
});
