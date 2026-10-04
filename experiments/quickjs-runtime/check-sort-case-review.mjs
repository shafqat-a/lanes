import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {packProgram,entrySource} from './program.js';
import {Script,createContext} from 'node:vm';
import {arraySortSources} from './array-sort-source.js';
import {arraySortReviewCases} from './array-sort-review-cases.js';
import {stringCaseSources} from './string-case-source.js';
import {stringCaseData} from './string-case-data.js';
import {stringCaseReviewCases,stringCaseReviewResourceCases} from './string-case-review-cases.js';
function point(cp,lower,index){const data=lower?stringCaseData.lower:stringCaseData.upper;const expansion=data.expansions.find(r=>r[0]===cp);if(expansion)return expansion[index+1]||-1;if(index)return -1;const range=data.ranges.find(r=>cp>=r[0]&&cp<=r[1]&&(cp-r[0])%r[2]===0);return range?(cp+range[3])>>>0:cp;}
function flags(cp){return stringCaseData.flags.find(r=>cp>=r[0]&&cp<=r[1])?.[2]||0;}
const setup=`const primitiveString=String,primitiveNumber=Number,define=Object.defineProperty,create=Object.create,codeUnit=String.fromCharCode,charCode=String.prototype.charCodeAt;
function __lanesToObject(v){if(v==null)throw new TypeError();return Object(v);}
function __lanesNumber(v){return +v;}
function __lanesDescriptor(){return create(null);}
const __lanesDefineProperty=define;
function __lanesToText(v){if(typeof v==='symbol')throw new TypeError();return primitiveString(v);}
const __lanesText=__lanesToText;
function __lanesPrimitive(v){for(const name of ['toString','valueOf']){if(typeof v[name]==='function'){const r=v[name]();if(r===null||(typeof r!=='object'&&typeof r!=='function'))return r;}}throw new TypeError();}
function __lanesCharCodeAt(v,i){return Reflect.apply(charCode,v,[i]);}
const __lanesCodeUnit=codeUnit;
function __lanesUnsupported(){throw new Error('Unsupported');}
Array.prototype.sort=(${arraySortSources.arraySort});
Array.prototype.toSorted=(${arraySortSources.arrayToSorted});
String.prototype.toUpperCase=(${stringCaseSources.stringToUpperCase});
String.prototype.toLowerCase=(${stringCaseSources.stringToLowerCase});`;
function run(item,helpers){const context=createContext({__lanesUnicodeCasePoint:point,__lanesUnicodeCaseFlags:flags});if(helpers)new Script(setup).runInContext(context);return new Script(`(${item.source})(${item.input??17})`).runInContext(context,{timeout:3000});}
for(const item of [...arraySortReviewCases,...stringCaseReviewCases]){assert.equal(run(item,false),item.expected,`fixed native ${item.feature}`);assert.equal(run(item,true),item.expected,`helper ${item.feature}`);}
for(const item of stringCaseReviewResourceCases){assert.equal(run(item,false).length,item.nativeLength,item.feature);assert.equal(run(item,true).length,item.nativeLength,item.feature);}
const {default:createCompiler}=await import('./generated/compiler.mjs');
const wasm=await createCompiler();
const rawW=source=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[source]));
const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const rawN=source=>JSON.parse(execFileSync(path,[source],{encoding:'utf8',maxBuffer:1<<26}));
const nativeBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,rawN(source)]));
const wasmBoot=Object.fromEntries(Object.entries(bootstrapSources).map(([key,source])=>[key,rawW(source)]));
const all=[...arraySortReviewCases,...stringCaseReviewCases,...stringCaseReviewResourceCases];
for(const item of all){
 const a=packProgram(attachBootstrap(rawN(item.source),nativeBoot),entrySource(item.source));
 const b=packProgram(attachBootstrap(rawW(item.source),wasmBoot),entrySource(item.source));
 assert.deepEqual(a.code,b.code,item.feature);assert.deepEqual(a.image,b.image,item.feature);
}
console.log(JSON.stringify({sortDirected:arraySortReviewCases.length,stringDirected:stringCaseReviewCases.length,nativeValidResourcePrograms:stringCaseReviewResourceCases.length,packedNativeWasmParity:all.length,gpuChecks:false}));
