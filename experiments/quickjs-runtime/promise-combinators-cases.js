// Worker 4 fixtures: Promise.resolve/reject/all/allSettled/any/race/
// withResolvers and AggregateError. Every source is ONE named function
// `f(x)` returning a Promise; `expected` is the settled value for `input`,
// `expectedNext` for `input + 1`; `settlement` is 'fulfilled' | 'rejected' |
// 'pending' (pending: expected/expectedNext are undefined). Values are
// primitives so the GPU status 12/13 result can be compared directly.
// No async functions (worker 5) and no subclassing; custom constructors are
// plain functions. Fixtures that patch Promise.resolve do so on a fresh realm.
const c = (feature, source, input, expected, expectedNext, settlement = 'fulfilled', extra = {}) =>
  Object.freeze({ feature, source, input, expected, expectedNext, settlement, ...extra });

const userIterator = (nextBody) => `const log=[];const it={[Symbol.iterator](){log.push('iter');return this;},next(){log.push('next');${nextBody}},return(){log.push('return');return {};}};`;
const closingGenerator = `function* g(){try{yield 1;yield 2;yield 3;}finally{log.push('closed');}}`;
const throwSecondResolve = `const orig=Promise.resolve;let k=0;Promise.resolve=function(v){k++;if(k===2)throw 'pr'+x;return orig.call(this,v);};`;
const thenThrowsResolve = `Promise.resolve=function(v){return {get then(){throw 'th'+x;}};};`;
const closeObservingIterator = `const log=[];const it={[Symbol.iterator](){return this;},next(){return {done:false,value:1};},return(){log.push('ret');return {};}};`;
const captureResolve = `const fns=[];Promise.resolve=function(v){return {then(a,b){fns.push(a,b);}};};`;

