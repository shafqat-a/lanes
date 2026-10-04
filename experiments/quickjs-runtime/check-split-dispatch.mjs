// Independent structural and executed-protocol checks for split GPU dispatch.
// This does not run WGSL or claim GPU semantic qualification.
import assert from 'node:assert/strict';
import {shader} from './shader.js';
import * as split from './split-dispatch-shader.js';
const clean=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
function functions(source){
 const result=new Map(),text=clean(source);
 for(const match of text.matchAll(/\bfn\s+(\w+)\s*\(/g)){
  let start=text.indexOf('{',match.index),end=start+1,depth=1;
  while(depth&&end<text.length){if(text[end]==='{')depth++;else if(text[end]==='}')depth--;end++;}
  assert.equal(depth,0,'balanced function '+match[1]);assert.ok(!result.has(match[1]),'unique function '+match[1]);result.set(match[1],text.slice(start+1,end-1));
 }
 const active=[],seen=new Set();
 function walk(name){assert.ok(!active.includes(name),'recursive WGSL '+[...active,name].join(' -> '));if(seen.has(name))return;active.push(name);for(const call of result.get(name).matchAll(/\b(\w+)\s*\(/g))if(result.has(call[1]))walk(call[1]);active.pop();seen.add(name);}
 for(const name of result.keys())walk(name);
 return result;
}
function layout(source,name,cache=new Map()){
 if(name==='u32'||name==='i32')return {align:4,size:4};
 if(name==='V'||name==='vec4<u32>')return {align:16,size:16};
 if(cache.has(name))return cache.get(name);
 const match=clean(source).match(new RegExp('struct\\s+'+name+'\\s*\\{([^}]*)\\}'));assert.ok(match,'layout declaration '+name);
 const fields=[],round=(n,a)=>Math.ceil(n/a)*a;let offset=0,align=1;
 for(const field of match[1].split(',').map(s=>s.trim()).filter(Boolean)){
  const [key,type]=field.split(':').map(s=>s.trim());const member=layout(source,type,cache);align=Math.max(align,member.align);offset=round(offset,member.align);fields.push({name:key,offset,size:member.size});offset+=member.size;
 }
 const result={align,size:round(offset,align),fields};cache.set(name,result);return result;
}
// Translate only the small scheduler entrypoint, not guest VM operations. Value
// copies are explicit because WGSL struct assignment copies, unlike JS objects.
function schedulerExecutor(body){
 let js=clean(body).replace(/\b(\d+)u\b/g,'$1').replace(/\bvar\b/g,'let').replace(/\b(let\s+\w+)\s*:\s*u32\b/g,'$1');
 js=js.replace(/\b(let\s+\w+\s*=\s*)(dispatchControl\[l\])\s*;/g,'$1structuredClone($2);');
 js=js.replace(/\b(callRequest|finishRequest)\s*=\s*([^;]+);/g,'$1=structuredClone($2);');
 js=js.replace(/((?:dispatchControl\[l\]|control)\.(?:call|completion|finish|callRequest|finishRequest))\s*=\s*([^;]+);/g,'$1=structuredClone($2);');
 js=js.replace(/(dispatchControl\[l\])\s*=\s*(control)\s*;/g,'$1=structuredClone($2);');
 // Unsupported control syntax must fail the checker instead of silently skip.
 return new Function('ctx',`with(ctx){${js}}`);
}
const {main,call,native}=split.splitDispatchShader(shader);
assert.deepEqual({main,call,native},split.splitShaders,'stable exported generation');
assert.equal(split.CONTROL_WORDS,36);assert.equal(split.PARAM_WORDS,8);assert.equal(split.INTERNAL_CALL_STATUS,15);
assert.deepEqual(split.DISPATCH_STAGES,{idle:0,callQueued:1,callCompleted:2,done:3,nativeQueued:4});
for(const source of [main,call,native]){
 assert.equal(layout(source,'CallRequest').size,64);assert.equal(layout(source,'FinishRequest').size,32);
 const control=layout(source,'DispatchControl');assert.equal(control.size,144);
 assert.deepEqual(control.fields.map(f=>[f.name,f.offset]),[['epoch',0],['stage',4],['budgetUsed',8],['pad',12],['call',16],['completion',80],['intrinsic',112]]);
 assert.equal(layout(source,'IntrinsicContext').size,32);
 assert.equal(layout(source,'Params').size,32);
 assert.match(source,/@binding\(6\)\s+var<storage,read_write>\s+dispatchControl/);
 assert.doesNotMatch(clean(source),/states\[l\]\.status\s*=\s*15u/,'internal dispatch marker must not overwrite guest completion');
}
const mainFunctions=functions(main),callFunctions=functions(call),nativeFunctions=functions(native);
assert.ok(!callFunctions.has('objectMethod'),'call kernel must prune native intrinsic tree');
assert.ok(nativeFunctions.has('objectMethod')&&!nativeFunctions.has('call')&&!nativeFunctions.has('finish')&&!nativeFunctions.has('completeCall'),'native tree isolated from call and completion');
assert.ok(!mainFunctions.has('call')&&!mainFunctions.has('objectMethod'),'main must prune call/intrinsic tree');
assert.ok(callFunctions.has('call')&&!callFunctions.has('finish')&&!callFunctions.has('completeCall'),'call must not finish or apply postactions');
assert.equal((clean(call).match(/\bcall\(l,/g)||[]).length,1);
for(const value of ['callRequest.data','callRequest.aux','finishRequest.value'])assert.ok(mainFunctions.get('collect').includes(`markValue(l,${value})`),'pending value rooted: '+value);
const mainBody=mainFunctions.get('main');
assert.ok(mainBody.indexOf('resumedCall=false;completeCall(l)')<mainBody.indexOf('step++;'),'resume precedes fresh instruction');
assert.match(mainBody,/resumedCall\|\|\(\(step<params\.budget/,'resume bypasses exhausted instruction budget and error status');
assert.match(mainBody,/if\(!sameEpoch\)\{asyncRejectDispatch\(l\)/,'initial job checkpoint once per logical step');
assert.match(mainBody,/if\(callRequest\.pending==2u\)\{completeCall\(l\);\}/,'finish continuation before call postaction');
assert.match(mainBody,/step\+\+;budgetUsed=step;/,'budget counts actual opcodes');
const callExecute=schedulerExecutor(callFunctions.get('main'));
const entryExecute=schedulerExecutor(split.splitMainEntryWGSL+'\nreturn {resumedCall,budgetUsed,sameEpoch};');
const value=(id,tag=4)=>[id,0,tag,0];
const request=()=>({pending:1,argc:3,flags:3,priorDepth:2,post:8,continuation:136,data:value(100),aux:value(101)});
const control=()=>({epoch:7,stage:1,budgetUsed:1,pad:0,call:request(),completion:{pending:0,value:value(0,3)},intrinsic:{id:0,base:0,extra:0,argc:0,flags:0,pad0:0,pad1:0,pad2:0}});
function context(){return {gid:{x:0},l:0,params:{count:2,epoch:7,budget:1},dispatchControl:[control(),control()],states:[{status:0},{status:0}],output:[{status:15},{status:15}],callRequest:request(),finishRequest:{pending:0,value:value(0,3)}};}
let callChecks=0,entryChecks=0;
// Actual generated call entrypoint: valid results, abrupt results, tail-finish
// requests, flags/argument passing, lane isolation and duplicate-dispatch guard.
for(const status of [0,1,3,4,5,6,7,8,9,10,11,12,13,14])for(const finish of [0,1])for(const flags of [0,1,2,3]){
 const c=context();c.dispatchControl[0].call.flags=flags;const untouched=structuredClone(c.dispatchControl[1]);let invoked=0;
 c.call=(lane,argc,method,tail)=>{invoked++;assert.equal(lane,0);assert.equal(argc,3);assert.equal(method,!!(flags&1));assert.equal(tail,!!(flags&2));assert.equal(c.callRequest.pending,2);c.states[0].status=status;c.finishRequest={pending:finish,value:value(202)};};
 callExecute(c);assert.equal(invoked,1);assert.equal(c.states[0].status,status);assert.equal(c.dispatchControl[0].stage,2);assert.equal(c.dispatchControl[0].call.pending,2);assert.equal(c.dispatchControl[0].completion.pending,finish);assert.deepEqual(c.dispatchControl[0].completion.value,value(202));assert.deepEqual(c.dispatchControl[0].call.data,value(100));assert.deepEqual(c.dispatchControl[0].call.aux,value(101));assert.equal(c.dispatchControl[0].budgetUsed,1);assert.deepEqual(c.dispatchControl[1],untouched);
 c.finishRequest.value[0]=999;assert.equal(c.dispatchControl[0].completion.value[0],202,'stored request copied rather than aliased');callExecute(c);assert.equal(invoked,1,'completed call must not dispatch twice');callChecks++;
}
for(const stage of [0,1,2,3,4])for(const epoch of [6,7])for(const pending of [0,1,2])for(const finish of [0,1,2]){
 const c=context();Object.assign(c.dispatchControl[0],{stage,epoch});c.dispatchControl[0].call.pending=pending;c.dispatchControl[0].completion.pending=finish;let invoked=0;c.call=()=>{invoked++;};const before=structuredClone(c.dispatchControl[0]);callExecute(c);
 if(stage!==1||epoch!==7){assert.equal(invoked,0);assert.deepEqual(c.dispatchControl[0],before);}
 else if(pending!==1||finish!==0){assert.equal(invoked,0);assert.equal(c.states[0].status,2);assert.equal(c.dispatchControl[0].stage,2);}
 else{assert.equal(invoked,1);assert.equal(c.dispatchControl[0].stage,2);}
 callChecks++;
}
// A pending finish plus abrupt status follows the original error/snapshot path,
// rather than forcing finish on re-entry. Ordinary abrupt calls without a finish
// still run completion/checkpoints, including at an exhausted instruction budget.
// The three reviewed call-kernel requestFinish sites require status==0 and return
// immediately. Test fabricated combinations too, so future sites stay defensive.
assert.match(split.splitMainEntryWGSL,/resumedCall=finishRequest\.pending==0u\|\|states\[l\]\.status==0u/);
assert.equal((clean(call).match(/\brequestFinish\(l,/g)||[]).length,3,'re-audit finish/error invariant when adding call-kernel finish sites');
// Main prologue must restore abrupt-call requests before a normal status guard.
for(const status of [0,1,3,4,5,6,7,8,9,10,11,12,13,14])for(const finish of [0,1])for(const used of [0,1,4096]){
 const c=context();c.states[0].status=status;Object.assign(c.dispatchControl[0],{stage:2,budgetUsed:used});c.dispatchControl[0].call.pending=2;c.dispatchControl[0].completion={pending:finish,value:value(303)};
 const result=entryExecute(c);assert.deepEqual(result,{resumedCall:finish===0||status===0,budgetUsed:used,sameEpoch:true});assert.equal(c.states[0].status,status);assert.deepEqual(c.callRequest,c.dispatchControl[0].call);assert.deepEqual(c.finishRequest,c.dispatchControl[0].completion);c.finishRequest.value[0]=999;assert.equal(c.dispatchControl[0].completion.value[0],303);entryChecks++;
}
for(const stage of [0,1,2,3,4])for(const epoch of [6,7]){
 const c=context();Object.assign(c.dispatchControl[0],{stage,epoch});c.dispatchControl[0].call.pending=2;const before=structuredClone(c.dispatchControl[0]);const result=entryExecute(c);
 if(epoch===7&&stage===3){assert.equal(result,undefined);assert.deepEqual(c.dispatchControl[0],before);}
 else if(epoch===7&&stage===2){assert.equal(result.resumedCall,true);}
 else if(epoch!==7&&(stage===0||stage===3)){assert.deepEqual(result,{resumedCall:false,budgetUsed:0,sameEpoch:false});assert.equal(c.dispatchControl[0].epoch,7);assert.equal(c.dispatchControl[0].budgetUsed,0);}
 else{assert.equal(c.states[0].status,2);assert.equal(c.output[0].status,2);assert.equal(c.dispatchControl[0].stage,3);}
 entryChecks++;
}
// The normalized native call must yield before the original stack cleanup.
assert.match(callFunctions.get('call'),/IntrinsicContext\(fnValue\.x,base,extra,argc,select\(0u,1u,isMethod\)\|select\(0u,2u,tail\),0u,0u,0u\);dispatchControl\[l\]\.stage=4u;return;\}states\[l\]\.sp=base;/);
for(const value of ['callRequest.data','callRequest.aux','finishRequest.value'])assert.ok(nativeFunctions.get('collect').includes(`markValue(l,${value})`),'native pending root '+value);
const nativeExecute=schedulerExecutor(nativeFunctions.get('main'));
const undefinedValue=()=>[0,0x7ff80000,3,0];let nativeChecks=0;
for(const argc of [0,1,2,3,5,16])for(const flags of [0,1,2,3])for(const status of [0,3,4,5,6,7,8]){
 const c=context(),base=5,extra=(flags&1)?2:1;
 c.dispatchControl[0].stage=4;c.dispatchControl[0].call.pending=2;
 c.dispatchControl[0].intrinsic={id:901,base,extra,argc,flags,pad0:0,pad1:0,pad2:0};
 c.states[0].stack=Array.from({length:64},(_,i)=>value(1000+i));c.states[0].sp=base+extra+argc;
 const originalStack=structuredClone(c.states[0].stack),originalSP=c.states[0].sp,otherLane=structuredClone(c.dispatchControl[1]);let invoked=0,pushed=0,finished=0;
 c.undef=undefinedValue;
 c.objectMethod=(lane,id,receiver,a,b,d)=>{
  invoked++;assert.equal(lane,0);assert.equal(id,901);assert.equal(c.states[0].sp,originalSP,'arguments remain stack roots while intrinsic runs');
  assert.deepEqual(receiver,(flags&1)?originalStack[base]:undefinedValue());
  [a,b,d].forEach((arg,i)=>assert.deepEqual(arg,argc>i?originalStack[base+extra+i]:undefinedValue(),'normalized argument '+i));
  assert.deepEqual(c.callRequest.data,value(100),'private root restored before native operation');assert.deepEqual(c.callRequest.aux,value(101));
  c.states[0].status=status;return value(505);
 };
 c.push=(lane,v)=>{pushed++;assert.equal(c.states[lane].sp,base,'stack drops original arguments before result push');c.states[lane].stack[c.states[lane].sp++]=structuredClone(v);};
 c.requestFinish=(lane,v)=>{finished++;assert.equal(c.states[lane].sp,base);assert.equal(c.states[lane].status,0);c.finishRequest={pending:1,value:structuredClone(v)};};
 nativeExecute(c);assert.equal(invoked,1);assert.equal(c.states[0].status,status);assert.equal(c.dispatchControl[0].stage,2);assert.equal(c.dispatchControl[0].call.pending,2);assert.equal(c.dispatchControl[0].budgetUsed,1);assert.equal(c.output[0].status,15,'host must resume main before publishing completion');
 assert.equal(pushed,status===0&&!(flags&2)?1:0);assert.equal(finished,status===0&&(flags&2)?1:0);assert.equal(c.states[0].sp,base+pushed,'unconditional stack cleanup even on abrupt intrinsic');assert.equal(c.dispatchControl[0].completion.pending,finished);
 if(finished){assert.deepEqual(c.dispatchControl[0].completion.value,value(505));c.finishRequest.value[0]=999;assert.equal(c.dispatchControl[0].completion.value[0],505,'finish value is copied into persistent roots');}
 assert.deepEqual(c.dispatchControl[1],otherLane);nativeExecute(c);assert.equal(invoked,1,'native completion cannot execute twice');nativeChecks++;
}
for(const stage of [0,1,2,3,4])for(const epoch of [6,7])for(const pending of [0,1,2]){
 const c=context();Object.assign(c.dispatchControl[0],{stage,epoch});c.dispatchControl[0].call.pending=pending;c.dispatchControl[0].completion.pending=1;
 c.objectMethod=()=>assert.fail('invalid native request may not execute');const before=structuredClone(c.dispatchControl[0]);nativeExecute(c);
 if(stage!==4||epoch!==7)assert.deepEqual(c.dispatchControl[0],before);else{assert.equal(c.states[0].status,2);assert.equal(c.dispatchControl[0].stage,2);}nativeChecks++;
}
for(const flags of [0,1,2,3]){
 const c=context();c.states[0].stack=[value(1),value(2),value(3)];c.states[0].sp=3;const original=structuredClone(c.states[0]);
 c.call=()=>{c.dispatchControl[0].intrinsic={id:901,base:1,extra:2,argc:0,flags,pad0:0,pad1:0,pad2:0};c.dispatchControl[0].stage=4;};
 callExecute(c);assert.equal(c.dispatchControl[0].stage,4,'call kernel must retain queued native stage');assert.equal(c.dispatchControl[0].call.pending,2);assert.equal(c.dispatchControl[0].intrinsic.flags,flags);assert.deepEqual(c.states[0],original,'native handoff must preserve argument stack');nativeChecks++;
}
assert.throws(()=>split.splitDispatchShader(shader.replace('let l=gid.x; if (l>=params.count) { return; }','let l=gid.x;')),/drift/,'fail closed on entrypoint drift');
console.log(JSON.stringify({controlBytes:144,uniformBytes:32,mainFunctions:mainFunctions.size,callFunctions:callFunctions.size,nativeFunctions:nativeFunctions.size,callProtocolChecks:callChecks,mainResumeChecks:entryChecks,nativeProtocolChecks:nativeChecks,privateRootsPreserved:true,noGuestStatus15:true,gpuExecution:false,defensiveFinishErrorGuard:true,method:'Independent WGSL layout calculation and acyclic graph checks; execute mechanically translated actual call/native entrypoints and main prologue with mocked outcomes.'}));
