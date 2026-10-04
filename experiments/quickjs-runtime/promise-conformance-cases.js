// Worker 8 (Promise + async wave): independent conformance fixtures.
// Written independently of workers 1..7. Every fixture is `function f(x){...}`;
// f returns a Promise (settlement 'fulfilled'|'rejected'|'pending') or, for
// synchronous-only cases, a primitive (settlement undefined).
//   expected / expectedNext : value (fulfilled), reason (rejected) or undefined
//                             (pending) for input / input+1. Values must be
//                             primitives the GPU boundary can decode (no
//                             objects, no Symbols).
//   gc:true         the GPU run must report collections[i] > 0 for every lane:
//                   the fixture allocates garbage while the retained value is
//                   reachable ONLY through promise/job/async machinery.
//   resumption:true browser suite re-runs input with job.step(1) single
//                   instruction dispatches.
//   resource        'heap'|'frames'|'stack': native (unbounded) engine yields
//                   `expected`; the GPU (LIMITS frames 32, stack 256,
//                   heap 2048 nodes, program.js) MUST stop with status 3
//                   (runtime.js message "Resource limit ... no CPU fallback").
//                   expectedStatus is fixed to 3 for those fixtures.
//   dependsOn       named dependency the wave may leave as a status-6 boundary
//                   (worker 1 lists Promise subclassing as one); the browser
//                   reports such a rejection as a gap, never as a pass.
//   promiseOnly     true when the fixture uses no async function/generator
//                   syntax (browser `?coreOnly=1` narrows to these).
// Microtask tick canon (ES2025; exact observed native differences are metadata): the TICK prefix
// builds a 6-link `then` chain that logs 1..6, one per job turn, before the
// event under test is scheduled; the logged interleaving is the tick count.
//   await <native promise>          : 1 tick  (PromiseResolve fast path)
//   await <non-promise>             : 1 tick
//   await <thenable>                : 2 ticks (ResolveThenableJob + reaction)
//   async return <native promise>   : 3 ticks to the caller's `then`
//   resolve(<native promise>)       : 3 ticks to the caller's `then`
const TICK = 'const log=[];let chain=Promise.resolve();for(let i=1;i<=6;i++)chain=chain.then(()=>{log.push(i);});';
const DONE = "return chain.then(()=>x+':'+log.join(''));";
const GARBAGE = "for(let i=0;i<700;i++){const waste={a:[i],s:'w'+i};}";
const make = category => (feature, body, expected, expectedNext, settlement, extra = {}) => Object.freeze({
  category, feature, source: `function f(x){${body}}`, input: 3, expected, expectedNext, settlement,
  promiseOnly: !/\basync\b|\bawait\b/.test(body), ...extra,
});
const order = make('order'), reent = make('reentrancy'), gc = make('gc'), res = make('resource'),
  pend = make('pending'), rej = make('rejection'), unh = make('unhandled'), t262 = make('test262-style');