export const promiseCombinatorCases = Object.freeze([
  // ---- Promise.resolve ----------------------------------------------------
  c('resolve-primitive', 'function f(x){return Promise.resolve(x).then(v=>v*2);}', 3, 6, 8),
  c('resolve-returns-same-promise', 'function f(x){const p=new Promise(r=>r(x));return Promise.resolve(Promise.resolve(p)===p).then(v=>v+":"+x);}', 3, 'true:3', 'true:4'),
  c('resolve-thenable', 'function f(x){return Promise.resolve({then(r){r(x+1);}});}', 3, 4, 5),
  c('resolve-thenable-then-throws', 'function f(x){return Promise.resolve({then(){throw x;}});}', 3, 3, 4, 'rejected'),
  c('resolve-thenable-getter-throws', 'function f(x){return Promise.resolve({get then(){throw "g"+x;}});}', 3, 'g3', 'g4', 'rejected'),
  c('resolve-non-object-this', 'function f(x){try{Promise.resolve.call(1,x);return Promise.resolve("no");}catch(e){return Promise.resolve((e instanceof TypeError)+":"+x);}}', 3, 'true:3', 'true:4'),
  c('resolve-plain-constructor', 'function f(x){const p=Promise.resolve(x);function C(ex){return new Promise(ex);}const q=Promise.resolve.call(C,p);return q.then(v=>(q!==p)+":"+v);}', 3, 'true:3', 'true:4', 'fulfilled', {"nativeExpected":["false:3","false:4"],"nativeReferenceDifference":"PromiseResolve may return its argument only when its constructor is SameValue to C; this plain alternate constructor requires a new capability.","spec":"https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-promise-resolve","nativeEvidence":"quickjs-safari-promise-species-pristine-native.json"}),
  // ---- Promise.reject -----------------------------------------------------
  c('reject-reason', 'function f(x){return Promise.reject(x*10);}', 3, 30, 40, 'rejected'),
  c('reject-does-not-unwrap', 'function f(x){const p=Promise.resolve(x);return Promise.reject(p).catch(r=>(r===p)+":"+x);}', 3, 'true:3', 'true:4'),
  c('reject-non-constructor-this', 'function f(x){try{Promise.reject.call({},x);return Promise.resolve("no");}catch(e){return Promise.resolve(e.constructor===TypeError?"TypeError"+x:"other");}}', 3, 'TypeError3', 'TypeError4'),
  // ---- Promise.withResolvers ------------------------------------------------
  c('withResolvers-resolve-once', 'function f(x){const r=Promise.withResolvers();r.resolve(x+5);r.resolve(0);r.reject(1);return r.promise;}', 3, 8, 9),
  c('withResolvers-shape', 'function f(x){const r=Promise.withResolvers();r.resolve(x);return r.promise.then(v=>Object.keys(r).join()+":"+(Object.getPrototypeOf(r)===Object.prototype)+":"+(r.promise instanceof Promise)+":"+typeof r.resolve+":"+r.resolve.length+":"+v);}', 3, 'promise,resolve,reject:true:true:function:1:3', 'promise,resolve,reject:true:true:function:1:4', 'fulfilled', {"nativeExpected":["resolve,reject,promise:true:true:function:1:3","resolve,reject,promise:true:true:function:1:4"],"nativeReferenceDifference":"ES2025 creates withResolvers own properties in promise, resolve, reject order; observed Safari uses resolve, reject, promise.","spec":"https://tc39.es/ecma262/2025/multipage/control-abstraction-objects.html#sec-promise.withResolvers","nativeEvidence":"quickjs-safari-promise-species-pristine-native.json"}),
  c('withResolvers-reject', 'function f(x){const r=Promise.withResolvers();r.reject("w"+x);return r.promise;}', 3, 'w3', 'w4', 'rejected'),
  c('statics-name-length', 'function f(x){const n=["all","allSettled","any","race","reject","resolve","withResolvers"];let s="";for(const k of n){s+=Promise[k].name+Promise[k].length+",";}return Promise.resolve(s+x);}', 3, 'all1,allSettled1,any1,race1,reject1,resolve1,withResolvers0,3', 'all1,allSettled1,any1,race1,reject1,resolve1,withResolvers0,4'),
  // ---- Promise.all --------------------------------------------------------
  c('all-array-mixed', 'function f(x){return Promise.all([x,Promise.resolve(x+1),{then(r){r(x+2);}}]).then(v=>v.join("-"));}', 3, '3-4-5', '4-5-6'),
  c('all-empty', 'function f(x){return Promise.all([]).then(v=>Array.isArray(v)+":"+v.length+":"+x);}', 3, 'true:0:3', 'true:0:4'),
  c('all-out-of-order-settlement', 'function f(x){const a=Promise.withResolvers(),b=Promise.withResolvers(),c=Promise.withResolvers();const p=Promise.all([a.promise,b.promise,c.promise]);c.resolve("c"+x);b.resolve("b");a.resolve("a");return p.then(v=>v.join());}', 3, 'a,b,c3', 'a,b,c4'),
  c('all-first-rejection-wins', 'function f(x){const a=Promise.withResolvers(),b=Promise.withResolvers();const p=Promise.all([a.promise,b.promise]);b.reject("b"+x);a.reject("a");return p;}', 3, 'b3', 'b4', 'rejected'),
  c('all-generator', 'function f(x){function* g(){yield x;yield Promise.resolve(x*2);}return Promise.all(g()).then(v=>v.join());}', 3, '3,6', '4,8'),
  c('all-string-iterable', 'function f(x){return Promise.all("ab"+x).then(v=>v.join("|"));}', 3, 'a|b|3', 'a|b|4'),
  c('all-fresh-result-array', 'function f(x){const arr=[x];return Promise.all(arr).then(v=>(v!==arr)+":"+v[0]+":"+v.length);}', 3, 'true:3:1', 'true:4:1'),
  c('all-next-throws-no-close', `function f(x){${userIterator("throw 'boom'+x;")}return Promise.all(it).catch(e=>e+':'+log.join());}`, 3, 'boom3:iter,next', 'boom4:iter,next'),
  c('all-value-getter-throws-no-close', `function f(x){${userIterator("return {done:false,get value(){throw 'val'+x;}};")}return Promise.all(it).catch(e=>e+':'+log.join());}`, 3, 'val3:iter,next', 'val4:iter,next'),
  c('all-done-getter-throws-no-close', `function f(x){${userIterator("return {get done(){throw 'done'+x;},value:1};")}return Promise.all(it).catch(e=>e+':'+log.join());}`, 3, 'done3:iter,next', 'done4:iter,next'),
  c('all-non-object-result-no-close', `function f(x){${userIterator('return 1;')}return Promise.all(it).catch(e=>(e instanceof TypeError)+':'+log.join()+':'+x);}`, 3, 'true:iter,next:3', 'true:iter,next:4'),
  c('all-exhausted-no-close', `function f(x){let n=0;${userIterator('n++;return n>2?{done:true}:{done:false,value:n*x};')}return Promise.all(it).then(v=>v.join()+':'+log.join());}`, 3, '3,6:iter,next,next,next', '4,8:iter,next,next,next'),
  c('all-resolve-lookup-throws-before-iterator', "function f(x){const log=[];Object.defineProperty(Promise,'resolve',{get(){log.push('get');throw 'rl'+x;},configurable:true});const it={get [Symbol.iterator](){log.push('iter');return function(){return [][Symbol.iterator]();};}};return Promise.all(it).catch(e=>e+':'+log.join());}", 3, 'rl3:get', 'rl4:get'),
  c('all-resolve-not-callable', "function f(x){const log=[];Object.defineProperty(Promise,'resolve',{value:5,configurable:true,writable:true});const it={get [Symbol.iterator](){log.push('iter');return function(){return [][Symbol.iterator]();};}};return Promise.all(it).catch(e=>(e instanceof TypeError)+':'+log.join()+':'+x);}", 3, 'true::3', 'true::4'),
  c('all-resolve-getter-called-once', "function f(x){let n=0;const orig=Promise.resolve;Object.defineProperty(Promise,'resolve',{get(){n++;return orig;},configurable:true});return Promise.all([1,2,x]).then(v=>n+':'+v.join());}", 3, '1:1,2,3', '1:1,2,4'),
  c('all-resolve-receives-constructor', "function f(x){const orig=Promise.resolve;const seen=[];Promise.resolve=function(v){seen.push(this===Promise);return orig.call(this,v);};return Promise.all([x,x+1]).then(v=>seen.join()+':'+v.join());}", 3, 'true,true:3,4', 'true,true:4,5'),
  c('all-resolve-throws-closes-iterator', `function f(x){const log=[];${throwSecondResolve}${closingGenerator}return Promise.all(g()).catch(e=>e+':'+log.join());}`, 3, 'pr3:closed', 'pr4:closed'),
  c('all-then-getter-throws-closes', `function f(x){${closeObservingIterator}${thenThrowsResolve}return Promise.all(it).catch(e=>e+':'+log.join());}`, 3, 'th3:ret', 'th4:ret'),
  c('all-then-not-callable-closes', `function f(x){${closeObservingIterator}Promise.resolve=function(v){return {then:x};};return Promise.all(it).catch(e=>(e instanceof TypeError)+':'+log.join()+':'+x);}`, 3, 'true:ret:3', 'true:ret:4'),
  c('all-close-error-suppressed', `function f(x){const log=[];const it={[Symbol.iterator](){return this;},next(){return {done:false,value:1};},return(){log.push('ret');throw 'other';}};${thenThrowsResolve}return Promise.all(it).catch(e=>e+':'+log.join());}`, 3, 'th3:ret', 'th4:ret'),
  c('all-not-iterable', 'function f(x){return Promise.all(x).catch(e=>(e instanceof TypeError)+":"+x);}', 3, 'true:3', 'true:4'),
  c('all-this-not-constructor-throws-sync', 'function f(x){try{Promise.all.call(undefined,[]);}catch(e){return Promise.resolve(e.constructor===TypeError?"sync"+x:"x");}return Promise.resolve("none");}', 3, 'sync3', 'sync4'),
  c('all-element-functions', `function f(x){${captureResolve}const p=Promise.all([1,2]);const a=fns[0];const info=a.length+':'+JSON.stringify(a.name)+':'+Object.prototype.hasOwnProperty.call(a,'prototype')+':'+(fns[1]===fns[3]);fns[2]('second');a('first'+x);a('again');return p.then(v=>info+'|'+v.join());}`, 3, '1:"":false:true|first3,second', '1:"":false:true|first4,second'),
  c('all-synchronous-then', "function f(x){Promise.resolve=function(v){return {then(a){a(v*2);}};};return Promise.all([x,x+1]).then(v=>v.join());}", 3, '6,8', '8,10'),
  c('all-throwing-reject-propagates', "function f(x){function C(ex){ex(function(){},function(){throw 'rj'+x;});}C.resolve=function(v){return v;};try{Promise.all.call(C,5);}catch(e){return Promise.resolve('sync:'+e);}return Promise.resolve('none');}", 3, 'sync:rj3', 'sync:rj4'),
  c('all-plain-constructor-step-order', "function f(x){const log=[];function C(ex){log.push('ctor');ex(function(v){log.push('res:'+v.join());},function(e){log.push('rej');});}Object.defineProperty(C,'resolve',{get(){log.push('getResolve');return function(v){log.push('pr'+v);return {then(a){a(v);}};};}});const it={get [Symbol.iterator](){log.push('getIter');return function(){log.push('callIter');return [x][Symbol.iterator]();};}};Promise.all.call(C,it);return Promise.resolve(log.join());}", 3, 'ctor,getResolve,getIter,callIter,pr3,res:3', 'ctor,getResolve,getIter,callIter,pr4,res:4'),
  // ---- Promise.allSettled ---------------------------------------------------
  c('allSettled-mixed-shapes', "function f(x){return Promise.allSettled([x,Promise.reject('r'),{then(a,b){b('t');}}]).then(v=>v.map(o=>Object.keys(o).join('/')+'='+o.status+':'+(o.status==='fulfilled'?o.value:o.reason)).join(','));}", 3, 'status/value=fulfilled:3,status/reason=rejected:r,status/reason=rejected:t', 'status/value=fulfilled:4,status/reason=rejected:r,status/reason=rejected:t'),
  c('allSettled-empty', 'function f(x){return Promise.allSettled([]).then(v=>Array.isArray(v)+":"+v.length+":"+x);}', 3, 'true:0:3', 'true:0:4'),
  c('allSettled-generator', 'function f(x){function* g(){yield Promise.reject(x);yield x+1;}return Promise.allSettled(g()).then(v=>v.map(o=>o.status[0]+(o.value??o.reason)).join());}', 3, 'r3,f4', 'r4,f5'),
  c('allSettled-resolve-throws-closes-iterator', `function f(x){const log=[];${throwSecondResolve}${closingGenerator}return Promise.allSettled(g()).catch(e=>e+':'+log.join());}`, 3, 'pr3:closed', 'pr4:closed'),
  c('allSettled-shared-already-called', `function f(x){${captureResolve}const p=Promise.allSettled([1]);fns[1]('no'+x);fns[0]('yes');return p.then(v=>v[0].status+':'+v[0].reason+':'+fns[0].length+fns[1].length+':'+(fns[0]!==fns[1]));}`, 3, 'rejected:no3:11:true', 'rejected:no4:11:true'),
  c('allSettled-next-throws-no-close', `function f(x){${userIterator("throw 'boom'+x;")}return Promise.allSettled(it).catch(e=>e+':'+log.join());}`, 3, 'boom3:iter,next', 'boom4:iter,next'),
  // ---- Promise.any --------------------------------------------------------
  c('any-first-fulfilled', 'function f(x){return Promise.any([Promise.reject(1),x,Promise.resolve(9)]);}', 3, 3, 4),
  // PerformPromiseAny specifies AggregateError/errors, not an English diagnostic message.
  c('any-all-rejected-aggregate', "function f(x){return Promise.any([Promise.reject('a'),Promise.reject('b'+x)]).catch(e=>(e instanceof AggregateError)+':'+(e instanceof Error)+':'+e.errors.join()+':'+typeof e.message+':'+Object.keys(e).length+':'+Object.getOwnPropertyDescriptor(e,'errors').enumerable);}", 3, 'true:true:a,b3:string:0:false', 'true:true:a,b4:string:0:false'),
  c('any-empty-rejects', 'function f(x){return Promise.any([]).catch(e=>(e.constructor===AggregateError)+":"+e.errors.length+":"+x);}', 3, 'true:0:3', 'true:0:4'),
  c('any-errors-index-order', "function f(x){const a=Promise.withResolvers(),b=Promise.withResolvers(),c=Promise.withResolvers();const p=Promise.any([a.promise,b.promise,c.promise]);c.reject('c'+x);a.reject('a');b.reject('b');return p.catch(e=>e.errors.join());}", 3, 'a,b,c3', 'a,b,c4'),
  c('any-errors-descriptor', "function f(x){return Promise.any([Promise.reject(x)]).catch(e=>{const d=Object.getOwnPropertyDescriptor(e,'errors');return d.writable+':'+d.configurable+':'+Array.isArray(d.value)+':'+d.value[0];});}", 3, 'true:true:true:3', 'true:true:true:4'),
  c('any-then-getter-throws-closes', `function f(x){${closeObservingIterator}${thenThrowsResolve}return Promise.any(it).catch(e=>e+':'+log.join());}`, 3, 'th3:ret', 'th4:ret'),
  c('any-resolve-getter-called-once', "function f(x){let n=0;const orig=Promise.resolve;Object.defineProperty(Promise,'resolve',{get(){n++;return orig;},configurable:true});return Promise.any([Promise.reject(0),x]).then(v=>n+':'+v);}", 3, '1:3', '1:4'),
  c('any-generator-all-rejected', 'function f(x){function* g(){yield Promise.reject(x);yield Promise.reject(x+1);}return Promise.any(g()).catch(e=>e.errors.join("+"));}', 3, '3+4', '4+5'),
  // ---- Promise.race -------------------------------------------------------
  c('race-first-settled-wins', 'function f(x){const a=Promise.withResolvers(),b=Promise.withResolvers();const p=Promise.race([a.promise,b.promise]);b.resolve("b"+x);a.resolve("a");return p;}', 3, 'b3', 'b4'),
  c('race-rejection-wins', 'function f(x){const a=Promise.withResolvers(),b=Promise.withResolvers();const p=Promise.race([a.promise,b.promise]);a.reject("a"+x);b.resolve("b");return p;}', 3, 'a3', 'a4', 'rejected'),
  c('race-empty-stays-pending', 'function f(x){return Promise.race([]);}', 3, undefined, undefined, 'pending'),
  c('race-immediate-values', 'function f(x){return Promise.race([x,x+1]);}', 3, 3, 4),
  c('race-resolve-throws-closes-iterator', `function f(x){const log=[];${throwSecondResolve}${closingGenerator}return Promise.race(g()).catch(e=>e+':'+log.join());}`, 3, 'pr3:closed', 'pr4:closed'),
  c('race-next-throws-no-close', `function f(x){${userIterator("throw 'boom'+x;")}return Promise.race(it).catch(e=>e+':'+log.join());}`, 3, 'boom3:iter,next', 'boom4:iter,next'),
  c('race-passes-capability-functions', `function f(x){${captureResolve}const p=Promise.race([1,2]);const same=(fns[0]===fns[2])+':'+(fns[1]===fns[3]);fns[2]('v'+x);fns[0]('late');return p.then(v=>same+':'+v);}`, 3, 'true:true:v3', 'true:true:v4'),
  // ---- AggregateError -------------------------------------------------------
  c('AggregateError-construct', "function f(x){const e=new AggregateError([1,x],'msg',{cause:'c'});return Promise.resolve(e.errors.join()+'|'+e.message+'|'+e.cause+'|'+e.name+'|'+String(e)+'|'+Object.keys(e).length);}", 3, '1,3|msg|c|AggregateError|AggregateError: msg|0', '1,4|msg|c|AggregateError|AggregateError: msg|0'),
  c('AggregateError-call-without-new', "function f(x){const e=AggregateError([x]);return Promise.resolve((e instanceof AggregateError)+':'+Object.prototype.hasOwnProperty.call(e,'message')+':'+e.message.length+':'+e.errors[0]+':'+Object.prototype.hasOwnProperty.call(e,'cause'));}", 3, 'true:false:0:3:false', 'true:false:0:4:false'),
  c('AggregateError-generator-errors', 'function f(x){function* g(){yield x;yield x+1;}return Promise.resolve(new AggregateError(g()).errors.join());}', 3, '3,4', '4,5'),
  c('AggregateError-metadata', "function f(x){return Promise.resolve(AggregateError.length+':'+AggregateError.name+':'+(Object.getPrototypeOf(AggregateError)===Error)+':'+(Object.getPrototypeOf(AggregateError.prototype)===Error.prototype)+':'+AggregateError.prototype.name+':'+JSON.stringify(AggregateError.prototype.message)+':'+(AggregateError.prototype.constructor===AggregateError)+':'+Object.prototype.toString.call(new AggregateError([]))+':'+x);}", 3, '2:AggregateError:true:true:AggregateError:"":true:[object Error]:3', '2:AggregateError:true:true:AggregateError:"":true:[object Error]:4'),
  c('AggregateError-step-order', "function f(x){const log=[];const msg={toString(){log.push('msg');return 'm';}};const opts={get cause(){log.push('cause');return x;}};const it={[Symbol.iterator](){log.push('iter');return [][Symbol.iterator]();}};const e=new AggregateError(it,msg,opts);return Promise.resolve(log.join()+':'+e.cause+':'+e.message);}", 3, 'msg,cause,iter:3:m', 'msg,cause,iter:4:m'),
  c('AggregateError-not-iterable', 'function f(x){try{new AggregateError(x);}catch(e){return Promise.resolve((e instanceof TypeError)+":"+x);}return Promise.resolve("none");}', 3, 'true:3', 'true:4'),
  c('AggregateError-errors-descriptor', "function f(x){const e=new AggregateError([x]);const d=Object.getOwnPropertyDescriptor(e,'errors');const m=Object.getOwnPropertyDescriptor(new AggregateError([],x),'message');return Promise.resolve(d.writable+':'+d.enumerable+':'+d.configurable+':'+m.enumerable+':'+m.value);}", 3, 'true:false:true:false:3', 'true:false:true:false:4'),
  c('AggregateError-iterator-throw-no-close', `function f(x){${userIterator("throw 'agg'+x;")}try{new AggregateError(it);}catch(e){return Promise.resolve(e+':'+log.join());}return Promise.resolve('none');}`, 3, 'agg3:iter,next', 'agg4:iter,next'),
  // ---- GC pressure ----------------------------------------------------------
  c('all-gc-bounded-pending', 'function f(x){const rs=[];const ps=[];for(let i=0;i<12;i++){const r=Promise.withResolvers();rs.push(r.resolve);ps.push(r.promise);}const p=Promise.all(ps);for(let i=11;i>=0;i--){const junk=[];for(let j=0;j<8;j++)junk.push({a:j,b:[j]});rs[i](i+x);}return p.then(v=>{let s=0;for(const n of v)s+=n;return s+":"+v.length;});}', 3, '102:12', '114:12', 'fulfilled', {requiresGC:true}),
  c('all-gc-pressure-many-pending', 'function f(x){const rs=[];const ps=[];for(let i=0;i<40;i++){const r=Promise.withResolvers();rs.push(r.resolve);ps.push(r.promise);}const p=Promise.all(ps);for(let i=39;i>=0;i--){const junk=[];for(let j=0;j<8;j++)junk.push({a:j,b:[j]});rs[i](i+x);}return p.then(v=>{let s=0;for(const n of v)s+=n;return s+":"+v.length;});}', 3, '900:40', '940:40', 'fulfilled', {gpuOutcome:'resource',resourceReason:'Current representation needs at least2162 simultaneously live nodes before resolving inputs; lane heap2048'}),
]);
