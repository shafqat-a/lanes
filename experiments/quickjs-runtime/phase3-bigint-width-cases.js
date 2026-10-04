const c=(feature,body,expected=true)=>({feature:'bigint-width-'+feature,source:`function f(x){${body}}`,input:7,expected});
export const phase3BigintWidthCases=[
 c('public-metadata','const d=Object.getOwnPropertyDescriptor(BigInt,"asIntN");return BigInt.asIntN.name==="asIntN"&&BigInt.asIntN.length===2&&BigInt.asUintN.name==="asUintN"&&BigInt.asUintN.length===2&&d.value===BigInt.asIntN&&d.writable&&!d.enumerable&&d.configurable;'),
 c('unsigned-negative' ,'return BigInt.asUintN(8,-1n)===255n&&BigInt.asUintN(8,-257n)===255n;'),
 c('signed-edges','return BigInt.asIntN(8,127n)===127n&&BigInt.asIntN(8,128n)===-128n&&BigInt.asIntN(8,255n)===-1n;'),
 c('signed-negative-wrap','return BigInt.asIntN(8,-129n)===127n&&BigInt.asIntN(8,-128n)===-128n;'),
 c('zero-width','return BigInt.asIntN(0,-1n)===0n&&BigInt.asUintN(0,999n)===0n;'),
 c('width-coercion','return BigInt.asIntN(undefined,1n)===0n&&BigInt.asUintN(NaN,1n)===0n&&BigInt.asUintN(-0.5,1n)===0n&&BigInt.asUintN(3.9,9n)===1n;'),
 c('width-before-value','let log="";const bits={valueOf(){log+="b";return 3}},value={valueOf(){log+="v";return "15"}};return BigInt.asIntN(bits,value)===-1n&&log==="bv";'),
 c('invalid-width-skips-value','let n=0;try{BigInt.asIntN(-1,{valueOf(){n++;return 1n}});return false;}catch(e){return e instanceof RangeError&&n===0;}'),
 c('bigint-width-type','try{BigInt.asUintN(2n,1n);return false;}catch(e){return e instanceof TypeError;}'),
 c('width-infinity-range','try{BigInt.asUintN(Infinity,1n);return false;}catch(e){return e instanceof RangeError;}'),
 c('width-over-safe-range','try{BigInt.asIntN(9007199254740992,1n);return false;}catch(e){return e instanceof RangeError;}'),
 c('number-value-type','try{BigInt.asIntN(8,1);return false;}catch(e){return e instanceof TypeError;}'),
 c('zero-width-still-converts-value','try{BigInt.asUintN(0,1);return false;}catch(e){return e instanceof TypeError;}'),
 c('boolean-and-string-values','return BigInt.asUintN(8,true)===1n&&BigInt.asIntN(8,"0xff")===-1n;'),
 c('invalid-string-syntax','try{BigInt.asIntN(0,"0x");return false;}catch(e){return e instanceof SyntaxError;}'),
 c('wide-word-edges','return BigInt.asIntN(33,4294967296n)===-4294967296n&&BigInt.asUintN(33,-1n)===8589934591n;'),
 c('2048-width','const m=(1n<<2047n);return BigInt.asIntN(2048,m)===-m&&BigInt.asUintN(2048,-1n)===(m-1n)*2n+1n;'),
 c('huge-width-fitting-result','return BigInt.asIntN(9007199254740991,-5n)===-5n&&BigInt.asUintN(9007199254740991,5n)===5n;'),
 c('object-bigint-value','return BigInt.asIntN(2,Object(3n))===-1n;'),
 c('exception-identity','const token={};try{BigInt.asUintN(0,{valueOf(){throw token}});return false;}catch(e){return e===token;}'),
 c('private-helper-immunity','const method=BigInt.asIntN;BigInt.asUintN=function(){throw 1};BigInt.prototype.valueOf=function(){throw 2};return method(8,255n)===-1n;'),
];
phase3BigintWidthCases.push({...c('retained-gc','const keep={a:BigInt.asIntN(64,18446744073709551615n),b:BigInt.asUintN(128,-3n)};for(let i=0;i<1000;i++){const garbage={v:i};}return keep.a===-1n&&keep.b===340282366920938463463374607431768211453n;'),requiresGC:true});
export const phase3BigintWidthResourceCases=[c('negative-unsigned-2049-resource','return BigInt.asUintN(2049,-1n)===(1n<<2049n)-1n;')];
export const phase3BigintWidthResumption=c('one-step-resumption','let sum=0n;for(let i=0;i<6;i++){sum+=BigInt.asIntN(4,BigInt(i+13));}return sum===-3n;');
