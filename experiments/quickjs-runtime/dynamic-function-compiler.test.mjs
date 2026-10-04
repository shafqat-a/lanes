import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createFunctionCompiler,createFunctionCompilerFromRaw,functionConstructorSource,checkDynamicFunctionArtifact,DynamicCompilationUnsupported} from './dynamic-function-compiler.js';
import {DynamicCompileService,encodeDynamicCompileRequest} from './dynamic-compile-request.js';
const wasm=await createFunctionCompiler();
const native=createFunctionCompilerFromRaw(source=>JSON.parse(execFileSync(fileURLToPath(new URL('./generated/compiler',import.meta.url)),[source],{encoding:'utf8'})));
// Atom numbers are compiler-process intern ids, not the exported string operand.
const normalized=raw=>({...raw,functions:raw.functions.map(fn=>({...fn,instructions:fn.instructions.map(i=>typeof i.operand==='string'?{...i,bytes:[i.bytes[0],0,0,0,0,...i.bytes.slice(5)]}:i)}))});
const fixtures=[
 [[], 'return 7'], [['a','b'],'return a+b'], [['a=7','...rest'],'return ()=>a+rest.length'],
 [['{a}','[b]'],'return a+b'], [['a','a'],'return a'], [['a // comment'],'return a'],
 [[], '"use strict"; return this'], [[], 'return typeof anonymous'], [[], 'return globalThis.x'],
 [[], 'globalThis.DO_NOT_EXECUTE=1;throw new Error("compilation executed guest code")'],
 [[], 'return function inner(){return typeof missingGlobal}'], [[], 'return new.target'],
 [['a="😀"'],'return a'], [[], 'return class C {method(){return this}}']
];
test('actual native/Wasm compile-only parity and Function metadata',()=>{
 for(const [p,b] of fixtures){
  const a=wasm.compileFunction(p,b),n=native.compileFunction(p,b),oracle=Function(...p,b);
  assert.deepEqual(normalized(a.raw),normalized(n.raw));assert.equal(a.raw.functions[0].length,oracle.length);
  assert.equal(a.source,Function.prototype.toString.call(oracle));assert.equal(a.raw.functions[0].name,'anonymous');
  assert.equal(a.lexicalEnvironment,'global');assert.equal(a.inheritCallerStrictness,false);
  checkDynamicFunctionArtifact(a);assert(Object.isFrozen(a.raw.functions[0]));
 }
 assert.equal(globalThis.DO_NOT_EXECUTE,undefined);
});
test('anonymous is a global reference, and closures only capture their own dynamic root',()=>{
 const a=wasm.compileFunction([],'return typeof anonymous');
 assert.deepEqual(a.raw.functions[0].refs.map(r=>[r.name,r.type]),[['anonymous',3]]);
 const b=wasm.compileFunction(['local'],'return ()=>local+globalThis.value');
 assert(b.raw.functions[0].refs.every(r=>r.type===3));assert(b.raw.functions[1].refs.some(r=>r.name==='local'&&r.type!==3));
 assert.throws(()=>checkDynamicFunctionArtifact({...a}),/trusted/);
});
test('independent grammar boundaries and strict early errors match native construction',()=>{
 for(const [p,b] of [ [['a){});globalThis.bad=1;(function('],''],[['/*'],'*/ return 1'],[['a=1'],'"use strict";return a'],[['a','a'],'"use strict";return a'],[[],'await 1'],[[],'return super.x'],[['a'],'} ); ( function () {'],[['a,,b'],'return 1'] ]){
  assert.throws(()=>Function(...p,b),SyntaxError);assert.throws(()=>wasm.compileFunction(p,b),SyntaxError);
 }
 assert.equal(globalThis.bad,undefined);
});
test('no CPU coercion and bounded unsupported transport',()=>{
 const hostile={toString(){throw new Error('must not run')}};
 assert.throws(()=>functionConstructorSource([hostile],''),TypeError);
 assert.throws(()=>functionConstructorSource([], ' '.repeat(257)),RangeError);
 assert.throws(()=>functionConstructorSource([], 'return "\u0000"'),DynamicCompilationUnsupported);
 assert.throws(()=>functionConstructorSource([], 'return "\uD800"'),DynamicCompilationUnsupported);
});
test('wire request reaches the actual Wasm compiler without executing guest code',async()=>{
 const service=new DynamicCompileService(wasm);
 const compiled=await service.request(encodeDynamicCompileRequest({requestId:1,lane:0,parameters:['x'],body:'globalThis.DYNAMIC_GUEST_RAN=1;return x'}));
 assert.equal(compiled.completion,'compiled');checkDynamicFunctionArtifact(compiled.artifact);assert.equal(globalThis.DYNAMIC_GUEST_RAN,undefined);
 const syntax=await service.request(encodeDynamicCompileRequest({requestId:2,lane:0,parameters:['a=1'],body:'"use strict";return a'}));assert.equal(syntax.completion,'syntax-error');
 const unsupported=await service.request(encodeDynamicCompileRequest({requestId:3,lane:0,parameters:[],body:'return "\uD800"'}));assert.equal(unsupported.completion,'unsupported');
 service.dispose();
});
