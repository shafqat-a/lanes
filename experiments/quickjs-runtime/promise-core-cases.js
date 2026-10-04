// Promise core fixtures (worker 1). Each program returns a Promise; `expected`
// is its settled value/reason for `input`, `expectedNext` for input+1, and
// `settlement` the required state. Expected values are normative ES2025
// outcomes and are re-derived by the native oracle in check-promise-core.mjs
// (real host job draining). They are GPU targets once the wave is integrated:
// fulfilled cases additionally depend on worker 2's __promiseResolveBody and
// every case on worker 7's drain/publish (statuses 12/13).
const c = (feature, body, settlement, expected, expectedNext) =>
  ({ feature, source: `function f(x){${body}}`, input: 3, expected, expectedNext, settlement });
const ok = (feature, body, expected, expectedNext) => c(feature, body, 'fulfilled', expected, expectedNext);
const no = (feature, body, expected, expectedNext) => c(feature, body, 'rejected', expected, expectedNext);
const waste = `for(let i=0;i<700;i++){const waste={a:[i],s:'w'+i};}`;

export const promiseCoreCases = [
  // Executor
  ok('executor-runs-synchronously', `let log='a';new Promise(()=>{log+='b';});log+='c';return new Promise(r=>r(log+x));`, 'abc3', 'abc4'),
  ok('executor-arguments-and-strict-this', `let info='';new Promise(function(a,b){'use strict';info=typeof a+':'+typeof b+':'+arguments.length+':'+(this===undefined);});return new Promise(r=>r(info+':'+x));`, 'function:function:2:true:3', 'function:function:2:true:4'),
  ok('executor-extra-constructor-arguments-ignored', `let n=-1;new Promise(function(){n=arguments.length;},x,x);return new Promise(r=>r(n+x));`, 5, 6),
  ok('executor-return-value-ignored', `return new Promise(r=>{r(x);return x+100;});`, 3, 4),
  ok('nested-promise-in-executor', `return new Promise(r=>{const q=new Promise((_,j)=>j(x));r((q instanceof Promise)+':'+x);});`, 'true:3', 'true:4'),
  // Resolve / reject once-only
  ok('resolve-fulfills', `return new Promise(r=>r(x*2));`, 6, 8),
  no('reject-rejects', `return new Promise((_,j)=>j(x+1));`, 4, 5),
  ok('resolve-once-only', `return new Promise((r,j)=>{r(x);r(x+1);j(0);});`, 3, 4),
  no('reject-once-only', `return new Promise((r,j)=>{j(x);r(1);j(2);});`, 3, 4),
  ok('throw-after-resolve-ignored', `return new Promise(r=>{r(x);throw 99;});`, 3, 4),
  no('throw-after-reject-ignored', `return new Promise((_,j)=>{j(x);throw 99;});`, 3, 4),
  no('throw-before-resolve-rejects', `return new Promise(r=>{throw x;r(1);});`, 3, 4),
  no('throw-string-reason', `return new Promise(()=>{throw 'boom'+x;});`, 'boom3', 'boom4'),
  ok('resolve-after-executor-returns', `let res;const p=new Promise(r=>{res=r;});res(x);res(0);return p;`, 3, 4),
  no('reject-after-executor-returns-any-this', `let j;const p=new Promise((_,b)=>{j=b;});j.call({},x);return p;`, 3, 4),
  ok('resolve-returns-undefined', `let out;const p=new Promise(r=>{out=r(x);});return new Promise(r=>r(String(out)+':'+x));`, 'undefined:3', 'undefined:4'),
  ok('reject-returns-undefined', `let out;new Promise((_,j)=>{out=j(x);});return new Promise(r=>r(String(out)+':'+x));`, 'undefined:3', 'undefined:4'),
  ok('rejected-then-resolve-on-other-promise-independent', `let ja,rb;const a=new Promise((_,j)=>{ja=j;});const b=new Promise(r=>{rb=r;});ja(1);rb(x);return b;`, 3, 4),
  // Non-callable executor / call without new
  ok('non-callable-executor-typeerror', `try{new Promise(x);}catch(e){return new Promise(r=>r((e instanceof TypeError)+':'+x));}return new Promise(r=>r('no'));`, 'true:3', 'true:4'),
  ok('missing-executor-typeerror', `try{new Promise();}catch(e){return new Promise(r=>r((e instanceof TypeError)+':'+x));}return new Promise(r=>r('no'));`, 'true:3', 'true:4'),
  ok('object-executor-typeerror', `try{new Promise({});}catch(e){return new Promise(r=>r((e instanceof TypeError)+':'+x));}return new Promise(r=>r('no'));`, 'true:3', 'true:4'),
  ok('call-without-new-typeerror', `let n=0;try{Promise(()=>{n++;});}catch(e){return new Promise(r=>r((e instanceof TypeError)+':'+n+':'+x));}return new Promise(r=>r('no'));`, 'true:0:3', 'true:0:4'),
  ok('call-via-call-without-new-typeerror', `try{Promise.call(undefined,()=>{});}catch(e){return new Promise(r=>r((e instanceof TypeError)+':'+x));}return new Promise(r=>r('no'));`, 'true:3', 'true:4'),
  // Brand, prototype chain, constructor metadata
  ok('instanceof-and-prototype', `const p=new Promise(()=>{});return new Promise(r=>r((p instanceof Promise)+':'+(Object.getPrototypeOf(p)===Promise.prototype)+':'+(p instanceof Object)+':'+x));`, 'true:true:true:3', 'true:true:true:4'),
  ok('prototype-chain', `return new Promise(r=>r((Object.getPrototypeOf(Promise.prototype)===Object.prototype)+':'+(Object.getPrototypeOf(Promise)===Function.prototype)+':'+x));`, 'true:true:3', 'true:true:4'),
  ok('constructor-link', `const d=Object.getOwnPropertyDescriptor(Promise.prototype,'constructor');return new Promise(r=>r((Promise.prototype.constructor===Promise)+':'+d.writable+d.enumerable+d.configurable+':'+(new Promise(()=>{}).constructor===Promise)+':'+x));`, 'true:truefalsetrue:true:3', 'true:truefalsetrue:true:4'),
  ok('to-string-tag', `const d=Object.getOwnPropertyDescriptor(Promise.prototype,Symbol.toStringTag);return new Promise(r=>r(Object.prototype.toString.call(new Promise(()=>{}))+':'+Promise.prototype[Symbol.toStringTag]+':'+d.writable+d.enumerable+d.configurable+':'+x));`, '[object Promise]:Promise:falsefalsetrue:3', '[object Promise]:Promise:falsefalsetrue:4'),
  ok('promise-length-name', `const l=Object.getOwnPropertyDescriptor(Promise,'length'),n=Object.getOwnPropertyDescriptor(Promise,'name');return new Promise(r=>r(Promise.length+':'+Promise.name+':'+l.writable+l.enumerable+l.configurable+':'+n.writable+n.enumerable+n.configurable+':'+x));`, '1:Promise:falsefalsetrue:falsefalsetrue:3', '1:Promise:falsefalsetrue:falsefalsetrue:4'),
  ok('promise-prototype-descriptor', `const d=Object.getOwnPropertyDescriptor(Promise,'prototype');return new Promise(r=>r(d.writable+':'+d.enumerable+':'+d.configurable+':'+(d.value===Promise.prototype)+':'+x));`, 'false:false:false:true:3', 'false:false:false:true:4'),
  ok('typeof-promise-and-instance', `return new Promise(r=>r(typeof Promise+':'+typeof new Promise(()=>{})+':'+x));`, 'function:object:3', 'function:object:4'),
  ok('promise-instance-has-no-own-keys', `const p=new Promise(r=>r(1));return new Promise(r=>r(Object.getOwnPropertyNames(p).length+':'+Object.keys(p).length+':'+Object.isExtensible(p)+':'+x));`, '0:0:true:3', '0:0:true:4'),
  ok('create-from-prototype-is-not-promise-object', `const fake=Object.create(Promise.prototype);return new Promise(r=>r((fake instanceof Promise)+':'+Object.prototype.toString.call(fake)+':'+x));`, 'true:[object Promise]:3', 'true:[object Promise]:4'),
  ok('frozen-promise-still-settles', `let res;const p=Object.freeze(new Promise(r=>{res=r;}));res('frozen'+x);return p;`, 'frozen3', 'frozen4'),
  ok('promise-properties-are-ordinary', `const p=new Promise(()=>{});p.tag=x;Promise.extra=x+1;const v=p.tag+':'+Promise.extra;delete Promise.extra;return new Promise(r=>r(v+':'+('extra' in Promise)));`, '3:4:false', '4:5:false'),
  ok('bound-promise-constructor', `const B=Promise.bind(null);const p=new B(r=>r(x));return p;`, 3, 4),
  // Resolving functions
  ok('resolving-functions-length-name', `let s='';new Promise((a,b)=>{s=a.length+':'+b.length+':['+a.name+']['+b.name+']:'+Object.hasOwn(a,'name')+':'+Object.hasOwn(a,'prototype');});return new Promise(r=>r(s+':'+x));`, '1:1:[][]:true:false:3', '1:1:[][]:true:false:4'),
  ok('resolving-functions-not-constructors', `let a;new Promise(r=>{a=r;});try{new a(1);}catch(e){return new Promise(r=>r((e instanceof TypeError)+':'+x));}return new Promise(r=>r('no'));`, 'true:3', 'true:4'),
  ok('resolving-functions-distinct', `let a,b,c;new Promise((r,j)=>{a=r;b=j;});new Promise(r=>{c=r;});return new Promise(r=>r((a!==b)+':'+(a!==c)+':'+(typeof a)+':'+x));`, 'true:true:function:3', 'true:true:function:4'),
  ok('resolving-functions-prototype-is-function-prototype', `let a;new Promise(r=>{a=r;});return new Promise(r=>r((Object.getPrototypeOf(a)===Function.prototype)+':'+x));`, 'true:3', 'true:4'),
  // GC: settled value / reason / pending state retained across collections
  ok('settled-value-retained-across-gc', `const p=new Promise(r=>r('keep'+x));${waste}return p;`, 'keep3', 'keep4'),
  no('rejection-reason-retained-across-gc', `const p=new Promise((_,j)=>j('lost'+x));${waste}return p;`, 'lost3', 'lost4'),
  ok('pending-promise-retained-by-resolver-across-gc', `let res;const p=new Promise(r=>{res=r;});${waste}res('late'+x);return p;`, 'late3', 'late4'),
  no('pending-promise-only-reachable-from-closure', `let rej;(()=>{new Promise((_,j)=>{rej=j;});})();${waste}let out=String(rej('x'+x));return new Promise((_,j)=>j(out+x));`, 'undefined3', 'undefined4'),
  ok('many-promises-dead-headers-collected', `let keep;for(let i=0;i<300;i++){const p=new Promise(r=>r('v'+i));if(i===x)keep=p;}return keep;`, 'v3', 'v4'),
  no('many-rejected-promises-reason-identity', `let keep;for(let i=0;i<300;i++){const p=new Promise((_,j)=>j('r'+i));if(i===x+1)keep=p;}${waste}return keep;`, 'r4', 'r5'),
];

// Normative outcomes that cross the existing built-in-subclass boundary
// (construct() status 6 for a foreign NewTarget). Required once parent
// construct dispatch passes NewTarget into tag-11 constructors; never relabel
// these as passes while the boundary stands.
export const promiseCoreBoundaryCases = [
  ok('subclass-instance-and-prototype', `class P extends Promise{}const p=new P(r=>r(x));return new Promise(r=>r((p instanceof P)+':'+(p instanceof Promise)+':'+(Object.getPrototypeOf(p)===P.prototype)+':'+x));`, 'true:true:true:3', 'true:true:true:4'),
  ok('subclass-settles', `class P extends Promise{}return new P(r=>r(x+1));`, 4, 5),
  ok('reflect-construct-newtarget-prototype', `function N(){}N.prototype=Object.create(Promise.prototype);const p=Reflect.construct(Promise,[r=>r(x)],N);return new Promise(r=>r((Object.getPrototypeOf(p)===N.prototype)+':'+x));`, 'true:3', 'true:4'),
];
