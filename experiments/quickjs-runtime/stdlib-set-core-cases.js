// Guest fixtures for worker 3 (Set constructor, add/has/delete). Every source
// is one named sync function f(x) returning a primitive. Expected values come
// from native V8 (host oracle only). `requires` names helpers owned by other
// workers / the parent; the parent gates those cases until they are wired.
const one = [3];
export const setCoreCases = [
  // SameValueZero categories.
  { feature: 'SameValueZero-NaN', source: 'function f(x){const s=new Set();s.add(NaN);return s.has(NaN)+":"+s.has(0/0)+":"+s.has(x)+":"+s.has("NaN");}', inputs: [NaN, 3, 'NaN'] },
  { feature: 'SameValueZero-NaN-once', source: 'function f(x){const s=new Set();s.add(NaN).add(x/0*0).add(NaN);let n=0;if(s.delete(NaN))n++;if(s.delete(NaN))n++;return n+":"+s.has(NaN);}', inputs: one },
  { feature: 'SameValueZero-minus-zero', source: 'function f(x){const s=new Set();s.add(-0);return s.has(0)+":"+s.has(-0)+":"+s.has(x)+":"+s.delete(0)+":"+s.has(-0);}', inputs: [0, -0, 3] },
  { feature: 'SameValueZero-minus-zero-delete', source: 'function f(x){const s=new Set([0]);return s.delete(-0)+":"+s.has(0)+":"+s.delete(x);}', inputs: [0, -0] },
  { feature: 'SameValueZero-numbers', source: 'function f(x){const s=new Set([1,0.5,-1.5,1e300,Infinity,-Infinity,5e-324]);return s.has(x)+":"+s.has(x+0)+":"+s.has(-x);}', inputs: [1, 0.5, -1.5, 1e300, Infinity, -Infinity, 5e-324, 2, 1.0000000000000002] },
  { feature: 'SameValueZero-number-vs-string', source: 'function f(x){const s=new Set();s.add(1);s.add("2");return s.has("1")+":"+s.has(2)+":"+s.has(x);}', inputs: [1, '1', 2, '2'] },
  { feature: 'SameValueZero-strings-by-content', source: 'function f(x){const s=new Set();const a="a";s.add(a+"b");s.add("");return s.has("ab")+":"+s.has("a"+"b")+":"+s.has(x)+":"+s.has("")+":"+s.has("AB");}', inputs: ['ab', 'ba', '', 'a'] },
  { feature: 'SameValueZero-surrogate-strings', source: 'function f(x){const s=new Set(["\\uD83D\\uDE00","\\uD83D"]);return s.has("\\uD83D")+":"+s.has("\\uDE00")+":"+s.has("\\uD83D"+"\\uDE00")+":"+s.has(x);}', inputs: ['\uD83D', '\uDE00', '😀'] },
  { feature: 'SameValueZero-symbol-identity', source: 'function f(x){const a=Symbol("k"),b=Symbol("k");const s=new Set();s.add(a);s.add(Symbol.iterator);return s.has(a)+":"+s.has(b)+":"+s.has(Symbol.iterator)+":"+s.has("k")+":"+s.delete(b)+":"+s.delete(a)+":"+s.has(a);}', inputs: one },
  { feature: 'SameValueZero-bigint-by-value', source: 'function f(x){const s=new Set();s.add(10n);s.add(18446744073709551616n);return s.has(10n)+":"+s.has(9n+1n)+":"+s.has(10)+":"+s.has(18446744073709551616n)+":"+s.has(-10n)+":"+s.has(x);}', inputs: [10, 3] },
  { feature: 'SameValueZero-object-identity', source: 'function f(x){const o={v:x},p={v:x};const s=new Set([o]);return s.has(o)+":"+s.has(p)+":"+s.has({v:x})+":"+s.delete(p)+":"+s.delete(o)+":"+s.has(o);}', inputs: one },
  { feature: 'SameValueZero-array-identity', source: 'function f(x){const a=[x];const s=new Set([a]);return s.has(a)+":"+s.has([x])+":"+s.has(x);}', inputs: one },
  { feature: 'SameValueZero-function-identity', source: 'function f(x){function g(){return x;}const h=()=>x;const s=new Set();s.add(g).add(h);return s.has(g)+":"+s.has(h)+":"+s.has(function(){return x;})+":"+s.has(f)+":"+s.has(Math.max);}', inputs: one },
  { feature: 'SameValueZero-wrapper-identity', source: 'function f(x){const w=new String("a");const s=new Set(["a",w]);return s.has("a")+":"+s.has(w)+":"+s.has(new String("a"))+":"+s.has(Object(1))+":"+s.delete("a")+":"+s.has(w);}', inputs: one },
  { feature: 'SameValueZero-undefined-null-boolean', source: 'function f(x){const s=new Set();s.add(undefined);s.add(false);return s.has(undefined)+":"+s.has()+":"+s.has(null)+":"+s.has(false)+":"+s.has(0)+":"+s.has("")+":"+s.has(x);}', inputs: [undefined, null, false, true, 0] },
  { feature: 'add-no-arguments-adds-undefined', source: 'function f(x){const s=new Set();const r=s.add();return (r===s)+":"+s.has(undefined)+":"+s.delete()+":"+s.has(undefined);}', inputs: one },
  { feature: 'has-no-arguments', source: 'function f(x){const s=new Set([null,0,""]);return s.has()+":"+s.delete()+":"+s.has(null);}', inputs: one },
  // add/delete results and ordering.
  { feature: 'add-returns-set-chaining', source: 'function f(x){const s=new Set();const r=s.add(1).add(2).add(1);return (r===s)+":"+s.has(2)+":"+(s.add(x)===s);}', inputs: one },
  { feature: 'delete-results', source: 'function f(x){const s=new Set();s.add(x);return s.delete(x)+":"+s.delete(x)+":"+s.has(x)+":"+s.delete("missing");}', inputs: [1, NaN, -0, 'missing', null, undefined] },
  { feature: 'delete-then-readd', source: 'function f(x){const s=new Set([1,2,3]);const a=s.delete(2);s.add(2);const b=s.delete(2);const c=s.delete(2);s.add(2);return a+":"+b+":"+c+":"+s.has(1)+":"+s.has(2)+":"+s.has(3);}', inputs: one },
  { feature: 'readd-existing-no-duplicate', source: 'function f(x){const s=new Set();for(let i=0;i<20;i++)s.add(i%x);let n=0;for(let i=0;i<20;i++)if(s.delete(i))n++;return n;}', inputs: [1, 3, 7, 20] },
  { feature: 'independent-sets', source: 'function f(x){const a=new Set([x]),b=new Set();b.add("y");a.delete("y");return a.has(x)+":"+b.has(x)+":"+b.has("y")+":"+(a!==b);}', inputs: [1, 'y'] },
  { feature: 'many-values', source: 'function f(x){const s=new Set();for(let i=0;i<200;i++)s.add(i*x);let n=0;for(let i=0;i<400;i++)if(s.has(i))n++;for(let i=0;i<200;i+=2)s.delete(i*x);let m=0;for(let i=0;i<400;i++)if(s.has(i))m++;return n+":"+m;}', inputs: [1, 2, 0.5] },
  { feature: 'borrowed-methods', source: 'function f(x){const s=new Set(),p=Set.prototype;p.add.call(s,x);return p.has.call(s,x)+":"+p.delete.call(s,x)+":"+s.has(x)+":"+p.has.apply(s,[x]);}', inputs: one },
  { feature: 'instance-properties-are-ordinary', source: 'function f(x){const s=new Set([x]);s.foo=x;s.add=5;return s.foo+":"+Object.keys(s).length+":"+Set.prototype.has.call(s,x)+":"+Object.isExtensible(s)+":"+s.hasOwnProperty("add");}', inputs: one },
  { feature: 'insertion-order-forEach', requires: ['setForEach'], source: 'function f(x){const s=new Set();s.add("a");s.add("b");s.add("c");s.add("a");s.delete("b");s.add("b");s.add(x);let r="";s.forEach(function(v){r+=v;});return r;}', inputs: ['a', 'd'] },
  { feature: 'insertion-order-minus-zero-forEach', requires: ['setForEach'], source: 'function f(x){const s=new Set([-0,NaN,1]);s.add(0);s.add(NaN);let r="";s.forEach(function(v){r+=(Object.is(v,-0)?"m":v)+",";});return r;}', inputs: one },
  { feature: 'insertion-order-constructor-forEach', requires: ['setForEach'], source: 'function f(x){const s=new Set([3,1,2,1,3,x]);let r="";s.forEach(function(v){r+=v;});return r;}', inputs: [2, 9] },
  { feature: 'size-after-operations', requires: ['setSize'], source: 'function f(x){const s=new Set([1,2,1,NaN,NaN,-0,0,"1"]);const a=s.size;s.add(x);s.delete(1);return a+":"+s.size;}', inputs: [1, 9, NaN] },
  // Constructor.
  { feature: 'ctor-array-duplicates', source: 'function f(x){const s=new Set([1,2,1,NaN,NaN,-0,0,"1",x]);return s.has(1)+":"+s.has(2)+":"+s.has(NaN)+":"+s.has(0)+":"+s.has("1")+":"+s.has(x)+":"+s.delete(-0)+":"+s.has(0);}', inputs: [1, 7] },
  { feature: 'ctor-array-holes', source: 'function f(x){const s=new Set([1,,x]);return s.has(undefined)+":"+s.has(x);}', inputs: one },
  { feature: 'ctor-empty-iterables', source: 'function f(x){const a=new Set(),b=new Set(undefined),c=new Set(null),d=new Set([]),e=new Set("");return a.has(undefined)+":"+b.has(undefined)+":"+c.has(null)+":"+d.has(undefined)+":"+e.has("")+":"+(a!==b);}', inputs: one },
  { feature: 'ctor-empty-size', requires: ['setSize'], source: 'function f(x){return new Set().size+":"+new Set(undefined).size+":"+new Set(null).size+":"+new Set([]).size+":"+new Set("").size;}', inputs: one },
  { feature: 'ctor-string-code-units', source: 'function f(x){const s=new Set("hello");return s.has("h")+":"+s.has("l")+":"+s.has("o")+":"+s.has("hello")+":"+s.has("ll")+":"+s.has(x);}', inputs: ['e', 'z'] },
  { feature: 'ctor-string-code-points', source: 'function f(x){const s=new Set("a\\uD83D\\uDE00a\\uD83D");return s.has("\\uD83D\\uDE00")+":"+s.has("\\uD83D")+":"+s.has("\\uDE00")+":"+s.has("a");}', inputs: one },
  { feature: 'ctor-string-size', requires: ['setSize'], source: 'function f(x){return new Set("hello").size+":"+new Set("a\\uD83D\\uDE00a\\uD83D").size;}', inputs: one },
  { feature: 'ctor-string-wrapper', source: 'function f(x){const s=new Set(new String("ab"));return s.has("a")+":"+s.has("b")+":"+s.has("ab");}', inputs: one },
  { feature: 'ctor-arguments', source: 'function f(x){function g(){return new Set(arguments);}const s=g(x,x,1,"1");return s.has(x)+":"+s.has(1)+":"+s.has("1")+":"+s.has(2);}', inputs: [1, 2] },
  { feature: 'ctor-patched-add-observed', source: 'function f(x){const p=Set.prototype,orig=p.add;let log="";p.add=function(v){log+=v+",";return orig.call(this,v);};const s=new Set([1,2,1,x]);p.add=orig;return log+":"+s.has(1)+":"+s.has(x);}', inputs: [3, 1] },
  { feature: 'ctor-patched-add-receiver-and-result-ignored', source: 'function f(x){const p=Set.prototype,orig=p.add;let seen=null;p.add=function(v){seen=this;orig.call(this,v*2);return 5;};const s=new Set([x]);p.add=orig;return (seen===s)+":"+s.has(x*2)+":"+s.has(x)+":"+(s instanceof Set);}', inputs: [3] },
  { feature: 'ctor-add-getter-once', source: 'function f(x){const p=Set.prototype,orig=p.add;let gets=0;Object.defineProperty(p,"add",{configurable:true,get:function(){gets++;return orig;}});new Set([1,2,3]);new Set(null);new Set();new Set([]);Object.defineProperty(p,"add",{configurable:true,writable:true,value:orig});return gets;}', inputs: one },
  { feature: 'ctor-array-grows-during-iteration', source: 'function f(x){const p=Set.prototype,orig=p.add;const a=[1,2];let log="";p.add=function(v){log+=v;if(v<x)a.push(v+2);return orig.call(this,v);};const s=new Set(a);p.add=orig;return log+":"+s.has(4);}', inputs: [3, 1] },
  { feature: 'ctor-non-callable-add', source: 'function f(x){const p=Set.prototype,orig=p.add;p.add=x;let r="";try{new Set([1]);r+="bad";}catch(e){r+=e instanceof TypeError;}try{new Set([]);r+="bad";}catch(e){r+=e instanceof TypeError;}const ok=new Set(null);p.add=orig;return r+":"+(ok instanceof Set);}', inputs: [1, 'add', null, undefined] },
  { feature: 'ctor-adder-throws', source: 'function f(x){const p=Set.prototype,orig=p.add;let n=0;p.add=function(v){n++;if(v===2)throw x;return orig.call(this,v);};let r;try{new Set([1,2,3]);r="bad";}catch(e){r=e===x;}p.add=orig;return r+":"+n;}', inputs: one },
  // Temporary constructor pre-check (__lanesIterationKind 0): non-iterable
  // values and non-callable @@iterator are catchable spec TypeErrors.
  { feature: 'ctor-non-iterable-TypeError', source: 'function f(x){let r="";try{new Set(x);r+="no throw";}catch(e){r+=e instanceof TypeError;}return r;}', inputs: [5, 0, NaN, true, false, -0] },
  { feature: 'ctor-non-iterable-objects-TypeError', source: 'function f(x){const v=[{},{length:2,0:x,1:x},Symbol("s"),10n,function(){},Object.create(null),new Number(x),Math];let n=0;for(let i=0;i<v.length;i++){try{new Set(v[i]);}catch(e){if(e instanceof TypeError)n++;}}return n;}', inputs: one },
  { feature: 'ctor-non-callable-iterator-TypeError', source: 'function f(x){const v=[{[Symbol.iterator]:x},{[Symbol.iterator]:null},{[Symbol.iterator]:undefined},{[Symbol.iterator]:"f"},{[Symbol.iterator]:{}},Object.create({[Symbol.iterator]:x})];let n=0;for(let i=0;i<v.length;i++){try{new Set(v[i]);}catch(e){if(e instanceof TypeError)n++;}}return n;}', inputs: [1, 'x', true] },
  { feature: 'ctor-iterator-get-after-add-get', source: 'function f(x){const p=Set.prototype,orig=p.add;let log="";Object.defineProperty(p,"add",{configurable:true,get:function(){log+="a";return orig;}});const o={get [Symbol.iterator](){log+="i";return x;}};let r;try{new Set(o);r="no throw";}catch(e){r=e instanceof TypeError;}Object.defineProperty(p,"add",{configurable:true,writable:true,value:orig});return log+":"+r;}', inputs: [1, null, undefined] },
  { feature: 'ctor-non-iterable-after-non-callable-add', source: 'function f(x){const p=Set.prototype,orig=p.add;let log="";p.add=1;const o={get [Symbol.iterator](){log+="i";return undefined;}};let r;try{new Set(o);r="no throw";}catch(e){r=e instanceof TypeError;}p.add=orig;return log+":"+r;}', inputs: one },
  { feature: 'ctor-without-new-TypeError', source: 'function f(x){let n=0;try{Set();}catch(e){if(e instanceof TypeError)n++;}try{Set([x]);}catch(e){if(e instanceof TypeError)n++;}try{Set.call(new Set());}catch(e){if(e instanceof TypeError)n++;}return n;}', inputs: one },
  // Brand checks.
  { feature: 'brand-checks-plain', source: 'function f(x){const p=Set.prototype;let n=0;const r=[{},[],null,undefined,1,"s",p,function(){},Set];for(let i=0;i<r.length;i++){try{p.has.call(r[i],x);}catch(e){if(e instanceof TypeError)n++;}try{p.add.call(r[i],x);}catch(e){if(e instanceof TypeError)n++;}try{p.delete.call(r[i],x);}catch(e){if(e instanceof TypeError)n++;}}return n;}', inputs: one },
  { feature: 'brand-checks-object-with-set-proto', source: 'function f(x){const o=Object.create(Set.prototype);let n=0;try{o.add(x);}catch(e){if(e instanceof TypeError)n++;}try{o.has(x);}catch(e){if(e instanceof TypeError)n++;}return n+":"+(o instanceof Set);}', inputs: one },
  { feature: 'brand-checks-map', requires: ['mapConstruct'], source: 'function f(x){const p=Set.prototype,m=new Map();let n=0;try{p.has.call(m,x);}catch(e){if(e instanceof TypeError)n++;}try{p.add.call(m,x);}catch(e){if(e instanceof TypeError)n++;}try{p.delete.call(m,x);}catch(e){if(e instanceof TypeError)n++;}return n;}', inputs: one },
  // Metadata.
  { feature: 'Set-length-name', source: 'function f(x){return Set.length+":"+Set.name+":"+typeof Set;}', inputs: one },
  { feature: 'method-length-name', source: 'function f(x){const p=Set.prototype;return p.add.name+p.add.length+":"+p.has.name+p.has.length+":"+p.delete.name+p.delete.length;}', inputs: one },
  { feature: 'method-descriptors', source: 'function f(x){let r="";const k=["add","has","delete"];for(let i=0;i<3;i++){const d=Object.getOwnPropertyDescriptor(Set.prototype,k[i]);r+=d.writable+","+d.enumerable+","+d.configurable+","+typeof d.value+";";}return r;}', inputs: one },
  { feature: 'prototype-descriptor', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Set,"prototype"),c=Object.getOwnPropertyDescriptor(Set.prototype,"constructor");return d.writable+":"+d.enumerable+":"+d.configurable+":"+c.writable+":"+c.enumerable+":"+c.configurable+":"+(c.value===Set);}', inputs: one },
  { feature: 'toStringTag', requires: ['setToStringTag'], source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Set.prototype,Symbol.toStringTag);return Object.prototype.toString.call(new Set([x]))+":"+d.value+":"+d.writable+":"+d.enumerable+":"+d.configurable+":"+Object.prototype.toString.call(Set.prototype);}', inputs: one },
  { feature: 'prototype-constructor-identity', source: 'function f(x){const s=new Set();return (Object.getPrototypeOf(s)===Set.prototype)+":"+(Set.prototype.constructor===Set)+":"+(Object.getPrototypeOf(Set.prototype)===Object.prototype)+":"+(Object.getPrototypeOf(Set)===Function.prototype)+":"+(s.constructor===Set)+":"+(Set.prototype.add===s.add);}', inputs: one },
  { feature: 'instanceof-typeof', source: 'function f(x){const s=new Set([x]);return (s instanceof Set)+":"+(s instanceof Object)+":"+({} instanceof Set)+":"+typeof s+":"+(Set.prototype instanceof Set);}', inputs: one },
  // Heap reclamation.
  { feature: 'GC-retained-set-across-collections', source: 'function f(x){const keep={k:x};const s=new Set([keep,"str",x]);let junk=0;for(let i=0;i<3000;i++){const o={i:i,t:[i]};junk+=o.t.length;}return s.has(keep)+":"+s.has("str")+":"+s.has(x)+":"+keep.k+":"+junk;}', inputs: one },
  { feature: 'GC-delete-readd-fresh-objects', gc: true, source: 'function f(x){const s=new Set();const keep={};s.add(keep);let k=0;for(let i=0;i<3000;i++){const o={i:i};s.add(o);if(s.has(o))k++;if(s.delete(o))k++;s.add(o);s.delete(o);}s.add(x);return k+":"+s.has(keep)+":"+s.has(x)+":"+s.has({});}', inputs: one },
  { feature: 'GC-delete-readd-primitives', gc: true, source: 'function f(x){const s=new Set([x]);let k=0;for(let i=0;i<3000;i++){s.add(i);if(s.delete(i))k++;}return k+":"+s.has(x)+":"+s.has(2999);}', inputs: [3, -1] },
];

