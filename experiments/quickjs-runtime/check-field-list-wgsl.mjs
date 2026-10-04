// Compare actual generated bodies with the original ordered OR expressions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shader} from './shader.js';
import {fieldListWGSL} from './field-list-wgsl.js';
const original=JSON.parse(readFileSync(new URL('./field-list-original.json',import.meta.url)));
function body(name){let a=shader.indexOf(`fn ${name}(`);assert(a>=0);a=shader.indexOf('{',a);let b=a+1,d=1;while(d){if(shader[b]==='{')d++;if(shader[b]==='}')d--;b++;}return shader.slice(a+1,b-1);}
function compile(source,args,field,globalGap){
  source=source.replace(/array<u32,\d+>\(([^)]*)\)/g,'[$1]').replace(/\b(0x[\da-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let');
  return new Function('field','globalGap','GLOBAL_OBJECT',`return function(${args}){${source}}`)(field,globalGap,65);
}
function model(bodies){const calls=[];const field=(_l,key,index)=>{calls.push(index);return key===index;};const globalGap=compile(bodies.globalGap,'l,key',field);return {calls,globalGap,prototypeGap:compile(bodies.prototypeGap,'l,id,key',field,globalGap)};}
const a=model(original),b=model({globalGap:body('globalGap'),prototypeGap:body('prototypeGap')});
let comparisons=0;
for(const key of [...Array.from({length:1024},(_,i)=>i),0x80000000,0x80000001,0x60000001,0xffffffff]){
  for(const id of [0,3,20,21,23,24,26,47,65,99]){
    a.calls.length=b.calls.length=0;
    assert.equal(b.prototypeGap(0,id,key),a.prototypeGap(0,id,key));
    assert.deepEqual(b.calls,a.calls,`ordered calls id=${id} key=${key}`);comparisons++;
  }
}
assert.equal(fieldListWGSL([]),'return false;');
assert.throws(()=>fieldListWGSL([-1]),/Invalid field/);
assert.throws(()=>fieldListWGSL([undefined]),/Invalid field/);
console.log(JSON.stringify({actualBodyComparisons:comparisons,orderedCallsPreserved:true,gpuExecuted:false}));
