// Differential tests of actual WGSL bodies before/after loop flattening.
// Host heap models only; this does not execute guest JavaScript or a GPU.
import assert from 'node:assert/strict';
import {collectionWGSLFunctions} from './stdlib-collections-core.js';

// Frozen original nested-loop WGSL, retained as an independent regression oracle.
const prior=heap=>`fn collectionCompact(l:u32) {
  for(var h=1u;h<${heap}u;h++){
    if(states[l].heap[h].kind!=42u||(states[l].heap[h].marked&1u)==0u){continue;}
    var previous=0u;var e=states[l].heap[h].value.x;var kept=0u;
    for(var n=0u;n<${heap}u&&e!=0u;n++){
      let next=states[l].heap[e].next;
      if(states[l].heap[e].kind==44u&&(states[l].heap[e].marked&4u)==0u){
        if(previous==0u){states[l].heap[h].value.x=next;}else{states[l].heap[previous].next=next;}
        states[l].heap[e].marked&=~1u;states[l].heap[e].next=0u;
      }else{previous=e;if(states[l].heap[e].kind==44u){kept++;}}
      states[l].heap[e].marked&=~4u;e=next;
    }
    states[l].heap[h].value.y=previous;states[l].heap[h].value.w=kept;
  }
}`;
function compile(code){const start=code.indexOf('fn collectionCompact('),body=code.slice(code.indexOf('{',start)+1,code.lastIndexOf('}')).replace(/\b(0x[0-9a-f]+|\d+)u\b/g,'$1').replace(/\bvar\b/g,'let');return new Function('states','l',body);}
function current(heap){const code=collectionWGSLFunctions({L:{heap}}),start=code.indexOf('fn collectionCompact(');return code.slice(start);}
let seed=0x71a36b2d;function random(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
const node=()=>({kind:0,marked:0,next:0,key:0,value:{x:0,y:0,z:0,w:0}});
function generate(heap,heads){const nodes=Array.from({length:heap},node),slots=Array.from({length:heap-1},(_,i)=>i+1);for(let i=slots.length-1;i>0;i--){let j=random(i+1);[slots[i],slots[j]]=[slots[j],slots[i]];}
 const headers=slots.splice(0,heads);for(const h of headers){const count=random(slots.length+1);const entries=slots.splice(0,count);nodes[h]={kind:42,marked:random(5)?1:0,next:0,key:0,value:{x:entries[0]||0,y:entries.at(-1)||0,z:count,w:count}};for(let i=0;i<entries.length;i++){let deleted=random(2);nodes[entries[i]]={kind:deleted?44:43,marked:1|(random(3)?0:4),next:entries[i+1]||0,key:0,value:{x:random(100),y:0,z:0,w:0}};}}
 return [{heap:nodes,status:0}];}
let comparisons=0;
for(const heap of [8,64,2048]){const before=compile(prior(heap)),after=compile(current(heap));const iterations=heap===2048?24:1000;for(let n=0;n<iterations;n++){const state=generate(heap,random(Math.min(heap-1,12)+1)),a=structuredClone(state),b=structuredClone(state);before(a,0);after(b,0);assert.deepEqual(b,a,`heap${heap}/case${n}`);comparisons++;}}
// Explicit empty, all-deleted, pinned endpoints, and multiple collection chains.
const before=compile(prior(32)),after=compile(current(32));
for(const pattern of [[],[0],[1],[2],[0,0,0],[1,0,2],[2,0,1],[2,2,0,2]]){
 const s=[{heap:Array.from({length:32},node),status:0}];s[0].heap[1]={...node(),kind:42,marked:1,value:{x:pattern.length?2:0,y:pattern.length+1,z:pattern.length,w:0}};
 for(let i=0;i<pattern.length;i++)s[0].heap[i+2]={...node(),kind:pattern[i]===1?43:44,marked:1|(pattern[i]===2?4:0),next:i+1<pattern.length?i+3:0};
 const a=structuredClone(s),b=structuredClone(s);before(a,0);after(b,0);assert.deepEqual(b,a);comparisons++;
}
let invalid=0;for(const next of [2,32,33]){const s=[{heap:Array.from({length:32},node),status:0}];s[0].heap[1]={...node(),kind:42,marked:1,value:{x:2,y:2,z:1,w:0}};s[0].heap[2]={...node(),kind:43,marked:1,next};after(s,0);assert.equal(s[0].status,2);invalid++;}
const body=current(2048);assert.equal((body.match(/\bfor\s*\(/g)||[]).length,1);assert.ok(body.includes('work<4096u'));
console.log(JSON.stringify({actualWGSLHeapComparisons:comparisons,invalidBounds:invalid,loopsBefore:2,loopsAfter:1,maxVisits:4096,gpuExecuted:false}));
