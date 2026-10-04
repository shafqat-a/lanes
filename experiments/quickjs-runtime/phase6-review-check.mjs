import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {phase6ReviewCases} from './phase6-review-cases.js';
import {phase6MetadataCases,phase6MetadataResourceCase} from './phase6-metadata-cases.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource,FIELDS} from './program.js';
const records=[...phase6ReviewCases,...phase6MetadataCases,phase6MetadataResourceCase];
for(const c of records)assert.equal(new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:3000}),c.expected,c.feature);
const compiler=fileURLToPath(new URL('./generated/compiler',import.meta.url)),nr=s=>JSON.parse(execFileSync(compiler,[s],{encoding:'utf8',maxBuffer:1<<26}));const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wr=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nr(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wr(s)]));let packedParity=0;
for(const c of records){const a=packProgram(attachBootstrap(nr(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(wr(c.source),wb),entrySource(c.source));assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);packedParity++;}
console.log(JSON.stringify({nativeExpectations:records.length,packedParity,gpuChecks:false,metadataIntegrated:FIELDS['[Symbol.hasInstance]']!==undefined}));
