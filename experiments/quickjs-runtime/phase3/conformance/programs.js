// Focused cases for the existing GPU harness. ready:true only when the current
// engine source implements the behavior. Symbol and BigInt programs stay
// ready:false with expect.kind "unsupported" — a guessed passing result is worse.
// The browser page calls the entry with HARNESS_INPUT. Sentinel integer
// addition is f(x){return x+1} at that input.

export const HARNESS_INPUT = 0;

const deferred = (id, source) => Object.freeze({
  id,
  source,
  ready: false,
  expect: Object.freeze({ kind: 'unsupported' }),
});

const sentinel = (id, source, value) => Object.freeze({
  id,
  source,
  ready: true,
  expect: Object.freeze({ kind: 'value', value }),
});

export const PROGRAMS = Object.freeze([
  sentinel('sentinel-math-tostring-tag', 'function f(x){return Object.prototype.toString.call(Math);}', '[object Math]'),
  sentinel('sentinel-json-tostring-tag', 'function f(x){return Object.prototype.toString.call(JSON);}', '[object JSON]'),
  sentinel('sentinel-integer-add', 'function f(x){return x+1;}', 1),
  sentinel('sentinel-array-isarray', 'function f(x){return Array.isArray([]);}', true),

  deferred('symbol-identity', 'function f(x){const a=Symbol("s");const b=Symbol("s");return a===b&&a!==b;}'),
  deferred('symbol-constructor-new', 'function f(x){return new Symbol(x);}'),
  deferred('symbol-for-keyfor', 'function f(x){return Symbol.keyFor(Symbol.for("phase3"));}'),
  deferred('symbol-typeof', 'function f(x){return typeof Symbol("s");}'),
  deferred('symbol-description', 'function f(x){return Symbol("phase3").description;}'),
  deferred('symbol-property-key', 'function f(x){const s=Symbol("k");const o={[s]:x};return o[s];}'),
  deferred('symbol-enumeration-order', 'function f(x){const s=Symbol("s");const o={};o[1]=x;o.b=x;o[s]=x;return Reflect.ownKeys(o).length;}'),
  deferred('symbol-getownpropertysymbols', 'function f(x){const s=Symbol("s");return Object.getOwnPropertySymbols({[s]:x}).length;}'),
  deferred('symbol-reflect-ownkeys', 'function f(x){const s=Symbol("s");return Reflect.ownKeys({a:x,[s]:x}).length;}'),
  deferred('symbol-spread-enumerable', 'function f(x){const s=Symbol("s");const o={...{[s]:x,a:x}};return o[s]===x&&o.a===x;}'),
  deferred('symbol-for-in-excludes', 'function f(x){const s=Symbol("s");const o={[s]:x,a:x};let n="";for(const k in o)n+=k;return n;}'),
  deferred('symbol-well-known-set', 'function f(x){return [Symbol.iterator,Symbol.asyncIterator,Symbol.hasInstance,Symbol.isConcatSpreadable,Symbol.match,Symbol.matchAll,Symbol.replace,Symbol.search,Symbol.species,Symbol.split,Symbol.toPrimitive,Symbol.toStringTag,Symbol.unscopables,Symbol.dispose,Symbol.asyncDispose].length+x;}'),
  deferred('symbol-toprimitive', 'function f(x){const o={[Symbol.toPrimitive](hint){return hint==="number"?x:String(x);}};return o+1;}'),
  deferred('symbol-tostringtag', 'function f(x){const o={[Symbol.toStringTag]:"Phase3"};return Object.prototype.toString.call(o);}'),
  deferred('symbol-iterator-override', 'function f(x){const a=[x];a[Symbol.iterator]=function(){return {next(){return {value:x,done:true};}}};let n=0;for(const v of a)n+=v;return n;}'),

  deferred('bigint-typeof', 'function f(x){return typeof 1n;}'),
  deferred('bigint-literal', 'function f(x){return 9007199254740993n;}'),
  deferred('bigint-strict-eq-number', 'function f(x){return 1n===1;}'),
  deferred('bigint-add', 'function f(x){return 2n+3n;}'),
  deferred('bigint-sub', 'function f(x){return 5n-2n;}'),
  deferred('bigint-mul', 'function f(x){return 4n*3n;}'),
  deferred('bigint-neg', 'function f(x){return -1n;}'),
  deferred('bigint-compare', 'function f(x){return 2n<3n;}'),
  deferred('bigint-div', 'function f(x){return 8n/3n;}'),
  deferred('bigint-bitwise', 'function f(x){return 7n&3n;}'),
  deferred('bigint-mixed-relational', 'function f(x){return 1n<2;}'),
  deferred('bigint-tobigint-number', 'function f(x){return BigInt(1);}'),
  deferred('bigint-tobigint-string', 'function f(x){return BigInt("1");}'),
  deferred('bigint-json-stringify', 'function f(x){return JSON.stringify(1n);}'),
  deferred('bigint-wrapper', 'function f(x){return typeof Object(1n);}'),
  deferred('bigint-max-limbs', 'function f(x){let a=1n;let i=0;while(i<64){a=a*2n;i++;}return a;}'),
]);
