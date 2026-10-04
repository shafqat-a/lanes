// Host differential tests are test oracles only, never a runtime fallback.
// Usage: node check-stdlib-numeric.mjs [--quick]
import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{fileURLToPath}from'node:url';import{Script,createContext}from'node:vm';
import{numericMethods,numericIntrinsics,numericPending,numericReserved,twoOverPiChunks}from'./stdlib-numeric.js';
import{numericCases,numericUnsupportedSources,numericResumptionSource,numericResumptionExpected}from'./stdlib-numeric-cases.js';
import{attachBootstrap,bootstrapSources,privateBuiltins}from'./bootstrap.js';
import{packProgram,entrySource,LIMITS,FIELDS}from'./program.js';import{createCompiler}from'./compiler.js';
import{NUMERIC_ID_FIRST,NUMERIC_ID_LAST}from'./stdlib-ids.js';
const quick=process.argv.includes('--quick');
const view=new DataView(new ArrayBuffer(8));const word=(x,high)=>{view.setFloat64(0,x,true);return view.getUint32(high?4:0,true);};const bits=(lo,hi)=>{view.setUint32(0,lo>>>0,true);view.setUint32(4,hi>>>0,true);return view.getFloat64(0,true);};
function primitive(x){if(x===null||!['object','function'].includes(typeof x))return x;const exotic=x[Symbol.toPrimitive];if(exotic!==undefined&&exotic!==null){const v=exotic.call(x,'number');if(v===null||!['object','function'].includes(typeof v))return v;throw new TypeError('bad @@toPrimitive');}for(const key of ['valueOf','toString']){const fn=x[key];if(typeof fn==='function'){const v=fn.call(x);if(v===null||!['object','function'].includes(typeof v))return v;}}throw new TypeError('Cannot convert to primitive');}
const bindings={__lanesPrimitive:primitive,__lanesNumber:Number,__lanesNumberWord:word,__lanesFromBits:bits,__lanesDescriptor:()=>Object.create(null),__lanesCharCodeAt:(s,i)=>s.charCodeAt(i),__lanesSlice:(s,a,b)=>s.slice(a,b),__lanesThisNumber:v=>Number.prototype.valueOf.call(v)};
// Contract: every intrinsic name used by the sources is declared and matches bootstrap privateBuiltins.
for(const[name,id]of Object.entries(numericIntrinsics))assert.equal(privateBuiltins[name],id,name);
assert.deepEqual(Object.keys(bindings).sort(),Object.keys(numericIntrinsics).sort());
const helpers=Object.fromEntries(numericMethods.map(m=>[m.field,Function(...Object.keys(bindings),'return ('+m.source+')')(...Object.values(bindings))]));
const native=Object.fromEntries(numericMethods.map(m=>[m.field,m.owner==='global'?globalThis[m.name]:m.owner==='Number.prototype'?Number.prototype[m.name]:globalThis[m.owner][m.name]]));
// Metadata checks.
const ids=new Set(),fields=new Set();for(const m of numericMethods){assert.ok(m.id>=NUMERIC_ID_FIRST&&m.id<=NUMERIC_ID_LAST);assert.ok(!ids.has(m.id)&&!fields.has(m.field));ids.add(m.id);fields.add(m.field);assert.equal(m.length,native[m.field].length,m.name+' length');assert.ok(!/\bMath\.|globalThis/.test(m.source),m.name+' must not use host Math');}
for(const id of Object.values(numericReserved)){assert.ok(id>=NUMERIC_ID_FIRST&&id<=NUMERIC_ID_LAST&&!ids.has(id));ids.add(id);}
// 2/pi table: recompute floor(2^1584*2/pi) with BigInt (Machin) and compare chunks.
{const P=1700n,one=1n<<P;const arctanInv=k=>{let s=0n,t=one/k,n=1n,sign=1n;const k2=k*k;while(t!==0n){s+=sign*(t/n);t/=k2;n+=2n;sign=-sign;}return s;};const pi=4n*(4n*arctanInv(5n)-arctanInv(239n));const v=((2n*one)<<1584n)/pi>>0n;const expect=[];let r=v;for(let i=65;i>=0;i--){expect[i]=Number(r&0xffffffn);r>>=24n;}
// v = floor(2/pi*2^1584) has an integer part 0, so all 66 chunks are fraction bits.
assert.deepEqual([...twoOverPiChunks],expect,'two_over_pi table');}
let seed=0x9e3779b9;function rnd(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}
const uniform=()=>rnd()/4294967296;const randomBits=()=>bits(rnd(),rnd());
const special=[NaN,Infinity,-Infinity,0,-0,5e-324,-5e-324,2.2250738585072014e-308,2.225073858507201e-308,-2.2250738585072014e-308,1.7976931348623157e308,-1.7976931348623157e308,1,-1,0.5,-0.5,2,-2,3,-3,0.1,-0.1,1e-300,1e300,-1e300,Math.PI,Math.PI/2,Math.PI/4,-Math.PI/2,3*Math.PI/4,709.782712893384,709.7827128933841,-745.1332191019411,-745.1332191019412,710.4758600739439,710.475860073944,22,-22,0.34657359027997264,1.0397207708399179,2**-28,2**-27,2**-29,2**-54,2**-55,2**-1022,2**-1023,2**-1074,2**1023,2**53,2**53+2,2**31,2**32,-(2**31),4294967295,4294967296,4294967297,0.41421356237309503,-0.2928932188134524,-0.29289321881345254,0.975,0.9999999999999999,-0.9999999999999999,1.0000000000000002,65504,65519.99,65520,65535,2**-24,2**-25,3*2**-26,2**-14,6.103515625e-5,3.4028234663852886e38,3.4028235677973366e38,3.4028235677973362e38,1.401298464324817e-45,7.006492321624085e-46,7.006492321624087e-46,1.1754942106924411e-38,1e22,1e100,2**1000,1e308,2**19*Math.PI/2,2**20*Math.PI/2,2**60,2**66,-(2**66),9007199254740993,1/3,2/3,123456789,0.7853981633974483,0.6744,0.6743999999999999];
function corpus(count){const out=[...special];for(let i=0;i<count;i++){const k=i%8;let x;
  if(k===0)x=randomBits();else if(k===1)x=(uniform()*2-1)*Math.PI*4;else if(k===2)x=(uniform()*2-1)*800;else if(k===3)x=(uniform()*2-1);
  else if(k===4)x=bits(rnd(),(rnd()&0x800fffff)|((0x3c0+(rnd()%0x90))<<20));else if(k===5)x=(uniform()*2-1)*2**(rnd()%1100-60);
  else if(k===6)x=Math.round((uniform()*2-1)*1e6)*(Math.PI/2)+(uniform()-0.5)*1e-9;else x=bits(rnd(),rnd()&0x801fffff|((rnd()%3)<<20));out.push(x);}return out;}
