// Apply production integration edits to temporary module copies, never the live
// tree. Verify admitted generator images from both actual compiler bridges.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {generatorIntegrationPatch} from './generator-integration-patch.js';
import {generatorCases,generatorDelegationCases} from './generator-cases.js';

import createModule from './generated/compiler.mjs';
import {OP as previousOP,FIELDS as previousFields} from './program.js';
const root=fileURLToPath(new URL('.',import.meta.url)),directory=mkdtempSync(join(tmpdir(),'lanes-generator-preview-'));
try{
 const names=['program.js','phase4-registry.js','phase4-class-elements.js','shader.js','phase4-classes.js','bootstrap.js'];
 const original=Object.fromEntries(names.map(n=>[n,readFileSync(join(root,n),'utf8')]));
 // Shared IteratorPrototype77 is the coordinator reservation; its actual
 // initialization belongs to the separate generic-iterator integration.
 const alreadyIntegrated=original['program.js'].includes('GENERATOR_KIND_BIT');
 const patched=alreadyIntegrated?original:generatorIntegrationPatch(original,{iteratorPrototypeNode:77});
 for(const name of names){
  const code=patched[name].replace(/(from\s*|import\s*)['"](\.\.?\/[^'"]+|acorn)['"]/g,(match,prefix,specifier)=>{
   const relative=specifier.slice(2),url=specifier==='acorn'?import.meta.resolve('acorn'):pathToFileURL(join(names.includes(relative)?directory:root,specifier)).href;
   return prefix+JSON.stringify(url);
  });
  writeFileSync(join(directory,name),code);
 }
 const {bootstrapSources,attachBootstrap}=await import(pathToFileURL(join(directory,'bootstrap.js')));
 const P=await import(pathToFileURL(join(directory,'program.js'))),S=await import(pathToFileURL(join(directory,'shader.js')));
 for(const [name,id] of Object.entries(previousOP))assert.equal(P.OP[name],id,`${name} opcode stable`);
 for(const [name,id] of Object.entries(previousFields))assert.equal(P.FIELDS[name],id,`${name} field stable`);
 assert.ok(!/undefinedu|NaNu|\$\{/.test(S.shader));
 for(const fn of ['generatorEnter','generatorResume','generatorSuspend','generatorBeforeFinish','generatorUnwind'])assert.equal((S.shader.match(new RegExp('fn '+fn+'\\(','g'))||[]).length,1,`${fn} registered once`);
 const functions=new Map(),clean=S.shader.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 for(const m of clean.matchAll(/\bfn\s+(\w+)\s*\(/g)){
  let start=clean.indexOf('{',m.index),end=start+1,depth=1;
  while(depth&&end<clean.length){if(clean[end]==='{')depth++;else if(clean[end]==='}')depth--;end++;}
  assert.equal(depth,0,m[1]);functions.set(m[1],clean.slice(start+1,end-1));
 }
 const active=[],done=new Set();function visit(name){assert.ok(!active.includes(name),`WGSL recursion: ${[...active,name].join(' -> ')}`);if(done.has(name))return;active.push(name);for(const m of functions.get(name).matchAll(/\b(\w+)\s*\(/g))if(functions.has(m[1]))visit(m[1]);active.pop();done.add(name);}
 for(const name of functions.keys())visit(name);
 const module=await createModule(),native=s=>JSON.parse(execFileSync(join(root,'generated/compiler'),[s],{encoding:'utf8',maxBuffer:1<<26})),wasm=s=>JSON.parse(module.ccall('lanes_compile','string',['string'],[s]));
 const bootNative=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,native(s)])),bootWasm=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wasm(s)]));
 for(const c of [...generatorCases,...generatorDelegationCases]){const a=P.packProgram(attachBootstrap(native(c.source),bootNative),P.entrySource(c.source)),b=P.packProgram(attachBootstrap(wasm(c.source),bootWasm),P.entrySource(c.source));assert.deepEqual(a.code,b.code,c.feature);assert.deepEqual(a.image,b.image,c.feature);}

 console.log(JSON.stringify({isolatedPreview:true,liveCoreModified:false,gpuExecuted:false,packedNativeWasmPrograms:generatorCases.length+generatorDelegationCases.length,opcodesPreserved:Object.keys(previousOP).length,fieldsPreserved:Object.keys(previousFields).length,genericIterationDependencyIntegrated:true,wgslFunctionsAcyclic:functions.size}));
}finally{rmSync(directory,{recursive:true,force:true});}
