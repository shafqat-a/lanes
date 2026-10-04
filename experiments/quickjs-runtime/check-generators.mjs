// Host-only evidence. Tests actual guest sources against the native oracle,
// checks native/Wasm bytecode agreement, and audits the generator WGSL hooks.
// Core admission/GPU execution are deliberately reported separately.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {generatorCases,generatorDelegationCases} from './generator-cases.js';
import {generatorOpcodes,generatorWGSLFunctions,generatorWGSLCases,generatorGCWGSL,generatorFields,generatorInitWGSL} from './generator-source.js';
import {LIMITS,FIELDS,OP} from './program.js';
import createModule from './generated/compiler.mjs';
const module=await createModule(),binary=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const fields={...FIELDS};for(const name of generatorFields)if(!(name in fields))fields[name]=Object.keys(fields).length;
const wgsl=generatorWGSLFunctions({F:fields,L:LIMITS})+Object.values(generatorWGSLCases()).join('\n')+generatorGCWGSL+generatorInitWGSL({F:fields,iteratorPrototypeNode:77,toStringTagNode:42});
assert.ok(!/undefinedu|NaNu|\$\{/.test(wgsl));
const reserved=new Set('abstract active alignas alignof as asm async await become cast catch class const_cast consteval constexpr debugger decltype delete do enum explicit export extends extern external fallthrough filter final finally friend from get goto impl implements import inline instanceof interface layout macro match meta mod module move mut mutable namespace new nil noexcept null nullptr of operator package partition pass patch precise precision private protected pub public readonly ref register require resource restrict self set shared sizeof static super target template this throw trait try type typedef typeid typename typeof union unless unsafe unsized use using virtual volatile where with yield'.split(' '));
for(const m of wgsl.matchAll(/\b(?:let|var|fn|const)\s+([A-Za-z_]\w*)/g))assert.ok(!reserved.has(m[1]),`WGSL reserved identifier ${m[1]}`);
let nativeChecks=0,rawParity=0;const observedOps=new Set();
for(const c of [...generatorCases,...generatorDelegationCases]){
 for(const [x,expected]of[[c.input,c.expected],[c.input+1,c.expectedNext]]){assert.equal(vm.runInNewContext(c.source+`;f(${x})`),expected,c.feature);nativeChecks++;}
 const native=JSON.parse(execFileSync(binary,[c.source],{encoding:'utf8',maxBuffer:1<<26}));
 const wasm=JSON.parse(module.ccall('lanes_compile','string',['string'],[c.source]));
 const normalize=r=>({...r,functions:r.functions.map(f=>({...f,instructions:f.instructions.map(i=>typeof i.operand==='string'?{...i,bytes:i.bytes.map((b,n)=>n>=1&&n<=4?0:b)}:i)}))});
 assert.deepEqual(normalize(wasm),normalize(native),`${c.feature} native/Wasm normalized bytecode`);assert.ok(native.functions.some(f=>f.kind===1),`${c.feature} nested generator compiled`);
 for(const f of native.functions)if(f.kind===1)for(const i of f.instructions){observedOps.add(i.op);assert.ok(!['tail_call','tail_call_method'].includes(i.op),'generator returns must use return_async so generator completion hook runs');}
 rawParity++;
}
for(const op of generatorOpcodes)assert.ok(observedOps.has(op),`${op} fixture coverage`);
console.log(JSON.stringify({nativeChecks,nativeWasmRawPrograms:rawParity,wgslStaticChecks:true,coreIntegrated:Object.hasOwn(OP,"initial_yield"),gpuExecuted:false,delegationDependsOnGenericIterators:true}));