let exactChecks=0;const mismatches={};
function same(actual,expected,label,field){if(Object.is(actual,expected)){exactChecks++;return;}(mismatches[field]??=[]).push(label+': got '+actual+' expected '+expected);}
const unaryFields=numericMethods.filter(m=>m.length===1&&m.owner==='Math').map(m=>m.field);
const exactFields=['mathSqrt','mathFround','mathClz32','mathF16round','mathCbrt'];
const N=quick?20000:200000,NT=quick?20000:150000;
const counts={};
for(const field of unaryFields){const xs=corpus(exactFields.includes(field)?N:NT);counts[field]=xs.length;for(const x of xs)same(helpers[field](x),native[field](x),String(x),field);}
// sqrt: also exact squares/near-squares and subnormal ranges.
for(let i=0;i<(quick?5000:50000);i++){const r=bits(rnd(),rnd()&0x7fffffff);const s=Math.sqrt(r);for(const x of [s*s,bits(word(s*s,false)+1,word(s*s,true)),bits(rnd(),rnd()&0x000fffff)])same(helpers.mathSqrt(x),Math.sqrt(x),String(x),'mathSqrt');}
// fround/f16round: values on and next to binary32/binary16 rounding boundaries.
const f32=new Float32Array(1);for(let i=0;i<(quick?5000:50000);i++){f32[0]=0;const u32=new Uint32Array(f32.buffer);u32[0]=rnd();const a=f32[0];if(!isFinite(a))continue;const b=Math.fround(a*(1+2**-23));const mid=(a+b)/2;for(const x of [mid,bits(word(mid,false)+1,word(mid,true)),bits(word(mid,false)-1,word(mid,true))])same(helpers.mathFround(x),Math.fround(x),String(x),'mathFround');}
{const h16=new Float16Array(1),u16=new Uint16Array(h16.buffer);for(let v=0;v<65536;v++){u16[0]=v;const a=h16[0];if(!isFinite(a))continue;u16[0]=v+1;const b=h16[0];if(!isFinite(b)||(v&0x7fff)===0x7bff){continue;}const mid=(a+b)/2;for(const x of [a,mid,bits(word(mid,false)+1,word(mid,true)),bits(word(mid,false)-1,word(mid,true))])same(helpers.mathF16round(x),Math.f16round(x),String(x),'mathF16round');}
for(const x of [65504,65519,65519.99999999999,65520,65520.00000000001,-65520,6e-8,5.960464477539063e-8,2.9802322387695312e-8,2.980232238769532e-8])same(helpers.mathF16round(x),Math.f16round(x),String(x),'mathF16round');}
// Two-argument functions.
const pairCount=quick?20000:150000;const xs2=corpus(pairCount);
for(let i=0;i<xs2.length;i++){const a=xs2[i],b=xs2[(i*7919+13)%xs2.length];
  same(helpers.mathImul(a,b),Math.imul(a,b),a+','+b,'mathImul');same(helpers.mathAtan2(a,b),Math.atan2(a,b),a+','+b,'mathAtan2');
  same(helpers.mathHypot(a,b),Math.hypot(a,b),a+','+b,'mathHypot');const c=xs2[(i*31+7)%xs2.length];same(helpers.mathHypot(a,b,c),Math.hypot(a,b,c),a+','+b+','+c,'mathHypot');}
