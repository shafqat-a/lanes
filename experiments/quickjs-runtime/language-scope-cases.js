// Language-scope fixtures. `expected` values are fixed ECMAScript results; the
// host oracle only confirms them. `admission` records current compiler status
// (compile-time only); it says nothing about GPU execution results.
export const languageScopeCases = [
  { feature: 'tdz-let-read', admission: 'admitted', input: 3, expected: 'true:tdz3',
    source: `function f(x){try{const r=y+x;let y=1;return "read:"+r;}catch(e){return (e instanceof ReferenceError)+":tdz"+x;}}` },
  { feature: 'tdz-closure-then-initialized', admission: 'admitted', input: 5, expected: 10,
    source: `function f(x){function g(){return v*2;}try{return "early:"+g();}catch(e){if(!(e instanceof ReferenceError))return "wrong";}let v=x;return g();}` },
  { feature: 'tdz-typeof', admission: 'admitted', input: 6, expected: -6,
    source: `function f(x){try{return typeof z;}catch(e){return e instanceof ReferenceError?-x:x;}let z=0;}` },
  { feature: 'tdz-let-write', admission: 'admitted', input: 4, expected: 8,
    source: `function f(x){try{w=x;let w=0;return "set";}catch(e){return e instanceof ReferenceError?x*2:-1;}}` },
  { feature: 'const-assign-typeerror', admission: 'admitted', input: 7, expected: 'true:7',
    source: `function f(x){const c=x;try{c=c+1;}catch(e){return (e instanceof TypeError)+":"+c;}return "mutated";}` },
  // Spec: an uninitialized const binding is checked before immutability (ReferenceError).
  { feature: 'const-assign-before-init-referenceerror', admission: 'admitted', input: 1, expected: 'ref1',
    note: 'Fixed by local compiler TDZ check before JS_THROW_VAR_RO; original ref1 outcome verified on M1/Safari in quickjs-safari-compiler-correctness.json',
    source: `function f(x){try{k=x;}catch(e){return (e instanceof ReferenceError?"ref":e instanceof TypeError?"type":"other")+x;}const k=1;return "none";}` },
  { feature: 'for-let-per-iteration-closures', admission: 'admitted', input: 5, expected: '0,5,10',
    source: `function f(x){const a=[];for(let i=0;i<3;i++){a[i]=function(){return i*x;};}return a[0]()+","+a[1]()+","+a[2]();}` },
  { feature: 'for-var-shared-binding', admission: 'admitted', input: 5, expected: '15,15,15',
    source: `function f(x){const a=[];for(var i=0;i<3;i++){a[i]=function(){return i*x;};}return a[0]()+","+a[1]()+","+a[2]();}` },
  { feature: 'for-let-copy-before-increment', admission: 'admitted', input: 2, expected: 533,
    source: `function f(x){const a=[];let n=0;for(let i=0;i<6;i++){a[n++]=function(){return i;};i++;}return a[0]()+a[1]()*10+a[2]()*100+x;}` },
  // Spec: closures created in the for-let head capture the loop environment, not the first iteration copy.
  { feature: 'for-let-head-closure-not-iteration-copy', admission: 'admitted', input: 40, expected: 40,
    source: `function f(x){let g;for(let i=x,h=(g=function(){return i;});i<x+2;i++){if(i===x){i=i+10;}}return g();}` },
  { feature: 'for-let-continue-per-iteration', admission: 'admitted', input: 1, expected: '1,2,3',
    note: 'Fixed by local compiler continue target before loop-head close_scopes; original 1,2,3 outcome verified on M1/Safari in quickjs-safari-compiler-correctness.json',
    source: `function f(x){const a=[];for(let i=0;i<3;i++){a[i]=function(){return i+x;};if(i<3)continue;}return a[0]()+","+a[1]()+","+a[2]();}` },
  { feature: 'finally-return-overrides-throw', admission: 'admitted', input: 3, expected: 'fin3',
    source: `function f(x){try{throw x;}finally{return "fin"+x;}}` },
  { feature: 'finally-throw-overrides-return', admission: 'admitted', input: 3, expected: 'caught6',
    source: `function f(x){try{try{return x;}finally{throw x*2;}}catch(e){return "caught"+e;}}` },
  { feature: 'finally-normal-keeps-evaluated-return', admission: 'admitted', input: 1, expected: 't:tf1',
    source: `function f(x){let log="";function g(){try{log+="t";return log;}finally{log+="f"+x;}}const r=g();return r+":"+log;}` },
  { feature: 'finally-break-discards-throw', admission: 'admitted', input: 19, expected: 20,
    source: `function f(x){let n=0;for(;;){try{n=x;throw 1;}finally{n++;break;}}return n;}` },
  { feature: 'nested-finally-order', admission: 'admitted', input: 7, expected: 'ac7|ac7fg',
    source: `function f(x){let s="";function g(){try{try{s+="a";throw x;}catch(e){s+="c"+e;return s;}finally{s+="f";}}finally{s+="g";}}const r=g();return r+"|"+s;}` },
  { feature: 'sloppy-arguments-mapped', admission: 'admitted', input: 3, expected: '30:7:3',
    source: `function f(x){function g(a,b){arguments[0]=a*10;b=7;return a+":"+arguments[1]+":"+arguments.length;}return g(x,1,2);}` },
  { feature: 'strict-arguments-unmapped', admission: 'admitted', input: 3, expected: '3:1:30',
    source: `function f(x){function g(a,b){"use strict";arguments[0]=a*10;b=7;return a+":"+arguments[1]+":"+arguments[0];}return g(x,1);}` },
  { feature: 'sloppy-arguments-unpassed-not-mapped', admission: 'admitted', input: 4, expected: '1:undefined:4',
    source: `function f(x){function g(a,b){b=x;return arguments.length+":"+arguments[1]+":"+b;}return g(x);}` },
  { feature: 'computed-key-number-string-same', admission: 'admitted', input: 1, expected: 'abc:abc1',
    source: `function f(x){const o={};o[x]="a";o[""+x]=o[""+x]+"b";o[x*1.0]=o[x*1.0]+"c";return o[x]+":"+o[""+x]+x;}` },
  { feature: 'computed-key-noncanonical-strings', admission: 'admitted', input: 5, expected: '5:6:7:false',
    source: `function f(x){const o={[x]:x,["0"+x]:x+1,[x+".0"]:x+2};return o[x]+":"+o["0"+x]+":"+o[x+".0"]+":"+(o[x]===o[x+".0"]);}` },
  // Object keys compile, but shader keyOf reports unsupported (status 6) for object keys.
  { feature: 'computed-key-object-tostring-first', admission: 'admitted', input: 3, expected: 's:3',
    note: 'shader.js keyOf: non-number/non-string key sets status 6',
    source: `function f(x){let log="";const k={toString(){log+="s";return "k"+x;},valueOf(){log+="v";return 1;}};const o={[k]:x};return log+":"+o["k"+x];}` },
  { feature: 'computed-key-object-valueof-fallback', admission: 'admitted', input: 3, expected: 'sv:9',
    note: 'shader.js keyOf: non-number/non-string key sets status 6',
    source: `function f(x){let log="";const k={toString(){log+="s";return {};},valueOf(){log+="v";return x;}};const o={};o[k]=x*3;return log+":"+o[x];}` },
  { feature: 'constructor-primitive-return-ignored', admission: 'admitted', input: 8, expected: 'object:8',
    source: `function f(x){function C(v){this.v=v;return 42;}const o=new C(x);return typeof o+":"+o.v;}` },
  { feature: 'constructor-object-return-used', admission: 'admitted', input: 3, expected: 'true:-3',
    source: `function f(x){const other={v:-x};function C(v){this.v=v;return other;}const o=new C(x);return (o===other)+":"+o.v;}` },
];
// Explicitly outside current compiler scope. Expected values document the
// ECMAScript result for future admission; they are oracle-checked only.
// Class rejection is incidental: packProgram drops the class constant, so push gets no operand.
export const languageScopeRejectedCases = [
  { feature: 'class-declaration', admission: 'admitted', input: 3, expected: 'function:3',
    source: `function f(x){class A{}return typeof A+":"+x;}` },
  // Admitted by the Phase 4 next wave (phase4-class-elements.js).
  { feature: 'class-private-field', admission: 'admitted', input: 3, expected: 3,
    source: `function f(x){class A{#p=x;get(){return this.#p;}}return new A().get();}` },
  { feature: 'new-target', admission: 'admitted', input: 2, expected: 'true:2',
    source: `function f(x){function C(){this.t=new.target===C;}return new C().t+":"+x;}` },
  { feature: 'generator-function', admission: 'admitted', input: 3, expected: 7,
    source: `function f(x){function* g(){yield x;yield x+1;}const it=g();return it.next().value+it.next().value;}` },
  { feature: 'async-function', admission: 'admitted', input: 4, expected: 'function4',
    source: `function f(x){async function g(){return x;}return typeof g+x;}` },
  { feature: 'object-destructuring', admission: 'admitted', input: 4, expected: 6,
    source: `function f(x){const {a,b=2}={a:x};return a+b;}` },
  { feature: 'array-destructuring', admission: 'admitted', input: 4, expected: 12,
    source: `function f(x){const [a,,b]=[x,0,x*2];return a+b;}` },
  { feature: 'call-spread', admission: 'admitted', input: 4, expected: 3,
    source: `function f(x){function g(a,b){return a-b;}return g(...[x,1]);}` },
  { feature: 'array-spread', admission: 'admitted', input: 5, expected: 7,
    source: `function f(x){return [...[x,x]].length+x;}` },
  { feature: 'object-spread', admission: 'admitted', input: 4, expected: 5,
    source: `function f(x){const o={...{a:x},b:1};return o.a+o.b;}` },
  // Destructuring and spread forms above are admitted since Phase 4 (to_object,
  // copy_data_properties, for_of_*/iterator_close, append/apply); see PHASE-4-STATUS.md.
  // Observed, not anticipated: computed-member compound assignment emits get_array_el3.
  // Admitted since the foundations integration added get_array_el3/perm4 (computed-assignment suite).
  { feature: 'computed-member-compound-assignment', admission: 'admitted', input: 4, expected: 5,
    source: `function f(x){const o={};o[x]=x;o[""+x]+=1;return o[x];}` },
  // Packs on both compilers. Guest ToPrimitive and the symbol method name run in WGSL.
  // Admission is compile-time only; this row does not claim a GPU result.
  { feature: 'symbol-toprimitive-key', admission: 'admitted', input: 4, expected: 4,
    source: `function f(x){const k={[Symbol.toPrimitive](hint){return "p"+hint;}};const o={[k]:x};return o.pstring;}` },
];
