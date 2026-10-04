// Standard-library wave, worker 1: Map constructor / get / set / has fixtures.
// Each source is one named sync function of one input returning a primitive.
// `expected` is omitted: check-stdlib-map-core.mjs computes it with native V8.
const keys = [0, -0, 1, NaN, Infinity, -Infinity, '', '0', 'a', true, false, null, undefined];
export const mapCoreCases = [
  // SameValueZero, one category per case.
  { feature: 'samevaluezero-primitive-roundtrip', source: 'function f(x){const m=new Map();m.set(x,"v");return m.get(x)+":"+m.has(x);}', inputs: keys },
  { feature: 'samevaluezero-NaN', source: 'function f(x){const m=new Map();m.set(NaN,1);m.set(0/0,2);return m.get(x)+":"+m.has(NaN)+":"+m.has(-NaN);}', inputs: [NaN, 0, 'NaN', undefined] },
  { feature: 'samevaluezero-zero-normalized-on-set', source: 'function f(x){const m=new Map();m.set(-0,"z");let k;m.set(x,"x");return m.get(0)+":"+m.get(-0)+":"+m.has(0)+":"+(m.get(x));}', inputs: [0, -0, 1] },
  { feature: 'samevaluezero-negative-zero-ctor', source: 'function f(x){const m=new Map([[-0,1]]);let s=0;for(const k of [0,-0])s+=m.get(k);m.set(x,7);return s+":"+m.get(0)+":"+m.has(-0);}', inputs: [-0, 0] },
  { feature: 'samevaluezero-negative-zero-key-observed-plus-zero', requires: ['Map.prototype.forEach'], source: 'function f(x){const m=new Map();m.set(x,1);new Map([[x,2]]).forEach(function(v,k){m.set("ctor",Object.is(k,0));});let r="";m.forEach(function(v,k){r+=typeof k==="number"?Object.is(k,-0)+"/"+(1/k):String(k)+"="+v;r+=";";});return r;}', inputs: [-0, 0] },
  { feature: 'samevaluezero-string-content', source: 'function f(x){const m=new Map();const a="ab"+x;m.set(a,1);const b="a"+"b"+x;return m.get(b)+":"+m.has("ab"+x)+":"+m.has("AB"+x);}', inputs: ['', 'c', 'long-string-key-0123456789'] },
  { feature: 'samevaluezero-string-vs-number', source: 'function f(x){const m=new Map();m.set("1",1);m.set(1,2);return m.get(x)+":"+m.has(String(x));}', inputs: [1, '1', 2] },
  { feature: 'samevaluezero-symbol-identity', source: 'function f(x){const a=Symbol("k"),b=Symbol("k");const m=new Map();m.set(a,x);return m.get(a)+":"+m.has(b)+":"+m.get(b)+":"+m.has(Symbol.iterator);}', inputs: [1, 'q'] },
  { feature: 'samevaluezero-symbol-for-registry', source: 'function f(x){const m=new Map();m.set(Symbol.for("reg"),x);return m.get(Symbol.for("reg"))+":"+m.has(Symbol("reg"));}', inputs: [3] },
  { feature: 'samevaluezero-bigint-value', source: 'function f(x){const m=new Map();m.set(1n,"one");m.set(1180591620717411303424n,"big");return m.get(1n)+":"+m.get(BigInt(x))+":"+m.has(1)+":"+m.get(1180591620717411303424n)+":"+m.has(1180591620717411303425n)+":"+m.has("1");}', inputs: [1, 2, 0] },
  { feature: 'samevaluezero-bigint-zero', source: 'function f(x){const m=new Map([[0n,"z"]]);return m.get(-0n)+":"+m.has(0)+":"+m.get(BigInt(x));}', inputs: [0, 1] },
  { feature: 'samevaluezero-object-identity', source: 'function f(x){const a={v:x},b={v:x};const m=new Map([[a,1]]);m.set(b,2);return m.get(a)+":"+m.get(b)+":"+m.has({v:x});}', inputs: [1] },
  { feature: 'samevaluezero-function-identity', source: 'function f(x){function g(){}const h=function(){};const m=new Map();m.set(g,1);m.set(h,2);m.set(Math.max,3);return m.get(g)+m.get(h)+m.get(Math.max)+":"+m.has(function(){})+":"+m.has(Math.min);}', inputs: [1] },
  { feature: 'samevaluezero-array-identity', source: 'function f(x){const a=[x];const m=new Map();m.set(a,"a");return m.get(a)+":"+m.has([x]);}', inputs: [1] },
  { feature: 'samevaluezero-null-undefined-distinct', source: 'function f(x){const m=new Map();m.set(null,"n");m.set(undefined,"u");return m.get(x)+":"+m.has(null)+":"+m.has(undefined)+":"+m.has(false)+":"+m.has(0)+":"+m.has("");}', inputs: [null, undefined, 0] },
  { feature: 'samevaluezero-boolean-keys', source: 'function f(x){const m=new Map([[true,1],[false,0]]);return m.get(x)+":"+m.has(1)+":"+m.has("true");}', inputs: [true, false, 1] },
  { feature: 'samevaluezero-get-missing-and-no-argument', source: 'function f(x){const m=new Map([[undefined,"u"]]);const e=new Map();return m.get()+":"+m.has()+":"+e.get()+":"+e.has()+":"+e.get(x);}', inputs: [1] },
  { feature: 'samevaluezero-boxed-not-primitive', source: 'function f(x){const m=new Map([[1,"p"],["s","p"]]);return m.has(Object(1))+":"+m.has(Object("s"))+":"+m.get(x);}', inputs: [1, 's'] },
  // set semantics.
  { feature: 'set-returns-map-chaining', source: 'function f(x){const m=new Map();const r=m.set(1,1).set(2,2).set(x,3);return (r===m)+":"+m.get(1)+":"+m.get(2)+":"+m.get(x);}', inputs: [3, 1] },
  { feature: 'set-overwrite-keeps-position', requires: ['Map.prototype.forEach'], source: 'function f(x){const m=new Map([["a",1],["b",2],["c",3]]);m.set("a",x);m.set(-0,0);m.set("b",x);m.set(0,9);let s="";m.forEach(function(v,k){s+=String(k)+"="+v+";";});return s;}', inputs: [7] },
  { feature: 'set-value-undefined-has-true', source: 'function f(x){const m=new Map();m.set(x);return m.has(x)+":"+m.get(x);}', inputs: [1, 'k'] },
  { feature: 'set-extra-arguments-ignored', source: 'function f(x){const m=new Map();m.set(x,1,2,3);return m.get(x)+":"+Map.prototype.get.call(m,x,9);}', inputs: [5] },
  { feature: 'many-keys-lookup', source: 'function f(x){const m=new Map();for(let i=0;i<40;i++)m.set(i,i*i);m.set("40",-1);let s=0;for(let i=0;i<40;i++)s+=m.get(i);return s+":"+m.get(x)+":"+m.has(40);}', inputs: [39, 0, 40] },
  // Constructor.
  { feature: 'ctor-undefined-null-empty', source: 'function f(x){const a=new Map(undefined),b=new Map(null),c=new Map(),d=new Map([]);return a.has(undefined)+":"+b.has(null)+":"+c.has()+":"+d.has(0)+":"+(a!==b);}', inputs: [1] },
  { feature: 'ctor-array-of-pairs', source: 'function f(x){const m=new Map([[1,"a"],["1","b"],[x,"c"],[NaN,"d"]]);return m.get(1)+m.get("1")+m.get(x)+m.get(NaN);}', inputs: [2, 1, NaN] },
  { feature: 'ctor-duplicate-keys-last-wins', requires: ['Map.prototype.forEach'], source: 'function f(x){const m=new Map([[0,1],[-0,2],[0,x]]);let n=0;m.forEach(function(){n++;});return m.get(-0)+":"+n;}', inputs: [3] },
  { feature: 'ctor-short-and-long-entries', source: 'function f(x){const m=new Map([[],[1],[2,3,4],["s"]]);return m.has(undefined)+":"+m.get(undefined)+":"+m.get(1)+":"+m.get(2)+":"+m.get("s");}', inputs: [1] },
  { feature: 'ctor-string-entry-is-TypeError', source: 'function f(x){try{new Map(["ab"]);return "no";}catch(e){return e instanceof TypeError;}}', inputs: [1] },
  { feature: 'ctor-hole-entry-is-TypeError', source: 'function f(x){const a=[[1,2],,[3,4]];try{new Map(a);return "no";}catch(e){return (e instanceof TypeError)+":"+e.constructor.name;}}', inputs: [1] },
  { feature: 'ctor-primitive-entries-TypeError', source: 'function f(x){try{new Map([x]);return "no";}catch(e){return e instanceof TypeError;}}', inputs: [1, 'k', null, undefined, true] },
  { feature: 'ctor-string-iterable-TypeError', source: 'function f(x){try{new Map(x);return "no";}catch(e){return e instanceof TypeError;}}', inputs: ['ab'] },
  { feature: 'ctor-empty-string-iterable', source: 'function f(x){const m=new Map(x);return m.has("")+":"+(m instanceof Map);}', inputs: [''] },
  { feature: 'ctor-function-entry-accepted', source: 'function f(x){function e(){}e[0]="k";e[1]=x;const m=new Map([e]);return m.get("k");}', inputs: [4] },
  { feature: 'ctor-entry-getter-order', source: 'function f(x){let log="";const e={get 0(){log+="k";return "key";},get 1(){log+="v";return x;},get 2(){log+="!";return 0;}};const m=new Map([e,e]);return log+":"+m.get("key");}', inputs: [5] },
  { feature: 'ctor-entry-getter-throws', source: 'function f(x){let log="";const e={get 0(){log+="k";return 1;},get 1(){log+="v";throw x;}};try{new Map([e]);}catch(err){return log+":"+err;}return "no";}', inputs: [9] },
  { feature: 'ctor-array-like-entry-object', source: 'function f(x){const m=new Map([{0:"a",1:x,length:0},new String("bc")]);return m.get("a")+":"+m.get("b");}', inputs: [6] },
  { feature: 'ctor-arguments-iterable', source: 'function f(x){function g(){return new Map(arguments);}const m=g([1,"a"],[x,"b"]);return m.get(1)+m.get(x);}', inputs: [2] },
  { feature: 'ctor-patched-set-observed', source: 'function f(x){const orig=Map.prototype.set;let log="";Map.prototype.set=function(k,v){log+=k+"="+v+";";return orig.call(this,k,v+1);};let m;try{m=new Map([[1,10],[x,20]]);}finally{Map.prototype.set=orig;}return log+m.get(1)+":"+m.get(x);}', inputs: [2] },
  { feature: 'ctor-patched-set-not-used-without-iterable', source: 'function f(x){const orig=Map.prototype.set;let n=0;Map.prototype.set=function(){n++;};try{new Map();new Map(null);new Map(undefined);}finally{Map.prototype.set=orig;}return n;}', inputs: [1] },
  { feature: 'ctor-patched-set-receiver-and-return-ignored', source: 'function f(x){const orig=Map.prototype.set;let self;Map.prototype.set=function(k,v){self=this;orig.call(this,k,v);return 42;};let m;try{m=new Map([[x,1]]);}finally{Map.prototype.set=orig;}return (self===m)+":"+m.get(x)+":"+(m instanceof Map);}', inputs: [3] },
  { feature: 'ctor-set-getter-read-once', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Map.prototype,"set");let n=0;Object.defineProperty(Map.prototype,"set",{configurable:true,get(){n++;return d.value;}});let m;try{m=new Map([[1,1],[2,2],[x,3]]);}finally{Object.defineProperty(Map.prototype,"set",d);}return n+":"+m.get(x);}', inputs: [3] },
  { feature: 'ctor-noncallable-set-TypeError', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Map.prototype,"set");Map.prototype.set=x;let r="no";try{new Map([]);}catch(e){r=e instanceof TypeError;}Object.defineProperty(Map.prototype,"set",d);return r+":"+(Map.prototype.set===d.value);}', inputs: [1, null, undefined, 'set'] },
  { feature: 'ctor-noncallable-set-ignored-for-null', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Map.prototype,"set");Map.prototype.set=x;let r;try{r=new Map(null) instanceof Map;}finally{Object.defineProperty(Map.prototype,"set",d);}return r;}', inputs: [1] },
  { feature: 'ctor-noncallable-set-before-iteration', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Map.prototype,"set");Map.prototype.set=0;let log="";const e={get 0(){log+="k";return 1;}};let r;try{new Map([e]);}catch(err){r=err instanceof TypeError;}Object.defineProperty(Map.prototype,"set",d);return r+":"+log;}', inputs: [1] },
  { feature: 'ctor-adder-throws-stops', source: 'function f(x){const orig=Map.prototype.set;let n=0;Map.prototype.set=function(k,v){n++;if(k===x)throw "stop";return orig.call(this,k,v);};let r;try{new Map([[1,1],[2,2],[3,3]]);r="no";}catch(e){r=e;}finally{Map.prototype.set=orig;}return r+":"+n;}', inputs: [2, 9] },
  { feature: 'ctor-array-growth-during-iteration', requires: ['Map.prototype.forEach'], source: 'function f(x){const a=[[1,1]];const orig=Map.prototype.set;Map.prototype.set=function(k,v){if(a.length<x)a.push([k+1,v+1]);return orig.call(this,k,v);};let m;try{m=new Map(a);}finally{Map.prototype.set=orig;}let n=0;m.forEach(function(){n++;});return n+":"+m.get(x);}', inputs: [4] },
  // Non-iterables: catchable TypeError via the temporary __lanesIterationKind pre-check.
  { feature: 'ctor-non-iterable-primitive-TypeError', source: 'function f(x){try{new Map(x);return "no";}catch(e){return e instanceof TypeError;}}', inputs: [5, 0, NaN, true, false] },
  { feature: 'ctor-symbol-iterable-TypeError', source: 'function f(x){try{new Map(Symbol("s"));return "no";}catch(e){return e instanceof TypeError;}}', inputs: [1] },
  { feature: 'ctor-plain-object-TypeError', source: 'function f(x){let r="";for(const v of [{},{length:0},Object.create(null),function(){},{0:[1,2],length:1}]){try{new Map(v);r+="n";}catch(e){r+=e instanceof TypeError?"T":"?";}}return r;}', inputs: [1] },
  { feature: 'ctor-noncallable-iterator-TypeError', source: 'function f(x){const o={};o[Symbol.iterator]=x;try{new Map(o);return "no";}catch(e){return e instanceof TypeError;}}', inputs: [1, 's', true, null, undefined] },
  { feature: 'ctor-noncallable-iterator-object-TypeError', source: 'function f(x){const o={[Symbol.iterator]:{x:x}};try{new Map(o);return "no";}catch(e){return (e instanceof TypeError)+":"+x;}}', inputs: [1] },
  { feature: 'ctor-iterator-getter-read-once-before-TypeError', source: 'function f(x){let log="";const o={get [Symbol.iterator](){log+="i";return x;}};const orig=Map.prototype.set;Map.prototype.set=function(k,v){log+="s";return orig.call(this,k,v);};let r;try{new Map(o);r="no";}catch(e){r=e instanceof TypeError;}finally{Map.prototype.set=orig;}return log+":"+r;}', inputs: [undefined, 0] },
  { feature: 'ctor-set-lookup-before-iterator-check', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Map.prototype,"set");let log="";Object.defineProperty(Map.prototype,"set",{configurable:true,get(){log+="s";return x?d.value:1;}});const o={get [Symbol.iterator](){log+="i";return undefined;}};let r;try{new Map(o);r="no";}catch(e){r=e instanceof TypeError;}Object.defineProperty(Map.prototype,"set",d);return log+":"+r;}', inputs: [0, 1] },
  { feature: 'ctor-without-new-TypeError', source: 'function f(x){let r="";try{Map();}catch(e){r+=e instanceof TypeError;}try{Map([[1,2]]);}catch(e){r+=":"+(e instanceof TypeError);}try{Map.call(new Map(),[]);}catch(e){r+=":"+(e instanceof TypeError);}return r;}', inputs: [1] },
  // Brand checks.
  { feature: 'brand-check-plain-object', source: 'function f(x){let r="";for(const name of ["get","set","has"]){try{Map.prototype[name].call({},x);r+="n";}catch(e){r+=e instanceof TypeError?"T":"?";}}return r;}', inputs: [1] },
  { feature: 'brand-check-prototype-itself', source: 'function f(x){let r="";for(const name of ["get","set","has"]){try{Map.prototype[name].call(Map.prototype,x);r+="n";}catch(e){r+=e instanceof TypeError?"T":"?";}}return r;}', inputs: [1] },
  { feature: 'brand-check-primitives', source: 'function f(x){let r=0;const fns=[Map.prototype.get,Map.prototype.set,Map.prototype.has];for(let i=0;i<3;i++){try{fns[i].call(x,1,2);}catch(e){if(e instanceof TypeError)r++;}}return r;}', inputs: [undefined, null, 1, 'map', true] },
  { feature: 'brand-check-map-like-and-inheriting', source: 'function f(x){let r="";const fake=Object.create(Map.prototype);const arr=[];try{fake.get(x);}catch(e){r+=e instanceof TypeError;}try{Map.prototype.has.call(arr,x);}catch(e){r+=":"+(e instanceof TypeError);}try{Map.prototype.set.call(function(){},x,1);}catch(e){r+=":"+(e instanceof TypeError);}return r;}', inputs: [1] },
  { feature: 'borrowed-methods-call-receiver', source: 'function f(x){const m=new Map();const set=m.set,get=m.get,has=m.has;set.call(m,x,"v");let r="";try{get(x);}catch(e){r=e instanceof TypeError;}return get.call(m,x)+":"+has.call(m,x)+":"+r;}', inputs: [1] },
  // Metadata.
  { feature: 'ctor-metadata', source: 'function f(x){return Map.length+":"+Map.name+":"+typeof Map+":"+(Map.prototype.constructor===Map)+":"+(Object.getPrototypeOf(Map)===Function.prototype);}', inputs: [1] },
  { feature: 'prototype-descriptor', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Map,"prototype");return d.writable+":"+d.enumerable+":"+d.configurable+":"+(Object.getPrototypeOf(Map.prototype)===Object.prototype);}', inputs: [1] },
  { feature: 'method-name-length', source: 'function f(x){const p=Map.prototype;return p.get.name+p.get.length+p.set.name+p.set.length+p.has.name+p.has.length;}', inputs: [1] },
  { feature: 'method-descriptors', source: 'function f(x){let s="";for(const n of ["get","set","has","constructor"]){const d=Object.getOwnPropertyDescriptor(Map.prototype,n);s+=(typeof d.value)+d.writable+d.enumerable+d.configurable+";";}return s;}', inputs: [1] },
  { feature: 'methods-not-constructors', source: 'function f(x){let n=0;for(const k of ["get","set","has"]){try{new Map.prototype[k]();}catch(e){if(e instanceof TypeError)n++;}}return n+":"+Object.hasOwn(Map.prototype.get,"prototype");}', inputs: [1] },
  { feature: 'instance-identity', source: 'function f(x){const m=new Map();return typeof m+":"+(m instanceof Map)+":"+(m instanceof Object)+":"+(Object.getPrototypeOf(m)===Map.prototype)+":"+(m.constructor===Map)+":"+Object.keys(m).length+":"+Array.isArray(m);}', inputs: [1] },
  { feature: 'instance-toString-tag', requires: ['Map.prototype[@@toStringTag]'], source: 'function f(x){return Object.prototype.toString.call(new Map())+":"+Object.prototype.toString.call(Map.prototype)+":"+String(new Map());}', inputs: [1] },
  { feature: 'instance-own-properties', source: 'function f(x){const m=new Map([["p","entry"]]);m.p="prop";m[0]=x;Object.defineProperty(m,"q",{value:3,enumerable:false});return m.p+":"+m.get("p")+":"+m.has(0)+":"+m[0]+":"+Object.keys(m).join(",")+":"+m.q+":"+JSON.stringify(m);}', inputs: [5] },
  { feature: 'instance-extensibility', source: 'function f(x){const m=new Map();Object.preventExtensions(m);m.set(x,1);let r="";try{m.z=1;}catch(e){r=e instanceof TypeError;}return Object.isExtensible(m)+":"+m.get(x)+":"+r+":"+Object.isFrozen(Object.freeze(new Map([[1,1]])).set(2,2));}', inputs: [1] },
  { feature: 'map-as-key-and-value', source: 'function f(x){const a=new Map(),b=new Map([[a,a]]);a.set(b,x);return (b.get(a)===a)+":"+b.get(a).get(b)+":"+a.has(a);}', inputs: [8] },
  { feature: 'self-referencing-map', source: 'function f(x){const m=new Map();m.set(m,m);return (m.get(m).get(m)===m)+":"+m.has(m)+":"+x;}', inputs: [1] },
  // GC: many temporary maps/objects, a retained map keeps its keys/values.
  { feature: 'gc-stress-retained-map', source: 'function f(x){const keep=new Map();const keyObj={id:x};const sym=Symbol("s");keep.set(keyObj,"o").set(sym,"s").set("t"+x,{v:x}).set(-0,"z").set(NaN,"n").set(10n,"b");for(let i=0;i<300;i++){const t=new Map([[i,{i:i}],[{},i]]);t.set("k"+i,[i]);if(i%50===0)keep.set(i,t.get(i).i);}let s=0;for(let i=0;i<300;i+=50)s+=keep.get(i);return keep.get(keyObj)+keep.get(sym)+keep.get("t"+x).v+keep.get(0)+keep.get(NaN)+keep.get(10n)+":"+s+":"+keep.has({id:x});}', inputs: [3] },
  { feature: 'gc-stress-value-cells', source: 'function f(x){const m=new Map();for(let i=0;i<200;i++){m.set(i%5,{n:i,pad:[i,i]});}let s="";for(let i=0;i<5;i++)s+=m.get(i).n+",";return s+m.has(5)+":"+x;}', inputs: [1] },
];

