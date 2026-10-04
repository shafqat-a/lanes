import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {phase3BigintConversionCases as cases,phase3BigintConversionResourceCases as resources,phase3BigintConversionResumption as resume} from './phase3-bigint-conversion-cases.js';
import {phase3BigintConversionSources as sources} from './phase3-bigint-conversion-source.js';
import {phase3BigintConversionWGSL,phase3BigintConversionDispatchWGSL} from './phase3-bigint-conversion.js';
import {evaluateBigintConversion,bigintConversionContext,fromDigitsModel,fromNumberModel,toNumberModel,toTextModel} from './phase3-bigint-conversion-test-support.js';
const fixtures=[...cases,...resources,resume];
for(const c of fixtures){const native=new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:3000});assert.equal(native,c.expected,c.feature+' native');assert.equal(evaluateBigintConversion(c.source,c.input),c.expected,c.feature+' helper');}
let numericHelperChecks=0;
for(const [left,right,op,expected] of [[17n,5n,2,3n],[-17n,5n,3,-2n],[9n,2n,7,36n],[9n,3n,4,1n],[12n,3n,1,36n]]){const realm=bigintConversionContext();realm.leftValue=left;realm.rightValue=right;realm.operationValue=op;assert.equal(new Script(`(${sources.binaryNumber})({valueOf(){return leftValue}},{valueOf(){return rightValue}},operationValue)`).runInContext(realm),expected);numericHelperChecks++;}
for(const [op,expected] of [[1,-12n],[2,-13n],[3,13n],[4,11n],[5,12n]]){const realm=bigintConversionContext();realm.operationValue=op;assert.equal(new Script(`(${sources.unaryNumber})({valueOf(){return 12n}},operationValue)`).runInContext(realm),expected);numericHelperChecks++;}
for(const [right,expected] of [[7n,12n],["x","5x"]]){const realm=bigintConversionContext();realm.rightValue=right;assert.equal(new Script(`(${sources.addition})({valueOf(){return 5n}},rightValue)`).runInContext(realm),expected);numericHelperChecks++;}
const valid=['',' ','+000','-0','0xff','0XFF','0o765','0b101','00009','-00009','123456789012345678901234567890'];
const invalid=['+','-','0x','+0x1','-0x1','+0o1','-0b1','0o8','0b2','0xfz','1.0','1e3','Infinity','NaN','1_2','0n','1 2','\u0085','\u180e','\ud800'];
const whites=[9,10,11,12,13,32,160,5760,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8232,8233,8239,8287,12288,65279];
for(const cp of whites)valid.push(String.fromCharCode(cp)+'42'+String.fromCharCode(cp));
const context=bigintConversionContext();let grammarChecks=0;
for(const s of [...valid,...invalid]){context.inputString=s;const actual=new Script('__lanesBigIntParseString(inputString)').runInContext(context);let expected;try{expected=BigInt(s);}catch{}assert.equal(actual,expected,JSON.stringify(s));grammarChecks++;}
let arithmeticChecks=0;
for(const n of [0,-0,1,-1,0.5,-0.5,1.25,NaN,Infinity,-Infinity,Number.MIN_VALUE,Number.MAX_VALUE,Number.MAX_SAFE_INTEGER,2**53,2**1023]){const expected=Number.isFinite(n)&&Number.isInteger(n)?BigInt(n):undefined;assert.equal(fromNumberModel(n),expected);arithmeticChecks++;}
let state=0x4568ac;const rand=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
const buffer=new ArrayBuffer(8),view=new DataView(buffer);
for(let i=0;i<1500;i++){view.setUint32(0,rand(),true);view.setUint32(4,rand(),true);const n=view.getFloat64(0,true);assert.equal(fromNumberModel(n),Number.isFinite(n)&&Number.isInteger(n)?BigInt(n):undefined);arithmeticChecks++;}
const integers=[0n,1n,-1n,(1n<<53n)-1n,1n<<53n,(1n<<53n)+1n,(1n<<53n)+3n,(1n<<54n)-1n,(1n<<1024n)-(1n<<971n),(1n<<1024n)-(1n<<970n)-1n,(1n<<1024n)-(1n<<970n),(1n<<1024n)-1n,(1n<<2048n)-1n];
for(let i=0;i<220;i++){let n=0n;const width=1+rand()%64;for(let j=0;j<width;j++)n=(n<<32n)+BigInt(rand());integers.push(i&1?-n:n);}
for(const n of integers){assert.ok(Object.is(toNumberModel(n),Number(n)),String(n));arithmeticChecks++;for(const radix of [2,3,8,10,16,25,36]){const expected=n.toString(radix),actual=toTextModel(n,radix);if(expected.length>256)assert.equal(actual.status,3);else{assert.equal(actual.value,expected);const digits=n<0n?expected.slice(1):expected;assert.equal(fromDigitsModel(digits,radix,n<0n).value,n);}arithmeticChecks++;}}
// Tie cases at every binary64 exponent, including carry into infinity.
for(let bit=54;bit<=1024;bit++){const halfway=(1n<<BigInt(bit-1))+(1n<<BigInt(bit-54));for(const delta of [-1n,0n,1n])for(const sign of [-1n,1n]){const n=(halfway+delta)*sign;assert.ok(Object.is(toNumberModel(n),Number(n)));arithmeticChecks++;}}
assert.ok(!/\b(?:let|var)\s+target\b/.test(phase3BigintConversionWGSL));
// Guest Boolean carries binary64 in xy: true has x=0,y=0x3ff00000.
assert.match(phase3BigintConversionDispatchWGSL,/FromDigits\(l,original,toBits\(b.xy\),truth\(c\)\)/);
assert.doesNotMatch(phase3BigintConversionDispatchWGSL,/c\.x\s*!=\s*0u/);
let rawParity=0,packedParity=0;
if(!process.argv.includes('--no-compiler')){
 const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
 const rn=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<27})),rw=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
 for(const source of [...Object.values(sources),...fixtures.map(c=>c.source)]){assert.deepEqual(JSON.parse(JSON.stringify(rn(source),(key,value)=>key==='bytes'?undefined:value)),JSON.parse(JSON.stringify(rw(source),(key,value)=>key==='bytes'?undefined:value)),'normalized raw compiler parity');rawParity++;}
 const {bootstrapSources,attachBootstrap}=await import('./bootstrap.js');const {packProgram,entrySource}=await import('./program.js');
 if(bootstrapSources.bigintCall){const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rn(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rw(s)]));for(const c of fixtures){const a=packProgram(attachBootstrap(rn(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(rw(c.source),wb),entrySource(c.source));assert.ok(a.code.length===b.code.length&&a.code.every((v,i)=>v===b.code[i]),c.feature+' code');assert.ok(a.image.length===b.image.length&&a.image.every((v,i)=>v===b.image[i]),c.feature+' image');packedParity++;}}
}
console.log(JSON.stringify({nativeFixtures:fixtures.length,helperFixtures:fixtures.length,grammarChecks,numericHelperChecks,arithmeticChecks,rawParity,packedParity,gpuChecks:false}));
