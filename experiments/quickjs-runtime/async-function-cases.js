// Worker 5 fixtures: async functions (QuickJS kind 2). Every source is
// `function f(x){...}` whose result is the promise the GPU run reports through
// statuses 12/13/14 ({promiseResults:'settle'}). expected/expectedNext are the
// settlement value/reason for inputs 3 and 4; values are fixed literals that
// check-async-functions.mjs re-derives from a fresh native (node:vm) run with
// the microtask queue fully drained.
// Extra fields: deps (other wave workers the fixture needs at GPU runtime),
// gc (only the suspended activation keeps the probed value alive; GPU run must
// record collections>0), oneInstruction (resumed step is a single instruction),
// gpuOutcome (expected GPU status when it legitimately differs from native:
// resource limits).
const c = (feature, body, expected, expectedNext, settlement = 'fulfilled', extra = {}) =>
  Object.freeze({ feature, source: `function f(x){${body}}`, input: 3, expected, expectedNext, settlement, deps: ['promise-core', 'promise-resolve', 'promise-then', 'jobs'], ...extra });
const WASTE = `for(let i=0;i<700;i++){const waste={a:[i],s:'w'+i};}`;

export const asyncFunctionCases = Object.freeze([
  // Completion and settlement.
  c('return-value-fulfills', `async function a(){return x;}return a();`, 3, 4),
  c('fall-off-end-fulfills-undefined', `async function a(){x++;}return a();`, undefined, undefined),
  c('await-non-promise', `async function a(){const v=await x;return v+1;}return a();`, 4, 5),
  c('await-sequence-accumulates', `async function a(){let s=0;for(let i=0;i<=x;i++){s+=await i;}return s;}return a();`, 6, 10),
  c('throw-before-await-rejects', `async function a(){throw x;}return a();`, 3, 4, 'rejected'),
  c('throw-after-await-rejects', `async function a(){await 0;throw x+1;}return a();`, 4, 5, 'rejected'),
  c('throw-is-not-synchronous', `async function a(){throw x;}let sync=false;let p;try{p=a();}catch(e){sync=true;}async function b(){try{await p;}catch(e){return sync+':'+e;}}return b();`, 'false:3', 'false:4'),
  c('vm-typeerror-rejects', `async function a(){await 0;return null.p;}async function b(){try{await a();}catch(e){return (e instanceof TypeError)+':'+x;}}return b();`, 'true:3', 'true:4'),
  c('returns-fresh-promise-per-call', `async function a(){return x;}const p=a(),q=a();async function b(){return (p!==q)+':'+(await p)+':'+(await q);}return b();`, 'true:3:3', 'true:4:4'),
  c('pending-forever', `async function a(){await {then(){}};return x;}return a();`, undefined, undefined, 'pending'),
  // Synchronous prefix and tick ordering.
  c('sync-prefix-before-caller-continues', `let log='';async function a(){log+='a';await 0;log+='c';return log+x;}const p=a();log+='b';return p;`, 'abc3', 'abc4'),
  c('interleaved-activations', `let log='';async function a(n){log+=n+'1';await 0;log+=n+'2';await 0;log+=n+'3';}a('a');a('b');async function c(){await 0;await 0;await 0;return log+x;}return c();`, 'a1b1a2b2a3b3' + '3', 'a1b1a2b2a3b3' + '4'),
  c('await-native-promise-one-tick', `let log='';async function inner(){return x;}async function a(){const p=inner();await p;log+='a';}async function b(){await 0;log+='b';}a();b();async function c(){await 0;await 0;await 0;return log;}return c();`, 'ab', 'ab'),
  c('await-thenable-two-ticks', `let log='';const t={then(r){r(x);}};async function a(){await t;log+='a';}async function b(){await 0;log+='b';await 0;log+='B';}a();b();async function c(){await 0;await 0;await 0;await 0;return log;}return c();`, 'baB', 'baB'),
  c('return-native-promise-three-ticks', `let log='';async function inner(){return x;}async function a(){return inner();}async function w(){await a();log+='a';}async function z(){for(let i=1;i<=4;i++){await 0;log+=i;}}w();z();async function c(){for(let i=0;i<6;i++)await 0;return log;}return c();`, '12a34', '12a34'),
  c('then-getter-runs-synchronously', `let log='';const t={get then(){log+='g';return r=>r(x);}};async function a(){log+='a';const v=await t;log+='c';return v+log;}const p=a();log+='b';return p;`, '3agbc', '4agbc'),
  // Thenables and return resolution.
  c('await-thenable-value', `const t={then(r){r(x+1);}};async function a(){return await t;}return a();`, 4, 5),
  c('await-thenable-rejects-into-catch', `const t={then(_,j){j(x);}};async function a(){try{await t;}catch(e){return 'caught'+e;}}return a();`, 'caught3', 'caught4'),
  c('await-thenable-then-throws', `const t={then(){throw x;}};async function a(){try{await t;return 'no';}catch(e){return e+1;}}return a();`, 4, 5),
  c('return-thenable-resolves-not-fulfills', `async function a(){return {then(r){r(x+5);}};}return a();`, 8, 9),
  c('return-thenable-getter-throws-rejects', `async function a(){return {get then(){throw x;}};}return a();`, 3, 4, 'rejected'),
  c('return-nonthenable-object-fulfills', `async function a(){return {v:x};}async function b(){return (await a()).v;}return b();`, 3, 4),
  c('return-async-rejected-promise-rejects', `async function inner(){throw x;}async function a(){return inner();}return a();`, 3, 4, 'rejected'),
  // Normative PromiseResolve(%Promise%, v) observability (constructor Get).
  c('await-promise-constructor-getter-observed', `const p=(async()=>x)();let n=0;const C=Object.getPrototypeOf(p).constructor;Object.defineProperty(p,'constructor',{get(){n++;return C;}});async function a(){const v=await p;return v+':'+n;}return a();`, '3:1', '4:1'),
  c('await-promise-constructor-getter-throw-catchable', `const p=(async()=>x)();Object.defineProperty(p,'constructor',{get(){throw x+1;}});async function a(){try{await p;return 'no';}catch(e){return 'caught'+e;}}return a();`, 'caught4', 'caught5'),
  c('await-promise-constructor-getter-throw-uncaught-rejects', `const p=(async()=>x)();Object.defineProperty(p,'constructor',{get(){throw x+2;}});async function a(){await p;return 'no';}return a();`, 5, 6, 'rejected'),
  // try / catch / finally across await.
  c('catch-rejected-await', `async function bad(){await 0;throw x;}async function a(){try{await bad();}catch(e){return e+1;}}return a();`, 4, 5),
  c('finally-await-after-return', `let log='';async function a(){try{return x;}finally{await 0;log+='f';}}async function b(){const v=await a();return v+log;}return b();`, '3f', '4f'),
  c('finally-return-overrides-throw', `async function a(){try{throw 1;}finally{await 0;return x;}}return a();`, 3, 4),
  c('catch-await-rethrow-rejects', `async function a(){try{throw x;}catch(e){await 0;throw e+10;}}return a();`, 13, 14, 'rejected'),
  c('uncaught-after-resume-runs-finally', `let n=0;async function a(){try{await 0;throw x;}finally{n++;}}async function b(){try{await a();}catch(e){return e+':'+n;}}return b();`, '3:1', '4:1'),
  c('nested-finally-awaits', `let log='';async function a(){try{try{await 0;log+='t';return x;}finally{await 0;log+='i';}}finally{await 0;log+='o';}}async function b(){const v=await a();return v+log;}return b();`, '3tio', '4tio'),
  c('loop-break-continue-awaits', `async function a(){let s='';for(let i=0;i<6;i++){if(i===1)continue;if(i===x)break;s+=await i;}return s;}return a();`, '02', '023'),
  // Bindings, this, arguments, closures.
  c('this-retained-method', `const o={v:x,async m(){await 0;return this.v;}};return o.m();`, 3, 4),
  c('sloppy-this-boxing-retained', `async function a(){const t=this;await 0;return (t===this)+':'+typeof this+':'+this.valueOf();}return a.call(x);`, 'true:object:3', 'true:object:4'),
  c('strict-this-primitive-retained', `async function a(){'use strict';await 0;return typeof this+':'+this;}return a.call(x);`, 'number:3', 'number:4'),
  c('arguments-retained', `async function a(){await 0;return arguments.length+':'+arguments[0];}return a(x,9);`, '2:3', '2:4'),
  c('mapped-arguments-linked-across-await', `async function a(p){await 0;p++;return arguments[0];}return a(x);`, 4, 5),
  c('closure-binding-across-await', `async function a(){let n=x;const g=()=>n;await 0;n++;return g();}return a();`, 4, 5),
  c('default-params-evaluated-synchronously', `let log='';async function a(p=(log+='d',x)){log+='b';await 0;return p+log;}const r=a();log+='c';return r;`, '3dbc', '4dbc'),
  c('default-param-throw-rejects-not-throws', `async function a(p=(()=>{throw x;})()){return 'no';}let sync=false;let r;try{r=a();}catch(e){sync=true;}async function b(){try{await r;}catch(e){return e+':'+sync;}}return b();`, '3:false', '4:false'),
  c('arrow-lexical-this-arguments', `function g(){return (async()=>{await 0;return this.v+':'+arguments[0];})();}return g.call({v:x},'arg');`, '3:arg', '4:arg'),
  c('bound-and-call-apply', `async function a(p,q){await 0;return this.v+p+q;}const b=a.bind({v:x},1);async function c(){return (await b(2))+':'+(await a.call({v:x},0,0))+':'+(await a.apply({v:1},[x,x]));}return c();`, '6:3:7', '7:4:9'),
  c('tail-called-async-function', `async function a(){await 0;return x;}function t(){return a();}return t();`, 3, 4),
  // Classes.
  c('class-async-method', `class A{async m(){await 0;return x;}}return new A().m();`, 3, 4),
  c('class-async-private-method', `class A{async #m(){await 0;return x+1;}run(){return this.#m();}}return new A().run();`, 4, 5),
  c('class-async-static-method', `class A{static async s(){await 0;return this===A?x:-1;}}return A.s();`, 3, 4),
  c('class-async-method-super', `class B{v(){return x;}}class A extends B{async m(){await 0;return super.v()+1;}}return new A().m();`, 4, 5),
  c('class-async-method-new-target-undefined', `class A{async m(){await 0;return typeof new.target;}}return new A().m();`, 'undefined', 'undefined'),
  // Nesting, recursion, re-entrancy.
  c('nested-async-calls', `async function c1(){await 0;return x;}async function b1(){return (await c1())+1;}async function a1(){return (await b1())*2;}return a1();`, 8, 10),
  c('async-recursion', `async function fib(n){return n<2?n:(await fib(n-1))+(await fib(n-2));}return fib(x+3);`, 8, 13),
  c('reentrant-call-from-resolved-callback', `let depth=0;async function a(n){depth++;await 0;if(n>0)return a(n-1);return depth;}return a(x);`, 4, 5),
  c('await-in-call-arguments', `function sum(a,b,c){return a+b+c;}async function a(){return sum(await x,await 1,x);}return a();`, 7, 9),
  c('deep-sync-recursion-resource-limit', `async function r(n){return n===0?0:1+await r(n-1);}return r(40+x);`, 43, 44, 'fulfilled', { gpuOutcome: 'resource' }),
  // Function objects.
  c('async-function-not-constructor', `async function a(){}let r='no';try{new a();}catch(e){r=e instanceof TypeError;}return (async()=>r+':'+x)();`, 'true:3', 'true:4'),
  c('async-function-own-properties', `async function a(p,q){}const g=async(s)=>s;return (async()=>Object.hasOwn(a,'prototype')+':'+a.length+':'+a.name+':'+g.name+':'+g.length+':'+typeof a+':'+x)();`, 'false:2:a:g:1:function:3', 'false:2:a:g:1:function:4'),
  c('async-function-prototype-chain', `const AF=Object.getPrototypeOf(async function(){});return (async()=>(Object.getPrototypeOf(AF)===Function.prototype)+':'+AF[Symbol.toStringTag]+':'+AF.constructor.name+':'+AF.constructor.length+':'+(AF.constructor.prototype===AF)+':'+Object.hasOwn(AF,'prototype')+':'+x)();`, 'true:AsyncFunction:AsyncFunction:1:true:false:3', 'true:AsyncFunction:AsyncFunction:1:true:false:4'),
  c('async-method-has-no-prototype', `const o={async m(){}};class A{async n(){}}return (async()=>Object.hasOwn(o.m,'prototype')+':'+Object.hasOwn(A.prototype.n,'prototype')+':'+o.m.name+':'+x)();`, 'false:false:m:3', 'false:false:m:4'),
  c('async-function-to-string-tag', `async function a(){}return (async()=>Object.prototype.toString.call(a)+x)();`, '[object AsyncFunction]3', '[object AsyncFunction]4'),
  // GC pressure: only the suspended activation keeps the probed value alive.
  c('gc-saved-operand-stack', `async function a(){return ({s:'keep'+x}).s+await 0;}const p=a();${WASTE}return p;`, 'keep30', 'keep40', 'fulfilled', { gc: true }),
  c('gc-saved-receiver', `async function a(){await 0;return this.s;}const p=a.call({s:'this'+x});${WASTE}return p;`, 'this3', 'this4', 'fulfilled', { gc: true }),
  c('gc-saved-locals-and-awaited-object', `async function a(){const keep={s:'k'+x};const v=await {s:'v'+x};return keep.s+v.s;}const p=a();${WASTE}return p;`, 'k3v3', 'k4v4', 'fulfilled', { gc: true }),
  c('gc-pending-finally-return', `async function a(){try{return {s:'r'+x};}finally{await 0;}}async function b(){const p=a();${WASTE}return (await p).s;}return b();`, 'r3', 'r4', 'fulfilled', { gc: true }),
  c('gc-between-resumptions', `async function a(){const keep=[{s:'a'+x}];await 0;${WASTE}await 0;return keep[0].s;}return a();`, 'a3', 'a4', 'fulfilled', { gc: true }),
  // One-instruction resumptions: the resumed step executes exactly one VM instruction.
  c('one-instruction-resume-return-async', `async function a(){return await x;}return a();`, 3, 4, 'fulfilled', { oneInstruction: 'return_async' }),
  c('one-instruction-resume-throw-uncaught', `const t={then(_,j){j(x);}};async function a(){await t;}return a();`, 3, 4, 'rejected', { oneInstruction: 'raise at await' }),
  c('one-instruction-resume-await-again', `async function a(){await await x;}async function b(){const v=await a();return typeof v+':'+x;}return b();`, 'undefined:3', 'undefined:4', 'fulfilled', { oneInstruction: 'await' }),
]);
