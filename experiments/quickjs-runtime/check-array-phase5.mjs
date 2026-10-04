// Host tests are algorithm oracles, not production guest execution.
import assert from 'node:assert/strict';
import { Script,createContext } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { arrayPhase5Sources as historicalArrayPhase5Sources } from './array-phase5-source.js';
import { arraySpeciesSources } from './array-species-source.js';
const arrayPhase5Sources={...historicalArrayPhase5Sources,...Object.fromEntries(['arrayMap','arrayFilter','arraySlice'].map(key=>[key,arraySpeciesSources[key]]))};
import { arrayPhase5Metadata } from './array-phase5-metadata.js';
import { arrayPhase5Cases,arrayPhase5UnsupportedCases,arrayPhase5ResourceCases,arrayPhase5ResumptionSource,arrayPhase5ResumptionExpected } from './array-phase5-cases.js';
const setup=`
const intrinsicDefine=Object.defineProperty,intrinsicApply=Reflect.apply,intrinsicTag=Object.prototype.toString;
const intrinsicCreate=Object.create,intrinsicDefineBool=Reflect.defineProperty,intrinsicConstruct=Reflect.construct,intrinsicProxy=Proxy;
function __lanesIsConstructor(v){try{intrinsicConstruct(new intrinsicProxy(v,{construct(){return {};}}),[]);return true;}catch(e){return false;}}
function __lanesReviverDefine(o,k,v){const d=intrinsicCreate(null);d.value=v;d.writable=true;d.enumerable=true;d.configurable=true;return intrinsicDefineBool(o,k,d);}
function __lanesUnsupported(){const e=new Error('Unsupported runtime operation');e.name='UnsupportedOperation';throw e;}
function __lanesToObject(v){if(v===null||v===undefined)throw new TypeError();return Object(v);}
function __lanesNumber(v){if(typeof v==='bigint')return __lanesUnsupported();return +v;}
function __lanesPrimitive(v,hint){if(v===null||(typeof v!=='object'&&typeof v!=='function'))return v;for(const k of hint?['toString','valueOf']:['valueOf','toString']){const m=v[k];if(typeof m==='function'){const r=intrinsicApply(m,v,[]);if(r===null||(typeof r!=='object'&&typeof r!=='function'))return r;}}throw new TypeError();}
function __lanesText(v){if(typeof v==='symbol')throw new TypeError();if(typeof v==='bigint')return __lanesUnsupported();return String(v);}
function __lanesCall(fn,receiver,...args){return intrinsicApply(fn,receiver,args);}
const __lanesDefineProperty=intrinsicDefine,__lanesIsArray=Array.isArray,__lanesObjectToString=intrinsicTag;
const __lanesArraySpeciesCreate=(function(Array){return (${arraySpeciesSources.arraySpeciesCreate});})(Array);
`+arrayPhase5Metadata.map(item=>`intrinsicDefine(Array.prototype,${JSON.stringify(item.name)},{value:(${arrayPhase5Sources[item.field]}),writable:true,configurable:true});`).join('\n');
function evaluate(source,input,helpers){const context=createContext({});if(helpers)new Script(setup).runInContext(context);return new Script(`(${source})(${input})`).runInContext(context,{timeout:2000});}
let directedChecks=0;
for(const item of arrayPhase5Cases)for(const input of [0,1,-1,3,17]){
 const expected=evaluate(item.source,input,false),actual=evaluate(item.source,input,true);
 assert.ok(Object.is(actual,expected),`${item.feature}(${input}): actual ${actual}, expected ${expected}`);directedChecks++;
}
assert.equal(evaluate(arrayPhase5ResumptionSource,3,false),arrayPhase5ResumptionExpected);
assert.equal(evaluate(arrayPhase5ResumptionSource,3,true),arrayPhase5ResumptionExpected);
// Former custom-constructor boundaries are checked in arrayPhase5Cases above.
const seeds=Number(process.env.LANES_ARRAY_PHASE5_SEEDS??200);
assert.ok(Number.isInteger(seeds)&&seeds>=0&&seeds<=10000);
let state=0x45b39a17;function random(){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;}
let randomizedChecks=0;
const shape='function shape(a){let s=""+a.length;for(let i=0;i<a.length;i++)s+=":"+(i in a?typeof a[i]+"="+a[i]:"hole");return s;}';
for(let seed=0;seed<seeds;seed++){
 const size=(random()*12)|0,values=[];for(let i=0;i<size;i++)values.push(random()<.3?'':String(((random()*41)|0)-20));
 const literal='['+values.join(',')+(values.length&&values.at(-1)===''?',':'')+']';
 const offset=((random()*20)|0)-10, end=((random()*20)|0)-5,divisor=((random()*3)|0)+2;
 const bodies=[`return a.join(${JSON.stringify(seed%2?'|':'')});`,`return a.toString();`,
 `return shape(a.map(function(v,i,o){if(i===0&&o.length>2){delete o[1];o[2]=x;}return v+i;}));`,
 `return shape(a.filter(function(v,i,o){if(i===0&&o.length>2)o[2]=x;return (v+i)%${divisor}!==0;}));`,
 `return shape(a.slice(${offset},${end}));`];
 for(const body of bodies){const source=`function f(x){${shape}const a=${literal};${body}}`;assert.ok(Object.is(evaluate(source,3,true),evaluate(source,3,false)),`random seed ${seed}: ${source}`);randomizedChecks++;}
}
let compilerPrograms=0,maxLocals=0,maxRefs=0,maxStack=0;
if(!process.argv.includes('--host-only')){
 const {createCompiler}=await import('./compiler.js');
 const {bootstrapSources,attachBootstrap}=await import('./bootstrap.js');
 const {entrySource,packProgram}=await import('./program.js');
 const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
 const raw=source=>JSON.parse(execFileSync(path,[source],{encoding:'utf8'}));
 const boot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,raw(source)]));
 for(const key of Object.keys(arrayPhase5Sources))assert.equal(bootstrapSources[key],arrayPhase5Sources[key],`${key}: root integration required`);
 const compiler=await createCompiler();
 const all=[...arrayPhase5Cases,...arrayPhase5UnsupportedCases,...arrayPhase5ResourceCases,{source:arrayPhase5ResumptionSource}];
 for(const item of all){const native=packProgram(attachBootstrap(raw(item.source),boot),entrySource(item.source)),wasm=compiler.compile(item.source);assert.deepEqual(native.code,wasm.code);assert.deepEqual(native.image,wasm.image);compilerPrograms++;}
 for(const key of Object.keys(arrayPhase5Sources))for(const fn of boot[key].functions){maxLocals=Math.max(maxLocals,fn.locals);maxRefs=Math.max(maxRefs,fn.refs.length);maxStack=Math.max(maxStack,fn.stack);}
}
console.log(JSON.stringify({directedPrograms:arrayPhase5Cases.length,directedChecks,resumptionChecks:1,unsupportedChecks:arrayPhase5UnsupportedCases.length,randomizedChecks,seeds,compilerPrograms,nativeWasmAgreement:compilerPrograms>0,maxLocals,maxRefs,maxStack,gpuChecks:false}));
