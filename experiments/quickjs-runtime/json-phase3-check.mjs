import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {jsonPhase3Cases,jsonPhase3CoercionCases,jsonPhase3BigIntPendingCases} from './json-phase3-cases.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
const cases=[...jsonPhase3Cases,...jsonPhase3CoercionCases,...jsonPhase3BigIntPendingCases];
for(const c of cases)assert.ok(Object.is(new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:2000}),c.expected),c.feature);
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url)),nr=s=>JSON.parse(execFileSync(native,[s],{encoding:'utf8',maxBuffer:1<<25}));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wr=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const norm=r=>JSON.parse(JSON.stringify(r,(k,v)=>k==='bytes'?undefined:v));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nr(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wr(s)]));
let rawParity=0,packedParity=0;const admissionPending=[];
for(const c of cases){const a=nr(c.source),b=wr(c.source);assert.equal(a.error,undefined,c.feature);assert.deepEqual(norm(a),norm(b));rawParity++;
 let pa,pb,ea,eb;try{pa=packProgram(attachBootstrap(a,nb),entrySource(c.source));}catch(e){ea=e;}try{pb=packProgram(attachBootstrap(b,wb),entrySource(c.source));}catch(e){eb=e;}
 if(ea||eb){assert.equal(ea?.message,eb?.message,c.feature);admissionPending.push({feature:c.feature,reason:ea.message});continue;}
 assert.deepEqual(pa.code,pb.code);assert.deepEqual(pa.image,pb.image);packedParity++;
}
if(process.argv.includes('--require-phase3'))assert.equal(admissionPending.length,0,JSON.stringify(admissionPending));
console.log(JSON.stringify({fixedNativeOracles:cases.length,rawParity,packedParity,admissionPending,ordinaryCases:jsonPhase3Cases.length,coercionDependencyCases:jsonPhase3CoercionCases.length,explicitBigIntBoundaryCases:jsonPhase3BigIntPendingCases.length,gpuChecks:false}));
