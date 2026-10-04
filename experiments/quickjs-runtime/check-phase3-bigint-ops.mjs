import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {phase3BigintOpsCases,phase3BigintOpsResumption,phase3BigintOpsUnsupportedCases} from './phase3-bigint-ops-cases.js';
import {phase3BigintOpsWGSL} from './phase3-bigint-ops.js';
import {fromLimbs,divTrunc,remTrunc} from './phase3/bigint-source/limbs.js';
import {bootstrapSources,attachBootstrap} from './bootstrap.js';
import {entrySource,packProgram} from './program.js';
let transientCarries=0;
const magnitude=n=>n<0n?-n:n;
function words(n){n=magnitude(n);const result=[];while(n){result.push(Number(n&0xffffffffn));n>>=32n;}return result;}
function fromWords(a){let n=0n;for(let i=a.length-1;i>=0;i--)n=(n<<32n)+BigInt(a[i]);return n;}
// Exact u32 transcription of the new WGSL loop. This exercises intermediate
// overflow/borrow behavior, but is explicitly NOT claimed as GPU execution.
function shaderModel(a,b){
 const u=words(a),v=words(b),an=u.length,bn=v.length;
 if(!bn)return {status:8};if(!an)return {q:0n,r:0n};
 if(an>64||bn>64)return {status:3};
 const remainder=new Uint32Array(64),quotient=new Uint32Array(64);
 let remaining=an*32;
 while(remaining){remaining--;let carry=(u[remaining>>>5]>>>(remaining&31))&1;
  for(let i=0;i<bn;i++){const old=remainder[i];remainder[i]=((old<<1)|carry)>>>0;carry=old>>>31;}
  if(carry)transientCarries++;
  let atLeast=carry!==0;
  if(!atLeast){let pos=bn,order=0;while(pos&&order===0){pos--;if(remainder[pos]>v[pos])order=1;else if(remainder[pos]<v[pos])order=-1;}atLeast=order>=0;}
  if(atLeast){let borrow=0;for(let i=0;i<bn;i++){const old=remainder[i],needed=(v[i]+borrow)>>>0,overflow=needed<v[i]?1:0;remainder[i]=(old-needed)>>>0;borrow=overflow!==0||old<needed?1:0;}assert.equal(carry,borrow,'remainder invariant');quotient[remaining>>>5]|=1<<(remaining&31);}
 }
 let q=fromWords(quotient),r=fromWords(remainder);if((a<0n)!==(b<0n))q=-q;if(a<0n)r=-r;return {q,r};
}
const cases=[...phase3BigintOpsCases,phase3BigintOpsResumption];
for(const c of cases)assert.equal(new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:3000}),c.expected,c.feature);
for(const c of phase3BigintOpsUnsupportedCases)assert.equal(new Script(`(${c.source})(${c.input})`).runInNewContext({}),c.nativeExpected,c.feature);
let directed=0;
const edges=[0n,1n,-1n,3n,-3n,0xffffffffn,0x100000000n,0x80000001n,0xffffffffffffffffn,(1n<<127n)-1n,(1n<<2048n)-1n];
for(const a of edges)for(const b of edges){const actual=shaderModel(a,b);if(b===0n)assert.equal(actual.status,8);else{assert.equal(actual.q,a/b);assert.equal(actual.r,a%b);}directed++;}
let state=0x629fd;const rand=()=>state=(Math.imul(state,1664525)+1013904223)>>>0;
let randomized=0;
for(let i=0;i<160;i++){
 const width=[1,2,3,8,16,32,64][i%7],other=1+rand()%width;
 const aWords=Array.from({length:width},()=>rand()),bWords=Array.from({length:other},()=>rand());aWords[width-1]=(aWords[width-1]|1)>>>0;bWords[other-1]=(bWords[other-1]|1)>>>0;
 const a=fromWords(aWords)*(i&1?-1n:1n),b=fromWords(bWords)*(i&2?-1n:1n),result=shaderModel(a,b);
 assert.equal(result.q,a/b,`random quotient ${i}`);assert.equal(result.r,a%b,`random remainder ${i}`);
 if(i<24){const av=fromLimbs(a<0n?-1:1,aWords),bv=fromLimbs(b<0n?-1:1,bWords);for(const [op,expected] of [[divTrunc,a/b],[remTrunc,a%b]]){const got=op(av,bv);assert.equal(fromWords(got.limbs)*(got.sign<0?-1n:1n),expected);}}
 randomized++;
}
assert.ok(transientCarries>0);assert.equal(shaderModel(1n<<2048n,1n).status,3);
assert.ok(!phase3BigintOpsWGSL.includes('ptr<function>'));assert.ok(phase3BigintOpsWGSL.includes('states[l].status=8u'));
const {default:create}=await import('./generated/compiler.mjs');const wasm=await create();
const native=fileURLToPath(new URL('./generated/compiler',import.meta.url));
const rawN=s=>JSON.parse(execFileSync(native,[s],{encoding:'utf8',maxBuffer:1<<26}));const rawW=s=>JSON.parse(wasm.ccall('lanes_compile','string',['string'],[s]));
const nb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawN(s)])),wb=Object.fromEntries(Object.entries(bootstrapSources).map(([k,s])=>[k,rawW(s)]));
for(const c of [...cases,...phase3BigintOpsUnsupportedCases]){const a=packProgram(attachBootstrap(rawN(c.source),nb),entrySource(c.source)),b=packProgram(attachBootstrap(rawW(c.source),wb),entrySource(c.source));assert.ok(a.code.length===b.code.length&&a.code.every((v,i)=>v===b.code[i]),c.feature+': native/Wasm code mismatch (check rebuild synchronization)');assert.ok(a.image.length===b.image.length&&a.image.every((v,i)=>v===b.image[i]),c.feature+': native/Wasm image mismatch (check rebuild synchronization)');}
console.log(JSON.stringify({nativeFixedFixtures:cases.length,nativeValidUnsupported:phase3BigintOpsUnsupportedCases.length,directedArithmetic:directed,randomizedArithmetic:randomized,transientCarries,packedParity:cases.length+phase3BigintOpsUnsupportedCases.length,maxLimbs:64,gpuChecks:false}));
