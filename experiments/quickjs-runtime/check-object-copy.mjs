import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {objectCopyCases as cases} from './object-copy-cases.js';
import {objectCopySources} from './object-copy-source.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
const setup=`const __lanesToObject=v=>{if(v===null||v===undefined)throw new TypeError();return Object(v);};
const __lanesOwnPropertyKeys=Reflect.ownKeys,__lanesOwnDescriptor=Object.getOwnPropertyDescriptor,__lanesDefine=Object.defineProperty,__lanesDescriptor=()=>Object.create(null);
Object.entries=(${objectCopySources.objectEntries});Object.assign=(${objectCopySources.objectAssign});`;
let values=0;for(const c of cases){assert.equal(new Script(`(${c.source})(7)`).runInNewContext(),c.expected,c.feature);assert.equal(new Script(setup+`(${c.source})(7)`).runInNewContext(),c.expected,c.feature);values+=2;}
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));const rawN=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<26}));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
for(const c of cases){const a=packProgram(attachBootstrap(rawN(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(rawW(c.source),wb),entrySource(c.source));assert.deepEqual(a.code,b.code,c.name);assert.deepEqual(a.image,b.image,c.name);}
console.log(JSON.stringify({programs:cases.length,nativeAndGuestHelperValues:values,packedParity:cases.length,gpuExecuted:false}));
