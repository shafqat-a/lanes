import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {arrayFlattenSources} from './array-flatten-source.js';
import {arraySpliceSources} from './array-splice-source.js';
import {arraySpeciesSources} from './array-species-source.js';
import {arrayFlattenCases} from './array-flatten-cases.js';
import {arraySpliceCases} from './array-splice-cases.js';
const sources={...arrayFlattenSources,...arraySpliceSources};
const setup=`const __lanesToObject=v=>{if(v==null)throw new TypeError();return Object(v);};
const __lanesNumber=v=>+v,__lanesIsArray=Array.isArray,__lanesText=String,__lanesCall=(f,t,...args)=>Reflect.apply(f,t,args);
const __lanesIsConstructor=v=>{try{Reflect.construct(function(){},[],v);return true;}catch{return false;}};
const __lanesReviverDefine=(o,k,v)=>Reflect.defineProperty(o,k,{value:v,writable:true,enumerable:true,configurable:true});
const __lanesArraySpeciesCreate=(${arraySpeciesSources.arraySpeciesCreate});
Array.prototype.flat=(${sources.arrayFlat});Array.prototype.flatMap=(${sources.arrayFlatMap});Array.prototype.splice=(${sources.arraySplice});`;
let directed=0;
for(const c of [...arrayFlattenCases,...arraySpliceCases])for(const input of c.inputs){const expression=`(${c.source})(${input})`;const native=new Script(expression).runInNewContext();const expected='expected'in c?c.expected:native;if('expected'in c)assert(Object.is(native,c.expected)||Object.is(native,c.allowedNativeExpected),c.name+' unexpected oracle difference');const actual=new Script(setup+expression).runInNewContext();assert(Object.is(actual,expected),`${c.name}: ${actual} !== ${expected}`);directed++;}
let state=0x5eed1234;const random=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;};
function literal(depth=0){const n=random(6),items=[];for(let i=0;i<n;i++)items.push(random(4)===0?'':depth<2&&random(3)===0?literal(depth+1):String(random(10)-3));return '['+items.join(',')+(n?',':'')+']';}
for(let seed=0;seed<600;seed++){
 const a=literal(),op=seed%3,depth=[0,1,2,-1,Infinity][random(5)],start=random(12)-6,del=random(8)-2;
 const operation=op===0?`a.flat(${depth})`:op===1?'a.flatMap((v,k)=>k%2?[v]:[v,,k])':`a.splice(${start},${del},${random(10)},${random(10)})`;
 const expression=`(()=>{const a=${a};const r=${operation};return JSON.stringify([a,Object.keys(a),r,Object.keys(r)]);})()`;
 assert.equal(new Script(setup+expression).runInNewContext(),new Script(expression).runInNewContext(),`seed ${seed} ${expression}`);
}
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const rawN=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<26})),rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
for(const [name,source]of Object.entries(sources)){const n=rawN(source),w=rawW(source);const normalize=r=>JSON.parse(JSON.stringify(r,(key,value)=>key==='bytes'?undefined:value));assert.deepEqual(normalize(n),normalize(w),name);assert(!n.error,name+':'+n.error);for(const f of n.functions)assert(f.locals<=64&&f.refs.length<=64&&f.args<=16,name+' frame limits');}
let packed=0;
if(process.argv.includes('--integrated')){
 const {attachBootstrap,bootstrapSources}=await import('./bootstrap.js');const {packProgram,entrySource}=await import('./program.js');
 for(const [name,source]of Object.entries(sources))assert.equal(bootstrapSources[name],source,`Missing integration ${name}`);
 const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
 for(const c of [...arrayFlattenCases,...arraySpliceCases]){const n=packProgram(attachBootstrap(rawN(c.source),nb),entrySource(c.source)),w=packProgram(attachBootstrap(rawW(c.source),wb),entrySource(c.source));assert.deepEqual(n.code,w.code,c.name);assert.deepEqual(n.image,w.image,c.name);packed++;}
}
console.log(JSON.stringify({programs:arrayFlattenCases.length+arraySpliceCases.length,directedNativeHelperValues:directed,deterministicDifferentialCases:600,seed:'0x5eed1234',helperNativeWasmParity:3,packedFixtures:packed,gpuExecuted:false}));
