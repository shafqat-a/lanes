// Worker 7 part B fixtures: for-await-of, GetIterator(obj, async),
// %AsyncFromSyncIteratorPrototype%, AsyncIteratorClose. Every fixture is
// `function f(x){ let log=''; async function g(){ BODY } return g(); }` (or a
// full source), so the top-level result is g's promise and the GPU publishes
// status 12 (fulfilled) / 13 (rejected) after draining the job queue.
// `expected` / `expectedNext` are the settled values for x = 3 / x = 4.
// check-async-iteration.mjs verifies every expectation with the host engine
// (oracle only, real job draining). Tick-count fixtures pin exact ES2025
// job ordering (QuickJS's own close-without-await would change them).
const REQ = ['promise-core', 'promise-resolve', 'promise-then', 'async-functions', 'jobs'];
const c = (feature, body, expected, expectedNext, settlement = 'fulfilled', extra = {}) =>
  Object.freeze({ feature, source: `function f(x){let log='';async function g(){${body}}return g();}`, input: 3, expected, expectedNext, settlement, requires: REQ, ...extra });
const full = (feature, source, expected, expectedNext, settlement = 'fulfilled', extra = {}) =>
  Object.freeze({ feature, source, input: 3, expected, expectedNext, settlement, requires: REQ, ...extra });
// Custom async iterator over [x, x+1, x+2] with logging hooks.
const asyncIter = (returnBody = `log+='R';return {done:true};`, extra = '') =>
  `const it={i:0,[Symbol.asyncIterator](){log+='I';return this;},next(){this.i++;log+='n';return Promise.resolve({value:x+this.i-1,done:this.i>3});},return(){${returnBody}}${extra}};`;
const syncIter = (nextBody, returnBody = `log+='R';return {};`) =>
  `const it={i:0,[Symbol.iterator](){return this;},next(){this.i++;${nextBody}},return(){${returnBody}}};`;

