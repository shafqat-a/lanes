import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {functionSourceCases,functionSourceResourceCases,functionSourceResumptionSource,functionSourceResumptionExpected} from './function-source-cases.js';
import {packProgram,entrySource,FIELDS} from './program.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {FUNCTION_SOURCE_MAGIC,functionSourceFields} from './function-source-core.js';
import {shader} from './shader.js';
for(const name of functionSourceFields)assert.equal(typeof FIELDS[name],'number',`Missing function source field ${name}`);
assert.ok(!shader.includes('undefinedu'),'Generated shader contains undefinedu');
const binary=fileURLToPath(new URL('./generated/compiler',import.meta.url)),nr=s=>JSON.parse(execFileSync(binary,[s],{encoding:'utf8',maxBuffer:1<<26}));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wr=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const nativeOnly=process.argv.includes('--native-only');
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nr(s)]));
const wb=nativeOnly?null:Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wr(s)]));
let directed=0,parity=0,sourceRecords=0;
for(const c of [...functionSourceCases,{feature:'resumption',source:functionSourceResumptionSource,input:2,expected:functionSourceResumptionExpected},...functionSourceResourceCases]){
 const value=new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:2000});if('expected'in c)assert.equal(value,c.expected,c.feature);else assert.equal(value.length,257);directed++;
 const a=nr(c.source);assert.ok(a.features.includes('function-source-v1'));const p=packProgram(attachBootstrap(a,nb),entrySource(c.source));
 for(let f=0;f<a.functions.length;f++){const record=p.image.slice((p.image[(f*2+1)*4]-1)*4,(p.image[(f*2+1)*4])*4);assert.equal(record[3],FUNCTION_SOURCE_MAGIC);assert.equal(record[1],a.functions[f].source?.length||0);sourceRecords++;}
 if(!nativeOnly){const b=wr(c.source);assert.deepEqual(JSON.parse(JSON.stringify(a, (k,v)=>k==='bytes'?undefined:v)),JSON.parse(JSON.stringify(b,(k,v)=>k==='bytes'?undefined:v)));const q=packProgram(attachBootstrap(b,wb),entrySource(c.source));assert.deepEqual(p.code,q.code);assert.deepEqual(p.image,q.image);parity++;}
}
console.log(JSON.stringify({directed,sourceRecords,packedParity:parity,nativeOnly,gpuChecks:false}));
