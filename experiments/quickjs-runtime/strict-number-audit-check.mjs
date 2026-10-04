import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {strictNumberAuditCases,strictNumberAuditPendingCases} from './strict-number-audit-cases.js';
import {privateBuiltins,bootstrapSources,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
assert.equal(privateBuiltins.__lanesNumber,1164);assert.equal(privateBuiltins.__lanesNumberConstructor,122);assert.equal(privateBuiltins.__lanesPow,960);
assert.match(bootstrapSources.numberConstruct,/__lanesNumberConstructor\(value\)/);
assert.match(bootstrapSources.toNumber,/__lanesBigIntToNumber\(value\)/);
assert.match(bootstrapSources.toNumberStrict,/typeof primitive==="bigint"\)throw new TypeError/);
const records=[...strictNumberAuditCases,...strictNumberAuditPendingCases];
for(const c of records)assert.equal(new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:3000}),c.expected,c.feature);
const compiler=fileURLToPath(new URL('./generated/compiler',import.meta.url)),nr=s=>JSON.parse(execFileSync(compiler,[s],{encoding:'utf8',maxBuffer:1<<26}));const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wr=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nr(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wr(s)]));let packedParity=0;
for(const c of records){const a=packProgram(attachBootstrap(nr(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(wr(c.source),wb),entrySource(c.source));assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);packedParity++;}
const guards=Object.entries(bootstrapSources).flatMap(([field,source])=>source.split('\n').filter(s=>/bigint.*Unsupported|BigInt.*pending|BigInt.*unsupported|Unsupported.*bigint/.test(s)).map(line=>({field,line:line.trim()})));
console.log(JSON.stringify({positiveNativeExpectations:strictNumberAuditCases.length,pendingNativeExpectations:strictNumberAuditPendingCases.length,packedParity,finalAliases:{strictNumber:privateBuiltins.__lanesNumber,publicNumber:privateBuiltins.__lanesNumberConstructor,numberPow:privateBuiltins.__lanesPow},remainingExplicitGuards:guards,gpuChecks:false}));
