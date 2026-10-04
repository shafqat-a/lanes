// Executes the actual generated completeCall WGSL subset as a host event model.
// Expected effects describe the original synchronous caller contracts. No GPU.
import assert from 'node:assert/strict';
import {sharedCallRequestWGSL} from './shared-call-dispatch.js';
let start=sharedCallRequestWGSL.indexOf('fn completeCall(');assert(start>=0);start=sharedCallRequestWGSL.indexOf('{',start)+1;let end=start,depth=1;
while(depth){if(sharedCallRequestWGSL[end]==='{')depth++;else if(sharedCallRequestWGSL[end]==='}')depth--;end++;}
let body=sharedCallRequestWGSL.slice(start,end-1).replace(/\/\/[^\n]*/g,'').replace(/\b(\d+)u\b/g,'$1').replace(/\blet\b/g,'let').replace(/switch request.post\s*\{/,'switch(request.post){').replace(/\}\s*(?=case \d+:|default:)/g,'}break;');
const run=new Function('states','callRequest','undef','pop','iterationStepResult',`const l=0;${body}`);
const U=()=>({x:0,y:0,z:3,w:0}),data={x:4,y:2,z:4,w:0};
const statuses=[0,2,3,4,5,6,7,8,9,10,11,12,13,14];let checked=0;
for(const post of [0,1,2,3,4,5,6,7,8,9,10,11,12])for(const status of statuses)for(const prior of [0,2])for(const change of [-1,0,1,2]){
 const current=prior+change;if(current<0||post===9&&prior!==0)continue;
 const continuation=({2:6,3:7,4:80,8:152,10:4,11:50,12:104})[post]??0;
 const frames=Array.from({length:8},()=>({tail:0,receiver:U()})),heap=Array.from({length:8},()=>({value:{z:0,w:0}}));
 const initial={status,depth:current,frames,heap,stack:Array.from({length:8},()=>U()),env:1,pops:0,iteration:[]};
 const expected=structuredClone(initial),actual=structuredClone(initial),entered=current>prior;
 const frame=expected.frames[current];const tail=(n,receiver=false)=>{frame.tail=n;if(receiver)frame.receiver=structuredClone(data);};
 // Original instructions applied these metadata writes without a status guard.
 if(entered&&post===2)tail(6,true);
 if(entered&&post===3)tail(7,true);
 if(entered&&post===10)tail(4);
 if(status===0){
  if(post===1){if(entered)tail(2);else expected.pops++;}
  if(post===3&&!entered)expected.status=6;
  if(post===4){if(entered)tail(80,true);else expected.status=2;}
  if(post===5){if(entered)tail(41,true);else{expected.pops++;expected.stack[data.x]={result:true};}}
  if(post===6){if(entered)tail(40,true);else{expected.pops++;expected.iteration.push([data.x,{result:true}]);}}
  if(post===7&&entered){tail(3);expected.heap[1].value={z:data.x,w:data.z};}
  if(post===8){if(current===prior+1)tail(152,true);else expected.status=2;}
  if(post===9){if(current===1)expected.frames[1].tail=136;else expected.status=2;}
  if(post===11){if(entered)tail(50);else expected.status=6;}
  if(post===12){if(entered)tail(104);else expected.status=2;}
 }
 const request={pending:2,post,priorDepth:prior,continuation,data:structuredClone(data),aux:{x:9,z:4}};
 run([actual],request,U,()=>{actual.pops++;return {result:true};},(_l,index,value)=>actual.iteration.push([index,value]));
 assert.deepEqual(actual,expected,`post${post} status${status} depth${prior}->${current}`);assert.equal(request.pending,0);assert.deepEqual(request.data,U());assert.deepEqual(request.aux,U());checked++;
}
// Ordinary unary conversions share the postfix request but do not install a tail.
for(const status of statuses){
 const actual={status,depth:2,frames:[{},{},{tail:0,receiver:U()}]};
 const request={pending:2,post:10,priorDepth:1,continuation:0,data:structuredClone(data),aux:U()};
 run([actual],request,U,()=>{throw Error('unexpected pop');},()=>{throw Error('unexpected iteration');});
 assert.equal(actual.frames[2].tail,0);assert.equal(actual.status,status);assert.equal(request.pending,0);checked++;
}
console.log(JSON.stringify({actualWGSLPostconditionChecks:checked,gpuExecuted:false}));