// Expected explicit host rejection (status 6, Unsupported) on the GPU. Natively
// these succeed (or throw a TypeError); the parent's GPU suite must observe
// status 6, never a guest catch.
export const mapCoreUnsupportedSources = [
  { feature: 'ctor-from-map-instance', requires: ['Map.prototype[@@iterator]'], source: 'function f(x){const a=new Map([[1,x]]);const b=new Map(a);return b.get(1);}', inputs: [2], reason: '@@iterator on Map.prototype -> generic iterator protocol pending' },
  { feature: 'ctor-from-user-iterable', source: 'function f(x){const it={[Symbol.iterator](){let i=0;return {next(){i++;return i>x?{done:true}:{done:false,value:[i,i*i]};}};}};return new Map(it).get(x);}', inputs: [3], reason: 'user @@iterator -> generic iterator protocol pending' },
  { feature: 'ctor-subclass', source: 'function f(x){class M extends Map{}const m=new M([[1,x]]);return m.get(1)+":"+(m instanceof M);}', inputs: [4], reason: 'subclass NewTarget keeps the status 6 boundary' },
  { feature: 'ctor-reflect-construct-newtarget', source: 'function f(x){function N(){}N.prototype=Object.create(Map.prototype);const m=Reflect.construct(Map,[[[1,x]]],N);return m.get(1);}', inputs: [4], reason: 'non-Map NewTarget keeps the status 6 boundary' },
];

// Single-instruction resumption: guest getters, a patched set and a key
// conversion callback run during construction and lookups.
export const mapCoreResumptionSource = 'function f(x){let log="";const orig=Map.prototype.set;Map.prototype.set=function(k,v){log+="s"+k;return orig.call(this,k,v*2);};const e={get 0(){log+="k";return x;},get 1(){log+="v";return {valueOf(){log+="o";return 5;}};}};let m;try{m=new Map([e,[x+1,3]]);}finally{Map.prototype.set=orig;}const r=m.get(x)*1;return log+":"+r+":"+m.get(x+1)+":"+m.has(x)+":"+(Map.prototype.set===orig);}';
export const mapCoreResumptionInputs = [3];
export const mapCoreResumptionExpected = 'kvs3os4:10:6:true:true';

// Original sources remain required value cases now generic iteration is integrated.
export const mapCoreUnsupportedPostMergeExpected=Object.freeze([2,9]);
