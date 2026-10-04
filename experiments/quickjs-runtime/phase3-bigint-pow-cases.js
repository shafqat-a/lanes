const cases=[];
for(const [a,b]of [[0n,0n],[0n,1n],[0n,999999999999999999999999999999999999n],[1n,0n],[1n,999999999999999999999999999999999999n],[-1n,0n],[-1n,999999999999999999999999999999999999n],[-1n,999999999999999999999999999999999998n],[2n,1n],[2n,31n],[2n,32n],[2n,64n],[2n,1024n],[2n,2047n],[-2n,127n],[-2n,128n],[3n,100n],[3n,1292n],[65535n,16n],[4294967295n,16n],[9007199254740993n,5n],[(1n<<2047n)+1n,1n]])cases.push({feature:`bigint-pow-${String(a).slice(0,20)}-${b}`,source:`function f(){const a=${a}n,b=${b}n;return a**b===${a**b}n;}`,input:3,expected:true});
const c=(feature,body,expected=true)=>cases.push({feature,source:`function f(x){${body}}`,input:3,expected});
for(const a of ['0n','1n','-1n','2n','-2n'])c('bigint-pow-negative-'+a,`try{const a=${a};a**-1n;}catch(e){return e instanceof RangeError;}return false;`);
c('bigint-pow-mixed-left','try{1n**2;}catch(e){return e instanceof TypeError;}return false;');
c('bigint-pow-mixed-right','try{1**2n;}catch(e){return e instanceof TypeError;}return false;');
c('bigint-pow-mixed-negative','try{0n**-1;}catch(e){return e instanceof TypeError;}return false;');
c('bigint-pow-left-right-hints','let log="";const a={[Symbol.toPrimitive](hint){log+="a"+hint;return 2n;}},b={[Symbol.toPrimitive](hint){log+="b"+hint;return 3n;}};return (a**b===8n)+":"+log;','true:anumberbnumber');
c('bigint-pow-typeerror-after-both-coercions','let log="";const a={valueOf(){log+="a";return 2n;}},b={valueOf(){log+="b";return 3;}};try{a**b;}catch(e){return e instanceof TypeError&&log==="ab";}return false;');
c('bigint-pow-left-symbol-stops-right-coercion','let calls=0;const a={valueOf(){return Symbol();}},b={valueOf(){calls++;return 1n;}};try{a**b;}catch(e){return e instanceof TypeError&&calls===0;}return false;');
c('bigint-pow-rhs-expression-before-lhs-coercion','let log="";const token={};const a={valueOf(){log+="a";throw token;}};function rhs(){log+="e";return {valueOf(){log+="b";return 1n;}};}try{a**rhs();}catch(e){return e===token&&log==="ea";}return false;');
c('bigint-pow-right-abrupt-identity','const token={};let log="";const a={valueOf(){log+="a";return 2n;}},b={valueOf(){log+="b";throw token;}};try{a**b;}catch(e){return e===token&&log==="ab";}return false;');
c('bigint-pow-exotic-object-typeerror','const a={[Symbol.toPrimitive](){return {};}};try{a**0n;}catch(e){return e instanceof TypeError;}return false;');
c('bigint-pow-computed-assignment-order','let log="";const key={toString(){log+="k";return "a";}},o={get a(){log+="g";return 2n;},set a(v){log+="s";if(v!==8n)throw 9;}};const r=o[key]**=3n;return (r===8n)+":"+log;','true:kgks');
c('bigint-pow-assignment-abrupt-no-set','let calls=0;const o={get a(){return 2n;},set a(v){calls++;}};try{o.a**=-1n;}catch(e){return e instanceof RangeError&&calls===0;}return false;');
c('bigint-pow-number-path','return 2**3===8&&NaN**0===1&&(-0)**3===0&&1/((-0)**3)===-Infinity;');
c('bigint-pow-number-object-hint','let log="";const a={[Symbol.toPrimitive](h){log+=h;return 2;}},b={valueOf(){log+="b";return 3;}};return a**b===8&&log==="numberb";');
c('bigint-pow-gc-retained-result','const value=3n**100n;for(let i=0;i<500;i++){const garbage={i:i};}return value===515377520732011331036461129765621272702107522001n;');
for(const c of cases)if(c.feature==='bigint-pow-gc-retained-result')c.requiresGC=true;
export const phase3BigintPowCases=Object.freeze(cases);
export const phase3BigintPowResourceCases=Object.freeze([
 {feature:'bigint-pow-2049-bit-result',source:'function f(){return 2n**2048n;}',input:3},
 {feature:'bigint-pow-nonpower-two-overflow',source:'function f(){return 3n**1293n;}',input:3},
 {feature:'bigint-pow-huge-exponent',source:'function f(){return 2n**999999999999999999999999n;}',input:3},
 {feature:'bigint-pow-wide-base-squared',source:`function f(){return ${1n<<1024n}n**2n;}`,input:3},
]);
export const phase3BigintPowResumptionSource='function f(x){let log="";const a={valueOf(){log+="a";return -3n;}},b={valueOf(){log+="b";return 9n;}};return (a**b===-19683n)+":"+log;}';
export const phase3BigintPowResumptionExpected='true:ab';
