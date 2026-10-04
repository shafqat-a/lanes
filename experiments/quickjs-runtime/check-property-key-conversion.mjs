import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createCompiler} from './compiler.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
import {propertyKeySource} from './property-key-conversion-source.js';
import {propertyKeyConversionSources,propertyKeyConversionResumptionSource,propertyKeyConversionUnsupportedSources,propertyKeyNormativeExpectations} from './property-key-conversion-cases.js';
const primitive=(value,hint)=>{
 if(value===null||!['object','function'].includes(typeof value))return value;
 for(const key of hint?['toString','valueOf']:['valueOf','toString']){const method=value[key];if(typeof method==='function'){const result=method.call(value);if(result===null||!['object','function'].includes(typeof result))return result;}}
 throw new TypeError('Cannot convert object to primitive');
};
const unsupported=()=>{throw new Error('Unsupported operation');};
const helper=new Function('__lanesPrimitive','__lanesText','__lanesUnsupported',`return (${propertyKeySource});`)(primitive,String,unsupported);
let helperChecks=0;
for(const value of [undefined,null,true,false,NaN,Infinity,-Infinity,-0,-1,1.5,1e21,1e-7,Number.MIN_VALUE,Number.MAX_VALUE,'','x',{toString(){return 1.5;}},{toString(){return {};},valueOf(){return false;}}]){
 const object={[value]:1};assert.equal(helper(value),Reflect.ownKeys(object)[0]);helperChecks++;
}
assert.throws(()=>helper({toString(){return {};},valueOf(){return {};}}),TypeError);
assert.throws(()=>helper(Symbol()),/Unsupported/);
const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=source=>JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));
const bootstraps=Object.fromEntries(Object.entries(bootstrapSources).map(([field,source])=>[field,raw(source)]));
const compiler=await createCompiler();const sources=[...propertyKeyConversionSources,propertyKeyConversionResumptionSource,...propertyKeyConversionUnsupportedSources];
for(const source of sources){const a=compiler.compile(source),b=packProgram(attachBootstrap(raw(source),bootstraps),entrySource(source));assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);}
for(const source of propertyKeyNormativeExpectations.keys())assert.ok(propertyKeyConversionSources.includes(source));
let nativeChecks=0;
for(const source of [...propertyKeyConversionSources,propertyKeyConversionResumptionSource])for(const input of [0,1,-1,17]){
 const value=new Script(`(${source})(${input})`).runInNewContext({},{timeout:1000});assert.ok(['boolean','string','number'].includes(typeof value));if(propertyKeyNormativeExpectations.has(source))assert.equal(value,propertyKeyNormativeExpectations.get(source).expectedForInput(input));if(typeof value==='boolean')assert.equal(value,true,source);nativeChecks++;
}
console.log(JSON.stringify({helperChecks,nativeChecks,compilerPrograms:sources.length,nativeWasmAgreement:true,gpuExecuted:false}));
