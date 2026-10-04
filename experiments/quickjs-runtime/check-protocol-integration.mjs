import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import createModule from './generated/compiler.mjs';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
import {shader} from './shader.js';
import {protocolCases} from './phase6-protocols/w8-conformance/cases.js';
const functions=new Map(),clean=shader.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
for(const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)){
 let start=clean.indexOf('{',m.index),end=start+1,depth=1;
 while(depth&&end<clean.length){if(clean[end]==='{')depth++;else if(clean[end]==='}')depth--;end++;}
 assert.equal(depth,0,m[1]);functions.set(m[1],clean.slice(start+1,end-1));
}
const active=[],done=new Set();function visit(name){assert.ok(!active.includes(name),`WGSL recursion: ${[...active,name].join(' -> ')}`);if(done.has(name))return;active.push(name);for(const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g))if(functions.has(m[1]))visit(m[1]);active.pop();done.add(name);}
for(const name of functions.keys())visit(name);
const module=await createModule(),binary=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const native=s=>JSON.parse(execFileSync(binary,[s],{encoding:'utf8',maxBuffer:1<<27}));
const wasm=s=>JSON.parse(module.ccall('lanes_compile','string',['string'],[s]));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,native(s)]));
const wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wasm(s)]));
let nativeChecks=0,packed=0;
for(const item of protocolCases()){
 const value=vm.runInNewContext(item.source+';f(0)',{}, {timeout:3000});assert.equal(value,item.expected,item.id);nativeChecks++;
 const a=packProgram(attachBootstrap(native(item.source),nb),entrySource(item.source));
 const b=packProgram(attachBootstrap(wasm(item.source),wb),entrySource(item.source));
 assert.deepEqual(a.code,b.code,item.id+' code');assert.deepEqual(a.image,b.image,item.id+' image');packed++;
}
console.log(JSON.stringify({nativeChecks,packedNativeWasmPrograms:packed,wgslFunctionsAcyclic:functions.size,gpuExecuted:false}));