for(let i=0;i<(quick?20000:100000);i++){const a=rnd()|0,b=rnd()|0;same(helpers.mathImul(a,b),Math.imul(a,b),a+','+b,'mathImul');const n=rnd()>>>(rnd()&31);same(helpers.mathClz32(n),Math.clz32(n),String(n),'mathClz32');}
for(const a of special)for(const b of special){same(helpers.mathAtan2(a,b),Math.atan2(a,b),a+','+b,'mathAtan2');same(helpers.mathHypot(a,b),Math.hypot(a,b),a+','+b,'mathHypot');same(helpers.mathImul(a,b),Math.imul(a,b),a+','+b,'mathImul');}
same(helpers.mathHypot(),Math.hypot(),'()','mathHypot');same(helpers.mathHypot(-0),Math.hypot(-0),'-0','mathHypot');same(helpers.mathHypot(NaN,Infinity),Infinity,'NaN,Inf','mathHypot');same(helpers.mathHypot(-Infinity,NaN),Infinity,'-Inf,NaN','mathHypot');
for(let n=1;n<=16;n++){const args=Array.from({length:n},()=>(uniform()-0.5)*2**(rnd()%40-20));same(helpers.mathHypot(...args),Math.hypot(...args),'hypot'+n,'mathHypot');}
// Global isNaN/isFinite: coercion (strings, wrappers, objects) and thrown TypeErrors.
const coercion=[undefined,null,true,false,'','  12  ','abc','0x1F','0b101','0o17','-0','  -Infinity ','1e1000','1_0','\n\t 3.5  ','.5','5.','+.5e-3',NaN,0,-0,1,Infinity,-Infinity,5e-324,new Number(3),new String('7'),{valueOf(){return '9';}},{toString(){return 'x';}},[],[1],[1,2],{[Symbol.toPrimitive](){return 2;}}];
for(const x of [...coercion,...special])for(const f of ['globalIsNaN','globalIsFinite',...unaryFields])same(helpers[f](x),native[f](x),f+'('+String(x)+')',f);
for(const x of [1n,Symbol('s'),{valueOf(){return 1n;}},{valueOf(){return Symbol();}}])for(const m of numericMethods)assert.throws(()=>helpers[m.field](x,1),TypeError,m.name);
let orderChecks=0;{let log='';const o=k=>({valueOf(){log+=k;return 2;}});helpers.mathImul(o('a'),o('b'));helpers.mathAtan2(o('c'),o('d'));helpers.mathHypot(o('e'),{valueOf(){log+='f';return NaN;}},o('g'),{valueOf(){log+='h';return Infinity;}});assert.equal(log,'abcdefgh');orderChecks++;
  log='';assert.throws(()=>helpers.mathHypot(o('a'),{valueOf(){log+='b';throw 7;}},o('c')),e=>e===7);assert.equal(log,'ab');orderChecks++;}
