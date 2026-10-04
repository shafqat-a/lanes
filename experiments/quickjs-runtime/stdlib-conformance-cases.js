// Standard-library wave, worker 8: independent ES2025 conformance fixtures for
// Map, Set, collection iterators, Reflect, numeric globals and their
// cross-feature interactions. Written from the ES2025 specification text
// (24.1 Map, 24.2 Set, 24.1.5/24.2.6 iterator prototypes, 28.1 Reflect,
// 19.2.2/19.2.3 isFinite/isNaN, 21.3 Math), not from the other workers' helpers.
//
// Record format:
//   { id, group: 'map'|'set'|'iterator'|'reflect'|'numeric'|'cross',
//     source: 'function f(x){...}'   one named sync function, one input, primitive result,
//     inputs: [...],                 primitives only (Number/Boolean/String/null/undefined),
//     expected?: [...],              ONLY where native V8/JSC disagrees with ES2025 or lacks the feature;
//                                    every override carries `specNote` (checked by check-stdlib-conformance.mjs),
//     specNote?: '...',
//     orderSensitive?: true,         result depends on intrinsic property creation order, which ES2025 leaves
//                                    to the implementation (the runtime installs in registry order);
//                                    a mismatch is a reported disagreement, never a pass,
//     requires?: [...names],         dependencies outside this wave; the suite's `features` list must contain them,
//     requiresGenericIteration?: true,
//     requiredGC?: true }            the run must report collections > 0.
//
// Results never return Symbols, BigInts or objects (they cannot cross the host boundary).

// Shared helper text: allocates ~5 heap nodes per iteration (object, two
// properties, array, element). 600 iterations exceed the 2048-node heap, so at
// least one collection must happen at an instruction boundary.
export const CHURN = 'function churn(n){let t;for(let i=0;i<n;i++){t={a:i,b:[i,"s"+i]};}return t.a;}';

// ES2025 24.1.3: Map.prototype property clauses (alphabetical in the spec).
// ES2025 does not specify the creation order of intrinsic properties; the
// clause order is used as the reference order for the order-sensitive probe.
const MAP_PROTO_ES2025 = 'clear,constructor,delete,entries,forEach,get,has,keys,set,size,values,Symbol(Symbol.iterator),Symbol(Symbol.toStringTag)';
const keyList = 'k=>typeof k==="symbol"?String(k):k';

