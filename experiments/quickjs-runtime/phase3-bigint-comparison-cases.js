const cases=[];
const result=(a,b)=>[a==b,a!=b,a<b,a<=b,a>b,a>=b].join(':');
const numeric=[0,-0,0.5,-0.5,1.5,-1.5,5e-324,-5e-324,NaN,Infinity,-Infinity,9007199254740992,9007199254740994,1.7976931348623157e308];
const integers=[0n,1n,-1n,9007199254740993n,-9007199254740993n,BigInt(1.7976931348623157e308),BigInt(1.7976931348623157e308)+1n,(1n<<2047n)-1n];
const literal=n=>Number.isNaN(n)?'NaN':n===Infinity?'Infinity':n===-Infinity?'-Infinity':Object.is(n,-0)?'-0':String(n);
for(let i=0;i<numeric.length;i++)for(let j=0;j<integers.length;j++){
 const a=integers[j],b=numeric[i];for(const reverse of [false,true]){const left=reverse?literal(b):a+'n',right=reverse?a+'n':literal(b);cases.push({feature:`bigint-number-${i}-${j}-${reverse}`,source:`function f(){const a=${left},b=${right};return (a==b)+":"+(a!=b)+":"+(a<b)+":"+(a<=b)+":"+(a>b)+":"+(a>=b);}`,input:3,expected:reverse?result(b,a):result(a,b)});}
}
for(const text of ['',' ','\uFEFF\n0\u2029','+1','-1','0xff','0o17','0b101','1.0','1e0','1n','Infinity','NaN','+0x1','-0x1','0x',' 1 2 ','\u0085','9007199254740993']){
 const a=1n;cases.push({feature:'bigint-string-'+JSON.stringify(text),source:`function f(){const a=1n,b=${JSON.stringify(text)};return (a==b)+":"+(b==a)+":"+(a<b)+":"+(a<=b)+":"+(a>b)+":"+(a>=b)+":"+(b<a)+":"+(b<=a)+":"+(b>a)+":"+(b>=a);}`,input:3,expected:[a==text,text==a,a<text,a<=text,a>text,a>=text,text<a,text<=a,text>a,text>=a].join(':')});
}
const c=(feature,body,expected)=>cases.push({feature,source:`function f(x){${body}}`,input:3,expected});
c('bigint-booleans-nullish','return (1n==true)+":"+(0n==false)+":"+(0n==null)+":"+(0n==undefined)+":"+(0n<null)+":"+(0n<=null)+":"+(1n>undefined);','true:true:false:false:false:true:false');
c('bigint-object-equality-valueof','let log="";const o={valueOf(){log+="v";return 1n;},toString(){throw 9;}};return (o==1n)+":"+(1==o)+":"+log;','true:true:vv');
c('bigint-object-null-never-converts','const o={valueOf(){throw 9;}};return (o==null)+":"+(undefined==o);','false:false');
for(const op of ['<','<=','>','>='])c('bigint-coercion-order-'+op,`let log="";const a={valueOf(){log+="a";return 1n;}},b={valueOf(){log+="b";return 2;}};const v=a${op}b;return log+":"+v;`,'ab:'+({'<':true,'<=':true,'>':false,'>=':false}[op]));
c('bigint-object-first-abrupt','const token={};let calls=0;const a={valueOf(){throw token;}},b={valueOf(){calls++;return 1n;}};try{a>b;}catch(e){return e===token&&calls===0;}return false;',true);
c('bigint-object-second-abrupt','const token={};let log="";const a={valueOf(){log+="a";return 1n;}},b={valueOf(){log+="b";throw token;}};try{a<=b;}catch(e){return e===token&&log==="ab";}return false;',true);
c('bigint-invalid-string-after-object','let calls=0;const o={valueOf(){calls++;return "1.0";}};return (1n==o)+":"+(o>=1n)+":"+calls;','false:false:2');
c('bigint-symbol-equality','const s=Symbol("s");return (s==1n)+":"+(1n==s)+":"+(Object(s)==s)+":"+(s==Object(s));','false:false:true:true');
c('bigint-symbol-relational-abrupt-order','let log="";const a={valueOf(){log+="a";return Symbol("s");}},b={valueOf(){log+="b";return 1n;}};try{a<b;}catch(e){return e instanceof TypeError&&log==="ab";}return false;',true);
c('bigint-symbol-object-equality-abrupt','const token={};const o={valueOf(){throw token;}};try{Symbol("s")==o;}catch(e){return e===token;}return false;',true);
c('bigint-exotic-hints','let log="";const o={[Symbol.toPrimitive](hint){log+=hint+":";return 1n;}};return (o==1)+":"+(o<2)+":"+log;','true:true:default:number:');
c('bigint-exotic-getter-once','let log="";const o={get [Symbol.toPrimitive](){log+="g";return function(h){log+="c"+h;return 1n;};},valueOf(){throw 9;}};return (o==1)+":"+log;','true:gcdefault');
c('bigint-exotic-returns-object','let fallback=0;const o={[Symbol.toPrimitive](){return {};},valueOf(){fallback++;return 1n;}};try{o<2;}catch(e){return e instanceof TypeError&&fallback===0;}return false;',true);
c('bigint-exotic-noncallable','const o={[Symbol.toPrimitive]:1,valueOf(){throw 9;}};try{o==1n;}catch(e){return e instanceof TypeError;}return false;',true);
c('bigint-exotic-null-fallback','const o={[Symbol.toPrimitive]:null,valueOf(){return 1n;}};return o==1;',true);
c('bigint-exotic-abrupt-identity','const token={};const o={get [Symbol.toPrimitive](){throw token;}};try{o>1n;}catch(e){return e===token;}return false;',true);
c('bigint-exotic-right-even-after-symbol','let log="";const a={[Symbol.toPrimitive](h){log+="a"+h;return Symbol();}},b={[Symbol.toPrimitive](h){log+="b"+h;return 1n;}};try{a>=b;}catch(e){return e instanceof TypeError&&log==="anumberbnumber";}return false;',true);
// Safari M1 qualification observed TypeError after only the left conversion.
// ES2025 IsLessThan1.a/1.b obtains both primitives before4.d ToNumeric.
const safariEarlySymbol=cases.find(c=>c.feature==='bigint-symbol-relational-abrupt-order');
safariEarlySymbol.allowedNativeExpected=false;
safariEarlySymbol.nativeReferenceDifference='Safari throws TypeError after left Symbol conversion, before the required right ToPrimitive; ES2025 IsLessThan requires both primitive conversions first';
safariEarlySymbol.nativeDiagnosticSource='function f(){let log="";const a={valueOf(){log+="a";return Symbol("s");}},b={valueOf(){log+="b";return 1n;}};try{a<b;return "no:"+log;}catch(e){return e.name+":"+log;}}';
safariEarlySymbol.expectedNativeDiagnostic='TypeError:a';
safariEarlySymbol.specification='https://tc39.es/ecma262/2025/multipage/abstract-operations.html#sec-islessthan';
const safariEarlyExoticSymbol=cases.find(c=>c.feature==='bigint-exotic-right-even-after-symbol');
safariEarlyExoticSymbol.allowedNativeExpected=false;
safariEarlyExoticSymbol.nativeReferenceDifference='Safari throws TypeError after left Symbol @@toPrimitive(number), before required right ToPrimitive; ES2025 IsLessThan requires both primitive conversions first';
safariEarlyExoticSymbol.nativeDiagnosticSource='function f(){let log="";const a={[Symbol.toPrimitive](h){log+="a"+h;return Symbol();}},b={[Symbol.toPrimitive](h){log+="b"+h;return 1n;}};try{a>=b;return "no:"+log;}catch(e){return e.name+":"+log;}}';
safariEarlyExoticSymbol.expectedNativeDiagnostic='TypeError:anumber';
safariEarlyExoticSymbol.specification=safariEarlySymbol.specification;
export const phase3BigintComparisonCases=Object.freeze(cases);
export const phase3BigintComparisonResumptionSource='function f(x){let log="";const a={valueOf(){log+="a";return 9007199254740993n;}},b={valueOf(){log+="b";return 9007199254740992;}};return (a>b)+":"+(a=="9007199254740993")+":"+log;}';
export const phase3BigintComparisonResumptionExpected='true:true:aba';
