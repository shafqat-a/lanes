import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {arrayFromSources,arrayFromIntrinsics} from './array-from-source.js';
import {arrayFromCases,arrayFromCollectionsCases} from './array-from-cases.js';
import {evaluateArrayFrom} from './array-from-test-support.js';
import {createCompiler} from './compiler.js';
import {bootstrapSources,privateBuiltins,attachBootstrap} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
let directed=0;
for(const fixture of [...arrayFromCases,...arrayFromCollectionsCases]){
 const inputs=fixture.resumption?[fixture.input]:[0,1,3,-1];
 for(const input of inputs){const native=evaluateArrayFrom(fixture.source,input,false),helper=evaluateArrayFrom(fixture.source,input,true);assert.equal(native,fixture.expected,fixture.feature+' fixed native '+input);assert.equal(helper,fixture.expected,fixture.feature+' guest helper '+input);directed++;}
}
let differential=0;
for(let seed=0;seed<240;seed++){
 const count=seed%11,skip=seed%4,factor=seed%5;
 const source=`function f(){const a={length:${count}};for(let i=0;i<${count};i++)if(i%4!==${skip})a[i]=i-7;return JSON.stringify(Array.from(a,function(v,k){return v===undefined?k:v*${factor}+k;}));}`;
 assert.equal(evaluateArrayFrom(source,0,true),evaluateArrayFrom(source,0,false));differential++;
}
const binary=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const native=s=>JSON.parse(execFileSync(binary,[s],{encoding:'utf8',maxBuffer:1<<26}));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const raw=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const normalize=r=>JSON.parse(JSON.stringify(r,(key,value)=>key==='bytes'?undefined:value));
let rawParity=0;
for(const source of [...Object.values(arrayFromSources),...arrayFromCases.map(c=>c.source),...arrayFromCollectionsCases.map(c=>c.source)]){const a=native(source),b=raw(source);assert.equal(a.error,undefined,source.slice(0,100));assert.deepEqual(normalize(a),normalize(b));rawParity++;}
const integrated=bootstrapSources.arrayFrom===arrayFromSources.arrayFrom&&Object.entries(arrayFromIntrinsics).every(([key,id])=>privateBuiltins[key]===id);
let packed=0;if(integrated){const compiler=await createCompiler();const helpers=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,native(source)]));for(const fixture of [...arrayFromCases,...arrayFromCollectionsCases]){const a=packProgram(attachBootstrap(native(fixture.source),helpers),entrySource(fixture.source)),b=compiler.compile(fixture.source);assert.deepEqual(a.code,b.code,fixture.feature+' packed code');assert.deepEqual(a.image,b.image,fixture.feature+' packed image');packed++;}}
console.log(JSON.stringify({fixtures:arrayFromCases.length,collectionFixtures:arrayFromCollectionsCases.length,directed,differential,rawParity,integrated,packed,gpuExecution:false}));
