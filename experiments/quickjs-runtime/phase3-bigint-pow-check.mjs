import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {comparisonHostSetup} from './phase3-bigint-comparison-test-support.js';
import {powHelperProgram,powLimbModel,limbInput,limbOutput} from './phase3-bigint-pow-test-support.js';
import {isResourceLimit} from './phase3/bigint-source/limbs.js';
import {phase3BigintPowSource} from './phase3-bigint-pow.js';
import {phase3BigintPowCases,phase3BigintPowResourceCases,phase3BigintPowResumptionSource,phase3BigintPowResumptionExpected} from './phase3-bigint-pow-cases.js';
import {bootstrapSources,attachBootstrap,privateBuiltins} from './bootstrap.js';
import {packProgram,entrySource,LIMITS,FIELDS} from './program.js';
const setup=comparisonHostSetup+`const __lanesBigIntPow=(a,b)=>a**b,__lanesPow=(a,b)=>a**b;const __pow=(${phase3BigintPowSource});`;
const fixtures=[...phase3BigintPowCases,{source:phase3BigintPowResumptionSource,expected:phase3BigintPowResumptionExpected,input:3,feature:'resumption'}];let directed=0,helperChecks=0;
for(const c of fixtures){const native=new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:3000});assert.equal(native,c.expected,c.feature);directed++;if(!c.source.includes('**=')){const helper=new Script(setup+`(${powHelperProgram(c.source)})(${c.input})`).runInNewContext({},{timeout:3000});assert.equal(helper,native,c.feature);helperChecks++;}}
let limbChecks=0,resourceChecks=0,rangeChecks=0,maxTransientNodes=0;
let seed=0x73165;const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
const pairs=[[0n,0n],[0n,1n],[0n,1n<<2047n],[1n,1n<<2047n],[-1n,(1n<<2047n)+1n],[-1n,1n<<2047n],[2n,2047n],[2n,2048n],[3n,1292n],[3n,1293n],[1n<<1024n,2n],[(1n<<2047n)+1n,1n]];
for(let i=0;i<800;i++){let base=BigInt(rand()%100000);if(rand()&1)base=-base;pairs.push([base,BigInt(rand()%180)]);}
for(const [base,exponent]of pairs){let nodes=0;const result=powLimbModel(limbInput(base),limbInput(exponent),n=>nodes+=n);maxTransientNodes=Math.max(maxTransientNodes,nodes);assert.ok(nodes<192,"Instruction allocation reserve");const expected=base**exponent;const bits=(expected<0n?-expected:expected).toString(2).length;
 if(bits>2048){assert.ok(isResourceLimit(result));resourceChecks++;}else{assert.equal(limbOutput(result),expected);limbChecks++;}}
for(const base of [0n,1n,-1n,2n,-2n]){assert.throws(()=>powLimbModel(limbInput(base),limbInput(-1n)),RangeError);rangeChecks++;}
assert.ok(isResourceLimit(powLimbModel(limbInput(2n),limbInput(1n<<2047n))));resourceChecks++;
const compiler=fileURLToPath(new URL('./generated/compiler',import.meta.url));const nr=s=>JSON.parse(execFileSync(compiler,[s],{encoding:'utf8',maxBuffer:1<<26}));const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wr=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const integrated=privateBuiltins.__lanesBigIntPow===1169&&bootstrapSources.numericPow===phase3BigintPowSource;
let nb,wb;if(integrated){assert.equal(typeof FIELDS.numericPow,'number');const {shader}=await import('./shader.js');assert.ok(!shader.includes('undefinedu'));assert.ok(shader.includes('fn phase3BigintPow('));nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nr(s)]));wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wr(s)]));}
let rawParity=0,packedParity=0;const limits={locals:0,refs:0,stack:0};
for(const source of [phase3BigintPowSource,...fixtures.map(c=>c.source),...phase3BigintPowResourceCases.map(c=>c.source)]){const a=nr(source),b=wr(source);assert.equal(a.error,undefined);assert.deepEqual(JSON.parse(JSON.stringify(a,(k,v)=>k==='bytes'?undefined:v)),JSON.parse(JSON.stringify(b,(k,v)=>k==='bytes'?undefined:v)));rawParity++;
 for(const f of a.functions)for(const [k,v]of [['locals',f.locals],['refs',f.refs.length],['stack',f.stack]]){limits[k]=Math.max(limits[k],v);assert.ok(v<=LIMITS[k]);}
 if(integrated&&source!==phase3BigintPowSource){const p=packProgram(attachBootstrap(a,nb),entrySource(source)),q=packProgram(attachBootstrap(b,wb),entrySource(source));assert.deepEqual(p.code,q.code);assert.deepEqual(p.image,q.image);packedParity++;}}
console.log(JSON.stringify({directed,helperChecks,limbChecks,resourceChecks,rangeChecks,maxTransientNodes,rawParity,packedParity,integrationPending:!integrated,limits,gpuChecks:false}));
