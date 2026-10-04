const c=(feature,body,expected=true)=>({feature,source:`function f(x){${body}}`,input:7,expected});
export const phase3BigintConversionCases=[
 c('decimal-signed-leading-zero','return BigInt(" +000123 ")===123n&&BigInt("-0")===0n&&BigInt("-42")===-42n;'),
 c('prefix-grammars','return BigInt("0XfF")===255n&&BigInt("0o77")===63n&&BigInt("0B101")===5n;'),
 c('empty-and-es-whitespace','return BigInt("")===0n&&BigInt("\\uFEFF\\u2028\\u2000\\u3000")===0n;'),
 c('boolean-and-identity','return BigInt(true)===1n&&BigInt(false)===0n&&BigInt(123n)===123n;'),
 c('large-decimal-exact','return BigInt("18446744073709551617001")===18446744073709551617001n;'),
 c('number-integral-53','return BigInt(9007199254740992)===9007199254740992n&&BigInt(-0)===0n;'),
 c('number-integral-1024','return BigInt(1.7976931348623157e308)===(2n**1024n-2n**971n);'),
 c('number-fraction-range','try{BigInt(1.25);return false;}catch(e){return e instanceof RangeError;}'),
 c('number-nan-range','try{BigInt(NaN);return false;}catch(e){return e instanceof RangeError;}'),
 c('number-infinity-range','try{BigInt(Infinity);return false;}catch(e){return e instanceof RangeError;}'),
 c('number-subnormal-range','try{BigInt(5e-324);return false;}catch(e){return e instanceof RangeError;}'),
 c('undefined-type','try{BigInt();return false;}catch(e){return e instanceof TypeError;}'),
 c('null-type','try{BigInt(null);return false;}catch(e){return e instanceof TypeError;}'),
 c('symbol-type','try{BigInt(Symbol());return false;}catch(e){return e instanceof TypeError;}'),
 ...['+0x1','-0b1','0o','1e3','1_000','1.0','+','0b2','0xg','12n','\\u0085','\\u180e'].map((s,i)=>c('invalid-string-'+i,`try{BigInt("${s}");return false;}catch(e){return e instanceof SyntaxError;}`)),
 c('ordinary-valueof-order','let log="";const o={valueOf(){log+="v";return "45"},toString(){log+="s";return "9"}};return BigInt(o)===45n&&log==="v";'),
 c('ordinary-tostring-fallback','let log="";const o={valueOf(){log+="v";return {}},toString(){log+="s";return "45"}};return BigInt(o)===45n&&log==="vs";'),
 c('coercion-exception-identity','const token={};try{BigInt({valueOf(){throw token}});return false;}catch(e){return e===token;}'),
 c('text-radices','return (255n).toString(16)==="ff"&&(-35n).toString(36)==="-z"&&(0n).toString(2)==="0";'),
 c('text-default-and-truncated-radix','return (123n).toString()==="123"&&(15n).toString(2.9)==="1111";'),
 c('text-boxed-receiver','return BigInt.prototype.toString.call(Object(-123n))==="-123"&&BigInt.prototype.valueOf.call(Object(5n))===5n;'),
 c('valueof-invalid-receiver','try{BigInt.prototype.valueOf.call(1);return false;}catch(e){return e instanceof TypeError;}'),
 c('text-receiver-before-radix','let n=0;try{BigInt.prototype.toString.call(1,{valueOf(){n++;return 10}});return false;}catch(e){return e instanceof TypeError&&n===0;}'),
 c('radix-bigint-type','try{(1n).toString(10n);return false;}catch(e){return e instanceof TypeError;}'),
 c('radix-range','try{(1n).toString(NaN);return false;}catch(e){return e instanceof RangeError;}'),
 c('number-nearest-even','return Number(9007199254740993n)===9007199254740992&&Number(9007199254740995n)===9007199254740996&&Number(-9007199254740993n)===-9007199254740992;'),
 c('number-rounded-carry','return Number(18014398509481983n)===18014398509481984;'),
 c('number-large-infinity','return Number(1n<<1024n)===Infinity&&Number(-(1n<<1024n))===-Infinity;'),
 c('number-boxed-bigint','return Number(Object(9007199254740993n))===9007199254740992&&new Number(3n).valueOf()===3;'),
 c('number-implicit-type','try{Math.abs(1n);return false;}catch(e){return e instanceof TypeError;}'),
 c('sort-comparator-implicit-type','try{[2,1].sort(function(){return 1n});return false;}catch(e){return e instanceof TypeError;}'),
 c('bigint-string-conversion','return String(123n)==="123"&&"x"+(-5n)==="x-5";'),
 c('bigint-constructor-not-constructible','try{new BigInt(1);return false;}catch(e){return e instanceof TypeError;}'),
 c('private-conversion-prototype-immunity','String.prototype.charCodeAt=function(){throw 1};String.prototype.slice=function(){throw 2};return BigInt("0xff")===255n;'),
 c('decimal-output-256-boundary','return ((1n<<847n)-1n).toString().length===255;'),
 c('radix-output-256-boundary','return (1n<<255n).toString(2).length===256;'),
];
phase3BigintConversionCases.push({...c('conversion-retained-gc','const n=BigInt("123456789012345678901234567890");const text=n.toString(16);const rounded=Number(n);for(let i=0;i<1000;i++){const garbage={v:i};}return n===123456789012345678901234567890n&&text==="18ee90ff6c373e0ee4e3f0ad2"&&rounded===1.2345678901234568e29;'),requiresGC:true});
phase3BigintConversionCases.push(
 c('object-bigint-divmod','return ({valueOf(){return 17n}})/5n===3n&&({valueOf(){return -17n}})%5n===-2n;'),
 c('object-bigint-binary-order','let log="";const a={valueOf(){log+="a";return 12n}},b={valueOf(){log+="b";return 3n}};return a*b===36n&&log==="ab";'),
 c('object-bigint-bits','return (({valueOf(){return 9n}})<<2n)===36n&&(({valueOf(){return 9n}})&3n)===1n;'),
 c('object-bigint-unary','const a={valueOf(){return 12n}};return -a===-12n&&~a===-13n;'),
 c('object-bigint-plus-type','try{+({valueOf(){return 1n}});return false;}catch(e){return e instanceof TypeError;}'),
 c('object-bigint-increment','let a={valueOf(){return 12n}};const old=a++;let b={valueOf(){return 5n}};return old===12n&&a===13n&&--b===4n;'),
 c('object-bigint-mixed-type-order','let log="";try{({valueOf(){log+="a";return 1n}})-({valueOf(){log+="b";return 2}});return false;}catch(e){return e instanceof TypeError&&log==="ab";}')
);
phase3BigintConversionCases.push(
 c('numeric-overflow-rounding-midpoint','const edge=(1n<<1024n)-(1n<<970n);return Number(edge-1n)===1.7976931348623157e308&&Number(edge)===Infinity&&Number(-edge)===-Infinity;'),
 c('text-conversion-consumers','return JSON.parse(123n)===123&&parseInt(123n)===123&&parseFloat(-123n)===-123&&[1n,2n].join(3n)==="132";'),
 c('string-method-bigint-inputs','return "x".concat(12n)==="x12"&&"123".includes(2n)&&String.prototype.toUpperCase.call(12n)==="12"&&String.prototype.padStart.call(1n,3,2n)==="221";'),
 c('bigint-property-key','const o={};o[123n]=7;Object.defineProperty(o,456n,{value:8});return o["123"]===7&&o["456"]===8;'),
 c('symbol-bigint-description','return Symbol(123n).description==="123"&&Symbol.keyFor(Symbol.for(123n))==="123";'),
 c('bigint-prototype-invalid-this','try{BigInt.prototype.valueOf.call(BigInt.prototype);return false;}catch(e){return e instanceof TypeError;}'),
 c('object-bigint-addition','return ({valueOf(){return 5n}})+7n===12n;')
);
phase3BigintConversionCases.push(
 c('primitive-bigint-updates','let a=1n;const b=a++;const c=++a;const d=a--;const e=--a;return b===1n&&c===3n&&d===3n&&e===1n&&a===1n;'),
 c('discarded-bigint-local-updates','let n=1n;n++;n--;n+=2n;return n===3n;'),
 c('object-postfix-number-regression','let a={valueOf(){return 12}};const b=a++;let c={valueOf(){return 3}};const d=c--;return b===12&&a===13&&d===3&&c===2;'),
 c('object-postfix-bigint-once','let calls=0;let a={valueOf(){calls++;return 12n}};const old=a--;return old===12n&&a===11n&&calls===1;'),
 c('bigint-compound-string','let a=1n;a+="x";return a==="1x";')
);
// Safari on the coordinator M1 did not produce the expected SyntaxError for "+".
// ES2025 SignedInteger requires DecimalDigits after + or -; this row keeps
// the normative SyntaxError oracle and records that exact native divergence.
phase3BigintConversionCases.find(row=>row.feature==='invalid-string-6').nativeReferenceDifference={
 observed:false,expected:true,
 reason:'Safari does not produce expected SyntaxError for sign-only BigInt string; ES2025 SignedInteger requires DecimalDigits',
 nativeDiagnosticSource:'function f(){try{const value=BigInt("+");return typeof value+":"+String(value);}catch(error){return error.name+":"+error.message;}}',
 specification:'https://tc39.es/ecma262/2025/multipage/abstract-operations.html#sec-stringtobigint',
};
// Use shifts rather than pending exponentiation in the Number max fixture.
phase3BigintConversionCases[6].source=phase3BigintConversionCases[6].source.replace('2n**1024n-2n**971n','(1n<<1024n)-(1n<<971n)');
export const phase3BigintConversionResourceCases=[c('radix-output-257','return (1n<<256n).toString(2).length===257;'),c('negative-output-sign-overflow','return (-(1n<<255n)).toString(2).length===257;')];
export const phase3BigintConversionResumption=c('conversion-repeated-resumption','let n=BigInt("123456789012345678901");let out="";for(let i=0;i<4;i++){out=n.toString(16);n=BigInt("0x"+out)+1n;}return n===123456789012345678905n;');
