import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {phase3BigintBitwiseCases,phase3BigintBitwiseResourceCases,phase3BigintBitwiseResumption} from './phase3-bigint-bitwise-cases.js';
import {phase3BigintBitwiseWGSL} from './phase3-bigint-bitwise.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
function words(n){if(n<0n)n=-n;const result=[];while(n){result.push(Number(n&0xffffffffn));n>>=32n;}return result;}
function number(a,negative){let n=0n;for(let i=a.length-1;i>=0;i--)n=(n<<32n)+BigInt(a[i]);return negative?-n:n;}
// u32 transcriptions exercise the WGSL arithmetic; no claim of GPU execution.
function bitwise(a,b,op){const aw=words(a),bw=op===3?[]:words(b),na=a<0n,nb=op!==3&&b<0n;let length=Math.max(1,aw.length,bw.length),ca=na?1:0,cb=nb?1:0;
 if(length>64)return{status:3};const out=new Uint32Array(64),negative=[na&&nb,na||nb,na!==nb,!na][op];
 for(let i=0;i<length;i++){let av=aw[i]||0,bv=bw[i]||0;if(na){av=((~av>>>0)+ca)>>>0;ca=ca!==0&&av===0?1:0;}if(nb){bv=((~bv>>>0)+cb)>>>0;cb=cb!==0&&bv===0?1:0;}out[i]=[av&bv,av|bv,av^bv,~av][op]>>>0;}
 if(negative){let carry=1;for(let i=0;i<length;i++){out[i]=((~out[i]>>>0)+carry)>>>0;carry=carry!==0&&out[i]===0?1:0;}if(carry){if(length===64)return{status:3};out[length++]=1;}}
 while(length&&out[length-1]===0)length--;return{value:number(out.slice(0,length),negative)};
}
function shift(a,b,left){const aw=words(a),bw=words(b);if(!aw.length||!bw.length)return{value:a};const negative=a<0n,actualLeft=left!==(b<0n),amount=bw.length===1?bw[0]:2048;
 const out=new Uint32Array(64);let length=0;
 if(actualLeft){const bits=(aw.length-1)*32+32-Math.clz32(aw.at(-1));if(amount>2048-bits)return{status:3};const whole=amount>>>5,part=amount&31;for(let i=0;i<aw.length;i++){out[i+whole]|=aw[i]<<part;if(part&&i+whole+1<64)out[i+whole+1]|=aw[i]>>>(32-part);}length=(bits+amount+31)>>>5;}
 else{let discarded=false;if(amount>=aw.length*32)discarded=true;else{const whole=amount>>>5,part=amount&31;length=aw.length-whole;for(let i=0;i<whole;i++)if(aw[i])discarded=true;if(part&&(aw[whole]&((1<<part)-1)))discarded=true;for(let i=0;i<length;i++){out[i]=aw[i+whole]>>>part;if(part&&i+whole+1<aw.length)out[i]|=aw[i+whole+1]<<(32-part);}}
  if(negative&&discarded){let carry=1;for(let i=0;i<length&&carry;i++){out[i]+=carry;carry=out[i]===0?1:0;}if(carry){if(length===64)return{status:3};out[length++]=1;}}
  while(length&&out[length-1]===0)length--;
 }
 return{value:number(out.slice(0,length),negative)};
}
function check(actual,expected,label){if(words(expected).length>64)assert.equal(actual.status,3,label);else assert.equal(actual.value,expected,label);}
const fixtures=[...phase3BigintBitwiseCases,phase3BigintBitwiseResumption,...phase3BigintBitwiseResourceCases];
for(const c of fixtures)assert.equal(new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:3000}),c.expected,c.feature);
const max=(1n<<2048n)-1n,values=[0n,1n,-1n,2n,-2n,0xffffffffn,-0xffffffffn,0x100000000n,-0x100000000n,(1n<<127n)+3n,-((1n<<127n)+3n),max,-max];
let bitwiseChecks=0,shiftChecks=0;
for(const a of values){check(bitwise(a,0n,3),~a,'not');bitwiseChecks++;for(const b of values){for(let op=0;op<3;op++){check(bitwise(a,b,op),[a&b,a|b,a^b][op],'bitwise');bitwiseChecks++;}}
 for(const b of [0n,1n,-1n,31n,32n,33n,-33n,63n,64n,127n,2047n,2048n,-2048n])for(const left of [true,false]){check(shift(a,b,left),left?a<<b:a>>b,'shift');shiftChecks++;}
 for(const b of [1n<<64n,-(1n<<64n)])for(const left of [true,false]){const actual=shift(a,b,left);if(a!==0n&&left!==(b<0n))assert.equal(actual.status,3);else assert.equal(actual.value,left?a<<b:a>>b);shiftChecks++;}
}
let state=0x846adb;const rand=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
for(let i=0;i<240;i++){const width=[1,2,4,16,32,64][i%6],aw=Array.from({length:width},()=>rand()),bw=Array.from({length:width},()=>rand()),a=number(aw,!!(i&1)),b=number(bw,!!(i&2));for(let op=0;op<3;op++){check(bitwise(a,b,op),[a&b,a|b,a^b][op],'random bits');bitwiseChecks++;}check(bitwise(a,0n,3),~a,'random not');bitwiseChecks++;const count=BigInt(rand()%2200)*(i&4?-1n:1n);for(const left of [true,false]){check(shift(a,count,left),left?a<<count:a>>count,'random shift');shiftChecks++;}}
assert.ok(!phase3BigintBitwiseWGSL.includes('ptr<function>'));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();const path=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const rn=s=>JSON.parse(execFileSync(path,[s],{encoding:'utf8',maxBuffer:1<<26})),rw=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rn(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rw(s)]));
for(const c of fixtures){const a=packProgram(attachBootstrap(rn(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(rw(c.source),wb),entrySource(c.source));assert.ok(a.code.length===b.code.length&&a.code.every((v,i)=>v===b.code[i]),c.feature+': native/Wasm code mismatch (check rebuild synchronization)');assert.ok(a.image.length===b.image.length&&a.image.every((v,i)=>v===b.image[i]),c.feature+': native/Wasm image mismatch (check rebuild synchronization)');}
console.log(JSON.stringify({nativeFixtures:fixtures.length,bitwiseChecks,shiftChecks,packedParity:fixtures.length,resourceFixtures:phase3BigintBitwiseResourceCases.length,gpuChecks:false}));
