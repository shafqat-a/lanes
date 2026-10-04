import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {prototypeMutationCases as cases} from './prototype-mutation-cases.js';
import {prototypeSources} from './prototype-source.js';
import {reflectSources,reflectNewIntrinsics} from './stdlib-reflect.js';
import {shader} from './shader.js';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
assert.equal(reflectNewIntrinsics.__lanesSetPrototype,2362);
assert(!shader.includes('fn setPrototype('));assert(!shader.includes('setPrototype(l,'));
const setup=`const raw=Object.setPrototypeOf;let commits=0;
const __lanesGetPrototypeOf=Object.getPrototypeOf,__lanesIsExtensible=Object.isExtensible;
const __lanesSetPrototype=(o,p)=>{commits++;return raw(o,p);};
const __lanesReflectSetPrototype=(${reflectSources.reflectSetPrototypeOf});
Object.setPrototypeOf=(${prototypeSources.objectSetPrototype});
Object.defineProperty(Object.prototype,'__proto__',{set:(${prototypeSources.legacySetPrototype})});
Reflect.setPrototypeOf=__lanesReflectSetPrototype;
`;
let values=0;for(const c of cases)for(const input of [7,8]){assert.equal(new Script(`(${c.source})(${input})`).runInNewContext(),true,c.name);assert.equal(new Script(setup+`(${c.source})(${input})`).runInNewContext(),true,c.name);values+=2;}
assert.equal(new Script(setup+`const o={};try{Object.setPrototypeOf(o,o);}catch(e){}commits;`).runInNewContext(),0,'cycles never reach trusted commit');
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));const rawN=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<26}));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
for(const c of cases){const a=packProgram(attachBootstrap(rawN(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(rawW(c.source),wb),entrySource(c.source));assert.deepEqual(a.code,b.code,c.name);assert.deepEqual(a.image,b.image,c.name);}
console.log(JSON.stringify({programs:cases.length,nativeAndGuestHelperValues:values,packedParity:cases.length,cyclesSkipTrustedCommit:true,gpuExecuted:false}));
