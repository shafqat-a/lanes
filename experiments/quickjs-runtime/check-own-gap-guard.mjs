// Independent host model executing the actual ownGap WGSL body with query stubs.
import assert from 'node:assert/strict';
import {shader,assertOwnGapHolders} from './shader.js';
let start=shader.indexOf('fn ownGap(');start=shader.indexOf('{',start)+1;let end=start,depth=1;
while(depth){if(shader[end]==='{')depth++;if(shader[end]==='}')depth--;end++;}
const body=shader.slice(start,end-1).replace(/\/\/[^\n]*/g,'').replace(/\b(\d+)u\b/g,'$1');
const run=new Function('states','id','prototypeGap','findProperty',`const l=0,key=123,GLOBAL_OBJECT=65;${body}`);
const holders=new Set([20,21,23,24,26,47,65]);let checks=0;
for(const id of [0,1,2,3,20,21,23,24,26,27,28,47,65,105,106,567,2047])for(const gap of [false,true])for(const property of [0,77])for(const status of [0,3,6]){
 const states=[{status}],calls=[];const result=run(states,id,()=>{calls.push('gap');return gap;},()=>{calls.push('property');return property;});
 const missing=holders.has(id)&&gap&&property===0;
 assert.equal(result,missing);assert.equal(states[0].status,missing?6:status);
 assert.deepEqual(calls,!holders.has(id)?[]:gap?['gap','property']:['gap']);checks++;
}
assertOwnGapHolders(shader);
assert.throws(()=>assertOwnGapHolders(shader.replace('if(id==23u){','if(id==12345u){')),/guard drift/);
assert.throws(()=>assertOwnGapHolders(shader.replace('id!=47u','id!=48u')),/guard drift/);
console.log(JSON.stringify({actualWGSLHolderGuardChecks:checks,driftChecks:3,gpuExecuted:false}));
