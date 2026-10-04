// Compiler bridge shape and actual WGSL stack preparation; host test only.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {shader} from './shader.js';
import {reflectSources,reflectNewIntrinsics} from './stdlib-reflect.js';
import {sharedCallRequestWGSL} from './shared-call-dispatch.js';
const compiler=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=JSON.parse(execFileSync(compiler,[reflectSources.reflectConstruct],{encoding:'utf8'}));
const f=raw.functions[0];assert(f.refs.some(r=>r.name==='__lanesPreparedConstruct'));
const preparedCalls=f.instructions.filter(i=>i.op==='call'&&i.operand===4);
assert.equal(preparedCalls.length,1,'prepared bridge must stay a normal four-argument call');
assert(!f.instructions.some(i=>i.op==='tail_call'&&i.operand===4));
assert.equal(reflectNewIntrinsics.__lanesPreparedConstruct,2360);
assert(shader.includes('states[l].stack[states[l].sp-5u].x==2360u){preparedConstruct(l);}'));
assert(sharedCallRequestWGSL.includes('states[l].heap[states[l].env].value.w=request.data.z'));
let start=shader.indexOf('fn preparedConstruct(');start=shader.indexOf('{',start)+1;let end=start,depth=1;
while(depth){if(shader[end]==='{')depth++;if(shader[end]==='}')depth--;end++;}
const body=shader.slice(start,end-1).replace(/\/\/[^\n]*/g,'').replace(/\b(\d+)u\b/g,'$1');
assert(!/\b(?:let|var)\s+target\b/.test(shader),'WGSL reserved target identifier');
const bridge=new Function('states','applyArguments','constructWithPrototype',`const l=0;${body}`);
let checks=0;
for(const base of [0,7])for(let argc=0;argc<=16;argc++)for(const tag of [5,11]){
 const target={x:91,z:5},newTarget={x:92,z:tag},prototype={x:93,z:4},list={x:94,z:4};
 const state={status:0,sp:base+5,stack:Array.from({length:256},()=>({z:3}))};
 state.stack.splice(base,5,{x:2360,z:11},target,list,newTarget,prototype);
 const args=Array.from({length:argc},(_,i)=>({x:100+i,z:4}));let invoked=0;
 bridge([state],(l,b,v)=>{assert.equal(b,base);assert.equal(v,list);for(let i=0;i<argc;i++)state.stack[base+2+i]=args[i];return argc;},(l,n,p,provided)=>{
  invoked++;assert.equal(n,argc);assert.equal(p,prototype);assert.equal(provided,true);
  assert.equal(state.sp,base+2+argc);assert.equal(state.stack[base],target);assert.equal(state.stack[base+1],newTarget);
  assert.deepEqual(state.stack.slice(base+2,state.sp),args);
 });
 assert.equal(invoked,1);checks++;
}
for(const sp of [0,4]){const state={sp,status:0};bridge([state],()=>assert.fail('read'),()=>assert.fail('construct'));assert.equal(state.status,2);checks++;}
// Execute actual env-root arm and markValue body: native constructor IDs are
// scalars, not heap indices (some exceed LIMITS.heap entirely).
const arm=shader.match(/if\(node.kind==4u\)\{markValue\(l,V\(node.value.z,0u,node.value.w,0u\)\);\}/)?.[0];assert(arm);
const mv=shader.match(/fn markValue\(l: u32, v: V\) \{([^\n]+)\}/)?.[1];assert(mv);
const clean=t=>t.replace(/\b(\d+)u\b/g,'$1');
const marking=new Function('node','marked',`const l=0,V=(x,y,z,w)=>({x,y,z,w}),mark=(l,x)=>marked.push(x);function markValue(l,v){${clean(mv)}}${clean(arm)}`);
let rootChecks=0;
for(const kind of [2,4,5])for(const tag of [0,5,11])for(const id of [200,600,2800]){const marked=[];marking({kind,value:{z:id,w:tag}},marked);assert.deepEqual(marked,kind===4&&tag===5?[id]:[]);rootChecks++;}
console.log(JSON.stringify({actualWGSLPreparedStackChecks:checks,compilerBridgeChecks:6,actualNewTargetRootChecks:rootChecks,gpuExecuted:false}));