export const promiseConformanceCases = Object.freeze([
  // ---- Microtask ordering canon -------------------------------------------------
  order('order-then-on-fulfilled-one-tick', `${TICK}Promise.resolve(x).then(()=>log.push('a'));${DONE}`, '3:1a23456', '4:1a23456', 'fulfilled'),
  order('order-await-native-promise-one-tick', `${TICK}async function a(){await Promise.resolve(x);log.push('a');}a();${DONE}`, '3:1a23456', '4:1a23456', 'fulfilled', { resumption: true }),
  order('order-await-non-promise-one-tick', `${TICK}async function a(){await x;log.push('a');}a();${DONE}`, '3:1a23456', '4:1a23456', 'fulfilled'),
  order('order-await-thenable-two-ticks', `${TICK}async function a(){await {then(r){log.push('T');r(x);}};log.push('a');}a();${DONE}`, '3:1T2a3456', '4:1T2a3456', 'fulfilled'),
  order('order-async-return-value-one-tick', `${TICK}async function a(){return x;}a().then(()=>log.push('a'));${DONE}`, '3:1a23456', '4:1a23456', 'fulfilled'),
  order('order-async-return-promise-three-ticks', `${TICK}async function a(){return Promise.resolve(x);}a().then(()=>log.push('a'));${DONE}`, '3:123a456', '4:123a456', 'fulfilled'),
  order('order-resolve-with-native-promise-three-ticks', `${TICK}new Promise(r=>r(Promise.resolve(x))).then(()=>log.push('a'));${DONE}`, '3:123a456', '4:123a456', 'fulfilled'),
  order('order-promise-resolve-identity-no-extra-tick', `${TICK}const p=Promise.resolve(x),q=Promise.resolve(p);q.then(()=>log.push(p===q?'a':'b'));${DONE}`, '3:1a23456', '4:1a23456', 'fulfilled'),
  order('order-executor-runs-synchronously', `const log=[];const p=new Promise(r=>{log.push('e');r(x);});log.push('s');return p.then(v=>{log.push('t'+v);return log.join('');});`, 'est3', 'est4', 'fulfilled'),
  order('order-two-chains-interleave', `const log=[];const a=Promise.resolve(),b=Promise.resolve();a.then(()=>log.push('a1')).then(()=>log.push('a2')).then(()=>log.push('a3'));b.then(()=>log.push('b1')).then(()=>log.push('b2')).then(()=>log.push('b3'));${TICK.replace('const log=[];', '')}return chain.then(()=>x+':'+log.join(''));`, '3:a1b11a2b22a3b33456', '4:a1b11a2b22a3b33456', 'fulfilled'),
  order('order-async-throw-before-await-is-sync-start', `${TICK}async function a(){log.push('s');throw x;}a().catch(()=>log.push('c'));${DONE}`, '3:s1c23456', '4:s1c23456', 'fulfilled'),
  order('order-await-rejected-native-one-tick', `${TICK}async function a(){try{await Promise.reject(x);}catch(e){log.push('c');}}a();${DONE}`, '3:1c23456', '4:1c23456', 'fulfilled'),
  order('order-await-async-call-chain', `${TICK}async function b(){await null;log.push('b');}async function a(){await b();log.push('a');}a();${DONE}`, '3:1b2a3456', '4:1b2a3456', 'fulfilled'),
  order('order-resolve-thenable-getter-is-synchronous', `${TICK}const t={get then(){log.push('g');return r=>{log.push('T');r(x);};}};Promise.resolve(t).then(()=>log.push('a'));${DONE}`, '3:g1T2a3456', '4:g1T2a3456', 'fulfilled'),
  order('order-finally-tick-count', `${TICK}Promise.resolve(x).finally(()=>log.push('f')).then(()=>log.push('a'));${DONE}`, '3:1f234a56', '4:1f234a56', 'fulfilled', {"nativeExpected":["3:1f2a3456","4:1f2a3456"],"nativeReferenceDifference":"Observed Safari finally fast path omits required PromiseResolve/then reaction jobs; GPU must preserve ES2025 finally job ordering.","spec":"https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-promise.prototype.finally","nativeEvidence":"quickjs-safari-promise-species-pristine-native.json"}),
  order('order-promise-all-tick-count', `${TICK}Promise.all([Promise.resolve(1),2]).then(()=>log.push('a'));${DONE}`, '3:12a3456', '4:12a3456', 'fulfilled'),
  order('order-promise-race-tick-count', `${TICK}Promise.race([new Promise(()=>{}),Promise.resolve(x)]).then(()=>log.push('a'));${DONE}`, '3:12a3456', '4:12a3456', 'fulfilled'),
  order('order-then-inside-then-goes-to-back', `const log=[];const p=Promise.resolve();p.then(()=>{log.push('a');p.then(()=>log.push('c'));});p.then(()=>log.push('b'));return Promise.resolve().then(()=>0).then(()=>x+':'+log.join(''));`, '3:abc', '4:abc', 'fulfilled'),
  order('order-handler-return-promise-adds-two-ticks', `${TICK}Promise.resolve().then(()=>Promise.resolve(x)).then(()=>log.push('a'));${DONE}`, '3:1234a56', '4:1234a56', 'fulfilled'),
  order('order-await-chain-of-awaits', `${TICK}async function a(){await 0;log.push('a');await 0;log.push('b');await 0;log.push('c');}a();${DONE}`, '3:1a2b3c456', '4:1a2b3c456', 'fulfilled'),

  // ---- Reentrancy ----------------------------------------------------------------
  reent('reent-resolve-inside-then-handler', `const log=[];let res;const p=new Promise(r=>{res=r;});const d=p.then(v=>{log.push('p'+v);return log.join('');});Promise.resolve().then(()=>{res(x);log.push('r');});return d;`, 'rp3', 'rp4', 'fulfilled'),
  reent('reent-sync-resolve-then-later-registration', `const p=new Promise(r=>r(x));let n=0;for(let i=0;i<3;i++)p.then(v=>{n+=v;});return p.then(v=>n+':'+v);`, '9:3', '12:4', 'fulfilled'),
  reent('reent-resolve-functions-once-only', `return new Promise((res,rej)=>{res(x);res(x+10);rej(x+20);throw x+30;});`, 3, 4, 'fulfilled'),
  reent('reent-resolve-with-thenable-locks-then-reject-ignored', `let late;const t={then(r){late=r;}};const p=new Promise((res,rej)=>{res(t);rej(99);});return Promise.resolve().then(()=>late(x)).then(()=>p);`, 3, 4, 'fulfilled'),
  reent('reent-settle-during-reaction-list', `const log=[];let res;const p=new Promise(r=>{res=r;});p.then(()=>{log.push('a');p.then(()=>log.push('d'));});p.then(()=>log.push('b'));p.then(()=>log.push('c'));res(x);return Promise.resolve().then(()=>0).then(()=>0).then(()=>x+':'+log.join(''));`, '3:abcd', '4:abcd', 'fulfilled'),
  reent('reent-thenable-calls-resolve-then-reject-then-throws', `return Promise.resolve({then(r,j){r(x);j(1);r(2);throw 3;}});`, 3, 4, 'fulfilled'),
  reent('reent-self-resolution-typeerror', `let res;const p=new Promise(r=>{res=r;});res(p);return p.then(()=>'no',e=>(e instanceof TypeError)+':'+x);`, 'true:3', 'true:4', 'fulfilled'),
  reent('reent-handler-returns-own-derived-promise', `const p=Promise.resolve(x);const q=p.then(()=>q);return q.then(()=>'no',e=>e instanceof TypeError?'cycle'+x:'other');`, 'cycle3', 'cycle4', 'fulfilled'),
  reent('reent-async-function-recursion', `async function r(n){if(n===0)return x;await null;return 1+await r(n-1);}return r(5);`, 8, 9, 'fulfilled', { resumption: true }),
  reent('reent-generator-driven-by-async', `function* g(){const v=yield Promise.resolve(x);const w=yield Promise.resolve(v+1);return w*2;}async function run(){const it=g();let r=it.next();while(!r.done){r=it.next(await r.value);}return r.value;}return run();`, 8, 10, 'fulfilled', { resumption: true }),
  reent('reent-async-generator-queued-requests', `async function* g(){yield x;yield x+1;}const it=g();const a=it.next(),b=it.next(),c=it.next(),d=it.next();return Promise.all([a,b,c,d]).then(r=>r.map(o=>o.value+'/'+o.done).join(','));`, '3/false,4/false,undefined/true,undefined/true', '4/false,5/false,undefined/true,undefined/true', 'fulfilled', { resumption: true }),
  // The request queued from inside the running body is served only after the
  // generator suspends again; awaiting it from the body therefore deadlocks
  // (the log never gains a third entry) while the first request still resolves.
  reent('reent-async-generator-self-request-deadlocks',`let it;const log=[];async function* g(){const p=it.next();log.push('in');yield x;log.push((await p).value);}it=g();return it.next().then(r=>{log.push(r.value);return Promise.resolve().then(()=>0).then(()=>0).then(()=>0).then(()=>log.join(','));});`, 'in,3', 'in,4', 'fulfilled'),
  reent('reent-resolve-from-another-chain', `let res;const gate=new Promise(r=>{res=r;});async function waiter(){return (await gate)+1;}const w=waiter();Promise.resolve(x).then(v=>res(v*2));return w;`, 7, 9, 'fulfilled'),
  reent('reent-handler-throws-rejects-derived', `return Promise.resolve(x).then(v=>{throw v+1;}).then(()=>'no',e=>'caught'+e);`, 'caught4', 'caught5', 'fulfilled'),

  // ---- GC roots (collections > 0 required on the GPU) ------------------------------
  gc('gc-pending-reaction-only-root', `let res;const p=new Promise(r=>{res=r;});let d;{const keep={s:'keep'+x};d=p.then(v=>keep.s+v);}${GARBAGE}res(x);return d;`, 'keep33', 'keep44', 'fulfilled', { gc: true }),
  gc('gc-suspended-async-only-reachable-from-reaction', `let res;const p=new Promise(r=>{res=r;});async function a(){const keep={s:'keep'+x};const v=await p;return keep.s+v;}const r=a();${GARBAGE}res('!');return r;`, 'keep3!', 'keep4!', 'fulfilled', { gc: true, resumption: true }),
  gc('gc-job-queue-only-root', `let out='none';{const keep={s:'job'+x};Promise.resolve().then(()=>{out=keep.s;});}${GARBAGE}return Promise.resolve().then(()=>out);`, 'job3', 'job4', 'fulfilled', { gc: true }),
  gc('gc-settled-value-only-in-header', `const p=Promise.resolve({s:'value'+x});${GARBAGE}return p.then(o=>o.s);`, 'value3', 'value4', 'fulfilled', { gc: true }),
  gc('gc-rejection-reason-retained', `const p=Promise.reject({s:'reason'+x});p.catch(()=>{});${GARBAGE}return p.then(()=>'no',e=>e.s);`, 'reason3', 'reason4', 'fulfilled', { gc: true }),
  gc('gc-thenable-job-payload-only-root', `const p=new Promise(r=>r({s:'then'+x,then(ok){ok(this.s);}}));${GARBAGE}return p;`, 'then3', 'then4', 'fulfilled', { gc: true }),
  gc('gc-collect-inside-job-with-queued-jobs', `let out='';{const k={s:'q'+x};Promise.resolve().then(()=>{${GARBAGE}});Promise.resolve().then(()=>{out=k.s;});}return Promise.resolve().then(()=>0).then(()=>out);`, 'q3', 'q4', 'fulfilled', { gc: true }),
  gc('gc-promise-all-values-retained', `let res;const gate=new Promise(r=>{res=r;});const all=Promise.all([Promise.resolve({s:'a'+x}),gate]);${GARBAGE}res({s:'b'});return all.then(v=>v[0].s+v[1].s);`, 'a3b', 'a4b', 'fulfilled', { gc: true }),
  gc('gc-async-generator-suspended-with-request', `async function* g(){const keep={s:'gen'+x};yield 1;yield keep.s;}const it=g();return it.next().then(()=>{const n=it.next();${GARBAGE}return n;}).then(r=>r.value);`, 'gen3', 'gen4', 'fulfilled', { gc: true }),

  // ---- Resource limits (GPU status 3 required; native value recorded) ---------------
  res('resource-heap-10000-deep-promise-chain', `let p=Promise.resolve(x);for(let i=0;i<10000;i++)p=p.then(v=>v+1);return p;`, 10003, 10004, 'fulfilled', { resource: 'heap', expectedStatus: 3 }),
  res('resource-heap-3000-pending-promises', `const a=[];for(let i=0;i<3000;i++)a.push(new Promise(()=>{}));return a.length+x;`, 3003, 3004, undefined, { resource: 'heap', expectedStatus: 3 }),
  res('resource-frames-sync-async-recursion-40', `async function r(n){return n===0?x:1+await r(n-1);}return r(40);`, 43, 44, 'fulfilled', { resource: 'frames', expectedStatus: 3 }),
  res('resource-stack-pending-operands-across-async-calls', `async function r(n){if(n===0)return await x;return n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+(n+await r(n-1))))))))))))))))))))))))));}return r(12);`, 2031, 2032, 'fulfilled', { resource: 'stack', expectedStatus: 3 }),

  // ---- Never-settling ---------------------------------------------------------------
  pend('pending-executor-never-settles', `return new Promise(()=>{x++;});`, undefined, undefined, 'pending'),
  pend('pending-await-never-settling', `async function a(){await new Promise(()=>{});return x;}return a();`, undefined, undefined, 'pending'),
  pend('pending-thenable-never-calls-back', `return Promise.resolve({then(){}});`, undefined, undefined, 'pending'),
  pend('pending-race-empty', `return Promise.race([]);`, undefined, undefined, 'pending'),
  pend('pending-async-generator-awaiting-forever', `async function* g(){await new Promise(()=>{});yield x;}return g().next();`, undefined, undefined, 'pending'),

  // ---- Rejection reasons (top-level rejection = status 13) -------------------------
  rej('reject-number', `return Promise.reject(x);`, 3, 4, 'rejected'),
  rej('reject-string', `return Promise.reject('r'+x);`, 'r3', 'r4', 'rejected'),
  rej('reject-undefined', `return Promise.reject(void x);`, undefined, undefined, 'rejected'),
  rej('reject-null', `return Promise.reject(x>0?null:0);`, null, null, 'rejected'),
  rej('reject-boolean', `return Promise.reject(x===3);`, true, false, 'rejected'),
  rej('reject-bigint', `return Promise.reject(BigInt(x)*9007199254740993n);`, 27021597764222979n, 36028797018963972n, 'rejected'),
  rej('reject-negative-zero', `return Promise.reject(-0*x);`, -0, -0, 'rejected'),
  rej('reject-nan', `return Promise.reject(x/0-x/0);`, NaN, NaN, 'rejected'),
  rej('reject-async-throw', `async function a(){await null;throw x*2;}return a();`, 6, 8, 'rejected'),
  rej('reject-error-object-caught-and-described', `return Promise.reject(new RangeError('m'+x)).catch(e=>e.name+':'+e.message+':'+(e instanceof RangeError));`, 'RangeError:m3:true', 'RangeError:m4:true', 'fulfilled'),
  rej('reject-symbol-caught-and-described', `return Promise.reject(Symbol('s'+x)).catch(e=>typeof e+':'+e.description);`, 'symbol:s3', 'symbol:s4', 'fulfilled'),
  rej('reject-object-identity-preserved', `const o={x};return Promise.reject(o).catch(e=>(e===o)+':'+e.x);`, 'true:3', 'true:4', 'fulfilled'),
  rej('reject-function-reason', `const fn=()=>x;return Promise.reject(fn).catch(e=>typeof e+':'+e());`, 'function:3', 'function:4', 'fulfilled'),
  rej('reject-typeerror-from-guest-runtime', `return Promise.resolve().then(()=>null.p).catch(e=>(e instanceof TypeError)+':'+x);`, 'true:3', 'true:4', 'fulfilled'),

  // ---- Unhandled rejections (no host error, never surfaced) ------------------------
  unh('unhandled-side-rejection-result-fulfilled', `Promise.reject(x);new Promise((_,j)=>j(x));return Promise.resolve(x+1);`, 4, 5, 'fulfilled'),
  unh('unhandled-async-function-not-awaited', `async function a(){throw x;}a();return x*2;`, 6, 8, undefined),
  unh('unhandled-later-handled', `const p=Promise.reject(x);return Promise.resolve().then(()=>0).then(()=>p.catch(e=>e+1));`, 4, 5, 'fulfilled'),
  unh('unhandled-top-level-rejected-async', `async function a(){throw 'top'+x;}return a();`, 'top3', 'top4', 'rejected'),

  // ---- test262-style: Promise constructor --------------------------------------------
  t262('t262-promise-ctor-length-name', `return Promise.length+':'+Promise.name+':'+x;`, '1:Promise:3', '1:Promise:4', undefined),
  t262('t262-promise-ctor-requires-new', `try{Promise(()=>{});}catch(e){return (e instanceof TypeError)+':'+x;}return 'no';`, 'true:3', 'true:4', undefined),
  t262('t262-promise-ctor-non-callable-executor', `try{new Promise(x);}catch(e){return (e instanceof TypeError)+':'+x;}return 'no';`, 'true:3', 'true:4', undefined),
  t262('t262-promise-ctor-executor-throw-rejects', `return new Promise(()=>{throw x;});`, 3, 4, 'rejected'),
  t262('t262-resolving-functions-shape', `let a,b;new Promise((r,j)=>{a=r;b=j;});return a.length+':'+b.length+':'+JSON.stringify(a.name)+':'+('prototype' in a)+':'+x;`, '1:1:"":false:3', '1:1:"":false:4', undefined),
  t262('t262-promise-prototype-tostringtag', `const p=Promise.resolve();return Object.prototype.toString.call(p)+':'+Promise.prototype[Symbol.toStringTag]+':'+(Object.getPrototypeOf(p)===Promise.prototype)+':'+x;`, '[object Promise]:Promise:true:3', '[object Promise]:Promise:true:4', undefined),
  // then / catch / finally
  t262('t262-then-length-and-passthrough', `return Promise.resolve(x).then(1,2).then(undefined,null).then(v=>Promise.prototype.then.length+':'+v);`, '2:3', '2:4', 'fulfilled'),
  t262('t262-then-rejection-passthrough', `return Promise.reject(x).then(v=>'no').then(null,e=>'r'+e);`, 'r3', 'r4', 'fulfilled'),
  t262('t262-then-non-promise-receiver-throws', `try{Promise.prototype.then.call({},()=>{});}catch(e){return (e instanceof TypeError)+':'+x;}return 'no';`, 'true:3', 'true:4', undefined),
  t262('t262-catch-invokes-this-then', `const log=[];const o={then(a,b){log.push(typeof a+'/'+typeof b);return x;}};return Promise.prototype.catch.call(o,()=>{})+':'+log.join('');`, '3:undefined/function', '4:undefined/function', undefined),
  t262('t262-finally-preserves-value-and-reason', `return Promise.resolve(x).finally(()=>99).then(v=>Promise.reject(v+1).finally(()=>99)).catch(e=>'fin'+e);`, 'fin4', 'fin5', 'fulfilled'),
  t262('t262-finally-throw-overrides', `return Promise.resolve(1).finally(()=>{throw x;}).catch(e=>'o'+e);`, 'o3', 'o4', 'fulfilled'),
  t262('t262-then-species-constructor-used', `class P extends Promise{}const p=P.resolve(x);const q=p.then(v=>v);return q.then(v=>(q instanceof P)+':'+(p instanceof P)+':'+v);`, 'true:true:3', 'true:true:4', 'fulfilled', { dependsOn: 'promise-subclassing' }),
  // statics
  t262('t262-promise-resolve-reject-statics', `return Promise.reject(x).catch(e=>Promise.resolve(e+1)).then(v=>v+':'+Promise.resolve.length+':'+Promise.reject.length);`, '4:1:1', '5:1:1', 'fulfilled'),
  t262('t262-all-empty-and-order', `return Promise.all([]).then(e=>Promise.all([new Promise(r=>Promise.resolve().then(()=>r('b'))),'a'+x,Promise.resolve('c')]).then(v=>e.length+':'+v.join(',')));`, '0:b,a3,c', '0:b,a4,c', 'fulfilled'),
  t262('t262-all-rejects-with-first', `return Promise.all([new Promise(()=>{}),Promise.reject(x),Promise.reject(99)]);`, 3, 4, 'rejected'),
  t262('t262-allsettled-shape', `return Promise.allSettled([Promise.resolve(x),Promise.reject(x+1)]).then(r=>r.map(o=>o.status+'='+('value' in o?o.value:o.reason)).join(','));`, 'fulfilled=3,rejected=4', 'fulfilled=4,rejected=5', 'fulfilled'),
  t262('t262-any-first-fulfilled', `return Promise.any([Promise.reject(1),new Promise(r=>Promise.resolve().then(()=>r(x))),Promise.reject(2)]);`, 3, 4, 'fulfilled'),
  t262('t262-any-all-rejected-aggregateerror', `return Promise.any([Promise.reject(x),Promise.reject(x+1)]).catch(e=>(e instanceof AggregateError)+':'+e.errors.join(','));`, 'true:3,4', 'true:4,5', 'fulfilled'),
  t262('t262-any-empty-aggregateerror', `return Promise.any([]).catch(e=>e.constructor.name+':'+e.errors.length+':'+x);`, 'AggregateError:0:3', 'AggregateError:0:4', 'fulfilled'),
  t262('t262-race-first-settled-rejection', `return Promise.race([new Promise(r=>Promise.resolve().then(()=>r(1))),Promise.reject(x)]);`, 3, 4, 'rejected'),
  t262('t262-with-resolvers', `const {promise,resolve,reject}=Promise.withResolvers();resolve(x);reject(1);return promise.then(v=>typeof resolve+':'+v);`, 'function:3', 'function:4', 'fulfilled'),
  t262('t262-all-iterable-non-iterable-rejects', `return Promise.all(x).catch(e=>e instanceof TypeError);`, true, true, 'fulfilled'),
  t262('t262-all-non-constructor-receiver-throws', `try{Promise.all.call(undefined,[]);}catch(e){return (e instanceof TypeError)+':'+x;}return 'no';`, 'true:3', 'true:4', undefined),
  // async functions
  t262('t262-async-function-shape', `async function a(p,q){}const P=Object.getPrototypeOf(a);return a.length+':'+('prototype' in a)+':'+(P!==Function.prototype)+':'+P[Symbol.toStringTag]+':'+(Object.getPrototypeOf(P)===Function.prototype)+':'+x;`, '2:false:true:AsyncFunction:true:3', '2:false:true:AsyncFunction:true:4', undefined),
  t262('t262-async-function-not-constructible', `async function a(){}try{new a();}catch(e){return (e instanceof TypeError)+':'+x;}return 'no';`, 'true:3', 'true:4', undefined),
  t262('t262-async-returns-new-promise-each-call', `async function a(){return x;}const p=a(),q=a();return (p instanceof Promise)+':'+(p!==q);`, 'true:true', 'true:true', undefined),
  t262('t262-async-default-param-throw-rejects', `async function a(b=(()=>{throw x;})()){return 'no';}let sync='none';let p;try{p=a();}catch(e){sync='threw';}return p.catch(e=>sync+':'+e);`, 'none:3', 'none:4', 'fulfilled'),
  t262('t262-async-arrow-lexical-this-arguments', `function outer(){return (async()=>this.v+arguments[0])();}return outer.call({v:x},10);`, 13, 14, 'fulfilled'),
  t262('t262-async-method-and-super', `class B{v(){return x;}}class A extends B{async m(){await null;return super.v()+1;}}return new A().m();`, 4, 5, 'fulfilled'),
  t262('t262-await-in-finally-preserves-completion', `async function a(){try{return x;}finally{await null;}}return a();`, 3, 4, 'fulfilled'),
  t262('t262-await-try-catch-finally-order', `const log=[];async function a(){try{await Promise.reject(x);}catch(e){log.push('c'+e);await null;}finally{log.push('f');}return log.join(',');}return a();`, 'c3,f', 'c4,f', 'fulfilled'),
  t262('t262-async-arguments-mapped', `async function a(p){p++;await null;return arguments[0];}return a(x);`, 4, 5, 'fulfilled'),
  // async generators
  t262('t262-async-generator-shape', `async function* g(){}const it=g();return Object.prototype.toString.call(it)+':'+typeof it[Symbol.asyncIterator]+':'+(it[Symbol.asyncIterator]()===it)+':'+x;`, '[object AsyncGenerator]:function:true:3', '[object AsyncGenerator]:function:true:4', undefined),
  t262('t262-async-generator-yield-awaits-value', `async function* g(){yield Promise.resolve(x);}return g().next().then(r=>r.value+':'+r.done);`, '3:false', '4:false', 'fulfilled'),
  t262('t262-async-generator-return-suspended-start', `async function* g(){yield 1;}const it=g();return it.return(Promise.resolve(x)).then(r=>r.value+':'+r.done);`, '3:true', '4:true', 'fulfilled'),
  t262('t262-async-generator-throw-suspended-start', `async function* g(){yield 1;}return g().throw(x);`, 3, 4, 'rejected'),
  t262('t262-async-generator-yield-star-async', `async function* a(){yield x;yield x+1;}async function* b(){yield* a();return 'end';}return (async()=>{const out=[];const it=b();let r;while(!(r=await it.next()).done)out.push(r.value);out.push(r.value);return out.join(',');})();`, '3,4,end', '4,5,end', 'fulfilled', { resumption: true }),
  t262('t262-async-generator-next-not-object-brand', `async function* g(){}let sync='none';let p;try{p=Object.getPrototypeOf(Object.getPrototypeOf(g())).next.call({});}catch(e){sync='threw';}return p.catch(e=>sync+':'+(e instanceof TypeError)+':'+x);`, 'none:true:3', 'none:true:4', 'fulfilled'),
  // for-await
  t262('t262-for-await-over-async-generator', `async function* g(){yield x;yield x+1;}return (async()=>{let s=0;for await(const v of g())s+=v;return s;})();`, 7, 9, 'fulfilled', { resumption: true }),
  t262('t262-for-await-over-sync-iterable-of-promises', `return (async()=>{const out=[];for await(const v of [Promise.resolve(x),x+1,Promise.resolve(x+2)])out.push(v);return out.join(',');})();`, '3,4,5', '4,5,6', 'fulfilled'),
  t262('t262-for-await-break-calls-return', `let closed=0;async function* g(){try{yield x;yield 99;}finally{closed++;}}return (async()=>{let v;for await(v of g())break;return v+':'+closed;})();`, '3:1', '4:1', 'fulfilled'),
  t262('t262-for-await-sync-iterator-rejection-rejects', `return (async()=>{try{for await(const v of [Promise.reject(x)]){}}catch(e){return 'c'+e;}return 'no';})();`, 'c3', 'c4', 'fulfilled'),
  // ES2025 AsyncFromSyncIteratorContinuation(closeOnRejection): a rejected value
  // promise closes the underlying sync iterator before the loop throws.
  t262('t262-for-await-sync-rejection-closes-sync-iterator', `let closed=0;const it={[Symbol.iterator](){return this;},next(){return {value:Promise.reject(x),done:false};},return(){closed++;return {};}};return (async()=>{try{for await(const v of it){}}catch(e){return e+':'+closed;}return 'no';})();`, '3:1', '4:1', 'fulfilled'),
  t262('t262-for-await-custom-async-iterable', `const it={i:0,[Symbol.asyncIterator](){return this;},next(){return Promise.resolve({value:this.i,done:this.i++>=x});}};return (async()=>{let s='';for await(const v of it)s+=v;return s;})();`, '012', '0123', 'fulfilled'),
]);

export const promiseConformanceCategories = Object.freeze(['order', 'reentrancy', 'gc', 'resource', 'pending', 'rejection', 'unhandled', 'test262-style']);
// Documented limits (program.js LIMITS). Resource fixtures are sized to exceed
// these by a wide margin so the expected status-3 outcome does not depend on
// helper frame/node accounting details.
export const promiseConformanceLimits = Object.freeze({ frames: 32, stack: 256, heap: 2048 });
