import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createCompiler} from './compiler.js';
import {packProgram,entrySource,OP} from './program.js';
import {privateBuiltins,attachBootstrap,bootstrapSources} from './bootstrap.js';
import {privateHelperIsolationCases as cases} from './private-helper-isolation-cases.js';
const compiler=await createCompiler(),path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<26}));
const bootstrap=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,raw(s)]));
let parity=0,rejected=0,native=0;
for(const item of cases){
 assert.throws(()=>new Script(`(${item.unresolved})(7)`).runInNewContext(),e=>e.name==='ReferenceError');native++;
 assert.equal(new Script(`(${item.isolated})(7)`).runInNewContext(),true);native++;
 for(const source of [item.unresolved,item.isolated]){
  const n=packProgram(attachBootstrap(raw(source),bootstrap),entrySource(source)),w=compiler.compile(source);
  assert.deepEqual(n.code,w.code);assert.deepEqual(n.image,w.image);parity++;
 }
 const standalone=raw(item.unresolved),packed=compiler.compile(item.unresolved);
 assert.equal(packed.code[0],OP.get_global,`${item.name} must load user global, not intrinsic`);
 // Check the whole original entry body: no private capture specification can
 // appear because every free helper load is lowered to a named global load.
 for(let i=0;i<standalone.functions[0].instructions.length;i++)if(standalone.functions[0].instructions[i].op==='get_var')assert.equal(packed.code[i*4],OP.get_global,item.name);
}
for(const name of Object.keys(privateBuiltins).filter(n=>n.startsWith('__lanes'))){assert.throws(()=>compiler.compile(`function f(x){return ${name}(x);}`),/Unsupported/);rejected++;}
// The reserved policy applies to unresolved references, not legitimate locals.
assert.equal(new Script('(function f(){const __lanesReviverDelete=()=>17;return __lanesReviverDelete();})()').runInNewContext(),17);
compiler.compile('function f(){const __lanesReviverDelete=()=>17;return __lanesReviverDelete();}');
console.log(JSON.stringify({nonreservedNames:cases.length,nativeChecks:native,packedParity:parity,reservedRejected:rejected,bootstrapHelpers:Object.keys(bootstrap).length,localReservedBindingAdmitted:true,gpuExecuted:false}));
