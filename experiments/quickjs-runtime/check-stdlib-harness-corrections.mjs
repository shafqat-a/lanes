import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createCompiler} from './compiler.js';
import {packProgram,entrySource} from './program.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {stdlibSuite} from './stdlib-gpu-suite.js';
import {compareStdlibValue,stdlibComparisonContract,ulpDistance} from './stdlib-numeric-comparison.js';
const previous=JSON.parse(readFileSync(new URL('../bootstrap/evidence/quickjs-safari-qualified-stdlib.json',import.meta.url))).report;
let reviewedDifferences=0,max=0n;
for(const f of previous.failures){
 const m=f.message.match(/: GPU (.*), expected (.*)$/);if(!m)continue;
 const actual=JSON.parse(m[1]),expected=JSON.parse(m[2]);
 const c=stdlibComparisonContract(f.group,f.name.slice(f.name.indexOf(':')+1));
 assert.ok(c,`No broad tolerance: missing explicit contract ${f.name}`);
 const result=compareStdlibValue(actual,expected,c);assert.equal(result.matches,true,f.name);
 for(const d of result.ulps){if(BigInt(d)>max)max=BigInt(d);if(BigInt(d)>0n)reviewedDifferences++;}
}
assert.equal(reviewedDifferences,52);assert.equal(max,1n);
const scalar=stdlibComparisonContract('numeric','Math.sin');
for(const [a,b]of [[0,-0],[NaN,0],[Infinity,-Infinity],[Infinity,Number.MAX_VALUE],[0,Number.MIN_VALUE],[1,1+2*Number.EPSILON]])assert.equal(compareStdlibValue(a,b,scalar).matches,false);
assert.equal(compareStdlibValue(1,1+Number.EPSILON,scalar).matches,true);
assert.equal(compareStdlibValue(1,1+Number.EPSILON).matches,false);
assert.equal(stdlibComparisonContract('numeric','Math.fround'),undefined);
assert.equal(stdlibComparisonContract('numeric','toFixed'),undefined);
const coercion=stdlibComparisonContract('numeric','unary-coercion-sin');assert.ok(coercion);
assert.equal(compareStdlibValue('1:v','1.0000000000000002:v',coercion).matches,true);
assert.equal(compareStdlibValue('1:v','1.0000000000000002:vv',coercion).matches,false);
assert.equal(compareStdlibValue('0:v','-0:v',coercion).matches,false);
const compiler=await createCompiler(),bin=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const raw=s=>JSON.parse(execFileSync(bin,[s],{encoding:'utf8',maxBuffer:1<<26}));
const bootstrap=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,raw(s)]));
const inputNames=new Set(['composition-brand','record-order-has-noncallable','has-result-ToBoolean','done-ToBoolean','isSupersetOf-return-called','isSupersetOf-return-noncallable']);
let transformed=0,values=0,promotions=0,parity=0,rejections=0;
for(const group of stdlibSuite.groups){
 for(const c of group.cases){
  if(group.name!=='set-extra'||!inputNames.has(c.name.split(':')[1]))continue;
  assert.ok(c.inputs.every(x=>x===null||typeof x!=='object'));
  const original=c.source.replace('if(x==="__fixture_object__")x={};','');
  for(const x of c.inputs){const a=new Script(`(${c.source})(input)`).runInNewContext({input:x},{timeout:1000});const b=new Script(`(${original})(input)`).runInNewContext({input:x==='__fixture_object__'?{}:x},{timeout:1000});assert.equal(a,b,c.name);values++;}transformed++;
  const n=packProgram(attachBootstrap(raw(c.source),bootstrap),entrySource(c.source)),w=compiler.compile(c.source);assert.deepEqual(n.code,w.code);assert.deepEqual(n.image,w.image);parity++;
 }
 for(const c of group.unsupported){
  if(c.expectedCompileError){assert.throws(()=>compiler.compile(c.source),e=>e.name===c.expectedCompileError.name&&e.message===c.expectedCompileError.message);rejections++;}
  if(!c.requiresGenericIteration||c.specExpected===undefined)continue;
  const actual=new Script(`(${c.source})(input)`).runInNewContext({input:c.input},{timeout:1000});assert.equal(actual,c.specExpected,c.name);promotions++;
  const n=packProgram(attachBootstrap(raw(c.source),bootstrap),entrySource(c.source)),w=compiler.compile(c.source);assert.deepEqual(n.code,w.code);assert.deepEqual(n.image,w.image);parity++;
 }
}
assert.equal(transformed,6);assert.ok(promotions>=9);assert.equal(rejections,1);
console.log(JSON.stringify({transformedObjectFixtures:transformed,nativeEquivalentValues:values,promotedBoundaries:promotions,packedParity:parity,exactCompileRejections:rejections,historicalMathDifferingFields:reviewedDifferences,historicalMaxUlps:String(max),gpuExecuted:false}));
