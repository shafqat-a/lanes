// Worker 3 fixtures: Promise.prototype.then/catch/finally, reactions,
// chaining, thrown errors, cycles and SpeciesConstructor.
// f(x) returns a promise; `expected` / `expectedNext` are its settled value
// (fulfillment value or rejection reason) for input / input+1 after the job
// queue drains, `settlement` its final state ('fulfilled'|'rejected'|'pending';
// pending => value undefined). Ordering is observed through string logs.
// Every expectation is checked against real ES semantics (node) by
// check-promise-then.mjs. `requires` names behaviour owned by other workers
// beyond the contract minimum (Promise constructor 2800/2801, resolve
// functions, job queue) that a GPU run of the fixture also needs.
const c = (feature, source, input, expected, expectedNext, settlement = 'fulfilled', extra = {}) =>
  Object.freeze({ feature, source, input, expected, expectedNext, settlement, ...extra });
const SPECIES = ['Object.getOwnPropertySymbols(Promise) exposing get [@@species] (worker 4, 2812)'];

export const promiseThenCases = Object.freeze([
  // then on fulfilled / rejected / pending
  c('then-fulfilled', 'function f(x){return new Promise(r=>r(x)).then(v=>v*2);}', 3, 6, 8),
  c('then-rejected-onRejected', 'function f(x){return new Promise((_,j)=>j(x)).then(v=>"no",e=>"r"+e);}', 3, 'r3', 'r4'),
  c('then-pending-then-resolve', 'function f(x){let res;const p=new Promise(r=>{res=r;});const q=p.then(v=>v+1);res(x);return q;}', 3, 4, 5),
  c('then-pending-then-reject', 'function f(x){let rej;const p=new Promise((_,j)=>{rej=j;});const q=p.then(v=>"no",e=>e*10);rej(x);return q;}', 3, 30, 40),
  c('then-returns-new-promise', 'function f(x){const p=new Promise(r=>r(x));const q=p.then();return q.then(v=>(q!==p)+":"+(q instanceof Promise)+":"+v);}', 3, 'true:true:3', 'true:true:4'),
  c('then-handler-this-undefined', 'function f(x){return new Promise(r=>r(x)).then(function(v){"use strict";return (this===undefined)+":"+v+":"+arguments.length;});}', 3, 'true:3:1', 'true:4:1'),
  // ordering across multiple thens
  c('order-multiple-thens-same-promise', 'function f(x){const log=[];const p=new Promise(r=>r(x));p.then(()=>log.push("a"));p.then(()=>log.push("b"));p.then(()=>log.push("c"));return p.then(()=>log.join(",")+":"+x);}', 3, 'a,b,c:3', 'a,b,c:4'),
  c('order-pending-registration', 'function f(x){const log=[];let res;const p=new Promise(r=>{res=r;});p.then(v=>log.push("a"+v));p.then(v=>log.push("b"+v));const q=p.then(()=>log.join());res(x);return q;}', 3, 'a3,b3', 'a4,b4'),
  c('order-interleave-a1-b1-a2-b2', 'function f(x){const log=[];const p=new Promise(r=>r(x));p.then(()=>log.push("a1")).then(()=>log.push("a2"));p.then(()=>log.push("b1")).then(()=>log.push("b2"));return p.then(()=>0).then(()=>0).then(()=>log.join(",")+":"+x);}', 3, 'a1,b1,a2,b2:3', 'a1,b1,a2,b2:4'),
  c('order-two-roots', 'function f(x){const log=[];const p=new Promise(r=>r(1));const q=new Promise(r=>r(2));p.then(()=>log.push("p1")).then(()=>log.push("p2")).then(()=>log.push("p3"));q.then(()=>log.push("q1")).then(()=>log.push("q2"));return new Promise(r=>r()).then(()=>0).then(()=>0).then(()=>0).then(()=>log.join(",")+":"+x);}', 3, 'p1,q1,p2,q2,p3:3', 'p1,q1,p2,q2,p3:4'),
  c('order-sync-before-jobs', 'function f(x){const log=[];const p=new Promise(r=>{log.push("exec");r(x);});p.then(()=>log.push("job"));log.push("sync");return p.then(()=>log.join(","));}', 3, 'exec,sync,job', 'exec,sync,job'),
  c('order-fulfilled-vs-rejected', 'function f(x){const log=[];const a=new Promise(r=>r(1));const b=new Promise((_,j)=>j(2));b.then(null,()=>log.push("b"));a.then(()=>log.push("a"));b.catch(()=>log.push("b2"));return a.then(()=>log.join(",")+":"+x);}', 3, 'b,a,b2:3', 'b,a,b2:4'),
  // nested chains / handler returns promise or thenable
  c('nested-chain', 'function f(x){return new Promise(r=>r(x)).then(v=>new Promise(r=>r(v+1)).then(w=>w*10));}', 3, 40, 50),
  c('handler-returns-thenable', 'function f(x){return new Promise(r=>r(x)).then(v=>({then(res){res(v+5);}}));}', 3, 8, 9),
  c('handler-returns-rejecting-thenable', 'function f(x){return new Promise(r=>r(x)).then(v=>({then(_,rej){rej("t"+v);}})).then(null,e=>e+"!");}', 3, 't3!', 't4!'),
  c('handler-returns-thenable-then-throws-after-resolve', 'function f(x){return new Promise(r=>r(x)).then(v=>({then(res){res(v);throw "late";}}));}', 3, 3, 4),
  c('order-returned-promise-costs-two-ticks', 'function f(x){const log=[];const p=new Promise(r=>r(x));p.then(()=>{log.push("a1");return new Promise(r=>r());}).then(()=>log.push("a2"));p.then(()=>log.push("b1")).then(()=>log.push("b2")).then(()=>log.push("b3")).then(()=>log.push("b4"));return p.then(()=>0).then(()=>0).then(()=>0).then(()=>0).then(()=>log.join(","));}', 3, 'a1,b1,b2,b3,a2,b4', 'a1,b1,b2,b3,a2,b4'),
  c('order-returned-thenable-costs-one-tick', 'function f(x){const log=[];const p=new Promise(r=>r(x));p.then(()=>{log.push("a1");return {then(r){log.push("then");r();}};}).then(()=>log.push("a2"));p.then(()=>log.push("b1")).then(()=>log.push("b2")).then(()=>log.push("b3"));return p.then(()=>0).then(()=>0).then(()=>0).then(()=>log.join(","));}', 3, 'a1,b1,then,b2,a2,b3', 'a1,b1,then,b2,a2,b3'),
  // thrown errors
  c('handler-throws-rejects', 'function f(x){return new Promise(r=>r(x)).then(()=>{throw "e"+x;}).then(null,e=>"caught:"+e);}', 3, 'caught:e3', 'caught:e4'),
  c('handler-throws-final-rejected', 'function f(x){return new Promise(r=>r(x)).then(v=>{throw v*2;});}', 3, 6, 8, 'rejected'),
  c('onRejected-throws', 'function f(x){return new Promise((_,j)=>j(x)).then(null,e=>{throw e+1;});}', 3, 4, 5, 'rejected'),
  c('handler-throws-TypeError-object', 'function f(x){return new Promise(r=>r(x)).then(v=>null.p).catch(e=>(e instanceof TypeError)+":"+x);}', 3, 'true:3', 'true:4'),
  // non-callable handlers
  c('non-callable-onFulfilled-pass-through', 'function f(x){return new Promise(r=>r(x)).then(5).then(null).then({}).then(v=>v+1);}', 3, 4, 5),
  c('non-callable-onRejected-pass-through', 'function f(x){return new Promise((_,j)=>j(x)).then(v=>1,"str").then(v=>2,null).then(null,e=>"r"+e);}', 3, 'r3', 'r4'),
  c('rejection-pass-through-final', 'function f(x){return new Promise((_,j)=>j(x)).then(v=>v);}', 3, 3, 4, 'rejected'),
  // catch
  c('catch-basic', 'function f(x){return new Promise((_,j)=>j(x)).catch(e=>e+1);}', 3, 4, 5),
  c('catch-on-fulfilled-pass-through', 'function f(x){return new Promise(r=>r(x)).catch(()=>0).then(v=>v);}', 3, 3, 4),
  c('catch-generic-invoke-on-thenable-object', 'function f(x){const o={then(a,b){return "then:"+(a===undefined)+":"+typeof b+":"+arguments.length+":"+x;}};const r=Promise.prototype.catch.call(o,()=>{});return new Promise(res=>res(r));}', 3, 'then:true:function:2:3', 'then:true:function:2:4'),
  c('catch-patched-then-observed', 'function f(x){const p=new Promise(r=>r(x));let seen=0;p.then=function(a,b){seen++;return Promise.prototype.then.call(this,a,b);};return p.catch(()=>0).then(v=>v+":"+seen);}', 3, '3:1', '4:1'),
  c('catch-undefined-receiver-TypeError', 'function f(x){try{Promise.prototype.catch.call(undefined,()=>{});return new Promise(r=>r("no"));}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+x));}}', 3, 'true:3', 'true:4'),
  c('catch-non-callable-then-TypeError', 'function f(x){try{Promise.prototype.catch.call({then:5});return new Promise(r=>r("no"));}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+x));}}', 3, 'true:3', 'true:4'),
  // finally
  c('finally-value-pass-through', 'function f(x){let n=0;return new Promise(r=>r(x)).finally(()=>{n++;return 99;}).then(v=>v+":"+n);}', 3, '3:1', '4:1'),
  c('finally-rejection-pass-through', 'function f(x){return new Promise((_,j)=>j(x)).finally(()=>1);}', 3, 3, 4, 'rejected'),
  c('finally-throw-overrides-fulfilled', 'function f(x){return new Promise(r=>r(x)).finally(()=>{throw "f"+x;}).catch(e=>e);}', 3, 'f3', 'f4'),
  c('finally-throw-overrides-rejected', 'function f(x){return new Promise((_,j)=>j("orig")).finally(()=>{throw "f"+x;});}', 3, 'f3', 'f4', 'rejected'),
  c('finally-rejected-promise-overrides', 'function f(x){return new Promise(r=>r(x)).finally(()=>new Promise((_,j)=>j("o"+x))).catch(e=>e);}', 3, 'o3', 'o4'),
  c('finally-fulfilled-promise-keeps-value', 'function f(x){return new Promise(r=>r(x)).finally(()=>new Promise(r=>r(100)));}', 3, 3, 4),
  c('finally-non-callable', 'function f(x){return new Promise(r=>r(x)).finally(5).finally().then(v=>v*3);}', 3, 9, 12),
  c('finally-non-callable-rejected', 'function f(x){return new Promise((_,j)=>j(x)).finally(undefined);}', 3, 3, 4, 'rejected'),
  c('finally-callback-no-arguments', 'function f(x){let n=-1;return new Promise(r=>r(x)).finally(function(){n=arguments.length;}).then(v=>v+":"+n);}', 3, '3:0', '4:0'),
  c('finally-closure-shape', 'function f(x){const p=new Promise(r=>r(x));let info="";p.then=function(a,b){info=a.length+":"+b.length+":"+JSON.stringify(a.name)+":"+(a===b)+":"+("prototype" in a);return Promise.prototype.then.call(this,a,b);};return p.finally(()=>{}).then(v=>info+":"+v);}', 3, '1:1:"":false:false:3', '1:1:"":false:false:4'),
  c('finally-non-callable-forwarded', 'function f(x){const p=new Promise(r=>r(x));let info="";p.then=function(a,b){info=(a===7)+":"+(b===7)+":"+arguments.length;return Promise.prototype.then.call(this,a,b);};return p.finally(7).then(v=>info+":"+v);}', 3, 'true:true:2:3', 'true:true:2:4'),
  c('finally-non-object-receiver-TypeError', 'function f(x){try{Promise.prototype.finally.call(x,()=>{});return new Promise(r=>r("no"));}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+x));}}', 3, 'true:3', 'true:4'),
  c('finally-generic-thenable-receiver', 'function f(x){const o={then(a,b){return typeof a+":"+typeof b+":"+a.length;}};return new Promise(r=>r(Promise.prototype.finally.call(o,()=>{})+":"+x));}', 3, 'function:function:1:3', 'function:function:1:4'),
  c('order-finally-tick-count', 'function f(x){const log=[];const p=new Promise(r=>r(x));p.finally(()=>log.push("f")).then(()=>log.push("f-after"));p.then(()=>log.push("b1")).then(()=>log.push("b2")).then(()=>log.push("b3")).then(()=>log.push("b4")).then(()=>log.push("b5"));return p.then(()=>0).then(()=>0).then(()=>0).then(()=>0).then(()=>0).then(()=>log.join(","));}', 3, 'f,b1,b2,b3,f-after,b4,b5', 'f,b1,b2,b3,f-after,b4,b5', 'fulfilled', {"nativeExpected":["f,b1,f-after,b2,b3,b4,b5","f,b1,f-after,b2,b3,b4,b5"],"nativeReferenceDifference":"Observed Safari finally fast path schedules continuation early; GPU must preserve ES2025 finally PromiseResolve and then reaction jobs.","spec":"https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-promise.prototype.finally","nativeEvidence":"quickjs-safari-promise-species-pristine-native.json"}),
  // chaining cycle
  c('chaining-cycle-TypeError', 'function f(x){const p=new Promise(r=>r(x));const q=p.then(()=>q);return q.then(null,e=>(e instanceof TypeError)+":"+x);}', 3, 'true:3', 'true:4'),
  c('chaining-cycle-final-rejected', 'function f(x){const p=new Promise(r=>r(x));const q=p.then(()=>q);return q.catch(e=>{throw e.constructor===TypeError?"TE"+x:"other";});}', 3, 'TE3', 'TE4', 'rejected'),
  // brand check (synchronous TypeError)
  c('then-non-promise-receiver-TypeError', 'function f(x){try{Promise.prototype.then.call({then(){}},()=>{});return new Promise(r=>r("no"));}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+x));}}', 3, 'true:3', 'true:4'),
  c('then-primitive-receiver-TypeError', 'function f(x){let n=0;try{Promise.prototype.then.call(x,()=>{n++;});}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+n+":"+x));}return new Promise(r=>r("no"));}', 3, 'true:0:3', 'true:0:4'),
  // SpeciesConstructor
  c('constructor-getter-observed-once', 'function f(x){const p=new Promise(r=>r(x));let n=0;Object.defineProperty(p,"constructor",{get(){n++;return Promise;}});const q=p.then(v=>v);return q.then(v=>v+":"+n);}', 3, '3:1', '4:1'),
  c('finally-constructor-reads', 'function f(x){const p=new Promise(r=>r(x));let n=0;Object.defineProperty(p,"constructor",{get(){n++;return Promise;}});return p.finally(()=>{}).then(v=>v+":"+n);}', 3, '3:2', '4:2'),
  c('constructor-undefined-default', 'function f(x){const p=new Promise(r=>r(x));p.constructor=undefined;const q=p.then(v=>v);return q.then(v=>(q instanceof Promise)+":"+v);}', 3, 'true:3', 'true:4'),
  c('constructor-non-object-TypeError', 'function f(x){const p=new Promise(r=>r(x));p.constructor=x;let n=0;try{p.then(()=>{n++;});}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+n));}return new Promise(r=>r("no"));}', 3, 'true:0', 'true:0'),
  c('constructor-null-TypeError', 'function f(x){const p=new Promise(r=>r(x));p.constructor=null;try{p.finally(()=>{});}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+x));}return new Promise(r=>r("no"));}', 3, 'true:3', 'true:4'),
  c('constructor-function-without-species-default', 'function f(x){const p=new Promise(r=>r(x));p.constructor=function C(){throw "never";};const q=p.then(v=>v+1);return q.then(v=>(Object.getPrototypeOf(q)===Promise.prototype)+":"+v);}', 3, 'true:4', 'true:5'),
  c('species-null-default', 'function f(x){const sp=Object.getOwnPropertySymbols(Promise)[0];const p=new Promise(r=>r(x));const C={};C[sp]=null;p.constructor=C;const q=p.then(v=>v);return q.then(v=>(q instanceof Promise)+":"+v);}', 3, 'true:3', 'true:4', 'fulfilled', { requires: SPECIES }),
  c('species-getter-observed', 'function f(x){const sp=Object.getOwnPropertySymbols(Promise)[0];const p=new Promise(r=>r(x));let n=0;const C={};Object.defineProperty(C,sp,{get(){n++;return undefined;}});p.constructor=C;return p.then(v=>v).then(v=>v+":"+n);}', 3, '3:1', '4:1', 'fulfilled', { requires: SPECIES }),
  c('species-custom-constructor', 'function f(x){const sp=Object.getOwnPropertySymbols(Promise)[0];const p=new Promise(r=>r(x));let got="none";function C(executor){executor(v=>{got="res"+v;},e=>{got="rej"+e;});}const K={};K[sp]=C;p.constructor=K;const q=p.then(v=>v+1);return new Promise(r=>r(0)).then(()=>0).then(()=>(q instanceof C)+":"+got);}', 3, 'true:res4', 'true:res5', 'fulfilled', { requires: SPECIES }),
  c('species-custom-constructor-reject-path', 'function f(x){const sp=Object.getOwnPropertySymbols(Promise)[0];const p=new Promise(r=>r(x));let got="none";function C(executor){executor(v=>{got="res"+v;},e=>{got="rej"+e;});}const K={};K[sp]=C;p.constructor=K;p.then(v=>{throw v*2;});return new Promise(r=>r(0)).then(()=>0).then(()=>got);}', 3, 'rej6', 'rej8', 'fulfilled', { requires: SPECIES }),
  c('species-non-constructor-TypeError', 'function f(x){const sp=Object.getOwnPropertySymbols(Promise)[0];const p=new Promise(r=>r(x));const K={};K[sp]=()=>{};p.constructor=K;try{p.then();}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+x));}return new Promise(r=>r("no"));}', 3, 'true:3', 'true:4', 'fulfilled', { requires: SPECIES }),
  c('finally-species-TypeError-before-then', 'function f(x){const sp=Object.getOwnPropertySymbols(Promise)[0];const p=new Promise(r=>r(x));let calls=0;p.then=function(){calls++;};const K={};K[sp]=5;p.constructor=K;try{p.finally(()=>{});}catch(e){return new Promise(r=>r((e instanceof TypeError)+":"+calls+":"+x));}return new Promise(r=>r("no"));}', 3, 'true:0:3', 'true:0:4', 'fulfilled', { requires: SPECIES }),
  c('finally-species-used-for-PromiseResolve', 'function f(x){const sp=Object.getOwnPropertySymbols(Promise)[0];const p=new Promise(r=>r(x));let made=0;function C(executor){made++;return new Promise(executor);}const K={};K[sp]=C;p.constructor=K;p.finally(()=>1);return new Promise(r=>r(0)).then(()=>0).then(()=>0).then(()=>made+":"+x);}', 3, '2:3', '2:4', 'fulfilled', { requires: SPECIES }),
  // pending forever, late handling
  c('pending-forever', 'function f(x){return new Promise(()=>{}).then(v=>v+x);}', 3, undefined, undefined, 'pending'),
  c('late-catch-on-rejected', 'function f(x){const p=new Promise((_,j)=>j(x));return new Promise(r=>r()).then(()=>p.catch(e=>e*2));}', 3, 6, 8),
  c('gc-bounded-pending-chain', 'function f(x){let res;const root=new Promise(r=>{res=r;});let p=root;for(let i=0;i<8;i++)p=p.then(v=>v+1);for(let round=0;round<20;round++){let junk=null;for(let i=0;i<40;i++)junk={i:i,next:junk};}res(x);return p;}',3,11,12,'fulfilled',{requiresGC:true}),
  c('gc-bounded-allocation-inside-handlers','function f(x){let p=Promise.resolve(x);for(let i=0;i<4;i++)p=p.then(v=>{for(let round=0;round<10;round++){let junk=null;for(let j=0;j<40;j++)junk={j:j,next:junk};}return v+1;});return p;}',3,7,8,'fulfilled',{requiresGC:true}),
  // GC pressure: long chains retain reactions/capabilities across allocation
  c('gc-deep-pending-chain', 'function f(x){let res;const root=new Promise(r=>{res=r;});let p=root;for(let i=0;i<40;i++)p=p.then(v=>v+1);let junk=null;for(let i=0;i<700;i++)junk={i:i,next:junk};junk=null;for(let i=0;i<700;i++)junk=[i,{i:i}];res(x);return p;}', 3, 43, 44, 'fulfilled', {gpuOutcome:'resource',resourceReason:'700 simultaneously reachable two-property objects require at least2100 heap nodes; lane capacity2048'}),
  c('gc-allocation-inside-handlers', 'function f(x){let p=new Promise(r=>r(x));for(let i=0;i<12;i++){p=p.then(v=>{let junk=null;for(let j=0;j<700;j++)junk={j:j,next:junk};return v+1;});}return p.finally(()=>{let junk=[];for(let j=0;j<700;j++)junk=[j];});}', 3, 15, 16, 'fulfilled', {gpuOutcome:'resource',resourceReason:'handler retains700 two-property linked objects: at least2100 heap nodes before Promise overhead'}),
]);
