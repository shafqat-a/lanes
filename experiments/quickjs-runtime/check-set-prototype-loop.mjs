// Host-only execution of the actual WGSL prototype mutation body.
import assert from 'node:assert/strict';
import {shader as currentShader} from './shader.js';
import {pathToFileURL} from 'node:url';
const shader=process.argv[2]?(await import(pathToFileURL(process.argv[2]).href)).splitShaders.native:currentShader;
function body(source){const start=source.indexOf('fn setPrototype('),open=source.indexOf('{',start);let n=1,end=open+1;for(;n;end++){if(source[end]==='{')n++;if(source[end]==='}')n--;}return source.slice(open+1,end-1);}
function execute(source){return new Function('states','original','parentValue',`const l=0,objectView=(l,v)=>v,undef=()=>({z:3});${body(source).replace(/\bloop\s*\{/g,'while(true){').replace(/\b(?:let|var)\b/g,'let').replace(/\b(\d+)u\b/g,'$1')}`);}
if(!shader.includes('fn setPrototype(')){
 assert(shader.includes('fn commitPrototype('));
 const {reflectSources,reflectNewIntrinsics}=await import('./stdlib-reflect.js');
 assert.equal(reflectNewIntrinsics.__lanesSetPrototype,2362);
 assert(reflectSources.reflectSetPrototypeOf.includes('while (p !== null)'));
 console.log(JSON.stringify({nativeCycleLoopRemoved:true,guestValidationChecker:'check-prototype-mutation.mjs',gpuExecuted:false}));
 process.exit(0);
}
const run=execute(shader);let checks=0;
for(const parent of [0,2,3,4])for(const extensible of [0,1])for(const current of [0,2,3])for(const cycle of [false,true]){
 const heap=Array.from({length:8},()=>({value:{x:0,w:1}}));heap[5].value={x:current,w:extensible};
 if(cycle&&parent)heap[parent].value.x=5;
 const state={heap,status:0};const same=parent===current;
 run([state],{x:5,z:4},parent?{x:parent,z:4}:{x:0,z:2});
 const failure=!same&&(!extensible||(cycle&&parent!==0));
 assert.equal(state.status,failure?4:0);assert.equal(heap[5].value.x,failure?current:parent);checks++;
}
for(const parent of [1,5]){const heap=Array.from({length:8},()=>({value:{x:0,w:1}}));heap[1].value.x=5;const s={heap,status:0};run([s],{x:5,z:4},{x:parent,z:4});assert.equal(s.status,4);assert.equal(heap[5].value.x,0);checks++;}
console.log(JSON.stringify({actualWGSLPrototypeMutationChecks:checks,gpuExecuted:false}));
