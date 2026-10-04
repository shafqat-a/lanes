// Execute the generated WGSL dispatch seam with observable host stubs. This tests
// plumbing ordering and roots, not guest JavaScript or a simulated GPU engine.
import assert from 'node:assert/strict';
import {shader} from './shader.js';
import {sharedFinishRequestWGSL} from './shared-finish-dispatch.js';
const clean=s=>s.replace(/\b(\d+)u\b/g,'$1');
const undef=()=>({z:3});
const begin=shader.indexOf('    if(finishRequest.pending!=0u){\n      if(finishRequest.pending!=1u)');
assert(begin>=0);
const end=shader.indexOf('    }else{',begin);
assert(end>begin);
const seam=clean(shader.slice(begin,end)+'    }');
const dispatch=new Function('states','callRequest','finishRequest','call','finish','completeCall','undef',`const l=0;do{${seam}}while(false);`);
let checks=0;
for(const finalStatus of [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14])for(const fromCall of [false,true]){
 const states=[{status:0}],value={z:4,x:77};
 const c={pending:fromCall?1:0,argc:2,flags:3,data:{z:4,x:88},aux:{z:4,x:89}};
 const f={pending:fromCall?0:1,value:fromCall?undef():value};
 const events=[];
 const call=(l,argc,method,tail)=>{assert.equal(c.pending,2);assert.equal(argc,2);assert.equal(method,true);assert.equal(tail,true);events.push('call');f.pending=1;f.value=value;};
 const finish=(l,v)=>{assert.equal(f.pending,2);assert.equal(v,value);assert.equal(f.value,value);if(fromCall){assert.equal(c.pending,2);assert.equal(c.data.x,88);assert.equal(c.aux.x,89);}events.push('finish');states[0].status=finalStatus;};
 const complete=()=>{assert.equal(f.pending,0);assert.deepEqual(f.value,undef());assert.equal(c.pending,2);events.push('post');c.pending=0;c.data=undef();c.aux=undef();};
 if(fromCall){dispatch(states,c,f,call,finish,complete,undef);assert.deepEqual(events,['call']);assert.equal(c.pending,2);assert.equal(f.pending,1);checks++;}
 dispatch(states,c,f,call,finish,complete,undef);
 assert.deepEqual(events,fromCall?['call','finish','post']:['finish']);assert.equal(states[0].status,finalStatus);assert.equal(f.pending,0);assert.deepEqual(f.value,undef());assert.equal(c.pending,0);checks++;
}
// Queued completion has priority even when a separate call is still queued.
{
 const states=[{status:0}],c={pending:1},f={pending:1,value:{z:0,x:1}},events=[];
 dispatch(states,c,f,()=>events.push('call'),()=>events.push('finish'),()=>events.push('post'),undef);
 assert.deepEqual(events,['finish']);assert.equal(c.pending,1);checks++;
}
// Actual request function must not overwrite live or active payloads.
const body=sharedFinishRequestWGSL.slice(sharedFinishRequestWGSL.indexOf('fn requestFinish'));
const req=new Function('states','initial','value','FinishRequest',`const l=0;let finishRequest=initial;${clean(body.slice(body.indexOf('{')+1,body.lastIndexOf('}'))).replaceAll('return;','return finishRequest;')}return finishRequest;`);
for(let status=0;status<=14;status++)for(const pending of [0,1,2]){
 const states=[{status}],initial={pending,value:{z:4,x:91}},value={z:4,x:92};
 const result=req(states,initial,value,(pending,value)=>({pending,value}));
 if(status!==0){assert.equal(result,initial);assert.equal(states[0].status,status);}
 else if(pending){assert.equal(result,initial);assert.equal(states[0].status,2);}
 else{assert.equal(result.pending,1);assert.equal(result.value,value);}
 checks++;
}
// Structural checks cover checkpoint skips and instruction-budget accounting.
assert(shader.includes('markValue(l,finishRequest.value);'));
assert(shader.includes('step<params.budget||callRequest.pending!=0u||finishRequest.pending!=0u'));
assert(!seam.includes('steps++'));assert(!seam.includes('step++'));
assert(shader.includes('if(finishRequest.pending==0u){jobDispatch(l);}'));
assert.equal((shader.match(/asyncRejectDispatch\(l\);\n    if\(finishRequest.pending!=0u\)\{continue;\}/g)||[]).length,2);
assert(shader.includes('if(finishRequest.pending!=0u){continue;}\n    asyncRejectDispatch(l);'));
console.log(JSON.stringify({actualWGSLFinishOrderingChecks:checks,structuralChecks:7,gpuExecuted:false}));
