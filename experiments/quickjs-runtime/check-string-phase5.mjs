import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {stringPhase5Sources as sources} from './string-phase5-source.js';
import {stringPhase5Metadata as metadata} from './string-phase5-metadata.js';
import {stringPhase5Cases, stringPhase5ResumptionSource,stringPhase5ResumptionExpected,stringPhase5ReceiverErrorSources,stringPhase5WhitespaceSource,stringPhase5WhitespaceExpected} from './string-phase5-cases.js';
import {attachBootstrap,bootstrapSources} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
const setup=`const __lanesSlice=Function.prototype.call.bind(String.prototype.slice),__lanesCharCodeAt=Function.prototype.call.bind(String.prototype.charCodeAt);
function __lanesPrimitive(v,h){for(const k of h?["toString","valueOf"]:["valueOf","toString"]){let m=v[k];if(typeof m==="function"){let r=m.call(v);if(r===null||(typeof r!=="object"&&typeof r!=="function"))return r;}}throw new TypeError();}
function __lanesUnsupported(){throw new Error("Unsupported");}const __lanesText=String,__lanesNumber=Number;
`+metadata.map(m=>`String.prototype[${JSON.stringify(m.name)}]=(${sources[m.name]});`).join('\n');
const run=(source,input,helpers=false)=>new Script((helpers?setup:'')+`(${source})(input)`).runInNewContext({input},{timeout:2000});
const extras=[...stringPhase5ReceiverErrorSources.map(source=>({source,input:17,expected:true})),{source:stringPhase5WhitespaceSource,input:17,expected:stringPhase5WhitespaceExpected}];
let checks=0;
for(const fixture of [...stringPhase5Cases,...extras,{source:stringPhase5ResumptionSource,input:17,expected:stringPhase5ResumptionExpected,stringPhase5ReceiverErrorSources,stringPhase5WhitespaceSource,stringPhase5WhitespaceExpected}]){
 assert.equal(run(fixture.source,fixture.input),fixture.expected,fixture.feature);
 for(const input of [0,1,-1,17]){assert.equal(run(fixture.source,input,true),run(fixture.source,input),fixture.feature);checks++;}
}
const whitespace=[9,11,12,32,160,65279,10,13,8232,8233,5760,...Array.from({length:11},(_,i)=>8192+i),8239,8287,12288];
const notWhitespace=[0,8,14,133,6158,8203,8204,8288,65535];
for(const c of [...whitespace,...notWhitespace])for(const method of ['trim','trimStart','trimEnd']){
 const text=String.fromCharCode(c)+'x'+String.fromCharCode(c);
 const source=`function f(){return ${JSON.stringify(text)}.${method}();}`;assert.equal(run(source,0,true),run(source,0),method+' '+c);checks++;
}
let seed=0x3579;const rand=()=>seed=(Math.imul(seed,1664525)+1013904223)>>>0;
const units=[0,32,97,160,0xd800,0xdbff,0xdc00,0xdfff,0xfeff];
for(let i=0;i<100;i++){
 let text='';for(let n=rand()%8;n>0;n--)text+=String.fromCharCode(units[rand()%units.length]);
 for(const method of metadata.map(m=>m.name)){
 const args=method==='repeat'?[rand()%5]:method==='padStart'||method==='padEnd'?[rand()%14,'ab']:method==='at'||method==='codePointAt'?[(rand()%20)-10]:[];
 const source=`function f(){return ${JSON.stringify(text)}.${method}(${args.map(JSON.stringify).join(',')});}`;
 assert.equal(run(source,0,true),run(source,0),method);checks++;
 }
}
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url));const rawN=s=>JSON.parse(execFileSync(native,[s],{encoding:'utf8',maxBuffer:1<<25}));
const bootN=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),bootW=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
let packed=0;
for(const fixture of [...stringPhase5Cases,...extras,{source:stringPhase5ResumptionSource}]){
 const a=packProgram(attachBootstrap(rawN(fixture.source),bootN),entrySource(fixture.source)),b=packProgram(attachBootstrap(rawW(fixture.source),bootW),entrySource(fixture.source));assert.deepEqual(a.code,b.code);assert.deepEqual(a.image,b.image);packed++;
}
for(const m of metadata){
 const stamp=raw=>({...raw,functions:raw.functions.map((f,i)=>i?f:{...f,intrinsicRoot:true})});
 const a=rawN(sources[m.name]),b=rawW(sources[m.name]);assert.equal(a.functions[0].length,m.length,m.name);assert.equal(b.functions[0].length,m.length,m.name);
 const pa=packProgram(stamp(a),a.functions[0].name),pb=packProgram(stamp(b),b.functions[0].name);assert.deepEqual(pa.code,pb.code);assert.deepEqual(pa.image,pb.image);packed++;
}
console.log(JSON.stringify({methods:metadata.length,hostChecks:checks,packedNativeWasmParity:packed,fixedExpectations:stringPhase5Cases.length+extras.length+1,gpuChecks:false}));
