import {jsonReviverHostSetup} from './json-reviver-test-support.js';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {jsonPhase5Sources} from './json-phase5-source.js';
import {jsonPhase5Cases,jsonPhase5InvalidTexts,jsonPhase5SyntaxSources,jsonPhase5ResumptionSource,jsonPhase5ResumptionExpected,jsonPhase5ReviverCoercionSource,jsonPhase5ResourceCases} from './json-phase5-cases.js';
import {privateBuiltins} from './bootstrap.js';
import {packProgram} from './program.js';
const setup=jsonReviverHostSetup;
function run(source,input,helper=false){return new Script((helper?setup:'')+`(${source})(input)`).runInNewContext({input},{timeout:2000});}
function same(a,b){if(a===null||typeof a!=='object'){assert.ok(Object.is(a,b));return;}assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a),Object.keys(b));if(Array.isArray(a))assert.equal(a.length,b.length);for(const k of Object.keys(a))same(a[k],b[k]);}
let checks=0;
for(const c of jsonPhase5ResourceCases){assert.equal(run(c.source,c.input),c.expected);assert.equal(run(c.source,c.input,true),c.expected);checks++;}
for(const c of [...jsonPhase5Cases,{source:jsonPhase5ResumptionSource,input:17,expected:jsonPhase5ResumptionExpected}]){
 assert.equal(run(c.source,c.input),c.expected,c.feature);for(const x of [0,1,-1,17]){same(run(c.source,x,true),run(c.source,x));checks++;}
}
for(const source of jsonPhase5SyntaxSources){assert.equal(run(source,17),true);assert.equal(run(source,17,true),true);checks++;}
assert.equal(run(jsonPhase5ReviverCoercionSource,17,true),'true:0:17');assert.equal(run(jsonPhase5ReviverCoercionSource,17),'true:0:17');checks++;
let seed=0x19283;const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
const units=[0,9,34,92,97,0xd800,0xdc00,0xfeff];
function value(depth){const choice=rand()%(depth?6:4);if(choice===0)return null;if(choice===1)return (rand()%200)-100;if(choice===2)return !!(rand()%2);if(choice===3){let s='';for(let n=rand()%6;n>0;n--)s+=String.fromCharCode(units[rand()%units.length]);return s;}if(choice===4)return [value(depth-1),value(depth-1)];return {a:value(depth-1),b:value(depth-1)};}
for(let i=0;i<200;i++){const text=JSON.stringify(value(3));const source=`function f(){return JSON.parse(${JSON.stringify(text)});}`;same(run(source,0,true),run(source,0));checks++;}
for(const text of ['0','-0','1e400','-1e-400','9007199254740993','2.2250738585072014e-308','5e-324','"\\u0000"','"\\uD800"','"\\uDC00"','{"__proto__":1,"2":2,"1":3,"a":4,"a":5}']){const source=`function f(){return JSON.parse(${JSON.stringify(text)});}`;same(run(source,0,true),run(source,0));checks++;}
// Random token streams compare both acceptance and SyntaxError identity.
const alphabet='{}[],:"\\0129eE+-.truefalsn xyz';
for(let i=0;i<200;i++){let text='';for(let j=rand()%18;j>0;j--)text+=alphabet[rand()%alphabet.length];const source=`function f(){return JSON.parse(${JSON.stringify(text)});}`;let a,b,ea,eb;try{a=run(source,0);}catch(e){ea=e.name;}try{b=run(source,0,true);}catch(e){eb=e.name;}assert.equal(eb,ea,text);if(!ea)same(a,b);checks++;}
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const n=JSON.parse(execFileSync(native,[jsonPhase5Sources.parse],{encoding:'utf8',maxBuffer:1<<25}));
const w=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[jsonPhase5Sources.parse]));
assert.equal(n.error,undefined);assert.equal(w.error,undefined);assert.equal(n.functions[0].length,2);assert.equal(w.functions[0].length,2);
const normalize=raw=>JSON.parse(JSON.stringify(raw,(k,v)=>k==='bytes'?undefined:v));assert.deepEqual(normalize(n),normalize(w));
let packedHelperParity=false;
if(privateBuiltins.__lanesCodeUnit===1770){const stamp=raw=>({...raw,functions:raw.functions.map((f,i)=>i?f:{...f,intrinsicRoot:true})});const a=packProgram(stamp(n),'jsonParsePhase5'),b=packProgram(stamp(w),'jsonParsePhase5');assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);packedHelperParity=true;}
console.log(JSON.stringify({hostChecks:checks,syntaxCases:jsonPhase5InvalidTexts.length,fixedExpectations:jsonPhase5Cases.length+1,normalizedRawHelperParity:true,packedHelperParity,pendingIntrinsic:packedHelperParity?null:'__lanesCodeUnit1770 registration',gpuChecks:false}));