// Explicit boundaries: the helper's language for-of over an object with
// a callable @@iterator in its chain (Set/Map instances, user iterables)
// reaches __lanesUnsupported (status 6, host
// rejection, never a guest catch). Subclass NewTarget stays status 6.
export const setCoreUnsupportedSources = [
  'function f(x){try{return new Set(new Set([x])).has(x);}catch(e){return "wrong guest catch";}}',
  'function f(x){try{return new Set(new Map([[x,1]])).has(x);}catch(e){return "wrong guest catch";}}',
  'function f(x){try{const it={[Symbol.iterator]:function(){let i=0;return {next:function(){i++;return {done:i>2,value:i};}};}};return new Set(it).has(1);}catch(e){return "wrong guest catch";}}',
  'function f(x){try{class S extends Set{}return new S([x]).has(x);}catch(e){return "wrong guest catch";}}',
];

// Guest callbacks/getters during construction: Get(set,"add") through an
// accessor (observed once per construction), adder calls per element in array
// order, then a second construction with the restored data property.
export const setCoreResumptionSource = 'function f(x){let log="";const p=Set.prototype,orig=p.add;Object.defineProperty(p,"add",{configurable:true,get:function(){log+="g";return function(v){log+="<"+v+">";return orig.call(this,v+x);};}});const s=new Set(["a","b","a"]);Object.defineProperty(p,"add",{configurable:true,writable:true,value:orig});const t=new Set([x,x]);return log+":"+s.has("a3")+":"+s.has("b3")+":"+s.has("a")+":"+t.has(x)+":"+s.delete("a3")+":"+s.has("a3");}';
export const setCoreResumptionInput = 3;
export const setCoreResumptionExpected = 'g<a><b><a>:true:true:false:true:true:false';

// Original sources remain required value cases now generic iteration is integrated.
export const setCoreUnsupportedPostMergeExpected=Object.freeze([true,false,true]);
