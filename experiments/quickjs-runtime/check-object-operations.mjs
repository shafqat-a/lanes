import { propertyKeySource } from './property-key-conversion-source.js';
import { primitiveSource } from './comparison-source.js';
// CPU evaluation is a test oracle only, never part of the GPU runtime.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCompiler } from './compiler.js';
import { entrySource, packProgram } from './program.js';
import { bootstrapSources, attachBootstrap, descriptorSource } from './bootstrap.js';
import { objectOperationSources as helpers } from './object-operation-source.js';
import { objectOperationSources, objectOperationResumptionSource, objectOperationResumptionExpected, objectOperationNegativeSources, objectOperationUnsupportedSources, objectOperationDirectedCases } from './object-operation-cases.js';
const compiler=await createCompiler();
const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=source=>JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));
const bootstraps=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,raw(source)]));
const prelude=`
const __lanesDefine=Object.defineProperty,__lanesOwnDescriptor=Object.getOwnPropertyDescriptor;
const __lanesPreventExtensions=Object.preventExtensions,__lanesIsExtensible=Object.isExtensible;
const __lanesDescriptor=()=>Object.create(null),__lanesNumber=Number,__lanesText=String;
const __lanesCall=Function.prototype.call.bind(Function.prototype.call),__lanesIsArray=Array.isArray;
const __lanesOwnKeys=Object.getOwnPropertyNames;
const __lanesArrayObject=value=>{if(value===null||value===undefined)throw new TypeError();if(typeof value!=='object'&&typeof value!=='function')throw new Error('Unsupported boxing');return value;};
const __lanesPrimitive=(${primitiveSource});
const __lanesUnsupported=()=>{throw new Error("Unsupported operation");};
const __lanesToPropertyKey=(${propertyKeySource});
const __lanesToDescriptor=(${helpers.toDescriptor});
const __lanesDefineProperty=(${descriptorSource});
${Object.entries(helpers).filter(([name])=>name!=='toDescriptor').map(([name,source])=>`Object.${name}=(${source});`).join('\n')}
`;
function evaluate(source,input,setup=''){
  try{return {value:new Script(setup+`(${source})(${input})`).runInNewContext({},{timeout:1000})};}
  catch(error){return {error:error.name};}
}
let checks=0;
for(const source of [...objectOperationSources,objectOperationResumptionSource,...objectOperationNegativeSources,...objectOperationUnsupportedSources]){
  const wasm=compiler.compile(source),native=packProgram(attachBootstrap(raw(source),bootstraps),entrySource(source));
  assert.deepEqual(wasm.code,native.code,source);assert.deepEqual(wasm.image,native.image,source);
  if(objectOperationUnsupportedSources.includes(source))continue;
  for(const input of [0,1,-1,17]){
    assert.deepEqual(evaluate(source,input,prelude),evaluate(source,input),source);checks++;
  }
}
for(const {source,input,expected} of objectOperationDirectedCases){
  const wasm=compiler.compile(source),native=packProgram(attachBootstrap(raw(source),bootstraps),entrySource(source));
  assert.deepEqual(wasm.code,native.code);assert.deepEqual(wasm.image,native.image);
  assert.deepEqual(evaluate(source,input,prelude),{value:expected});checks++;
}
assert.equal(evaluate(objectOperationResumptionSource,17).value,objectOperationResumptionExpected);
console.log(JSON.stringify({programs:objectOperationSources.length+1,negativePrograms:objectOperationNegativeSources.length,unsupportedPrograms:objectOperationUnsupportedSources.length,hostAlgorithmChecks:checks,nativeWasmAgreement:true,gpuChecks:false,specDirectedPrograms:objectOperationDirectedCases.length,resumptionExpected:objectOperationResumptionExpected}));
