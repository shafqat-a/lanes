// GPU fixtures for stdlib-numeric.js. One named sync `function f(x)` per
// source, primitive inputs, primitive results compared with Object.is.
import { numericMethods } from './stdlib-numeric.js';
const ref = m => m.owner === 'global' ? m.name : m.owner + '.' + m.name;
export const numericInputs = [NaN, Infinity, -Infinity, -0, 0, 5e-324, -5e-324, 2.2250738585072014e-308, 1e-300, 2 ** -28, 0.1, -0.5, 0.5, 0.75, 1, -1, 1.5, 2, -2, 3, 10, 22, -22, 100, 709.78, 710.4, -745.2, 1e22, 1e300, -1.7976931348623157e308, 65520, 4294967295, 4294967296, -2147483648];
const unaryMath = numericMethods.filter(m => m.owner === 'Math' && m.length === 1);
export const numericCases = [
  // Metadata: name, length, descriptor attributes, identity, typeof.
  ...numericMethods.map(m => ({ feature: ref(m) + '-metadata', source: `function f(x){return ${ref(m)}.name+":"+${ref(m)}.length+":"+typeof ${ref(m)};}`, inputs: [3] })),
  ...numericMethods.filter(m => m.owner === 'Math').map(m => ({ feature: ref(m) + '-descriptor', source: `function f(x){const d=Object.getOwnPropertyDescriptor(Math,"${m.name}");return d.writable+":"+d.enumerable+":"+d.configurable+":"+(d.value===Math.${m.name});}`, inputs: [3] })),
  { feature: 'numeric-not-constructors', source: 'function f(x){let n=0;try{new Math.sqrt(4);}catch(e){if(e instanceof TypeError)n++;}try{new isNaN(1);}catch(e){if(e instanceof TypeError)n++;}try{new Math.hypot(1);}catch(e){if(e instanceof TypeError)n++;}return n+":"+("prototype" in Math.sqrt)+":"+("prototype" in isFinite);}', inputs: [3] },
  // Values.
  ...unaryMath.map(m => ({ feature: ref(m), source: `function f(x){return ${ref(m)}(x);}`, inputs: numericInputs })),
  ...unaryMath.map(m => ({ feature: ref(m) + '-missing-argument', source: `function f(x){return ${ref(m)}();}`, inputs: [3] })),
  { feature: 'isNaN', source: 'function f(x){return isNaN(x);}', inputs: [undefined, null, true, false, '', 'abc', '  12  ', '0x1F', '-0', '1e1000', 'Infinity', NaN, 0, -0, Infinity, 5e-324] },
  { feature: 'isFinite', source: 'function f(x){return isFinite(x);}', inputs: [undefined, null, true, false, '', 'abc', '  12  ', '0b101', ' -Infinity ', '1e1000', NaN, 0, -0, Infinity, -Infinity, 1.7976931348623157e308] },
  { feature: 'isNaN-isFinite-missing', source: 'function f(x){return isNaN()+":"+isFinite();}', inputs: [3] },
  { feature: 'isNaN-wrappers', source: 'function f(x){return isNaN(new Number(x))+":"+isNaN(new String("z"))+":"+isFinite([x])+":"+isFinite([1,2])+":"+isNaN({})+":"+isFinite(new Boolean(true));}', inputs: [3, NaN] },
  { feature: 'isNaN-coercion', source: 'function f(x){let s="";const o={valueOf(){s+="v";return {};},toString(){s+="t";return " "+x+" ";}};return isNaN(o)+":"+isFinite(o)+":"+s;}', inputs: [3, NaN, -0] },
  { feature: 'isNaN-toPrimitive-hint', source: 'function f(x){let h="";const o={[Symbol.toPrimitive](hint){h+=hint;return x;}};return isNaN(o)+":"+h;}', inputs: [3, NaN] },
  { feature: 'isNaN-symbol-bigint-TypeError', source: 'function f(x){let n=0;const vs=[Symbol("s"),1n,{valueOf(){return 2n;}},Object(Symbol("t"))];for(const v of vs){try{isNaN(v);}catch(e){if(e instanceof TypeError)n++;}try{isFinite(v);}catch(e){if(e instanceof TypeError)n++;}}return n;}', inputs: [3] },
  { feature: 'Math-symbol-bigint-TypeError', source: `function f(x){let n=0;const fs=[${numericMethods.filter(m => m.owner === 'Math').map(ref).join(',')}];for(const g of fs){try{g(Symbol("s"),1);}catch(e){if(e instanceof TypeError)n++;}try{g(1,2n);g(3n,1);}catch(e){if(e instanceof TypeError)n++;}}return n;}`, inputs: [3] },
  { feature: 'isNaN-throw-propagates', source: 'function f(x){try{isFinite({valueOf(){throw x;}});}catch(e){return e===x;}return false;}', inputs: [3] },
  // Coercion order and argument handling.
  { feature: 'imul-coercion-order', source: 'function f(x){let s="";const r=Math.imul({valueOf(){s+="a";return 0xffffffff;}},{valueOf(){s+="b";return x;}});return s+":"+r;}', inputs: [3, -5, 2 ** 31, 1e20] },
  { feature: 'atan2-coercion-order', source: 'function f(x){let s="";const r=Math.atan2({valueOf(){s+="y";return x;}},{valueOf(){s+="x";return -1;}});return s+":"+r;}', inputs: [1, -0, 0, NaN] },
  { feature: 'hypot-coerce-all', source: 'function f(x){let s="";const v=(k,n)=>({valueOf(){s+=k;return n;}});const r=Math.hypot(v("a",NaN),v("b",x),v("c",Infinity));return s+":"+r;}', inputs: [3, NaN] },
  { feature: 'hypot-throw-after-Infinity', source: 'function f(x){let s="";try{Math.hypot({valueOf(){s+="a";return Infinity;}},{valueOf(){s+="b";throw x;}},{valueOf(){s+="c";return 1;}});}catch(e){return s+":"+(e===x);}return "bad";}', inputs: [3] },
  { feature: 'hypot-special', source: 'function f(x){return [Math.hypot(),Math.hypot(-0),Math.hypot(-0,-0),Math.hypot(NaN,-Infinity),Math.hypot(x,NaN),Math.hypot(3,4),Math.hypot(x),Math.hypot(1e300,1e300),Math.hypot(5e-324,5e-324),Math.hypot(1,2,3,4,5,6,7,8,9,10,11,12)].join(",")+":"+Object.is(Math.hypot(-0),0);}', inputs: [-3, -0, Infinity] },
  { feature: 'hypot-many-arguments', source: 'function f(x){return Math.hypot(x,x,x,x,x,x,x,x,x,x,x,x,x,x,x);}', inputs: [1, -0.1, 3e200] },
  { feature: 'hypot-pairs', source: 'function f(x){return Math.hypot(x,1)+":"+Math.hypot(x,-x,0.5);}', inputs: numericInputs },
  { feature: 'atan2-pairs', source: 'function f(x){return Math.atan2(x,-0)+":"+Math.atan2(-0,x)+":"+Math.atan2(x,-Infinity)+":"+Math.atan2(Infinity,x)+":"+Math.atan2(x,3)+":"+Math.atan2(-2,x);}', inputs: numericInputs },
  { feature: 'imul-pairs', source: 'function f(x){return Math.imul(x,x)+":"+Math.imul(x,-7)+":"+Math.imul(0xffffffff,x);}', inputs: numericInputs },
  // Keep each observable coercion/result within the runtime string boundary.
  ...unaryMath.map(m => ({ feature: 'unary-coercion-' + m.name, source: `function f(x){let s="";const o={valueOf(){s+="v";return x;}};const r=${ref(m)}(o);return r+":"+s;}`, inputs: ['2.5', ' -0 ', '0x10', true, null] })),
  { feature: 'unary-string-inputs', source: 'function f(x){return Math.sqrt(x)+":"+Math.fround(x)+":"+Math.clz32(x)+":"+Math.cbrt(x)+":"+Math.exp(x)+":"+Math.log(x)+":"+Math.sin(x);}', inputs: ['', '  16  ', 'abc', '-Infinity', '0b11'] },
  { feature: 'borrowed-numeric-methods', source: 'function f(x){return Math.sqrt.call(null,x)+":"+Math.hypot.apply(null,[3,4,x])+":"+isNaN.bind(null,"q")()+":"+Math.imul.call(Math,x,3);}', inputs: [12, -0] },
  { feature: 'numeric-replaceable', source: 'function f(x){const o=Math.sqrt;Math.sqrt=function(){return "patched";};const r=Math.sqrt(x)+":"+o(x);Math.sqrt=o;return r+":"+(Math.sqrt===o);}', inputs: [9] },
  { feature: 'numeric-GC-roots', source: 'function f(x){const g=Math.hypot,h=isNaN;for(let i=0;i<500;i++){({i});}return g(x,4)+":"+h(x)+":"+Math.sin(x)+":"+Math.cbrt(x*9);}', inputs: [3] },
  { feature: 'trig-large-reduction', source: 'function f(x){return Math.sin(x)+":"+Math.cos(x)+":"+Math.tan(x);}', inputs: [1e22, 1e300, -1.7976931348623157e308, 2 ** 1000, 1647099.3291652855, 6381956970095103 * 2 ** 797, 5.319372648326541e255, 3 * Math.PI / 2, 1e6 * Math.PI] },
  { feature: 'fround-boundaries', source: 'function f(x){return Math.fround(x)+":"+Math.f16round(x);}', inputs: [3.4028235677973366e38, 3.4028235677973362e38, 1.401298464324817e-45, 7.006492321624085e-46, 7.006492321624087e-46, 65519.99999999999, 65520, 2.9802322387695312e-8, 2.980232238769532e-8, 1.0000000596046448, 1.0000000596046446, -1.0004882812500002] },
  // Number.prototype decimal formatting (exact; ties round half up on magnitude).
  ...numericMethods.filter(m => m.owner === 'Number.prototype').map(m => ({ feature: ref(m) + '-descriptor', source: `function f(x){const d=Object.getOwnPropertyDescriptor(Number.prototype,"${m.name}");return d.writable+":"+d.enumerable+":"+d.configurable+":"+(d.value===Number.prototype.${m.name})+":"+(x.${m.name}===d.value);}`, inputs: [3] })),
  { feature: 'toFixed', source: 'function f(x){return x.toFixed(2)+"|"+x.toFixed(0)+"|"+x.toFixed()+"|"+x.toFixed(20);}', inputs: [...numericInputs, 0.5, 1.5, 2.5, -2.5, 1.005, 1.255, 8.345, 0.000001, 1e20, 1e21, -1e21, 123.456, -0.0000001] },
  { feature: 'toExponential', source: 'function f(x){return x.toExponential()+"|"+x.toExponential(0)+"|"+x.toExponential(3)+"|"+x.toExponential(16);}', inputs: [...numericInputs, 25, 35, 1.45, 123456, 0.00015, -6.02214076e23] },
  { feature: 'toPrecision', source: 'function f(x){return x.toPrecision()+"|"+x.toPrecision(1)+"|"+x.toPrecision(3)+"|"+x.toPrecision(7)+"|"+x.toPrecision(21);}', inputs: [...numericInputs, 0.000001234, 0.0000001234, 123456, 999.95, 9.5, 1e21] },
  // Compare all 100 digits separately: concatenating three results exceeds 256 UTF-16 units.
  ...['toPrecision', 'toFixed', 'toExponential'].map(method => ({ feature: 'decimal-worst-case-digits-' + method, source: `function f(x){return x.${method}(100);}`, inputs: [5e-324, 0.1, 1.7976931348623157e308] })),
  { feature: 'decimal-RangeError', source: 'function f(x){let n=0;const t=[()=>(1).toFixed(101),()=>(1).toFixed(-1),()=>(1).toFixed(Infinity),()=>(NaN).toFixed(Infinity),()=>(1).toExponential(101),()=>(1).toExponential(-1),()=>(1).toPrecision(0),()=>(1).toPrecision(101),()=>(1).toPrecision(-Infinity)];for(const g of t){try{g();}catch(e){if(e instanceof RangeError)n++;}}return n+":"+(NaN).toExponential(1000)+":"+(Infinity).toPrecision(0)+":"+(-Infinity).toFixed(100)+":"+x.toFixed(100.9).length;}', inputs: [3] },
  { feature: 'decimal-receiver', source: 'function f(x){let n=0;for(const r of ["1",undefined,null,{},true,Object("2")]){for(const g of [Number.prototype.toFixed,Number.prototype.toExponential,Number.prototype.toPrecision]){try{g.call(r,1);}catch(e){if(e instanceof TypeError)n++;}}}return n+":"+Number.prototype.toFixed.call(new Number(x),1)+":"+Number.prototype.toPrecision.call(Object(x));}', inputs: [2.25, -0] },
  { feature: 'decimal-coercion-order', source: 'function f(x){let s="";const a={valueOf(){s+="a";return x;}};let r="";try{Number.prototype.toFixed.call("z",a);}catch(e){r+=e instanceof TypeError;}r+=":"+(1.25).toFixed(a)+":"+(NaN).toExponential(a)+":"+(0).toPrecision(a);return r+":"+s;}', inputs: [1, 3] },
  { feature: 'decimal-argument-coercion', source: 'function f(x){return (12.345).toFixed(x)+"|"+(12.345).toExponential(x)+"|"+(12.345).toPrecision(x===undefined||x===null||x==="" ? 2 : x);}', inputs: [undefined, null, true, '2', '  3 ', 2.9, ''] },
];
// Each must end with an explicit Unsupported completion (status 6), never a guest catch.
export const numericUnsupportedSources = [
  'function f(x){try{return Math.random();}catch(e){return "wrong guest catch";}}',
  'function f(x){try{return (x).toLocaleString();}catch(e){return "wrong guest catch";}}',
];
// Resumption: nested helper calls with observable coercion across helpers.
export const numericResumptionSource = 'function f(x){let s="";const a={valueOf(){s+="a";return x*x;}};const b={valueOf(){s+="b";return Math.cbrt(64);}};const r=Math.hypot(Math.sqrt(a),b,Math.clz32(Math.imul(x,x))-28)+Math.atan2(0,-x)+Math.fround(Math.exp(Math.log(2)));return s+":"+r+":"+isNaN(r)+":"+isFinite(s);}';
export const numericResumptionExpected = 'ab:10.141592653589793:false:false';