export const stdlibConformanceCases = [
  // ---------------------------------------------------------------- map
  { id: 'map-set-get-size', group: 'map', source: 'function f(x){const m=new Map();m.set(x,"a").set(x+1,"b");return m.get(x)+m.get(x+1)+m.size;}', inputs: [1, 's', NaN, -0, Infinity] },
  { id: 'map-samevaluezero-zero-normalized', group: 'map', source: 'function f(x){const m=new Map();m.set(-0,"z");let neg=0;m.forEach((v,k)=>{if(Object.is(k,-0))neg++;});return m.get(0)+m.get(x)+neg+m.size;}', inputs: [0, -0] },
  { id: 'map-samevaluezero-nan', group: 'map', source: 'function f(x){const m=new Map([[NaN,1]]);m.set(0/0,2);return m.get(x)+":"+m.size+":"+m.has(Number("z"));}', inputs: [NaN, 0, 'NaN'] },
  { id: 'map-type-distinct-keys', group: 'map', source: 'function f(x){const m=new Map([[1,"n"],["1","s"],[true,"b"],[null,"z"],[undefined,"u"]]);return m.get(x)+":"+m.size;}', inputs: [1, '1', true, null, undefined, 0] },
  { id: 'map-object-key-identity', group: 'map', source: 'function f(x){const a={},b={};const m=new Map([[a,x],[b,x+1]]);return m.get(a)+":"+m.get(b)+":"+m.has({})+":"+m.size;}', inputs: [1, 'q'] },
  { id: 'map-set-returns-receiver', group: 'map', source: 'function f(x){const m=new Map();return (m.set(x,1)===m)+":"+(m.set(x,2)===m)+":"+m.get(x);}', inputs: [3] },
  { id: 'map-delete-results', group: 'map', source: 'function f(x){const m=new Map([[x,1],[2,2]]);return m.delete(x)+":"+m.delete(x)+":"+m.size+":"+m.has(x)+":"+m.get(x);}', inputs: [1, 'k', NaN] },
  { id: 'map-clear-returns-undefined', group: 'map', source: 'function f(x){const m=new Map([[1,1],[x,2]]);const r=m.clear();return String(r)+":"+m.size+":"+m.has(1);}', inputs: [5] },
  { id: 'map-update-keeps-position', group: 'map', source: 'function f(x){const m=new Map();m.set("a",1).set("b",2).set("c",3);m.set("a",x);let s="";m.forEach((v,k)=>{s+=k+v;});return s;}', inputs: [9, 'z'] },
  { id: 'map-delete-reinsert-appends', group: 'map', source: 'function f(x){const m=new Map([["a",1],["b",2]]);m.delete("a");m.set("a",x);let s="";m.forEach((v,k)=>{s+=k+v;});return s;}', inputs: [7] },
  { id: 'map-forEach-arguments-and-thisArg', group: 'map', source: 'function f(x){"use strict";const m=new Map([[x,"v"]]);const t={};let r="";m.forEach(function(v,k,map){r+=v+":"+k+":"+(map===m)+":"+(this===t)+":"+arguments.length;},t);return r;}', inputs: [1, 'k'] },
  { id: 'map-forEach-live-mutation', group: 'map', source: 'function f(x){const m=new Map([["a",1],["b",2],["c",3]]);let s="";m.forEach((v,k)=>{s+=k;if(k==="a"){m.delete("b");m.set("d",x);}if(k==="c"){m.delete("a");m.set("a",0);}});return s+":"+m.size;}', inputs: [4] },
  { id: 'map-forEach-noncallable-before-iteration', group: 'map', source: 'function f(x){const m=new Map([[1,1]]);try{m.forEach(x);}catch(e){return e instanceof TypeError;}return "no throw";}', inputs: [3, null, 'f'] },
  { id: 'map-forEach-callback-throw-propagates', group: 'map', source: 'function f(x){const m=new Map([[1,1],[2,2]]);let n=0;try{m.forEach(()=>{n++;throw x;});}catch(e){return e+":"+n;}return "none";}', inputs: [7, 'e'] },
  { id: 'map-ctor-array-entries', group: 'map', source: 'function f(x){const m=new Map([[x,1],[x,2],[0,3]]);return m.get(x)+":"+m.size;}', inputs: [5, 0, -0] },
  { id: 'map-ctor-entry-not-object', group: 'map', source: 'function f(x){try{new Map([x]);}catch(e){return e instanceof TypeError;}return "no throw";}', inputs: [1, 'ab', null, undefined, true] },
  { id: 'map-ctor-short-entry', group: 'map', source: 'function f(x){const m=new Map([[x]]);return m.has(x)+":"+m.get(x)+":"+m.size;}', inputs: [3] },
  { id: 'map-ctor-nullish-iterable', group: 'map', source: 'function f(x){return new Map(x).size+new Map().size;}', inputs: [null, undefined] },
  { id: 'map-call-without-new', group: 'map', source: 'function f(x){try{Map();}catch(e){return e instanceof TypeError;}return "no throw";}', inputs: [3] },
  { id: 'map-ctor-entry-getter-order', group: 'map', source: 'function f(x){let log="";const e={get 0(){log+="k";return x;},get 1(){log+="v";return 2;}};const m=new Map([e,{get 0(){log+="K";return x+1;},get 1(){log+="V";return 3;}}]);return log+":"+m.get(x)+m.get(x+1);}', inputs: [1] },
  { id: 'map-ctor-entry-getter-throws', group: 'map', source: 'function f(x){let log="";const bad={get 0(){log+="k";throw x;},get 1(){log+="v";return 1;}};try{new Map([[1,1],bad,[2,2]]);}catch(e){return log+":"+e;}return "none";}', inputs: [9, 'thrown'] },
  { id: 'map-ctor-uses-observable-set', group: 'map', source: 'function f(x){const orig=Map.prototype.set;let n=0;Map.prototype.set=function(k,v){n++;return orig.call(this,k,v+1);};let m;try{m=new Map([[x,1],[2,2]]);}finally{Map.prototype.set=orig;}return n+":"+m.get(x)+":"+(Map.prototype.set===orig);}', inputs: [1] },
  { id: 'map-ctor-noncallable-set', group: 'map', source: 'function f(x){const orig=Map.prototype.set;Map.prototype.set=x;let r;try{new Map([]);r="no throw";}catch(e){r=e instanceof TypeError;}const ok=new Map().size;Map.prototype.set=orig;return r+":"+ok;}', inputs: [3, null, 'set'] },
  { id: 'map-metadata', group: 'map', source: 'function f(x){const g=Object.getOwnPropertyDescriptor(Map.prototype,"size").get;return Map.length+":"+Map.name+":"+Map.prototype.set.length+":"+Map.prototype.get.length+":"+Map.prototype.forEach.length+":"+g.name+":"+g.length+":"+Map.prototype.entries.name+":"+Map.prototype[Symbol.iterator].name;}', inputs: [3] },
  { id: 'map-prototype-descriptors', group: 'map', source: 'function f(x){const p=Object.getOwnPropertyDescriptor(Map,"prototype"),s=Object.getOwnPropertyDescriptor(Map.prototype,"size"),g=Object.getOwnPropertyDescriptor(Map.prototype,"get"),c=Object.getOwnPropertyDescriptor(Map.prototype,"constructor");return [p.writable,p.enumerable,p.configurable,typeof s.get,s.set,s.enumerable,s.configurable,g.writable,g.enumerable,g.configurable,c.value===Map,c.enumerable].join();}', inputs: [3] },
  { id: 'map-brand-checks', group: 'map', source: 'function f(x){let n=0;const tries=[()=>Map.prototype.get.call({},x),()=>Map.prototype.set.call(new Set(),x,1),()=>Map.prototype.has.call(x,1),()=>Map.prototype.forEach.call([],()=>0),()=>Map.prototype.clear.call(Object.create(Map.prototype)),()=>Map.prototype.delete.call(Map.prototype,1)];for(const t of tries){try{t();}catch(e){if(e instanceof TypeError)n++;}}return n;}', inputs: [3, 'x'] },
  { id: 'map-size-on-prototype-throws', group: 'map', source: 'function f(x){try{return Map.prototype.size;}catch(e){return e instanceof TypeError;}}', inputs: [3] },
  { id: 'map-iterator-alias', group: 'map', source: 'function f(x){return (Map.prototype[Symbol.iterator]===Map.prototype.entries)+":"+(Map.prototype.keys!==Map.prototype.values);}', inputs: [3] },
  { id: 'map-es2026-upsert-absent', group: 'map', source: 'function f(x){return typeof Map.prototype.getOrInsert+":"+typeof Map.prototype.getOrInsertComputed;}', inputs: [3], expected: ['undefined:undefined'], specNote: 'ES2025 24.1.3 defines no getOrInsert/getOrInsertComputed (upsert proposal is post-ES2025); V8 ≥ 14 ships them, so the native oracle disagrees.' },

  // ---------------------------------------------------------------- set
  { id: 'set-add-has-size', group: 'set', source: 'function f(x){const s=new Set();s.add(x).add(x).add(x+1);return s.has(x)+":"+s.has(x+1)+":"+s.size;}', inputs: [1, 'a', NaN, -0] },
  { id: 'set-samevaluezero', group: 'set', source: 'function f(x){const s=new Set([NaN,0/0,0,-0,x]);let neg=0;s.forEach(v=>{if(Object.is(v,-0))neg++;});return s.size+":"+neg+":"+s.has(-0);}', inputs: [0, -0, NaN, 1] },
  { id: 'set-add-returns-receiver', group: 'set', source: 'function f(x){const s=new Set();return (s.add(x)===s)+":"+s.size;}', inputs: [3] },
  { id: 'set-delete-clear', group: 'set', source: 'function f(x){const s=new Set([x,2,3]);const a=s.delete(x),b=s.delete(x);const c=s.clear();return a+":"+b+":"+String(c)+":"+s.size;}', inputs: [1, 'z'] },
  { id: 'set-ctor-string-iterable', group: 'set', source: 'function f(x){return new Set(x).size;}', inputs: ['abca', '', 'xyz'] },
  { id: 'set-ctor-uses-observable-add', group: 'set', source: 'function f(x){const orig=Set.prototype.add;let log="";Set.prototype.add=function(v){log+=v;return orig.call(this,v);};let s;try{s=new Set([x,2,x]);}finally{Set.prototype.add=orig;}return log+":"+s.size;}', inputs: [1] },
  { id: 'set-ctor-noncallable-add', group: 'set', source: 'function f(x){const orig=Set.prototype.add;Set.prototype.add=x;let r;try{new Set([]);r="no throw";}catch(e){r=e instanceof TypeError;}Set.prototype.add=orig;return r;}', inputs: [3, undefined] },
  { id: 'set-insertion-order', group: 'set', source: 'function f(x){const s=new Set(["b","a"]);s.add("c");s.add("b");s.delete("a");s.add("a");let r="";s.forEach((v,k,set)=>{r+=v+(v===k)+(set===s);});return r;}', inputs: [3] },
  { id: 'set-iterator-aliases', group: 'set', source: 'function f(x){return (Set.prototype.keys===Set.prototype.values)+":"+(Set.prototype[Symbol.iterator]===Set.prototype.values)+":"+Set.prototype.keys.name;}', inputs: [3] },
  { id: 'set-metadata', group: 'set', source: 'function f(x){const g=Object.getOwnPropertyDescriptor(Set.prototype,"size").get;return [Set.length,Set.name,Set.prototype.add.length,Set.prototype.union.length,Set.prototype.isSubsetOf.length,Set.prototype.forEach.length,g.name].join();}', inputs: [3] },
  { id: 'set-union-order', group: 'set', source: 'function f(x){const u=new Set([1,2,3]).union(new Set([x,2,9]));let r="";u.forEach(v=>{r+=v+",";});return r+u.size;}', inputs: [4, 1] },
  { id: 'set-intersection-this-smaller', group: 'set', source: 'function f(x){const r=new Set([3,1,2]).intersection(new Set([2,3,4,5,x]));let s="";r.forEach(v=>{s+=v;});return s;}', inputs: [1, 6] },
  { id: 'set-intersection-other-smaller', group: 'set', source: 'function f(x){const r=new Set([1,2,3,4]).intersection(new Set([3,x]));let s="";r.forEach(v=>{s+=v;});return s;}', inputs: [1, 9] },
  { id: 'set-difference-symmetric', group: 'set', source: 'function f(x){const a=new Set([1,2,3]),b=new Set([2,x]);let d="",y="";a.difference(b).forEach(v=>{d+=v;});a.symmetricDifference(b).forEach(v=>{y+=v;});return d+":"+y;}', inputs: [4, 3] },
  { id: 'set-predicates', group: 'set', source: 'function f(x){const a=new Set([1,2]),b=new Set([1,2,x]);return [a.isSubsetOf(b),b.isSupersetOf(a),a.isDisjointFrom(new Set([x])),b.isSubsetOf(a)].join();}', inputs: [3, 1] },
  { id: 'set-result-is-fresh', group: 'set', source: 'function f(x){const a=new Set([x]);const u=a.union(a);return (u!==a)+":"+(Object.getPrototypeOf(u)===Set.prototype)+":"+u.size;}', inputs: [3] },
  { id: 'set-like-record-order', group: 'set', source: 'function f(x){let log="";const o={get size(){log+="s";return x;},get has(){log+="h";return ()=>false;},get keys(){log+="k";return ()=>({next(){return {done:true};}});}};new Set([1]).union(o);return log;}', inputs: [2, 0] },
  { id: 'set-like-invalid-size', group: 'set', source: 'function f(x){try{new Set([1]).union({size:x,has(){return true;},keys(){return {next(){return {done:true};}};}});}catch(e){return e.name;}return "ok";}', inputs: [NaN, undefined, -1, 'abc', 2] },
  { id: 'set-like-noncallable-methods', group: 'set', source: 'function f(x){let r="";try{new Set().union({size:1,has:x,keys(){}});}catch(e){r+=e.name;}try{new Set().union({size:1,has(){},keys:x});}catch(e){r+=e.name;}return r;}', inputs: [1, null] },
  { id: 'set-isSubsetOf-early-size-exit', group: 'set', source: 'function f(x){let n=0;const r=new Set([1,2,3]).isSubsetOf({size:x,has(){n++;return true;},keys(){return {next(){return {done:true};}};}});return r+":"+n;}', inputs: [2, 3] },
  { id: 'set-difference-live-receiver', group: 'set', source: 'function f(x){const a=new Set([1,2,3]);const d=a.difference({size:5,has(v){if(v===1)a.delete(2);return v===x;},keys(){}});let s="";d.forEach(v=>{s+=v;});return s+":"+a.size;}', inputs: [3, 9] },
  { id: 'set-isDisjointFrom-other-keys', group: 'set', source: 'function f(x){let calls=0;const o={size:1,has(){return false;},keys(){return {next(){calls++;return calls>1?{done:true}:{value:x,done:false};}};}};return new Set([1,2,3]).isDisjointFrom(o)+":"+calls;}', inputs: [2, 7] },
  { id: 'set-brand-checks', group: 'set', source: 'function f(x){let n=0;for(const t of [()=>Set.prototype.add.call(new Map(),x),()=>Set.prototype.has.call({},x),()=>Set.prototype.union.call([],new Set()),()=>Set.prototype.size]){try{t();}catch(e){if(e instanceof TypeError)n++;}}return n;}', inputs: [3] },

  // ---------------------------------------------------------------- iterator (explicit next() only)
  { id: 'iter-map-entries-next', group: 'iterator', source: 'function f(x){const m=new Map([[x,"v"]]);const it=m.entries();const a=it.next(),b=it.next();return a.value[0]+":"+a.value[1]+":"+a.done+":"+a.value.length+":"+b.done+":"+b.value;}', inputs: [1, 'k'] },
  { id: 'iter-map-keys-values', group: 'iterator', source: 'function f(x){const m=new Map([["a",x],["b",x+1]]);const k=m.keys(),v=m.values();return k.next().value+v.next().value+k.next().value+v.next().value+k.next().done;}', inputs: [1] },
  { id: 'iter-set-entries-pair', group: 'iterator', source: 'function f(x){const r=new Set([x]).entries().next().value;return (r[0]===r[1])+":"+r[0]+":"+Array.isArray(r);}', inputs: [3, 'q'] },
  { id: 'iter-exhausted-stays-done', group: 'iterator', source: 'function f(x){const m=new Map([[1,1]]);const it=m.keys();it.next();const d=it.next().done;m.set(x,2);return d+":"+it.next().done+":"+String(it.next().value);}', inputs: [2] },
  { id: 'iter-visits-appended', group: 'iterator', source: 'function f(x){const s=new Set([1]);const it=s.values();let r=""+it.next().value;s.add(x);r+=it.next().value;return r+it.next().done;}', inputs: [2] },
  { id: 'iter-skips-deleted-unvisited', group: 'iterator', source: 'function f(x){const s=new Set([1,2,3]);const it=s.values();let r=""+it.next().value;s.delete(2);s.delete(1);r+=it.next().value+":"+it.next().done;return r+":"+x;}', inputs: [0] },
  { id: 'iter-continues-after-clear-add', group: 'iterator', source: 'function f(x){const m=new Map([["a",1],["b",2]]);const it=m.keys();const first=it.next().value;m.clear();m.set(x,3);const n=it.next();return first+":"+n.value+":"+n.done+":"+it.next().done;}', inputs: ['z', 4] },
  { id: 'iter-unstarted-after-clear', group: 'iterator', source: 'function f(x){const m=new Map([["a",1]]);const it=m.values();m.clear();m.set("b",x);return it.next().value+":"+it.next().done;}', inputs: [5] },
  { id: 'iter-toStringTag', group: 'iterator', source: 'function f(x){const t=Object.prototype.toString;return t.call(new Map().keys())+t.call(new Set().values())+t.call(Object.getPrototypeOf(new Map().entries()));}', inputs: [3] },
  { id: 'iter-next-brand-checks', group: 'iterator', source: 'function f(x){const mn=new Map().keys().next,sn=new Set().values().next;let n=0;for(const t of [()=>mn.call({}),()=>mn.call(new Set().values()),()=>sn.call(new Map().keys()),()=>sn.call(x)]){try{t();}catch(e){if(e instanceof TypeError)n++;}}return n;}', inputs: [3] },
  { id: 'iter-prototype-sharing', group: 'iterator', source: 'function f(x){const m=new Map(),s=new Set(),P=Object.getPrototypeOf;return (P(m.keys())===P(m.entries()))+":"+(P(m.values())===P(m[Symbol.iterator]()))+":"+(P(s.keys())===P(s.entries()))+":"+(P(m.keys())!==P(s.keys()));}', inputs: [3] },
  { id: 'iter-next-metadata', group: 'iterator', source: 'function f(x){const n=Object.getPrototypeOf(new Map().keys()).next,d=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(new Set().keys()),"next");return n.name+":"+n.length+":"+d.writable+d.enumerable+d.configurable;}', inputs: [3] },
  { id: 'iter-result-objects-fresh', group: 'iterator', source: 'function f(x){const m=new Map([[1,2],[3,4]]);const it=m.entries();const a=it.next(),b=it.next();a.value[0]=x;return (a!==b)+":"+(a.value!==b.value)+":"+m.get(1)+":"+m.has(x)+":"+Object.keys(a).join("");}', inputs: [9] },
  { id: 'iter-inherits-IteratorPrototype', group: 'iterator', source: 'function f(x){const IP=Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));const it=new Map().keys();return (Object.getPrototypeOf(Object.getPrototypeOf(it))===IP)+":"+(it[Symbol.iterator]()===it);}', inputs: [3], requires: ['%IteratorPrototype%'] },

  // ---------------------------------------------------------------- reflect
  { id: 'reflect-apply-map-get', group: 'reflect', source: 'function f(x){const m=new Map([[x,"hit"]]);return Reflect.apply(Map.prototype.get,m,[x])+":"+Reflect.apply(Map.prototype.has,m,[x+1]);}', inputs: [1, 'k'] },
  { id: 'reflect-apply-set-has-brand', group: 'reflect', source: 'function f(x){try{Reflect.apply(Set.prototype.has,new Map([[x,1]]),[x]);}catch(e){return e instanceof TypeError;}return "no throw";}', inputs: [3] },
  { id: 'reflect-construct-map', group: 'reflect', source: 'function f(x){const m=Reflect.construct(Map,[]);const n=Reflect.construct(Map,[[[x,2]]]);return m.size+":"+(m instanceof Map)+":"+n.get(x)+":"+(Object.getPrototypeOf(n)===Map.prototype);}', inputs: [1] },
  { id: 'reflect-construct-set', group: 'reflect', source: 'function f(x){const s=Reflect.construct(Set,[[x,x,1]]);return s.size+":"+s.has(x);}', inputs: [1, 2] },
  { id: 'reflect-get-size-receiver', group: 'reflect', source: 'function f(x){const m=new Map([[1,1],[x,2]]);return Reflect.get(Map.prototype,"size",m)+":"+Reflect.get(Set.prototype,"size",new Set([x]));}', inputs: [2, 1] },
  { id: 'reflect-get-size-bad-receiver', group: 'reflect', source: 'function f(x){let r="";for(const recv of [undefined,{},new Set()]){try{Reflect.get(Map.prototype,"size",recv);r+="n";}catch(e){r+=e instanceof TypeError?"T":"?";}}return r;}', inputs: [3] },
  { id: 'reflect-has-and-ownKeys-instance', group: 'reflect', source: 'function f(x){const m=new Map([[x,1]]);const before=Reflect.ownKeys(m).length;Reflect.defineProperty(m,"tag",{value:x,enumerable:true});return Reflect.has(m,"size")+":"+Reflect.has(m,"get")+":"+Reflect.has(m,x)+":"+before+":"+Reflect.ownKeys(m).join()+":"+m.tag;}', inputs: [1, 'k'] },
  { id: 'reflect-set-size-false', group: 'reflect', source: 'function f(x){const m=new Map([[1,1]]);return Reflect.set(m,"size",x)+":"+m.size+":"+Object.prototype.hasOwnProperty.call(m,"size");}', inputs: [5] },
  { id: 'reflect-prototype-ops', group: 'reflect', source: 'function f(x){const m=new Map([[x,"v"]]);const a=Reflect.getPrototypeOf(m)===Map.prototype;Reflect.setPrototypeOf(m,null);return a+":"+Map.prototype.get.call(m,x)+":"+Reflect.getPrototypeOf(m)+":"+(m.get===undefined);}', inputs: [1] },
  { id: 'reflect-prevent-extensions-keeps-slots', group: 'reflect', source: 'function f(x){const m=new Map();const p=Reflect.preventExtensions(m);m.set(x,1);return p+":"+Reflect.isExtensible(m)+":"+m.size+":"+Reflect.defineProperty(m,"y",{value:1});}', inputs: [3] },
  { id: 'reflect-toStringTag-descriptor', group: 'reflect', source: 'function f(x){const d=Reflect.getOwnPropertyDescriptor(Map.prototype,Symbol.toStringTag),e=Reflect.getOwnPropertyDescriptor(Set.prototype,Symbol.toStringTag);return d.value+d.writable+d.enumerable+d.configurable+":"+e.value;}', inputs: [3] },
  { id: 'reflect-ownKeys-map-prototype-set', group: 'reflect', source: 'function f(x){const k=Reflect.ownKeys(Map.prototype).map(' + keyList + ');const s=k.filter(v=>v.slice(0,7)!=="Symbol(").sort(),y=k.filter(v=>v.slice(0,7)==="Symbol(").sort();return s.concat(y).join();}', inputs: [3], expected: [MAP_PROTO_ES2025], specNote: 'ES2025 24.1.3 lists exactly clear, constructor, delete, entries, forEach, get, has, keys, set, size, values, @@iterator, @@toStringTag. V8 ≥ 14 adds getOrInsert/getOrInsertComputed (post-ES2025 upsert), so the native oracle disagrees.' },
  { id: 'reflect-ownKeys-map-prototype-order', group: 'reflect', source: 'function f(x){return Reflect.ownKeys(Map.prototype).map(' + keyList + ').join();}', inputs: [3], expected: [MAP_PROTO_ES2025], orderSensitive: true, specNote: 'ES2025 does not specify the creation order of intrinsic properties; reference order is the 24.1.3 clause order (strings, then symbols per OrdinaryOwnPropertyKeys). V8 installs constructor,get,set,has,… and JSC differs again; the runtime installs in registry order. Mismatch is reported, not failed.' },
  { id: 'reflect-ownKeys-set-prototype-set', group: 'reflect', source: 'function f(x){const k=Reflect.ownKeys(Set.prototype).map(' + keyList + ');const s=k.filter(v=>v.slice(0,7)!=="Symbol(").sort(),y=k.filter(v=>v.slice(0,7)==="Symbol(").sort();return s.concat(y).join();}', inputs: [3] },
  { id: 'reflect-ownKeys-map-ctor', group: 'reflect', source: 'function f(x){const k=Reflect.ownKeys(Map).map(' + keyList + ');return k.filter(v=>v.slice(0,7)!=="Symbol(").sort().join()+"|"+k.filter(v=>v.slice(0,7)==="Symbol(").join();}', inputs: [3], requires: ['Map.groupBy', 'Map[@@species]'] },

  // ---------------------------------------------------------------- numeric
  { id: 'isNaN-isFinite-coercion', group: 'numeric', source: 'function f(x){return isNaN(x)+":"+isFinite(x);}', inputs: ['abc', '', ' ', '\n12\t', '0x10', '0b11', '0o7', '1e3', '1e309', '-0', 'Infinity', '-Infinity', '+Infinity', 'infinity', '1_000', '.5', '5.', null, undefined, true, false, NaN, 0, -0, Infinity, -Infinity, 5e-324, 1.7976931348623157e308] },
  { id: 'isNaN-object-coercion', group: 'numeric', source: 'function f(x){return [isNaN({}),isNaN([]),isNaN([x]),isNaN([1,2]),isNaN({valueOf(){return x;}}),isNaN({toString(){return "7";}}),isFinite([x]),isFinite(new Number(x))].join();}', inputs: [5, 'a', NaN, Infinity] },
  { id: 'isNaN-coercion-throw-propagates', group: 'numeric', source: 'function f(x){let log="";try{isNaN({valueOf(){log+="v";throw x;},toString(){log+="t";return "1";}});}catch(e){return log+":"+e;}return log;}', inputs: [7, 'boom'] },
  { id: 'isNaN-symbol-bigint-typeerror', group: 'numeric', source: 'function f(x){let n=0;for(const t of [()=>isNaN(Symbol("s")),()=>isFinite(Symbol.iterator),()=>isNaN(1n),()=>isFinite(BigInt(x))]){try{t();}catch(e){if(e instanceof TypeError)n++;}}return n;}', inputs: [3] },
  { id: 'isNaN-missing-argument', group: 'numeric', source: 'function f(x){return isNaN()+":"+isFinite();}', inputs: [3] },
  { id: 'isNaN-isFinite-metadata', group: 'numeric', source: 'function f(x){return isNaN.name+isNaN.length+isFinite.name+isFinite.length+":"+(isNaN!==Number.isNaN)+(isFinite!==Number.isFinite)+":"+Number.isNaN("NaN")+isNaN("NaN")+Number.isFinite("1")+isFinite("1");}', inputs: [3] },
  { id: 'isNaN-not-constructor', group: 'numeric', source: 'function f(x){try{new isNaN(x);}catch(e){return e instanceof TypeError;}return "constructed";}', inputs: [3] },
  { id: 'math-round-edges', group: 'numeric', source: 'function f(x){return Math.round(x);}', inputs: [-0.5, 0.5, -0, 0, 2.5, -2.5, -1.5, 0.49999999999999994, -0.49999999999999994, 4503599627370495.5, -4503599627370495.5, NaN, -Infinity, 5e-324, -5e-324] },
  { id: 'math-signed-zero-family', group: 'numeric', source: 'function f(x){return [Math.trunc(x),Math.ceil(x),Math.floor(x),Math.sign(x),Math.abs(x)].map(v=>Object.is(v,-0)?"-0":String(v)).join();}', inputs: [-0, -0.9, 0.9, -1e-300, NaN, -Infinity] },
  { id: 'math-min-max-edges', group: 'numeric', source: 'function f(x){const z=v=>Object.is(v,-0)?"-0":String(v);return [Math.max(),Math.min(),Math.max(-0,0),Math.min(0,-0),Math.max(x,NaN),Math.min(x,-0),Math.max(x,"7")].map(z).join();}', inputs: [0, -0, 1, NaN] },
  { id: 'math-pow-edges', group: 'numeric', source: 'function f(x){return [Math.pow(NaN,0),Math.pow(1,Infinity),Math.pow(-1,-Infinity),Math.pow(x,0.5),Math.pow(-0,-1),Math.pow(-Infinity,3)].map(String).join();}', inputs: [-0, -Infinity, 4] },
  { id: 'math-sqrt-cbrt-hypot', group: 'numeric', source: 'function f(x){const z=v=>Object.is(v,-0)?"-0":String(v);return [Math.sqrt(x),Math.cbrt(x),Math.hypot(),Math.hypot(x,-0),Math.hypot(NaN,Infinity)].map(z).join();}', inputs: [-0, 4, -8, Infinity, -1], requires: ['Math.sqrt', 'Math.cbrt', 'Math.hypot'] },
  { id: 'math-int32-helpers', group: 'numeric', source: 'function f(x){return [Math.clz32(x),Math.imul(x,0xffffffff),Math.fround(x)].join();}', inputs: [0, 1, -1, 4294967296, 5.5, NaN, 16777217], requires: ['Math.clz32', 'Math.imul', 'Math.fround'] },
  { id: 'number-statics-vs-globals', group: 'numeric', source: 'function f(x){return [Number.isInteger(x),Number.isSafeInteger(x),Number.isFinite(x),isFinite(x),Number.isNaN(x),isNaN(x)].join();}', inputs: [9007199254740991, 9007199254740992, -0, '5', 5.5, NaN, null] },

  // ---------------------------------------------------------------- cross
  { id: 'cross-symbol-keys', group: 'cross', source: 'function f(x){const s=Symbol("k"),g=Symbol.for("reg");const m=new Map([[s,x],[g,"g"]]);return m.get(s)+":"+m.has(Symbol("k"))+":"+m.get(Symbol.for("reg"))+":"+m.get(Symbol.iterator)+":"+new Set([s,s,Symbol("k")]).size;}', inputs: [1, 'v'] },
  { id: 'cross-bigint-keys', group: 'cross', source: 'function f(x){const m=new Map([[1n,"a"]]);m.set(BigInt(x),"b");return m.get(1n)+":"+m.has(1)+":"+m.get(BigInt(x))+":"+m.size+":"+new Set([0n,-0n,BigInt(0)]).size;}', inputs: [1, 2] },
  { id: 'cross-function-keys', group: 'cross', source: 'function f(x){function g(){}const h=()=>0;const m=new Map([[g,1],[h,2],[Math.max,3],[Map,4]]);return m.get(g)+m.get(h)+m.get(Math.max)+m.get(Map)+":"+m.has(function g(){})+":"+m.get(Math.min);}', inputs: [3] },
  { id: 'cross-class-instance-keys-and-field', group: 'cross', source: 'function f(x){class P{constructor(n){this.n=n;}}class Counter{counts=new Map();hit(k){this.counts.set(k,(this.counts.get(k)||0)+1);return this;}}const a=new P(1),b=new P(1);const c=new Counter().hit(a).hit(b).hit(a).hit(x);return c.counts.get(a)+":"+c.counts.get(b)+":"+c.counts.get(x)+":"+c.counts.size+":"+(c.counts instanceof Map);}', inputs: [1, 'k'] },
  { id: 'cross-json-stringify', group: 'cross', source: 'function f(x){const m=new Map([[x,1]]),s=new Set([x]);const before=JSON.stringify(m)+JSON.stringify(s)+JSON.stringify({m:m,s:[s]});m.own=x;return before+":"+JSON.stringify(m);}', inputs: [1, 'k'] },
  { id: 'cross-json-replacer-forEach', group: 'cross', source: 'function f(x){const m=new Map([["a",x],["b",[x]]]);return JSON.stringify({m:m},function(k,v){if(v instanceof Map){const o={};v.forEach((val,key)=>{o[key]=val;});return o;}return v;});}', inputs: [1, 'z'] },
  { id: 'cross-object-keys-names', group: 'cross', source: 'function f(x){const m=new Map([[x,1]]),s=new Set([x]);const a=Object.keys(m).length+Object.getOwnPropertyNames(m).length+Object.getOwnPropertyNames(s).length+Object.getOwnPropertySymbols(m).length;m.p=1;s[x]=2;return a+":"+Object.keys(m).join()+":"+Object.getOwnPropertyNames(s).join()+":"+Object.entries(m).join();}', inputs: [1, 'k'] },
  { id: 'cross-toString-tags', group: 'cross', source: 'function f(x){const t=Object.prototype.toString;return [t.call(new Map()),t.call(new Set()),t.call(Map.prototype),t.call(Set.prototype),String(new Map()),new Set()+"",t.call(Map)].join();}', inputs: [3] },
  { id: 'cross-toStringTag-nonwritable-then-defined', group: 'cross', source: 'function f(x){const m=new Map();m[Symbol.toStringTag]=x;const a=Object.prototype.toString.call(m);Object.defineProperty(m,Symbol.toStringTag,{value:x});return a+Object.prototype.toString.call(m)+Object.getOwnPropertySymbols(m).length;}', inputs: ['X', 5] },
  { id: 'cross-prototype-object-not-a-map', group: 'cross', source: 'function f(x){const o=Object.create(Map.prototype);let r=Object.prototype.toString.call(o)+":"+(o instanceof Map);try{o.set(x,1);r+=":set";}catch(e){r+=":"+(e instanceof TypeError);}return r;}', inputs: [3] },
  { id: 'cross-freeze-keeps-internal-slots', group: 'cross', source: 'function f(x){const m=Object.freeze(new Map());m.set(x,1);const s=Object.seal(new Set([1]));s.add(x);s.delete(1);return Object.isFrozen(m)+":"+m.size+":"+m.get(x)+":"+Object.isSealed(s)+":"+s.has(x)+":"+s.size;}', inputs: [2] },
  { id: 'cross-spread-and-assign-copy-nothing', group: 'cross', source: 'function f(x){const m=new Map([[x,1]]);const o={...m},a=Object.assign({},new Set([x]));return Object.keys(o).length+":"+Object.keys(a).length+":"+(m instanceof Map)+":"+(Map.prototype.constructor===Map)+":"+(new Set() instanceof Map);}', inputs: [3] },
  { id: 'cross-for-in-instance', group: 'cross', source: 'function f(x){const m=new Map([[x,1]]);let r="";for(const k in m)r+=k;m.own=1;for(const k in m)r+="|"+k;return r+":"+("size" in m)+":"+m.hasOwnProperty("size")+":"+(delete m.size)+":"+m.size;}', inputs: [1] },
  { id: 'cross-collections-as-keys', group: 'cross', source: 'function f(x){const inner=new Map([[x,"deep"]]),s=new Set([inner]);const outer=new Map([[inner,s],[s,inner]]);return outer.get(inner).has(inner)+":"+outer.get(s).get(x)+":"+outer.get(outer.get(s)).size;}', inputs: [1, 'k'] },
  { id: 'cross-heap-string-keys', group: 'cross', source: 'function f(x){const m=new Map([["ab"+x,1]]);const k="a"+("b"+x);m.set(String(x),2);return m.get(k)+":"+m.get(""+x)+":"+m.size+":"+new Set(["x"+x,"x"+String(x),"x"+x]).size;}', inputs: [1, 'z', ''] },
  { id: 'cross-method-call-bind-apply', group: 'cross', source: 'function f(x){const m=new Map([[x,"v"]]);const g=Map.prototype.get;return g.call(m,x)+g.apply(m,[x])+g.bind(m)(x)+g.bind(m,x)()+":"+Map.prototype.get.name;}', inputs: [1] },
  { id: 'cross-set-union-with-map-setlike', group: 'cross', source: 'function f(x){const u=new Set([1]).union(new Map([[x,"a"],[1,"b"]]));let r="";u.forEach(v=>{r+=v;});return r+":"+new Set([x]).isSubsetOf(new Map([[x,0]]));}', inputs: [2, 1] },
  { id: 'cross-closure-retains-map-across-gc', group: 'cross', source: 'function f(x){' + CHURN + 'function make(){const m=new Map();return k=>{m.set(k,(m.get(k)|0)+1);return m.get(k)*100+m.size;};}const inc=make();inc(x);inc("o");churn(600);inc(x);churn(600);return inc(x);}', inputs: [1, 'k'], requiredGC: true },
  { id: 'cross-includes-indexOf-identity', group: 'cross', source: 'function f(x){const m=new Map(),s=new Set([x]);const list=[s,m];return list.indexOf(m)+":"+list.includes(s)+":"+[new Map()].includes(m)+":"+(m==m)+":"+(new Map()==new Map());}', inputs: [3] },
  { id: 'cross-typeof', group: 'cross', source: 'function f(x){return [typeof Map,typeof new Map(),typeof new Set([x]).values(),typeof Map.prototype.get,typeof Object.getOwnPropertyDescriptor(Map.prototype,"size").get].join();}', inputs: [3] },
];

