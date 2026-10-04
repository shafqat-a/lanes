// Compiler admission and host-oracle checks only. CPU evaluation is a test
// oracle for the fixed expected values; no guest code runs here and no GPU is used.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCompiler } from './compiler.js';
import { OP, entrySource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { languageScopeCases, languageScopeRejectedCases } from './language-scope-cases.js';
const compiler=await createCompiler();
const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=source=>JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));
const bootstraps=Object.fromEntries(Object.entries(bootstrapSources).map(([name,source])=>[name,raw(source)]));
const opNames=Object.keys(OP);
// Opcodes with a WGSL switch case: cases('a b c', ...) and ['a','b'].map((name...)=>cases(name,...)).
const shaderText=readFileSync(new URL('./shader.js',import.meta.url),'utf8');
const shaderOps=new Set([...shaderText.matchAll(/cases\('([^']+)'/g)].flatMap(m=>m[1].split(' ')));
for(const m of shaderText.matchAll(/\[((?:'[a-z0-9_]+',?)+)\]\.map\(\(name/g))for(const n of m[1].matchAll(/'([a-z0-9_]+)'/g))shaderOps.add(n[1]);
// Phase 4 cases are generated from the registry rather than literal cases('...') calls.
for(const name of (await import('./shader.js')).phase4ShaderOps)shaderOps.add(name);
function guestOps(source){
  // Guest functions only (bootstrap helpers omitted); operand kept where it selects semantics.
  const {code}=packProgram(raw(source),entrySource(source)),ops=new Set();
  for(let i=0;i<code.length;i+=4){const name=opNames[code[i]];ops.add(['special_object','throw_error'].includes(name)?`${name}/${code[i+1]}`:name);}
  return [...ops].sort();
}
function admission(source){
  let wasm,native,wasmError,nativeError;
  try{wasm=compiler.compile(source);}catch(error){wasmError=error;}
  try{native=packProgram(attachBootstrap(raw(source),bootstraps),entrySource(source));}catch(error){nativeError=error;}
  assert.equal(wasmError?.message,nativeError?.message,source);
  if(wasmError)return {admission:'rejected',reason:`${wasmError.name}: ${wasmError.message}`};
  assert.deepEqual(wasm.code,native.code,source);assert.deepEqual(wasm.image,native.image,source);
  return {admission:'admitted'};
}
function oracle(source,input){
  try{return {value:new Script(`(${source})(${JSON.stringify(input)})`).runInNewContext({},{timeout:1000})};}
  catch(error){return {error:error.name};}
}
const primitive=v=>v===null||['number','string','boolean','undefined'].includes(typeof v);
let admissionChecks=0,oracleChecks=0,inputSensitivityChecks=0;
const admitted=[],rejected=[],mismatches=[];
for(const item of [...languageScopeCases,...languageScopeRejectedCases]){
  const {feature,source,input,expected}=item;
  assert.ok(primitive(expected),feature);
  const status=admission(source);
  if(status.admission!==item.admission)mismatches.push({feature,expected:item.admission,actual:status.admission,reason:status.reason});
  admissionChecks++;
  assert.deepEqual(oracle(source,input),{value:expected},feature);oracleChecks++;
  // Every fixture must depend on its input, so a constant result cannot pass.
  assert.notDeepEqual(oracle(source,input+1),{value:expected},feature);inputSensitivityChecks++;
  if(status.admission==='admitted'){
    const ops=guestOps(source),missing=ops.filter(op=>!shaderOps.has(op.split('/')[0]));
    admitted.push({feature,ops,shaderMissing:missing,...item.note?{note:item.note}:{}});
  }else rejected.push({feature,reason:status.reason});
}
assert.deepEqual(mismatches,[],'compiler admission differs from recorded status: '+JSON.stringify(mismatches));
const values=languageScopeCases.map(c=>JSON.stringify(c.expected));
assert.equal(new Set(values).size,values.length,'admitted expected values must be distinct');
assert.ok(languageScopeCases.length>=15&&languageScopeCases.length<=25);
console.log(JSON.stringify({gpuChecks:false,guestExecution:false,
  compilerAdmission:{admitted:admitted.length,rejected:rejected.length,checks:admissionChecks,nativeWasmAgreement:true},
  hostOracle:{checks:oracleChecks,inputSensitivityChecks},
  admitted,rejected},null,1));
