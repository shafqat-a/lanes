import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {groupBySources,groupByIntrinsics} from './group-by-source.js';
import {groupByCases} from './group-by-cases.js';
import {evaluateGroupBy} from './group-by-test-support.js';
import {createCompiler} from './compiler.js';
import {bootstrapSources,privateBuiltins,attachBootstrap} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
let directed=0;
for(const fixture of [...groupByCases]){
 const inputs=fixture.resumption?[fixture.input]:[0,1,3,-1];
 for(const input of inputs){const native=evaluateGroupBy(fixture.source,input,false),helper=evaluateGroupBy(fixture.source,input,true);assert.equal(native,fixture.expected,fixture.feature+' fixed native '+input);assert.equal(helper,fixture.expected,fixture.feature+' guest helper '+input);directed++;}
}
let differential=0;
for(let seed=0;seed<240;seed++){
 const size=seed%15,groups=seed%5+1;
 for(const mode of ['Object','Map']){
  const source=`function f(){const input=[];for(let i=0;i<${size};i++)input.push(i-5);const r=${mode}.groupBy(input,(v,k)=>k%${groups});return JSON.stringify(${mode==='Map'?'[...r]':'r'});}`;
  assert.equal(evaluateGroupBy(source,0,true),evaluateGroupBy(source,0,false));differential++;
 }
}

const binary=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const native=s=>JSON.parse(execFileSync(binary,[s],{encoding:'utf8',maxBuffer:1<<26}));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const raw=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const normalize=r=>JSON.parse(JSON.stringify(r,(key,value)=>key==='bytes'?undefined:value));
let rawParity=0;
for(const source of [...Object.values(groupBySources),...groupByCases.map(c=>c.source)]){const a=native(source),b=raw(source);assert.equal(a.error,undefined,source.slice(0,100));assert.deepEqual(normalize(a),normalize(b));rawParity++;}
const integrated=bootstrapSources.mapGroupBy===groupBySources.mapGroupBy&&Object.entries(groupByIntrinsics).every(([key,id])=>privateBuiltins[key]===id);
let packed=0;if(integrated){const compiler=await createCompiler();const helpers=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,native(source)]));for(const fixture of [...groupByCases]){const a=packProgram(attachBootstrap(native(fixture.source),helpers),entrySource(fixture.source)),b=compiler.compile(fixture.source);assert.deepEqual(a.code,b.code,fixture.feature+' packed code');assert.deepEqual(a.image,b.image,fixture.feature+' packed image');packed++;}}
console.log(JSON.stringify({fixtures:groupByCases.length,directed,differential,rawParity,integrated,packed,gpuExecution:false}));