// Number.prototype.toFixed/toExponential/toPrecision: exact decimal formatting vs V8.
let decimalChecks=0;{const fmt=['numberToFixed','numberToExponential','numberToPrecision'];const call=(field,x,a)=>{try{return helpers[field].call(x,a);}catch(e){return e.constructor.name;}};const ref=(field,x,a)=>{try{return native[field].call(x,a);}catch(e){return e.constructor.name;}};
  const check=(x,a)=>{for(const field of fmt){same(call(field,x,a),ref(field,x,a),field+'('+x+','+String(a)+')',field);decimalChecks++;}};
  const xs=corpus(quick?1500:12000).filter((_,i)=>i%3!==2);const ties=[0.5,1.5,2.5,-2.5,0.125,0.375,1.25,1.005,1.45,8.345,1.0000000000000002,123.456,0.000001,0.0000001,1e-7,5e-7,9.5,99.5,999.5,0.05,0.95,0.995,1e20,9.999999999999999e20,1e21,-1e21,123456789012345680000,4.35,1.255,5e-324,2**-1074*3,1.7976931348623157e308,2**53,0.1,0.2,0.3,25,35,45,1e100,-0,0,-1e-10];
  for(const x of [...ties,...special])for(const a of [undefined,0,1,2,3,5,10,15,16,17,20,21,30,50,99,100,101,-1,NaN,Infinity,-Infinity,2.9,-0.9,'4',null,true])check(x,a);
  for(const x of xs){check(x,rnd()%101);check(x,1+rnd()%21);check(x,undefined);}
  for(let i=0;i<(quick?2000:15000);i++){const x=Math.round((uniform()-0.5)*2*10**(rnd()%22))/10**(rnd()%12);check(x,rnd()%25);}
  for(const x of [new Number(1.5),'1',undefined,null,{},true])for(const field of fmt){same(call(field,x,2),ref(field,x,2),field+' receiver '+String(x),field);decimalChecks++;}
  let log='';const order={valueOf(){log+='v';return 2;}};assert.equal(helpers.numberToFixed.call(1.25,order),'1.25');assert.throws(()=>helpers.numberToFixed.call('x',order),TypeError);assert.equal(log,'v');
  log='';assert.equal(helpers.numberToExponential.call(NaN,order),'NaN');assert.equal(helpers.numberToPrecision.call(Infinity,order),'Infinity');assert.equal(log,'vv');
  assert.throws(()=>helpers.numberToFixed.call(NaN,101),RangeError);assert.equal(helpers.numberToExponential.call(NaN,101),'NaN');orderChecks+=3;}
