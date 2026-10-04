import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {arraySpeciesSources,arraySpeciesIntrinsics,speciesGetterMethods} from './array-species-source.js';
import {arraySpeciesCases} from './array-species-cases.js';
import {evaluateArraySpecies} from './array-species-test-support.js';
import {createCompiler} from './compiler.js';
import {bootstrapSources,privateBuiltins,attachBootstrap} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
let directed=0;
for(const fixture of [...arraySpeciesCases]){
 const inputs=fixture.resumption?[fixture.input]:[0,1,3,-1];
 for(const input of inputs){const native=evaluateArraySpecies(fixture.source,input,false),helper=evaluateArraySpecies(fixture.source,input,true);assert.equal(native,fixture.expected,fixture.feature+' fixed native '+input);assert.equal(helper,fixture.expected,fixture.feature+' guest helper '+input);directed++;}
}
let differential=0;
for(let seed=0;seed<120;seed++){
 const size=seed%10,skip=seed%3,start=seed%13-7,end=seed%17-3;
 for(const mode of ['map','filter','slice']){
  const op=mode==='map'?'v=>v+2':mode==='filter'?'v=>v%2===0':`${start},${end}`;
  const source=`function f(){const a=[];a.length=${size};for(let i=0;i<${size};i++)if(i%3!==${skip})a[i]=i-5;function C(n){this.size=n;}a.constructor={[Symbol.species]:C};return JSON.stringify(a.${mode}(${op}));}`;
  assert.equal(evaluateArraySpecies(source,0,true),evaluateArraySpecies(source,0,false));differential++;
 }
}

const binary=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const native=s=>JSON.parse(execFileSync(binary,[s],{encoding:'utf8',maxBuffer:1<<26}));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const raw=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const normalize=r=>JSON.parse(JSON.stringify(r,(key,value)=>key==='bytes'?undefined:value));
let rawParity=0;
for(const source of [...Object.values(arraySpeciesSources),...speciesGetterMethods.map(c=>c.source),...arraySpeciesCases.map(c=>c.source)]){const a=native(source),b=raw(source);assert.equal(a.error,undefined,source.slice(0,100));assert.deepEqual(normalize(a),normalize(b));rawParity++;}
const integrated=bootstrapSources.arraySpeciesCreate===arraySpeciesSources.arraySpeciesCreate&&Object.entries(arraySpeciesIntrinsics).every(([key,id])=>privateBuiltins[key]===id);
let packed=0;if(integrated){const compiler=await createCompiler();const helpers=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,native(source)]));for(const fixture of [...arraySpeciesCases]){const a=packProgram(attachBootstrap(native(fixture.source),helpers),entrySource(fixture.source)),b=compiler.compile(fixture.source);assert.deepEqual(a.code,b.code,fixture.feature+' packed code');assert.deepEqual(a.image,b.image,fixture.feature+' packed image');packed++;}}
console.log(JSON.stringify({fixtures:arraySpeciesCases.length,directed,differential,rawParity,integrated,packed,gpuExecution:false}));