// Must fail closed on the GPU with an explicit Unsupported status (status 6)
// and the runtime's "no CPU fallback" message. `specExpected` records the
// ES2025 result (from V8 at authoring time) for when the dependency lands;
// `requiresGenericIteration` entries move to supported cases once the
// generic iterator protocol (1270–1273 / 2400–2499) is merged.
export const stdlibConformanceUnsupported = [
  { id: 'unsupported-for-of-map', requiresGenericIteration: true, input: 3, specExpected: 'a1b3', source: 'function f(x){const m=new Map([["a",1],["b",x]]);let r="";for(const [k,v] of m)r+=k+v;return r;}', reason: 'for-of over a Map: @@iterator on Map.prototype reaches the generic protocol guard' },
  { id: 'unsupported-for-of-set', requiresGenericIteration: true, input: 3, specExpected: 4, source: 'function f(x){let n=0;for(const v of new Set([1,x]))n+=v;return n;}', reason: 'for-of over a Set' },
  { id: 'unsupported-spread-map', requiresGenericIteration: true, input: 3, specExpected: '1,3', source: 'function f(x){return [...new Map([[1,x]])].join();}', reason: 'array spread over a Map' },
  { id: 'unsupported-spread-set-keys', requiresGenericIteration: true, input: 3, specExpected: '3,1', source: 'function f(x){return [...new Set([x,1]).keys()].join();}', reason: 'spread over a Set iterator (needs %IteratorPrototype%[@@iterator])' },
  { id: 'unsupported-array-from-map', requiresGenericIteration: true, input: 3, specExpected: 2, source: 'function f(x){return Array.from(new Map([[1,2],[x,4]])).length;}', reason: 'Array.from over a Map' },
  { id: 'unsupported-map-copy-ctor', requiresGenericIteration: true, input: 3, specExpected: '3:true', source: 'function f(x){const a=new Map([[1,x]]);const b=new Map(a);return b.get(1)+":"+(a!==b);}', reason: 'new Map(map): constructor for-of over an @@iterator object' },
  { id: 'unsupported-set-copy-ctor', requiresGenericIteration: true, input: 3, specExpected: 2, source: 'function f(x){return new Set(new Set([1,x])).size;}', reason: 'new Set(set)' },
  { id: 'unsupported-destructure-set', requiresGenericIteration: true, input: 3, specExpected: 3, source: 'function f(x){const [a]=new Set([x]);return a;}', reason: 'array destructuring from a Set' },
  { id: 'unsupported-class-extends-map', input: 3, specExpected: '3:true', source: 'function f(x){class M extends Map{}const m=new M([[1,x]]);return m.get(1)+":"+(m instanceof M);}', reason: 'subclass NewTarget keeps the status 6 boundary (contract: Constructors)' },
  { id: 'unsupported-class-extends-set-super-call', input: 3, specExpected: 1, source: 'function f(x){class S extends Set{constructor(){super();}}return new S().add(x).size;}', reason: 'subclass construction of Set' },
  { id: 'unsupported-reflect-construct-newtarget', input: 3, specExpected: 'true:undefined', source: 'function f(x){function N(){}const m=Reflect.construct(Map,[],N);return (Object.getPrototypeOf(m)===N.prototype)+":"+Map.prototype.get.call(m,x);}', reason: 'Reflect.construct with a different NewTarget (status 6 boundary)' },
  { id: 'unsupported-private-field-on-map', input: 3, specExpected: '3:true', source: 'function f(x){class B{constructor(o){return o;}}class C extends B{#p=x;static read(o){return o.#p+":"+(#p in o);}}const m=new Map();new C(m);return C.read(m);}', reason: 'private elements on kind-40 objects: privateHolder() returns PRIVATE_NO_STORAGE -> status 6 (contract: private class elements on Map/Set stay status 6)' },
  { id: 'unsupported-map-non-iterable-primitive', requiresGenericIteration:true, input: 3, specExpected: true, specOutcome: 'TypeError', source: 'function f(x){try{new Map(x);}catch(e){return e instanceof TypeError;}return false;}', reason: 'ES2025 GetIterator(5) is a TypeError, but the constructor for-of reports status 6 through the generic-iteration guard until the protocol lands' },
];

// Original boundary IDs/sources remain visible as required value records.
stdlibConformanceCases.push(
  { id: 'unsupported-map-groupBy', input: 3, expected: '1,3:2', source: 'function f(x){const g=Map.groupBy([1,2,x],v=>v%2);return g.get(1).join()+":"+g.get(0)[0];}', group: 'map', specNote: 'Former boundary now required after GroupBy/species integration' },
  { id: 'unsupported-map-species', input: 3, expected: true, source: 'function f(x){return Map[Symbol.species]===Map;}', group: 'map', specNote: 'Former boundary now required after GroupBy/species integration' },
  { id: 'unsupported-set-species', input: 3, expected: true, source: 'function f(x){return Set[Symbol.species]===Set;}', group: 'map', specNote: 'Former boundary now required after GroupBy/species integration' },
);
