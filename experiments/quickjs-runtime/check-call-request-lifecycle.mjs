// Independent request lifecycle matrix executing extracted WGSL statements as JS.
// No guest execution or GPU device is used.
import assert from 'node:assert/strict';
import {sharedCallRequestWGSL} from './shared-call-dispatch.js';
import {shader} from './shader.js';
const undef=()=>({x:0,y:0,z:3,w:0});
function block(text,start){start=text.indexOf('{',start)+1;let end=start,depth=1;while(depth){if(text[end]==='{')depth++;else if(text[end]==='}')depth--;end++;}return text.slice(start,end-1);}
const clean=s=>s.replace(/\/\/[^\n]*/g,'').replace(/\b(\d+)u\b/g,'$1');
const body=clean(block(sharedCallRequestWGSL,sharedCallRequestWGSL.indexOf('fn requestCall(')));
const call=new Function('states','initial','undef','CallRequest','select',`let callRequest=initial;const l=0,argc=3,method=true,tail=false;${body.replaceAll('return;','return callRequest;')}return callRequest;`);
const constructor=(pending,argc,flags,priorDepth,post,continuation,data,aux)=>({pending,argc,flags,priorDepth,post,continuation,data,aux});
const postbody=clean(block(sharedCallRequestWGSL,sharedCallRequestWGSL.indexOf('fn callPost(')));
const post=new Function('callRequest',`const l=0,post=7,continuation=3,data={x:17,z:4},aux={x:19,z:4};${postbody}`);
let checks=0;
for(const status of [0,2,3,4,5,6,7,8,9,10,11,12,13,14])for(const pending of [0,1,2]){
 const state={status,depth:3};const initial={pending,data:{x:99,z:4},aux:{x:98,z:4},post:5};
 const result=call([state],structuredClone(initial),undef,constructor,(a,b,p)=>p?b:a);
 if(status!==0){assert.equal(state.status,status);assert.deepEqual(result,initial);}
 else if(pending){assert.equal(state.status,2);assert.deepEqual(result,initial);}
 else assert.deepEqual(result,constructor(1,3,1,3,0,0,undef(),undef()));
 checks++;
 const r=structuredClone(initial);post(r);if(pending===1){assert.equal(r.post,7);assert.equal(r.data.x,17);}else assert.deepEqual(r,initial);checks++;
}
const marker=shader.indexOf('// Private requests must never outlive');assert(marker>=0);const start=shader.indexOf('if(callRequest.pending',marker);
const condition=shader.slice(start,shader.indexOf('{',start));
const snapshot=new Function('states','callRequest','finishRequest','undef',`const l=0;${clean(condition+'{'+block(shader,start)+'}')}`);
for(let status=0;status<=14;status++)for(const pending of [0,1,2])for(const finishing of [0,1,2]){
 const states=[{status}],r={pending,data:{x:99,z:4},aux:{x:98,z:4}},f={pending:finishing,value:{x:97,z:4}};
 snapshot(states,r,f,undef);
 assert.equal(states[0].status,pending||finishing?(status>=2&&status<=8?status:2):status,`snapshot status${status}`);
 if(pending||finishing){assert.equal(r.pending,0);assert.deepEqual(r.data,undef());assert.deepEqual(r.aux,undef());assert.equal(f.pending,0);assert.deepEqual(f.value,undef());}
 checks++;
}
console.log(JSON.stringify({actualWGSLRequestLifecycleChecks:checks,gpuExecuted:false}));
