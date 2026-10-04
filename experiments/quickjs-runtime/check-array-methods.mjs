// Host algorithm/reference and compiler check only, never a runtime backend.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import { createCompiler } from './compiler.js';
import { arraySources, arrayBuiltins, arrayMethods } from './array-source.js';
import { arrayMethodSources, arrayMethodResumptionSource } from './array-method-cases.js';
const compiler = await createCompiler();
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], {encoding:'utf8'}));
const bootstraps = Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,nativeRaw(source)]));
const setup = Object.entries(arraySources).map(([key, source]) =>
  `Array.prototype[${JSON.stringify(key.slice(5,6).toLowerCase()+key.slice(6))}] = (${source});`).join('\n');
const intrinsics = `const __lanesNumber=Number;const __lanesCall=Function.prototype.call.bind(Function.prototype.call);function __lanesArrayObject(value){if(value===null||value===undefined)throw new TypeError();if(typeof value!=="object"&&typeof value!=="function")throw new Error("Unsupported boxing");return value;}`;
let checks=0;
for (const [id,helper] of Object.entries(arrayMethods)) {
  const name=arrayBuiltins[Number(id)-300];
  assert.equal(helper,'array'+name[0].toUpperCase()+name.slice(1));
}
assert.equal(Object.keys(arrayMethods).length,Object.keys(arraySources).length);
for(const source of [...arrayMethodSources,arrayMethodResumptionSource]){
  const wasm=compiler.compile(source);
  const native=packProgram(attachBootstrap(nativeRaw(source),bootstraps),entrySource(source));
  assert.deepEqual(wasm.code,native.code,source);
  assert.deepEqual(wasm.image,native.image,source);
  for(const input of [0,1,-1,17]){
    const script=`(${source})(${input})`;
    const expected=new Script(script).runInNewContext({}, {timeout:1000});
    const actual=new Script(intrinsics+'\n'+setup+'\n'+script).runInNewContext({}, {timeout:1000});
    assert.equal(actual,expected,source);checks++;
  }
}
console.log(JSON.stringify({programs:arrayMethodSources.length+1,hostAlgorithmChecks:checks,nativeWasmAgreement:true,gpuChecks:false}));
