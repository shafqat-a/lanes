// Async generator fixtures (worker 6). Each `f(x)` is a synchronous function
// that returns a Promise; the GPU run reports its settlement (status 12/13)
// after the job queue drains. `expected`/`expectedNext` are the settled
// values for x=input and x=input+1, `settlement` is 'fulfilled'|'rejected'.
// `resumption:true` marks fixtures for one-instruction (budget 1) resumption
// runs. `gc:true` fixtures must record actual collections on the GPU.
// `needs` lists opcodes/intrinsics owned by other workers beyond the promise
// core (2800/2821/2827/2830 + job draining), which every fixture needs.
const c = (feature, body, expected, expectedNext, extra = {}) =>
  ({ feature, source: `function f(x){${body}}`, input: 3, expected, expectedNext, settlement: 'fulfilled', ...extra });
const bad = 'const bad={then(_,reject){reject(x);}};';
// A thenable's `then` runs in a later job (NewPromiseResolveThenableJob), so a
// captured resolver is called from a reaction that runs after that job.
const later = call => `{async function* tick(){}tick().next().then(()=>{${call};});}`;
const churn ='for(let i=0;i<700;i++){const waste={a:[i],s:"w"+i};}';

export const asyncGeneratorCases = [
  // ---- basics / AsyncGeneratorStart
  c('next-sequence-fifo', `async function* g(){yield x;yield x+1;return x+2;}const it=g();const log=[];const add=r=>{log.push(r.value+':'+r.done);};it.next().then(add);it.next().then(add);it.next().then(add);return it.next().then(r=>{add(r);return log.join(',');});`,
    '3:false,4:false,5:true,undefined:true', '4:false,5:false,6:true,undefined:true', { resumption: true }),
  c('body-runs-synchronously-on-first-next', `let n=0;async function* g(){n++;yield x;n++;}const it=g();const a=n;const p=it.next();const b=n;return p.then(r=>a+':'+b+':'+n+':'+r.value);`,
    '0:1:1:3', '0:1:1:4'),
  c('parameter-defaults-run-at-call', `let log='';async function* g(a=(log+='p',x)){log+='b';yield a;}const it=g();const before=log;return it.next().then(r=>before+':'+log+':'+r.value);`,
    'p:pb:3', 'p:pb:4'),
  c('parameter-throw-is-synchronous', `async function* g(a=(()=>{throw x;})()){yield 1;}let caught='none';try{g();}catch(e){caught=e;}async function* h(){yield caught;}return h().next().then(r=>r.value);`,
    3, 4),
  c('iter-result-shape', `async function* g(){yield x;}return g().next().then(r=>{const d=Object.getOwnPropertyDescriptor(r,'value');return Object.keys(r).join(',')+':'+(Object.getPrototypeOf(r)===Object.prototype)+':'+d.writable+d.enumerable+d.configurable+':'+r.value;});`,
    'value,done:true:truetruetrue:3', 'value,done:true:truetruetrue:4'),
  c('await-in-body', `async function* g(){const a=await x;const b=await (x+1);yield a+b;}return g().next().then(r=>r.value);`, 7, 9, { resumption: true }),
  c('await-thenable-object', `const t={then(resolve){resolve(x*2);}};async function* g(){yield await t;}return g().next().then(r=>r.value);`, 6, 8),
  c('yield-awaits-thenable-operand', `async function* g(){yield {then(resolve){resolve(x+5);}};}return g().next().then(r=>r.value+':'+r.done);`, '8:false', '9:false'),
  c('yield-rejected-thenable-throws-into-body', `${bad}async function* g(){try{yield bad;}catch(e){yield 'caught'+e;}}return g().next().then(r=>r.value);`, 'caught3', 'caught4'),
  c('yield-rejected-uncaught-rejects-and-completes', `${bad}async function* g(){yield bad;yield 1;}const it=g();return it.next().then(()=>'wrong',e=>it.next().then(r=>e+':'+r.value+':'+r.done));`, '3:undefined:true', '4:undefined:true'),
  c('await-rejected-thenable-caught', `${bad}async function* g(){try{await bad;}catch(e){yield e+10;}}return g().next().then(r=>r.value);`, 13, 14),
  c('throw-in-body-rejects-request', `async function* g(){yield x;throw x+1;}const it=g();it.next();return it.next().then(()=>'wrong',e=>it.next().then(r=>e+':'+r.done));`, '4:true', '5:true'),
  c('body-throw-rejects-f-promise', `async function* g(){throw x;}return g().next();`, 3, 4, { settlement: 'rejected' }),
  c('return-value-awaited', `async function* g(){return {then(resolve){resolve(x+1);}};}return g().next().then(r=>r.value+':'+r.done);`, '4:true', '5:true'),
  c('return-rejected-thenable-rejects', `${bad}async function* g(){return bad;}return g().next();`, 3, 4, { settlement: 'rejected' }),
  // ---- brand checks: rejected promises, never synchronous throws
  c('brand-check-next-rejects', `async function* g(){}const next=g().next;let sync=false;let p;try{p=next.call({});}catch(e){sync=true;}return p.then(()=>'wrong',e=>(e instanceof TypeError)+':'+sync+':'+x);`, 'true:false:3', 'true:false:4'),
  c('brand-check-return-throw-sync-generator', `async function* g(){}function* s(){}const it=g();const a=it.return.call(s(),x);const b=it.throw.call(Object.create(it),x);return a.then(()=>'wrong',e=>b.then(()=>'wrong',e2=>(e instanceof TypeError)+':'+(e2 instanceof TypeError)+':'+x));`, 'true:true:3', 'true:true:4'),
  c('brand-check-primitive-receiver', `async function* g(){}const next=g().next;return next.call(x).then(()=>'wrong',e=>e instanceof TypeError);`, true, true),
  // ---- request queue
  c('next-queued-before-start', `let n=0;async function* g(){n++;yield x;yield x+1;}const it=g();const log=[];[it.next(),it.next(),it.next()].forEach((p,i)=>{p.then(r=>{log.push(i+'='+r.value+':'+r.done);});});return it.next().then(()=>log.join(',')+':'+n);`,
    '0=3:false,1=4:false,2=undefined:true:1', '0=4:false,1=5:false,2=undefined:true:1'),
  c('return-before-start-skips-body', `let n=0;async function* g(){n++;yield x;}const it=g();const a=it.return(x);return a.then(r=>it.next().then(q=>r.value+':'+r.done+':'+q.done+':'+n));`, '3:true:true:0', '4:true:true:0'),
  c('throw-before-start-rejects-and-completes', `let n=0;async function* g(){n++;yield x;}const it=g();return it.throw(x).then(()=>'wrong',e=>it.next().then(q=>e+':'+q.done+':'+n));`, '3:true:0', '4:true:0'),
  c('return-before-start-awaits-thenable', `async function* g(){yield 1;}return g().return({then(resolve){resolve(x+1);}}).then(r=>r.value+':'+r.done);`, '4:true', '5:true'),
  c('return-before-start-rejected-thenable', `${bad}async function* g(){yield 1;}const it=g();return it.return(bad).then(()=>'wrong',e=>it.next().then(q=>e+':'+q.done));`, '3:true', '4:true'),
  c('completed-next-return-throw', `async function* g(){return x;}const it=g();return it.next().then(r=>it.next().then(n=>it.return({then(resolve){resolve(x+1);}}).then(q=>it.throw(x+2).then(()=>'wrong',e=>r.value+':'+n.done+':'+q.value+':'+q.done+':'+e))));`,
    '3:true:4:true:5', '4:true:5:true:6'),
  c('mixed-queue-settles-fifo', `async function* g(){yield x;yield x+1;}const it=g();const log=[];const ok=i=>r=>{log.push(i+'='+r.value+':'+r.done);};const no=i=>e=>{log.push(i+'!'+e);};it.next().then(ok(0),no(0));it.return(x+10).then(ok(1),no(1));it.next().then(ok(2),no(2));it.throw(x).then(ok(3),no(3));return it.next().then(()=>log.join(','));`,
    '0=3:false,1=13:true,2=undefined:true,3!3', '0=4:false,1=14:true,2=undefined:true,3!4'),
  c('requests-during-await-are-queued', `let release;const gate={then(resolve){release=resolve;}};async function* g(){const v=await gate;yield v;yield v+1;}const it=g();const p1=it.next(),p2=it.next(),p3=it.next();${later('release(x)')}return p3.then(r3=>p2.then(r2=>p1.then(r1=>r1.value+':'+r2.value+':'+r3.done)));`,
    '3:4:true', '4:5:true'),
  c('reentrant-next-from-body-is-queued', `let it;let p;async function* g(){p=it.next();yield x;yield x+1;}it=g();return it.next().then(r=>p.then(q=>r.value+':'+q.value+':'+q.done));`, '3:4:false', '4:5:false'),
  c('yield-continues-without-suspending-when-queued', `const log=[];async function* g(){log.push('a');yield x;log.push('b');yield x+1;log.push('c');}const it=g();const p1=it.next();const p2=it.next();log.push('sync');return p2.then(r=>log.join('')+':'+r.value);`,
    'asyncb:4', 'asyncb:5'),
  c('next-argument-sent-to-yield', `async function* g(){const a=yield x;const b=yield a+1;return a+b;}const it=g();it.next(99);it.next(x+10);return it.next(x+20).then(r=>r.value+':'+r.done);`, '36:true', '38:true', { resumption: true }),
  // ---- return / throw while suspendedYield
  c('return-runs-finally', `let log='';async function* g(){try{yield x;}finally{log+='f';}}const it=g();return it.next().then(()=>it.return(x+1)).then(r=>r.value+':'+r.done+':'+log);`, '4:true:f', '5:true:f'),
  c('await-in-finally-during-return', `let log='';async function* g(){try{yield x;}finally{await null;log+='f';await {then(r){log+='t';r();}};}}const it=g();return it.next().then(()=>it.return(x+1)).then(r=>r.value+':'+log);`, '4:ft', '5:ft'),
  c('yield-in-finally-during-return', `async function* g(){try{yield x;}finally{yield x+1;}}const it=g();return it.next().then(()=>it.return(x+2)).then(p=>it.next(99).then(q=>p.value+':'+p.done+':'+q.value+':'+q.done));`, '4:false:5:true', '5:false:6:true'),
  c('finally-return-overrides-return', `async function* g(){try{yield x;}finally{return x+4;}}const it=g();return it.next().then(()=>it.return(x+2)).then(r=>r.value+':'+r.done);`, '7:true', '8:true'),
  c('return-thenable-awaited-in-body', `async function* g(){yield x;}const it=g();return it.next().then(()=>it.return({then(resolve){resolve(x+1);}})).then(r=>r.value+':'+r.done);`, '4:true', '5:true'),
  c('return-rejected-thenable-catchable-in-body', `${bad}async function* g(){try{yield x;}catch(e){yield 'c'+e;}}const it=g();return it.next().then(()=>it.return(bad)).then(r=>r.value+':'+r.done);`, 'c3:false', 'c4:false'),
  c('throw-caught-in-body', `async function* g(){try{yield x;}catch(e){yield e+1;}}const it=g();return it.next().then(()=>it.throw(x)).then(r=>r.value+':'+r.done);`, '4:false', '5:false'),
  c('throw-uncaught-completes', `async function* g(){yield x;yield x+1;}const it=g();return it.next().then(()=>it.throw(x+5)).then(()=>'wrong',e=>it.next().then(r=>e+':'+r.done));`, '8:true', '9:true'),
  // ---- yield* (for_await_of_start from worker 7)
  c('yield-star-async-generator', `async function* a(){yield x;return x+1;}async function* b(){const r=yield* a();yield r;}const it=b();return it.next().then(p=>it.next().then(q=>p.value+':'+q.value+':'+q.done));`, '3:4:false', '4:5:false', { needs: ['for_await_of_start'] }),
  c('yield-star-sync-iterable-async-from-sync', `async function* g(){yield* [x,{then(r){r(x+1);}}];}const it=g();return it.next().then(p=>it.next().then(q=>p.value+':'+q.value));`, '3:4', '4:5', { needs: ['for_await_of_start', 'AsyncFromSyncIterator'] }),
  c('yield-star-custom-async-iterator', `let log='';let n=0;const inner={[Symbol.asyncIterator](){return this;},next(v){n++;log+=arguments.length+':'+v+';';return {value:x,done:n>1};}};async function* g(){return yield* inner;}const it=g();return it.next(100).then(()=>it.next(x+1)).then(r=>log+r.done);`,
    '1:undefined;1:4;true', '1:undefined;1:5;true', { needs: ['for_await_of_start'] }),
  c('yield-star-return-forwarded', `let log='';const inner={[Symbol.asyncIterator](){return this;},next(){return {value:0,done:false};},return(v){log+='r'+v;return {value:v+1,done:true};}};async function* g(){yield* inner;}const it=g();return it.next().then(()=>it.return(x)).then(r=>r.value+':'+r.done+':'+log);`,
    '4:true:r3', '5:true:r4', { needs: ['for_await_of_start'] }),
  c('yield-star-throw-forwarded', `const inner={[Symbol.asyncIterator](){return this;},next(){return {value:0,done:false};},throw(v){return {value:v+1,done:true};}};async function* g(){return yield* inner;}const it=g();return it.next().then(()=>it.throw(x)).then(r=>r.value+':'+r.done);`,
    '4:true', '5:true', { needs: ['for_await_of_start'] }),
  c('yield-star-missing-throw-closes', `let log='';const inner={[Symbol.asyncIterator](){return this;},next(){return {value:0,done:false};},return(){log+='r'+arguments.length;return {};}};async function* g(){yield* inner;}const it=g();return it.next().then(()=>it.throw(x)).then(()=>'wrong',e=>(e instanceof TypeError)+':'+log);`,
    'true:r0', 'true:r0', { needs: ['for_await_of_start'] }),
  c('yield-star-inner-promise-result-awaited', `const inner={[Symbol.asyncIterator](){return this;},n:0,next(){this.n++;return this.n<2?{then(r){r({value:x,done:false});}}:{value:x+1,done:true};}};async function* g(){const r=yield* inner;yield r;}const it=g();return it.next().then(p=>it.next().then(q=>p.value+':'+q.value));`,
    '3:4', '4:5', { needs: ['for_await_of_start'] }),
  // ---- for await inside an async generator (worker 7 interop)
  c('for-await-inside-async-generator', `async function* src(){yield x;yield x+1;}async function* g(){let s=0;for await(const v of src())s+=v;yield s;}return g().next().then(r=>r.value);`, 7, 9, { needs: ['for_await_of_start'] }),
  // ---- intrinsics / prototypes
  c('prototype-chain-and-tags', `async function* g(){}const AGF=Object.getPrototypeOf(g);const AGP=AGF.prototype;const it=g();const out=[Object.getPrototypeOf(g.prototype)===AGP,Object.getPrototypeOf(it)===g.prototype,Object.getPrototypeOf(AGF)===Function.prototype,AGP.constructor===AGF,Object.prototype.toString.call(it),AGF[Symbol.toStringTag],Object.hasOwn(g.prototype,'constructor')];async function* h(){yield out.join(',')+':'+x;}return h().next().then(r=>r.value);`,
    'true,true,true,true,[object AsyncGenerator],AsyncGeneratorFunction,false:3', 'true,true,true,true,[object AsyncGenerator],AsyncGeneratorFunction,false:4'),
  c('async-iterator-prototype-link', `async function* g(){}const it=g();const AIP=Object.getPrototypeOf(Object.getPrototypeOf(g.prototype));const ok=it[Symbol.asyncIterator]()===it&&Object.getPrototypeOf(AIP)===Object.prototype;async function* h(){yield ok+':'+x;}return h().next().then(r=>r.value);`,
    'true:3', 'true:4', { needs: ['%AsyncIteratorPrototype% node 96'] }),
  c('method-metadata', `async function* g(){}const AGP=Object.getPrototypeOf(g.prototype);const d=Object.getOwnPropertyDescriptor(g,'prototype');const out=[AGP.next.name,AGP.next.length,AGP.return.name,AGP.throw.name,typeof AGP.next,d.writable,d.enumerable,d.configurable,Object.keys(g.prototype).length];async function* h(){yield out.join(',')+':'+x;}return h().next().then(r=>r.value);`,
    'next,1,return,throw,function,true,false,false,0:3', 'next,1,return,throw,function,true,false,false,0:4'),
  c('not-constructible', `async function* g(){}let ok=false;try{new g();}catch(e){ok=e instanceof TypeError;}async function* h(){yield ok+':'+x;}return h().next().then(r=>r.value);`, 'true:3', 'true:4'),
  c('null-prototype-falls-back', `async function* g(){yield x;}const AGP=Object.getPrototypeOf(g.prototype);g.prototype=null;const it=g();return AGP.next.call(it).then(r=>(Object.getPrototypeOf(it)===AGP)+':'+r.value);`, 'true:3', 'true:4'),
  c('this-and-arguments-across-await', `async function* g(a){await null;yield this.v+':'+arguments[0];await null;yield this.v+a;}const it=g.call({v:x},x+1);return it.next().then(p=>it.next().then(q=>p.value+'|'+q.value));`, '3:4|7', '4:5|9'),
  c('interleaved-independent-generators', `async function* g(n){yield n;await null;yield n+1;}const a=g(x),b=g(x+10);const log=[];const add=r=>{log.push(r.value);};a.next().then(add);b.next().then(add);a.next().then(add);return b.next().then(r=>{add(r);return log.join(',');});`,
    '3,13,4,14', '4,14,5,15'),
  // ---- job ordering against plain promise reactions (tick parity with V8)
  c('tick-order-yield-vs-then-chain', `const log=[];async function* g(){log.push('b');yield 1;}const it=g();it.next().then(()=>log.push('n'));const t=Promise.resolve();t.then(()=>log.push('t1')).then(()=>log.push('t2')).then(()=>log.push('t3'));return t.then(()=>0).then(()=>0).then(()=>0).then(()=>0).then(()=>log.join(',')+':'+x);`,
    'b,t1,n,t2,t3:3', 'b,t1,n,t2,t3:4', { needs: ['Promise.resolve'] }),
  c('tick-order-await-and-return', `const log=[];async function* g(){await null;log.push('a1');await null;log.push('a2');}const it=g();it.next().then(()=>log.push('n'));it.return(1).then(()=>log.push('r'));const t=Promise.resolve();t.then(()=>log.push('t1')).then(()=>log.push('t2')).then(()=>log.push('t3')).then(()=>log.push('t4'));return t.then(()=>0).then(()=>0).then(()=>0).then(()=>0).then(()=>0).then(()=>log.join(',')+':'+x);`,
    'a1,t1,a2,t2,n,t3,r,t4:3', 'a1,t1,a2,t2,n,t3,r,t4:4', { needs: ['Promise.resolve'] }),
  // ---- GC pressure
  c('gc-queued-requests-retain-records', `async function* g(){let a=yield 'start';for(;;){a=yield a.s;}}const it=g();const p0=it.next();const p1=it.next({s:'a'+x});const p2=it.next({s:'b'+x});${churn}return p2.then(r2=>p1.then(r1=>p0.then(r0=>r0.value+':'+r1.value+':'+r2.value)));`,
    'start:a3:b3', 'start:a4:b4', { gc: true }),
  c('gc-suspended-await-activation', `let release;const gate={then(resolve){release=resolve;}};async function* g(){const keep={s:'keep'+x};const v=await gate;yield keep.s+v;}const it=g();const p=it.next();${churn}${later("release('!')")}return p.then(r=>r.value);`,
    'keep3!', 'keep4!', { gc: true }),
  c('gc-saved-operand-stack', `async function* g(){return ({s:'keep'+x}).s+(yield x);}const it=g();return it.next().then(()=>{${churn}return it.next('done');}).then(r=>r.value);`,
    'keep3done', 'keep4done', { gc: true }),
  c('gc-saved-receiver', `async function* g(){yield x;return this.s;}const it=g.call({s:'this'+x});return it.next().then(()=>{${churn}return it.next();}).then(r=>r.value);`,
    'this3', 'this4', { gc: true }),
  c('gc-pending-return-request', `async function* g(){try{yield x;}finally{await null;}}const it=g();return it.next().then(()=>{const p=it.return({s:'ret'+x});${churn}return p;}).then(r=>r.value.s);`,
    'ret3', 'ret4', { gc: true }),
  c('gc-yield-star-delegation-state', `const inner={[Symbol.asyncIterator](){return this;},items:[{s:'one'+x},{s:'two'+x}],next(){const v=this.items.shift();return {value:v,done:v===undefined};}};async function* g(){yield* inner;}const it=g();return it.next().then(p=>{${churn}return it.next().then(q=>p.value.s+':'+q.value.s);});`,
    'one3:two3', 'one4:two4', { gc: true, needs: ['for_await_of_start'] }),
];