export const asyncIterationCases = Object.freeze([
  // -- arrays / built-in sync iterables (CreateAsyncFromSyncIterator)
  c('array-of-values', `let s='';for await (const v of [x,x+1,x+2]) s+=v+',';return s;`, '3,4,5,', '4,5,6,'),
  c('array-of-promises', `let s='';for await (const v of [Promise.resolve(x),x+1,Promise.resolve(x+2)]) s+=v+',';return s;`, '3,4,5,', '4,5,6,'),
  c('array-with-rejected-promise', `let s='';try{for await (const v of [x,Promise.reject('bad'+x),x+2]) s+=v+',';}catch(e){s+='|'+e;}return s;`, '3,|bad3', '4,|bad4'),
  c('array-of-thenables', `let s='';for await (const v of [{then(r){r(x*2);}}]) s+=v;return s;`, '6', '8'),
  c('string-code-points', `let s='';for await (const ch of 'ab'+x) s+=ch+'.';return s;`, 'a.b.3.', 'a.b.4.'),
  c('empty-array', `let n=0;for await (const v of []) n++;return n+x;`, 3, 4),
  c('array-destructuring-binding', `let s=0;for await (const [a,b] of [[x,1],[x,2]]) s+=a*b;return s;`, 9, 12),
  c('let-binding-fresh-per-iteration', `const fs=[];for await (const v of [x,x+1]) fs.push(()=>v);return fs[0]()+':'+fs[1]();`, '3:4', '4:5'),
  c('sync-generator-source', `function* gen(){yield x;yield x+1;}let s=0;for await (const v of gen()) s+=v;return s;`, 7, 9, 'fulfilled', { requires: [...REQ, 'generators'] }),
  c('sync-generator-break-runs-finally', `function* gen(){try{yield x;yield x+1;}finally{log+='F';}}for await (const v of gen()){log+=v;break;}return log;`, '3F', '4F', 'fulfilled', { requires: [...REQ, 'generators'] }),
  // -- sync iterables with rejected values (closeOnRejection)
  c('sync-rejected-value-closes-sync-iterator', `${syncIter(`return this.i===1?{value:Promise.reject('r'+x),done:false}:{value:this.i,done:this.i>3};`)}try{for await (const v of it) log+='v'+v;}catch(e){log+='|'+e;}return log;`, 'R|r3', 'R|r4'),
  c('sync-rejected-value-after-values', `${syncIter(`return this.i===2?{value:Promise.reject('r'+x),done:false}:{value:this.i,done:this.i>3};`)}try{for await (const v of it) log+='v'+v;}catch(e){log+='|'+e;}return log;`, 'v1R|r3', 'v1R|r4'),
  c('sync-rejected-value-with-done-true-not-closed', `${syncIter(`return {value:Promise.reject('d'+x),done:true};`)}try{for await (const v of it) log+='v'+v;}catch(e){log+='|'+e;}return log;`, '|d3', '|d4', 'fulfilled', {"nativeExpected":["R|d3","R|d4"],"nativeReferenceDifference":"AsyncFromSyncIteratorContinuation does not close an already-done sync iterator when its value rejects; observed Safari calls return.","spec":"https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-asyncfromsynciteratorcontinuation","nativeEvidence":"quickjs-safari-promise-species-pristine-native.json"}),
  c('sync-rejected-close-throw-ignored', `${syncIter(`return {value:Promise.reject('r'+x),done:false};`, `log+='R';throw 'closeErr';`)}try{for await (const v of it) log+='v';}catch(e){log+='|'+e;}return log;`, 'R|r3', 'R|r4', 'fulfilled', { nativeOracleError:{inputs:[3,4],name:'NativeWorkerError',nativeError:'NativeWorkerError: closeErr',timeout:false,evidence:'quickjs-safari-native-promise-worker-probe.json',spec:'https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-asyncfromsynciteratorcontinuation',reason:'Observed Safari worker emits closeErr; ES2025 retains the original rejection when IteratorClose throws.'} }),
  // ES2025 27.1.6.2.1 step 7 / 27.1.6.4 steps 3,5: IfAbruptRejectPromise only;
  // the sync iterator is closed solely when the value promise rejects (step 7).
  // node 26 (V8) also closes here; recorded as `v8` and asserted separately.
  c('sync-next-throws-no-close', `${syncIter(`throw 'n'+x;`)}try{for await (const v of it) log+='v';}catch(e){log+='|'+e;}return log;`, '|n3', '|n4', 'fulfilled', { v8: ['R|n3', 'R|n4'], nativeReferenceDifference:'ES2025 Async-from-Sync next rejects an abrupt IteratorNext without closing the underlying sync iterator.' }),
  c('sync-next-non-object-typeerror', `${syncIter(`return x;`)}try{for await (const v of it) log+='v';}catch(e){log+='|'+(e instanceof TypeError);}return log;`, '|true', '|true', 'fulfilled', { nativeOracleError:{inputs:[3,4],name:'NativeOracleTimeout',nativeError:'NativeOracleTimeout: exceeded 5000ms',timeout:true,evidence:'quickjs-safari-native-promise-worker-probe.json',spec:'https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-%asyncfromsynciteratorprototype%.next',reason:'Observed Safari hangs on primitive next result (2s diagnostic, 5s harness deadline); ES2025 rejects with TypeError without closing.'}, v8: ['R|true', 'R|true'], nativeReferenceDifference:'ES2025 Async-from-Sync next rejects a non-object IteratorNext result without closing the underlying sync iterator.' }),
  c('sync-value-getter-throws-no-close', `${syncIter(`return {done:false,get value(){throw 'g'+x;}};`)}try{for await (const v of it) log+='v';}catch(e){log+='|'+e;}return log;`, '|g3', '|g4', 'fulfilled', { v8: ['R|g3', 'R|g4'], nativeReferenceDifference:'ES2025 AsyncFromSyncIteratorContinuation rejects an abrupt IteratorValue before installing the rejection close handler.' }),
  // AsyncFromSyncIteratorContinuation reads done then value even when done.
  c('sync-done-and-value-both-read', `${syncIter(`return {get done(){log+='d';return this.k>0;},get value(){log+='v';return 1;},k:this.i-1};`)}for await (const v of it) log+='.';return log;`, 'dv.dv', 'dv.dv'),
  c('sync-break-calls-sync-return', `${syncIter(`return {value:x,done:false};`)}for await (const v of it){log+=v;break;}return log;`, '3R', '4R'),
  c('sync-break-no-return-method', `const it={[Symbol.iterator](){return this;},next(){return {value:x,done:false};}};for await (const v of it){log+=v;break;}return log+'ok';`, '3ok', '4ok'),
  c('sync-break-return-non-object-typeerror', `${syncIter(`return {value:x,done:false};`, `log+='R';return 7;`)}try{for await (const v of it){log+=v;break;}}catch(e){log+='|'+(e instanceof TypeError);}return log;`, '3R|true', '4R|true'),
  c('sync-throw-in-body-closes', `${syncIter(`return {value:x,done:false};`)}try{for await (const v of it){throw 'b'+v;}}catch(e){log+='|'+e;}return log;`, 'R|b3', 'R|b4'),
  c('sync-exhaustion-does-not-close', `${syncIter(`return {value:this.i,done:this.i>2};`)}for await (const v of it) log+=v;return log+x;`, '123', '124'),
  // -- custom async iterables
  c('custom-async-iterator', `${asyncIter()}let s='';for await (const v of it) s+=v;return log+':'+s;`, 'Innnn:345', 'Innnn:456'),
  c('custom-next-returns-plain-object', `const it={[Symbol.asyncIterator](){return {i:0,next(){this.i++;return {value:this.i*x,done:this.i>2};}};}};let s=0;for await (const v of it) s+=v;return s;`, 9, 12),
  c('custom-next-value-promise-not-unwrapped', `const it={[Symbol.asyncIterator](){return {i:0,next(){this.i++;return {value:Promise.resolve(x),done:this.i>1};}};}};let s='';for await (const v of it) s+=(v instanceof Promise);return s;`, 'true', 'true'),
  c('custom-next-non-object-typeerror', `const it={[Symbol.asyncIterator](){return {next(){return x;}};}};try{for await (const v of it);}catch(e){return 'T'+(e instanceof TypeError)+x;}return 'no';`, 'Ttrue3', 'Ttrue4'),
  c('custom-next-promise-of-non-object-typeerror', `const it={[Symbol.asyncIterator](){return {next(){return Promise.resolve(x);}};}};try{for await (const v of it);}catch(e){return 'T'+(e instanceof TypeError)+x;}return 'no';`, 'Ttrue3', 'Ttrue4'),
  c('custom-next-rejects-no-close', `${asyncIter(`log+='R';return {};`)}it.next=function(){return Promise.reject('rej'+x);};try{for await (const v of it);}catch(e){log+='|'+e;}return log;`, 'I|rej3', 'I|rej4'),
  c('custom-next-getter-read-once', `let reads=0;const inner={i:0,get next(){reads++;return function(){this.i++;return {value:this.i,done:this.i>3};};}};const it={[Symbol.asyncIterator](){return inner;}};let s=0;for await (const v of it) s+=v;return reads+':'+s+':'+x;`, '1:6:3', '1:6:4'),
  c('custom-next-called-with-no-arguments-and-this', `let info='';const inner={i:0,next(){info+=arguments.length+(this===inner?'t':'f');this.i++;return {value:1,done:this.i>2};}};const it={[Symbol.asyncIterator](){return inner;}};for await (const v of it);return info+x;`, '0t0t0t3', '0t0t0t4'),
  c('custom-done-truthy-non-boolean', `const it={[Symbol.asyncIterator](){return {i:0,next(){this.i++;return {value:x,done:this.i>1?'yes':0};}};}};let n=0;for await (const v of it) n+=v;return n;`, 3, 4),
  c('custom-value-not-read-when-done', `const it={[Symbol.asyncIterator](){return {next(){return {done:true,get value(){log+='V';return 1;}};}};}};for await (const v of it);return log+x;`, '3', '4'),
  // -- break / return / throw: AsyncIteratorClose
  c('break-calls-return-and-awaits-it', `${asyncIter(`log+='R';return new Promise(r=>{Promise.resolve().then(()=>{log+='A';r({});});});`)}for await (const v of it){log+=v;break;}log+='after';return log;`, 'In3RAafter', 'In4RAafter'),
  c('break-return-non-object-typeerror', `${asyncIter(`log+='R';return 1;`)}try{for await (const v of it){break;}}catch(e){log+='|'+(e instanceof TypeError);}return log;`, 'InR|true', 'InR|true'),
  c('break-return-promise-of-non-object-typeerror', `${asyncIter(`log+='R';return Promise.resolve(1);`)}try{for await (const v of it){break;}}catch(e){log+='|'+(e instanceof TypeError);}return log;`, 'InR|true', 'InR|true'),
  c('break-return-rejects-propagates', `${asyncIter(`log+='R';return Promise.reject('rr'+x);`)}try{for await (const v of it){break;}}catch(e){log+='|'+e;}return log;`, 'InR|rr3', 'InR|rr4'),
  c('break-return-throws-propagates', `${asyncIter(`log+='R';throw 'rt'+x;`)}try{for await (const v of it){break;}}catch(e){log+='|'+e;}return log;`, 'InR|rt3', 'InR|rt4'),
  c('break-no-return-method', `const it={[Symbol.asyncIterator](){return {next(){return {value:x,done:false};}};}};for await (const v of it){log+=v;break;}return log+'ok';`, '3ok', '4ok'),
  c('break-return-getter-non-callable-typeerror', `const it={[Symbol.asyncIterator](){log+='I';return this;},next(){log+='n';return {value:x,done:false};},get return(){log+='G';return 5;}};try{for await (const v of it){break;}}catch(e){log+='|'+(e instanceof TypeError);}return log;`, 'InG|true', 'InG|true'),
  c('return-statement-awaits-return-before-resolving', `${asyncIter(`log+='R';return new Promise(r=>{Promise.resolve().then(()=>{log+='A';r({});});});`)}const p=(async()=>{for await (const v of it){return 'ret'+v;}})();const v=await p;return log+':'+v;`, 'InRA:ret3', 'InRA:ret4'),
  c('continue-does-not-close', `${asyncIter()}let s='';for await (const v of it){if(v===x)continue;s+=v;}return log+s;`, 'Innnn45', 'Innnn56'),
  c('exhaustion-does-not-call-return', `${asyncIter()}for await (const v of it);return log+x;`, 'Innnn3', 'Innnn4'),
  c('throw-in-body-closes-original-error-wins', `${asyncIter(`log+='R';return {};`)}try{for await (const v of it){throw 'body'+v;}}catch(e){log+='|'+e;}return log;`, 'InR|body3', 'InR|body4'),
  c('throw-in-body-return-throws-original-wins', `${asyncIter(`log+='R';throw 'closeErr';`)}try{for await (const v of it){throw 'body'+v;}}catch(e){log+='|'+e;}return log;`, 'InR|body3', 'InR|body4'),
  c('throw-in-body-return-non-object-original-wins', `${asyncIter(`log+='R';return 5;`)}try{for await (const v of it){throw 'body'+v;}}catch(e){log+='|'+e;}return log;`, 'InR|body3', 'InR|body4'),
  c('throw-in-body-return-rejects-original-wins', `${asyncIter(`log+='R';return Promise.reject('cr');`)}try{for await (const v of it){throw 'body'+v;}}catch(e){log+='|'+e;}return log;`, 'InR|body3', 'InR|body4'),
  c('throw-in-body-awaits-return-result', `${asyncIter(`log+='R';return new Promise(r=>{Promise.resolve().then(()=>{log+='A';r({});});});`)}try{for await (const v of it){throw 'b';}}catch(e){log+='|'+e;}return log;`, 'InRA|b', 'InRA|b'),
  c('throw-from-nested-call-in-body-closes', `${asyncIter()}function h(v){throw 'deep'+v;}try{for await (const v of it){h(v);}}catch(e){log+='|'+e;}return log;`, 'InR|deep3', 'InR|deep4'),
  c('try-catch-inside-body-does-not-close', `${asyncIter()}let s='';for await (const v of it){try{throw v;}catch(e){s+=e;}}return log+s;`, 'Innnn345', 'Innnn456'),
  c('nested-loops-labeled-break-closes-inner-then-outer', `const mk=(tag)=>({[Symbol.asyncIterator](){return {next(){return {value:tag,done:false};},return(){log+='R'+tag;return {};}};}});outer:for await (const a of mk('o')){for await (const b of mk('i')){break outer;}}return log+x;`, 'RiRo3', 'RiRo4'),
  c('nested-return-closes-both', `const mk=(tag)=>({[Symbol.asyncIterator](){return {next(){return {value:tag,done:false};},return(){log+='R'+tag;return {};}};}});const r=await (async()=>{for await (const a of mk('o')){for await (const b of mk('i')){return a+b+x;}}})();return log+':'+r;`, 'RiRo:oi3', 'RiRo:oi4'),
  c('uncaught-body-throw-rejects-function', `${asyncIter()}for await (const v of it){throw 'u'+v;}`, 'u3', 'u4', 'rejected'),
  // -- GetIterator(obj, async)
  c('symbol-asynciterator-getter-before-iterator', `const o={get [Symbol.asyncIterator](){log+='A';return undefined;},get [Symbol.iterator](){log+='S';return function(){return [x][Symbol.iterator]();};}};for await (const v of o) log+=v;return log;`, 'AS3', 'AS4'),
  c('symbol-asynciterator-preferred-over-iterator', `const o={[Symbol.asyncIterator](){log+='A';return {i:0,next(){this.i++;return {value:x,done:this.i>1};}};},[Symbol.iterator](){log+='S';return [][Symbol.iterator]();}};for await (const v of o) log+=v;return log;`, 'A3', 'A4'),
  c('symbol-asynciterator-null-falls-back', `const o={[Symbol.asyncIterator]:null,[Symbol.iterator](){return [x][Symbol.iterator]();}};let s=0;for await (const v of o) s+=v;return s;`, 3, 4),
  c('symbol-asynciterator-non-callable-typeerror', `const o={[Symbol.asyncIterator]:1};try{for await (const v of o);}catch(e){return (e instanceof TypeError)+''+x;}return 'no';`, 'true3', 'true4'),
  c('asynciterator-returns-non-object-typeerror', `const o={[Symbol.asyncIterator](){return x;}};try{for await (const v of o);}catch(e){return (e instanceof TypeError)+''+x;}return 'no';`, 'true3', 'true4'),
  c('not-iterable-number-typeerror', `try{for await (const v of x);}catch(e){return (e instanceof TypeError)+''+x;}return 'no';`, 'true3', 'true4'),
  c('null-typeerror', `try{for await (const v of null);}catch(e){return (e instanceof TypeError)+''+x;}return 'no';`, 'true3', 'true4'),
  // -- intrinsics
  full('symbol-asynciterator-well-known', `function f(x){return Promise.resolve(typeof Symbol.asyncIterator+':'+Symbol.asyncIterator.description+':'+x);}`, 'symbol:Symbol.asyncIterator:3', 'symbol:Symbol.asyncIterator:4', 'fulfilled', { requires: ['promise-core'] }),
  full('async-iterator-prototype-method-returns-this', `function f(x){async function* ag(){}const AIP=Object.getPrototypeOf(Object.getPrototypeOf(ag.prototype));const m=AIP[Symbol.asyncIterator];const o={x};return Promise.resolve((m.call(o)===o)+':'+m.name+':'+m.length+':'+x);}`, 'true:[Symbol.asyncIterator]:0:3', 'true:[Symbol.asyncIterator]:0:4', 'fulfilled', { requires: [...REQ, 'async-generators'] }),
  // -- job ordering (exact ES2025 tick counts)
  full('ticks-array-values', `function f(x){let t=0,stop=false;(async()=>{while(!stop){t++;await null;}})();async function g(){for await (const v of [x,x]);stop=true;return t;}return g();}`, 7, 7),
  full('ticks-custom-async-iterator', `function f(x){let t=0,stop=false;(async()=>{while(!stop){t++;await null;}})();const it={[Symbol.asyncIterator](){return {i:0,next(){this.i++;return {value:x,done:this.i>2};}};}};async function g(){for await (const v of it);stop=true;return t;}return g();}`, 4, 4),
  full('ticks-break-with-async-return', `function f(x){let t=0,stop=false;(async()=>{while(!stop){t++;await null;}})();const it={[Symbol.asyncIterator](){return {next(){return {value:x,done:false};},return(){return Promise.resolve({});}};}};async function g(){for await (const v of it){break;}stop=true;return t;}return g();}`, 3, 3),
  full('ticks-throw-close-awaits', `function f(x){let t=0,stop=false;(async()=>{while(!stop){t++;await null;}})();const it={[Symbol.asyncIterator](){return {next(){return {value:x,done:false};},return(){return {};}};}};async function g(){try{for await (const v of it){throw 1;}}catch(e){}stop=true;return t;}return g();}`, 3, 3),
]);
