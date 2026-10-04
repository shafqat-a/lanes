import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {stringCaseData} from './string-case-data.js';
import {stringCaseStorage,stringCaseLayout} from './string-case-buffer.js';
import {stringCaseWGSL} from './string-case-wgsl.js';
import {stringCaseSources} from './string-case-source.js';
import {stringCaseCases,stringCaseVersionCases,stringCaseResumptionSource,stringCaseResumptionExpected} from './string-case-cases.js';
import {casePoint,caseFlags,evaluateStringCase} from './string-case-test-support.js';
import {stringCaseReviewCases,stringCaseReviewResourceCases} from './string-case-review-cases.js';
import {bootstrapSources,privateBuiltins,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource,LIMITS} from './program.js';
const root=dirname(fileURLToPath(import.meta.url)),vendor=join(root,'vendor');
for(const [name,hash] of Object.entries(stringCaseData.vendorSHA256))assert.equal(createHash('sha256').update(readFileSync(join(vendor,name))).digest('hex'),hash,`stale generated ${name}`);
const temp=mkdtempSync(join(tmpdir(),'lanes-case-check-'));let raw;
try{execFileSync(process.env.CC||'cc',['-O2','-I',vendor,join(root,'string-case-generator.c'),join(vendor,'libunicode.c'),join(vendor,'cutils.c'),'-o',join(temp,'generate')]);raw=JSON.parse(execFileSync(join(temp,'generate'),[],{encoding:'utf8',maxBuffer:1<<24}));}finally{rmSync(temp,{force:true,recursive:true});}
assert.equal(raw.version,stringCaseData.version);assert.deepEqual(raw.flags,stringCaseData.flags);
// Validate the uploaded representation, not just the logical generation data.
let tableOffset=0;for(const [name,rows] of [['upperRanges',stringCaseData.upper.ranges],['upperExpansions',stringCaseData.upper.expansions],['lowerRanges',stringCaseData.lower.ranges],['lowerExpansions',stringCaseData.lower.expansions],['flags',stringCaseData.flags]]){assert.deepEqual(stringCaseLayout[name],{offset:tableOffset,length:rows.length});for(const row of rows){assert.deepEqual([...stringCaseStorage.subarray(tableOffset*4,tableOffset*4+4)],[...row,...Array(4-row.length).fill(0)]);tableOffset++;}}
assert.equal(stringCaseStorage.length,tableOffset*4);assert.ok(!stringCaseWGSL.includes('const unicode_'));assert.match(stringCaseWGSL,/@binding\(5\) var<storage, read>/);
let flagAt=0;for(let cp=0;cp<=0x10ffff;cp++){while(raw.flags[flagAt]&&cp>raw.flags[flagAt][1])flagAt++;const row=raw.flags[flagAt];assert.equal(caseFlags(cp),row&&cp>=row[0]?row[2]:0);}
let exhaustive=0,nativeDifferences=0;const differenceExamples=[];
for(let mode=0;mode<2;mode++){let at=0;const rows=raw.maps[mode];for(let cp=0;cp<=0x10ffff;cp++){
 const row=rows[at]?.[0]===cp?rows[at++]:[cp,cp];const expected=row.slice(1);
 for(let index=0;index<3;index++)assert.equal(casePoint(cp,mode,index),expected[index]??-1,`U+${cp.toString(16)} mode${mode} index${index}`);
 const text=String.fromCodePoint(cp),native=mode?text.toLowerCase():text.toUpperCase();
 if(native!==String.fromCodePoint(...expected)){nativeDifferences++;if(differenceExamples.length<10)differenceExamples.push({cp,mode});}
 exhaustive++;
}}
// An engine on the same data version must agree for all single code points.
if(process.versions.unicode==='17.0')assert.equal(nativeDifferences,0);
let directed=0;
for(const c of [...stringCaseCases,...stringCaseReviewCases,...stringCaseVersionCases,{feature:'resumption',source:stringCaseResumptionSource,input:3,expected:stringCaseResumptionExpected}]){
 assert.equal(evaluateStringCase(c.source,c.input,true),c.expected,c.feature);
 if(!stringCaseVersionCases.includes(c))assert.equal(evaluateStringCase(c.source,c.input,false),c.expected,c.feature);
 for(const input of [0,1,-1,3,17]){if(!stringCaseVersionCases.includes(c))assert.equal(evaluateStringCase(c.source,input,true),evaluateStringCase(c.source,input,false),c.feature);directed++;}
}
for(const c of stringCaseReviewResourceCases){assert.equal(evaluateStringCase(c.source,17,true).length,c.nativeLength);assert.equal(evaluateStringCase(c.source,17,false).length,c.nativeLength);}
let state=0x21835;const rand=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
const points=[65,97,0x3a3,0x3c2,0x345,0x301,0x27,0x200d,0x20,0,0xdf,0x130,0xfb03,0xd800,0xdc00,0x10428,0x10400,0x1f80];let differential=0;
for(let i=0;i<300;i++){let text='';for(let j=rand()%15;j>0;j--)text+=String.fromCodePoint(points[rand()%points.length]);for(const method of ['toUpperCase','toLowerCase']){const source=`function f(){return ${JSON.stringify(text)}.${method}();}`;assert.equal(evaluateStringCase(source,0,true),evaluateStringCase(source,0,false));differential++;}}
const native=join(root,'generated/compiler');const nativeRaw=s=>JSON.parse(execFileSync(native,[s],{encoding:'utf8',maxBuffer:1<<25}));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create(),wasmRaw=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const norm=r=>JSON.parse(JSON.stringify(r,(k,v)=>k==='bytes'?undefined:v));
const integrated=privateBuiltins.__lanesUnicodeCasePoint===1852&&privateBuiltins.__lanesUnicodeCaseFlags===1853;
let nativeBoot,wasmBoot;if(integrated){nativeBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,nativeRaw(s)]));wasmBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,wasmRaw(s)]));}
let parity=0,packedParity=0;const limits={locals:0,refs:0,stack:0};
for(const [source,helper] of [...Object.values(stringCaseSources).map(s=>[s,true]),...[...stringCaseCases,...stringCaseReviewCases,...stringCaseVersionCases,{source:stringCaseResumptionSource},...stringCaseReviewResourceCases].map(c=>[c.source,false])]){
 const a=nativeRaw(source),b=wasmRaw(source);assert.equal(a.error,undefined);assert.deepEqual(norm(a),norm(b));parity++;
 for(const f of a.functions){limits.locals=Math.max(limits.locals,f.locals);limits.refs=Math.max(limits.refs,f.refs.length);limits.stack=Math.max(limits.stack,f.stack);assert.ok(f.locals<=LIMITS.locals&&f.refs.length<=LIMITS.refs&&f.stack<=LIMITS.stack);}
 if(integrated){if(helper){a.functions[0].intrinsicRoot=true;b.functions[0].intrinsicRoot=true;}const p=packProgram(attachBootstrap(a,nativeBoot),entrySource(source)),q=packProgram(attachBootstrap(b,wasmBoot),entrySource(source));assert.deepEqual(p.code,q.code);assert.deepEqual(p.image,q.image);packedParity++;}
}
console.log(JSON.stringify({unicodeVersion:stringCaseData.version,hostUnicode:process.versions.unicode,exhaustiveCodePointMappings:exhaustive,nativeDifferences,differenceExamples,directed,differential,parity,packedParity,limits,storageBytes:stringCaseStorage.byteLength,wgslBytes:stringCaseWGSL.length,gpuChecks:false}));