const failing=Object.entries(mismatches).map(([f,list])=>[f,list.length,list.slice(0,4)]);
if(failing.length){console.error(JSON.stringify(failing,null,1));process.exitCode=1;}
assert.equal(failing.length,0,'host differential mismatches');
// Fixture semantics: case sources evaluated with mocked globals backed by the helpers equal native results.
// Helpers are instantiated inside the sandbox realm so guest-visible TypeErrors match that realm.
const sandbox=createContext({});const install=new Script('(function(fn,owner,name,len){const w={[name](...a){return fn.apply(this,a);}}[name];Object.defineProperty(w,"length",{value:len});Object.defineProperty(owner==="global"?globalThis:owner==="Math"?Math:Number.prototype,name,{value:w,writable:true,enumerable:false,configurable:true});})').runInContext(sandbox);
const sandboxBindings={...bindings,__lanesThisNumber:new Script('(v=>Number.prototype.valueOf.call(v))').runInContext(sandbox)};
for(const m of numericMethods){const fn=new Script('(function('+Object.keys(sandboxBindings).join(',')+'){return ('+m.source+');})').runInContext(sandbox)(...Object.values(sandboxBindings));install(fn,m.owner,m.name,m.length);}
let fixtureHelperChecks=0,nativeFixtureChecks=0;
for(const item of numericCases)for(const input of item.inputs){const expected=new Script('('+item.source+')').runInNewContext()(input);nativeFixtureChecks++;if(item.helperModel===false)continue;const actual=new Script('('+item.source+')').runInContext(sandbox)(input);assert.ok(Object.is(actual,expected),`${item.feature}(${String(input)}): ${actual} vs ${expected}`);fixtureHelperChecks++;}
assert.ok(Object.is(new Script('('+numericResumptionSource+')').runInNewContext()(3),numericResumptionExpected),'resumption native');
assert.ok(Object.is(new Script('('+numericResumptionSource+')').runInContext(sandbox)(3),numericResumptionExpected),'resumption helpers');
// Compiler parity: native QuickJS bridge vs Wasm ccall, packed identically, within GPU limits.
const{default:create}=await import('./generated/compiler.mjs');const wasm=await create();const nativePath=fileURLToPath(new URL('./generated/compiler',import.meta.url));
// Helpers declare nested kernels, so (exactly like the integrated pipeline) they are
// attached with attachBootstrap after a trivial entry: index 0 becomes the intrinsic
// root and nested functions sit outside the user-function range of globalProgramPlan.
let helperParity=0;const helperShape={};const entry='function f(x){return x;}';
const entryNative=JSON.parse(execFileSync(nativePath,[entry],{encoding:'utf8'})),entryWasm=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[entry]));
for(const m of numericMethods){const source=m.source;const nat=JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));const raw=JSON.parse(wasm.ccall('lanes_compile','string',['string'],[source]));assert.ok(!nat.error&&!raw.error,m.name+': '+(nat.error||raw.error));
  const field=m.field in FIELDS?m.field:'mathAbs';
  const a=packProgram(attachBootstrap(entryWasm,{[field]:raw}),entrySource(entry)),b=packProgram(attachBootstrap(entryNative,{[field]:nat}),entrySource(entry));assert.deepEqual(a.code,b.code,m.name);assert.deepEqual(a.image,b.image,m.name);
  helperShape[m.name]={functions:nat.functions.length,maxLocals:Math.max(...nat.functions.map(f=>f.locals)),maxStack:Math.max(...nat.functions.map(f=>f.stack)),instructions:a.code.length/4|0,image:a.image.length};helperParity++;}
// Case programs: compile natively; integrated packing needs the parent registry to wire the new globals.
let caseCompiles=0,integratedPrograms=0,integrationPending=false;const compiler=await createCompiler();
for(const source of [...numericCases.map(i=>i.source),numericResumptionSource,...numericUnsupportedSources]){JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}));caseCompiles++;}
try{compiler.compile('function f(x){return Math.sqrt(x)+isNaN(x);}');}catch(error){if(!/Unsupported|not a function|unknown|global/i.test(error.message))throw error;integrationPending=true;}
if(!integrationPending){const bootstraps=Object.fromEntries(Object.entries(bootstrapSources).map(([field,source])=>[field,JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'}))]));for(const source of [...numericCases.map(i=>i.source),numericResumptionSource]){try{const actual=compiler.compile(source),expected=packProgram(attachBootstrap(JSON.parse(execFileSync(nativePath,[source],{encoding:'utf8'})),bootstraps),entrySource(source));assert.deepEqual(actual.code,expected.code);assert.deepEqual(actual.image,expected.image);integratedPrograms++;}catch(error){if(!/Unsupported/.test(error.message))throw error;integrationPending=true;}}}
console.log(JSON.stringify({exactChecks,decimalChecks,corpusSizes:counts,pairCorpus:xs2.length,orderChecks,fixtureHelperChecks,nativeFixtureChecks,helperParity,caseCompiles,integratedPrograms,integrationPending,implemented:numericMethods.map(m=>(m.owner==='global'?'':m.owner+'.')+m.name),pending:numericPending,limits:LIMITS,maxHelperLocals:Math.max(...Object.values(helperShape).map(s=>s.maxLocals)),maxHelperStack:Math.max(...Object.values(helperShape).map(s=>s.maxStack)),gpuChecks:false}));
if(process.argv.includes('--shapes'))console.log(JSON.stringify(helperShape));
