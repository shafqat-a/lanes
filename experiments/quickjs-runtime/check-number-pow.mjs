// Host oracle only. General finite exponentiation is implementation-approximated
// in ES2025. fdlibm claims nearly rounded results; allow at most 2 ULP against
// native Math.pow (the two implementations need not round the same last bit).
// NaNs, signed zero, infinities and directed exact cases must match exactly.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { numberPowSource } from './number-pow-source.js';
import { numberPowCases,numberPowApproximateCases,numberPowCoercionCases,numberPowResumptionSource,numberPowResumptionExpected } from './number-pow-cases.js';
import { bootstrapSources,attachBootstrap } from './bootstrap.js';
import { packProgram,entrySource,LIMITS } from './program.js';

const view=new DataView(new ArrayBuffer(8));
const word=(value,high)=>{view.setFloat64(0,value,true);return view.getUint32(high?4:0,true);};
const fromBits=(lo,hi)=>{view.setUint32(0,lo,true);view.setUint32(4,hi,true);return view.getFloat64(0,true);};
function primitive(value){
  if(value===null||(typeof value!=='object'&&typeof value!=='function'))return value;
  for(const name of ['valueOf','toString']){const method=value[name];if(typeof method==='function'){const result=Reflect.apply(method,value,[]);if(result===null||(typeof result!=='object'&&typeof result!=='function'))return result;}}
  throw new TypeError('Cannot convert object to primitive');
}
const unsupported=()=>{throw new Error('Unsupported runtime operation');};
const bindings={__lanesNumber:Number,__lanesNumberWord:word,__lanesFromBits:fromBits,__lanesPrimitive:primitive,__lanesUnsupported:unsupported};
const pow=Function(...Object.keys(bindings),'return ('+numberPowSource+')')(...Object.values(bindings));
function replacePower(source){
  const nodes=[];
  function visit(node){if(!node||typeof node!=='object')return;if(node.type==='BinaryExpression'&&node.operator==='**')nodes.push(node);for(const [key,value]of Object.entries(node)){if(key==='start'||key==='end')continue;if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}}
  visit(parse(source,{ecmaVersion:2025}));
  function render(start,end){let out='',cursor=start;for(const node of nodes.filter(n=>n.start>=start&&n.end<=end).sort((a,b)=>a.start-b.start||b.end-a.end)){if(node.start<cursor)continue;out+=source.slice(cursor,node.start)+`pow(${render(node.left.start,node.left.end)},${render(node.right.start,node.right.end)})`;cursor=node.end;}return out+source.slice(cursor,end);}
  return render(0,source.length);
}
const fixtureSources=[...numberPowCases,...numberPowCoercionCases,{feature:'resumption',source:numberPowResumptionSource,input:3,expected:numberPowResumptionExpected}];
let exactChecks=0;
for(const item of fixtureSources){
  const actual=new Script(`(${replacePower(item.source)})(${item.input})`).runInNewContext({pow});
  const native=new Script(`(${item.source})(${item.input})`).runInNewContext();
  assert.ok(Object.is(actual,item.expected),`${item.feature}: helper ${actual},expected ${item.expected}`);
  assert.ok(Object.is(native,item.expected),`${item.feature}: native ${native},expected ${item.expected}`);exactChecks++;
}
for(const pair of [[1n,2n],[2,3n],[{valueOf(){return 2n;}},3]])assert.throws(()=>pow(...pair),/Unsupported runtime operation/);
const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const nativeRaw=source=>JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));
const {default:create}=await import('./generated/compiler.mjs');const wasmModule=await create();
const wasmRaw=source=>JSON.parse(wasmModule.ccall('lanes_compile','string',['string'],[source]));
const nativeBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,nativeRaw(source)]));
const wasmBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,wasmRaw(source)]));
let maxLocals=0,maxRefs=0,maxStack=0;
const compilerCases=[...fixtureSources,...numberPowApproximateCases];
for(const item of compilerCases){
  const source=item.source;
  function pack(raw,boot){
    assert.equal(raw.error,undefined);
    for(const fn of [...raw.functions,...boot.numberPow.functions]){maxLocals=Math.max(maxLocals,fn.locals);maxRefs=Math.max(maxRefs,fn.refs.length);maxStack=Math.max(maxStack,fn.stack);assert.ok(fn.locals<=LIMITS.locals&&fn.refs.length<=LIMITS.refs&&fn.stack<=LIMITS.stack);}
    return packProgram(attachBootstrap(raw,boot),entrySource(source));
  }
  const before=pack(nativeRaw(source),nativeBoot),after=pack(wasmRaw(source),wasmBoot);
  assert.deepEqual(before.code,after.code,item.feature);assert.deepEqual(before.image,after.image,item.feature);
}
const randomCount=Number(process.env.LANES_NUMBER_POW_RANDOM??20000);
assert.ok(Number.isSafeInteger(randomCount)&&randomCount>=0&&randomCount<=1000000);
let state=0x6d2b79f5;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
const rawBits=value=>{view.setFloat64(0,value,true);return view.getBigUint64(0,true);};
let finiteChecks=0,maxUlp=0n;let worst=null;
function compare(base,exponent){
 const actual=pow(base,exponent),expected=Math.pow(base,exponent);
 if(Object.is(actual,expected)){finiteChecks++;return;}
 assert.ok(Number.isFinite(actual)&&Number.isFinite(expected)&&actual!==0&&expected!==0&&Math.sign(actual)===Math.sign(expected),`Classification mismatch ${base} ** ${exponent}: ${actual},${expected}`);
 const a=rawBits(actual),b=rawBits(expected),distance=a>b?a-b:b-a;
 if(distance>maxUlp){maxUlp=distance;worst={base,exponent,actual,expected};}
 assert.ok(distance<=2n,`${base} ** ${exponent}: ${distance} ULP,actual ${actual},native ${expected}`);finiteChecks++;
}
for(const item of numberPowApproximateCases)compare(item.base,item.exponent);
for(let i=0;i<randomCount;i++){
 const base=fromBits((random()*4294967296)>>>0,(random()*0x7ff00000)>>>0);
 const exponent=(random()-0.5)*2200;
 compare(base,exponent);
 compare(1+(random()-0.5)*0.000001,(random()-0.5)*1e10);
 compare(-(random()*20),((random()*101)|0)-50);
}
for(const base of [5e-324,1e-300,.5,.9999999999999999,1.0000000000000002,1.5,2,3,Number.MAX_VALUE])
 for(const exponent of [-Infinity,-1075,-1074,-1024,-100,-3,-1,-.5,-0,0,.25,.5,1,2,3,100,1023,1024,Infinity,NaN])compare(base,exponent);
console.log(JSON.stringify({exactChecks,finiteAndSpecialDifferentialChecks:finiteChecks,randomCount,maxUlp:Number(maxUlp),worst,compilerPrograms:compilerCases.length,nativeWasmAgreement:true,maxLocals,maxRefs,maxStack,bigIntUnsupportedChecks:3,gpuChecks:false,resumptionExpected:numberPowResumptionExpected}));
