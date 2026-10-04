// Executes the extracted GPU helper with allocation stubs; never guest execution.
import assert from 'node:assert/strict';
import {shader} from './shader.js';
import {FIELDS as F} from './program.js';
let start=shader.indexOf('fn descriptorObject(');start=shader.indexOf('{',start)+1;
let end=start,depth=1;while(depth){if(shader[end]==='{')depth++;if(shader[end]==='}')depth--;end++;}
const body=shader.slice(start,end-1).replace(/\/\/[^\n]*/g,'').replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1');
assert(!body.includes('putProperty('));
const fn=new Function('states','value','flags','accessor','alloc','dataProperty','fieldKey','V','undef','boolean','select',`const l=0;${body}`);
let checks=0;
for(const accessor of [false,true])for(let flags=0;flags<8;flags++)for(const slots of [[0,0],[17,19],[0x80000011,0x80000013]])for(const freeCount of [0,4,5,6]){
 const states=[{status:0,freeCount}],properties=[];let allocations=0;
 const V=(...v)=>v,undef=()=>[0,0,3,0],value=accessor?slots:[123,456,0,0];
 const result=fn(states,value,flags,accessor,()=>{allocations++;states[0].freeCount--;return 50;},(l,id,key,v,attrs)=>{assert.equal(id,50);states[0].freeCount--;properties.push({key,v,attrs});},i=>i,V,undef,b=>[Number(b),0,1,0],(a,b,p)=>p?b:a);
 if(freeCount<5){assert.equal(states[0].status,3);assert.equal(allocations,0);assert.deepEqual(result,undef());assert.equal(properties.length,0);}
 else{
  assert.equal(states[0].status,0);assert.equal(states[0].freeCount,freeCount-5);assert.equal(allocations,1);assert.deepEqual(result,[50,0,4,0]);
  assert.deepEqual(properties.map(p=>p.key),accessor?[F.get,F.set,F.enumerable,F.configurable]:[F.value,F.writable,F.enumerable,F.configurable]);
  assert(properties.every(p=>p.attrs===7));
  assert.deepEqual(properties[2].v,[Number(!!(flags&2)),0,1,0]);assert.deepEqual(properties[3].v,[Number(!!(flags&4)),0,1,0]);
  if(accessor){for(let i=0;i<2;i++)assert.deepEqual(properties[i].v,slots[i]?[slots[i]&0x7fffffff,0,slots[i]&0x80000000?11:5,0]:undef());}
  else{assert.deepEqual(properties[0].v,value);assert.deepEqual(properties[1].v,[Number(!!(flags&1)),0,1,0]);}
 }
 checks++;
}
console.log(JSON.stringify({actualWGSLDescriptorConstructionChecks:checks,gpuExecuted:false}));
