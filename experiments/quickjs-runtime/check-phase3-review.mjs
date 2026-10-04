// Review checks are host arithmetic/oracle/packaging checks, NOT GPU execution.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {build} from 'esbuild';
import {createCompiler} from './compiler.js';
import {shader} from './shader.js';
import {phase3BrowserCases} from './phase3-browser-cases.js';
import {phase3ArithWGSL} from './phase3-values.js';
import {symbolIdentitySource} from './phase3-symbol-identity-wgsl.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
assert.equal(symbolIdentitySource,read('./phase3/symbol-identity/symbol-identity.wgsl'));
let normative=0;
for(const item of phase3BrowserCases){if(!item.reject||'nativeExpected' in item){assert.equal(new Script(`(${item.source})()`).runInNewContext({},{timeout:1000}),item.reject?item.nativeExpected:item.expected,item.name);normative++;}}
assert.ok(phase3ArithWGSL.includes('let productLow=p00+add_lo;'),'32-bit low product must include p00');
// Literal transcription of the shader multiply-add inner loop. Host BigInt is
// an oracle only; this does not claim WGSL execution or compiler correctness.
function multiplyAdd(av,bv,previous,carry){
 const a0=av&65535,a1=av>>>16,b0=bv&65535,b1=bv>>>16;
 const p00=(a0*b0)>>>0,p01=(a0*b1)>>>0,p10=(a1*b0)>>>0,p11=(a1*b1)>>>0;
 const cross=(p01+p10)>>>0,crossOverflow=cross<p01?1:0;
 const addLow=((cross&65535)<<16)>>>0,addHigh=((cross>>>16)+(crossOverflow<<16)+p11)>>>0;
 const productLow=(p00+addLow)>>>0,productCarry=productLow<p00?1:0;
 const low=(previous+productLow)>>>0;
 let c=productCarry+(low<previous?1:0);
 const low2=(low+carry)>>>0;c+=low2<low?1:0;
 return [low2,(addHigh+c)>>>0];
}
const values=[0,1,2,65535,65536,0x7fffffff,0xfffffffe,0xffffffff];let arithmetic=0;
for(const a of values)for(const b of values)for(const prior of values)for(const carry of values){const n=BigInt(a)*BigInt(b)+BigInt(prior)+BigInt(carry);assert.deepEqual(multiplyAdd(a,b,prior,carry),[Number(n&0xffffffffn),Number(n>>32n)],`${a}*${b}+${prior}+${carry}`);arithmetic++;}
const dir=new URL('.',import.meta.url).pathname;
const bundle=await build({entryPoints:[dir+'phase3-values.js'],bundle:true,write:false,platform:'browser',format:'esm'});
assert.equal(bundle.errors.length,0);assert.ok(!bundle.outputFiles[0].text.includes('node:fs'));
assert.ok(!read('./browser-phase3.js').includes('budget: 8192'));
// WGSL rejects mixing && and || within a parenthesis group without nesting.
const logicalGroups=[];
for(let i=0;i<shader.length;i++){
 if(shader[i]==='(')logicalGroups.push(new Set());
 else if(shader[i]===')'){const group=logicalGroups.pop();assert.ok(!group||group.size<2,'Unparenthesized mixed WGSL logical operators');}
 else if((shader.slice(i,i+2)==='&&'||shader.slice(i,i+2)==='||')&&logicalGroups.length){logicalGroups.at(-1).add(shader.slice(i,i+2));i++;}
}
const compiler=await createCompiler();
const privateSources=['function f(x){return __lanesReviverDelete(x);}','function f(x){return typeof __lanesReviverDelete;}','function f(x){return this&&__lanesReviverDelete(x);}','function f(x){return function(){return __lanesReviverDelete(x);}();}'];
for(const source of privateSources)assert.throws(()=>compiler.compile(source),/Unsupported global or module reference: __lanes/);
assert.ok(compiler.compile('function f(x){return JSON.parse("1",function(k,v){return v;});}').code.length>0);
console.log(JSON.stringify({privateFreeReferenceRejections:privateSources.length,nativeNormativeFixtures:normative,multiplyAddHostChecks:arithmetic,browserSafeValuesBundle:true,gpuChecks:false}));
