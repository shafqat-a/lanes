import test from 'node:test';
import assert from 'node:assert/strict';
import {packBigIntInput,unpackBigIntOutput} from './bigint-transfer.js';
import {readBigIntPool} from './phase3/bigint-bridge/representation.js';

test('BigInt API encoding round trips zero, signs, limb boundaries and the full limit',()=>{
 const values=[0n,1n,-1n,0xffffffffn,0x100000000n,-0x100000000n,(1n<<2048n)-1n,-((1n<<2048n)-1n)];
 for(let bits=1n;bits<2048n;bits+=31n)values.push((1n<<bits)-1n,-(1n<<bits));
 for(const value of values){
  const image=[11,22,33,44],encoded=packBigIntInput(value,image),rows=[];
  for(let i=0;i<image.length;i+=4)rows.push(image.slice(i,i+4));
  const parsed=readBigIntPool(rows,encoded[0]);
  const output=new Uint32Array(68);output.set([parsed.sign<0?0xffffffff:parsed.sign,parsed.limbs.length,18,0]);output.set(parsed.limbs,4);
  assert.equal(unpackBigIntOutput(output,0),value);
  assert.deepEqual(image.slice(0,4),[11,22,33,44]);
 }
});
test('oversized BigInt input fails before modifying the input image',()=>{
 for(const value of [1n<<2048n,-(1n<<2048n)]){const image=[1,2,3,4];assert.throws(()=>packBigIntInput(value,image),/GPU bigint limit/);assert.deepEqual(image,[1,2,3,4]);}
});
test('malformed BigInt output never silently changes values',()=>{
 for(const header of [[0,1,18,0],[1,0,18,0],[2,1,18,0],[1,65,18,0],[1,1,17,0],[1,1,18,1]]){
  const output=new Uint32Array(70);output.set(header);output[4]=1;assert.throws(()=>unpackBigIntOutput(output,0),/Invalid GPU BigInt/);
 }
 assert.throws(()=>unpackBigIntOutput(new Uint32Array([1,1,18,0]),0),/Invalid GPU BigInt/);
 assert.throws(()=>unpackBigIntOutput(new Uint32Array([1,1,18,0,0]),0),/Invalid GPU BigInt/);
});
