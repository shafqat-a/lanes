// Exact special cases and independently checkable powers. General finite powers
// additionally use a bounded ULP oracle in check-number-pow.mjs.
const literal = value => Number.isNaN(value) ? 'NaN' : value === Infinity ? 'Infinity' : value === -Infinity ? '-Infinity' : Object.is(value,-0) ? '-0' : String(value);
export const numberPowCases = [
  [NaN,0,1], [NaN,-0,1], [NaN,1,NaN], [1,NaN,NaN], [0,NaN,NaN],
  [1,Infinity,NaN], [-1,Infinity,NaN], [1,-Infinity,NaN], [-1,-Infinity,NaN],
  [2,Infinity,Infinity], [2,-Infinity,0], [0.5,Infinity,0], [0.5,-Infinity,Infinity],
  [-2,Infinity,Infinity], [-0.5,-Infinity,Infinity],
  [0,3,0], [-0,3,-0], [-0,2,0], [-0,0.5,0], [0,-3,Infinity], [-0,-3,-Infinity], [-0,-2,Infinity],
  [Infinity,3,Infinity], [-Infinity,3,-Infinity], [-Infinity,2,Infinity], [-Infinity,0.5,Infinity],
  [Infinity,-3,0], [-Infinity,-3,-0], [-Infinity,-2,0], [-Infinity,-0.5,0],
  [-2,0.5,NaN], [-1,1.5,NaN], [-2,3,-8], [-2,-3,-0.125],
  [2,1023,8.98846567431158e307], [2,1024,Infinity], [2,-1074,5e-324], [2,-1075,0],
  [-2,-1075,-0], [0.5,1074,5e-324], [5e-324,1,5e-324], [5e-324,-1,Infinity],
  [2,10,1024], [10,2,100], [9,0.5,3], [16,0.25,2],
  [-1,9007199254740991,-1], [-1,9007199254740992,1], [-1,4503599627370497,-1],
].map(([base,exponent,expected],index)=>({feature:`pow-exact-${index}`,base,exponent,expected,input:3,
  source:`function f(x){return (${literal(base)}) ** (${literal(exponent)});}`}));
// General finite cases use an implementation-approximation ULP oracle, not
// blanket native bit identity. The first catches fdlibm's old Taylor shortcut.
export const numberPowApproximateCases = [
  [1.000000286985877,2293732666.8761673], [27,1/3],
  [1.0000000000000002,4503599627370496], [0.9999999999999999,9007199254740992],
  [1.0000000000000002,9007199254740992], [0.9999999999999999,-9007199254740992],
  [1.0000000000000002,2305843009213693952], [0.9999999999999999,2305843009213693952],
  [3,0.5], [2,-1074.5], [5e-324,0.5], [1e-300,0.25],
].map(([base,exponent],index)=>({feature:`pow-approximate-${index}`,base,exponent,input:3,toleranceUlps:2,
  source:`function f(x){return (${literal(base)}) ** (${literal(exponent)});}`}));
export const numberPowCoercionCases = [
  {feature:'pow-coercion-left-then-right',input:3,expected:'lr:8',source:`function f(x){let log="";const a={valueOf(){log+="l";return 2;}};const b={valueOf(){log+="r";return x;}};const result=a**b;return log+":"+result;}`},
  {feature:'pow-fallback-coercion',input:3,expected:'lst:8',source:`function f(x){let log="";const a={valueOf(){log+="l";return {};},toString(){log+="s";return "2";}};const b={valueOf(){log+="t";return x;}};const result=a**b;return log+":"+result;}`},
  {feature:'pow-left-throw-skips-right-coercion',input:3,expected:'l:3',source:`function f(x){let log="";const a={valueOf(){log+="l";throw x;}};const b={valueOf(){log+="r";return 0;}};try{return a**b;}catch(e){return log+":"+e;}}`},
  {feature:'pow-right-throw',input:3,expected:'lr:3',source:`function f(x){let log="";const a={valueOf(){log+="l";return 2;}};const b={valueOf(){log+="r";throw x;}};try{return a**b;}catch(e){return log+":"+e;}}`},
  {feature:'pow-zero-exponent-still-coerces-base',input:3,expected:'l:1',source:`function f(x){let log="";const a={valueOf(){log+="l";return NaN;}};const result=a**0;return log+":"+result;}`},
  {feature:'pow-operands-evaluated-before-coercion',input:3,expected:'ABlr:8',source:`function f(x){let log="";function a(){log+="A";return {valueOf(){log+="l";return 2;}};}function b(){log+="B";return {valueOf(){log+="r";return x;}};}const result=a()**b();return log+":"+result;}`},
  {feature:'pow-string-null-boolean',input:3,expected:'8:1:0:1',source:`function f(x){return ("2"**"3")+":"+(null**false)+":"+(false**true)+":"+(true**99);}`},
];
// Keep a callback before and after a nontrivial fractional exponent, with an
// exact mathematical result, to check resumption through the numerical body.
export const numberPowResumptionSource=`function f(x){let log="";const a={valueOf(){log+="a";return 16;}};const b={valueOf(){log+="b";return 0.25;}};const first=a**b;const second=({valueOf(){log+="c";return 2;}})**x;return log+":"+first+":"+second;}`;
export const numberPowResumptionExpected='abc:2:8';
