// Worker 2 cases: Map.prototype.size/delete/clear/forEach. Each source is one
// named synchronous function taking one input and returning a primitive.
// Expected values are native V8 results (check-stdlib-map-extra.mjs); GPU runs
// are coordinator-owned. Maps are built with `new Map()` + `.set` (worker 1).
const keys = [1, 0, -0, NaN, 'a', '', true, null, undefined];
const abc = 'const m=new Map();m.set("a",1);m.set("b",2);m.set("c",3);let s="";';
const T = 'try{ROUTINE;}catch(e){n+=(e instanceof TypeError)?1:100;}';
const tries = calls => 'let n=0;' + calls.map(c => T.replace('ROUTINE', c)).join('') + 'return n;';

export const mapExtraCases = [
  // size
  { feature: 'size-empty', source: 'function f(x){return new Map().size;}', inputs: [0] },
  { feature: 'size-after-set', source: 'function f(x){const m=new Map();m.set(x,1);m.set("k",2);m.set({},3);return m.size;}', inputs: keys },
  { feature: 'size-overwrite', source: 'function f(x){const m=new Map();m.set(x,1);m.set(x,2);m.set(x,3);return m.size+":"+m.get(x);}', inputs: keys },
  { feature: 'size-after-delete', source: 'function f(x){const m=new Map();m.set(x,1);m.set("z",2);const a=m.size;m.delete(x);const b=m.size;m.delete(x);return a+":"+b+":"+m.size;}', inputs: keys },
  { feature: 'size-after-clear', source: 'function f(x){const m=new Map();for(let i=0;i<x;i++)m.set(i,i);const a=m.size;m.clear();const b=m.size;m.set(1,1);return a+":"+b+":"+m.size;}', inputs: [0, 1, 7, 40] },
  { feature: 'size-signed-zero-keys', source: 'function f(x){const m=new Map();m.set(0,1);m.set(-0,2);m.set(NaN,3);m.set(0/0,4);return m.size+":"+m.get(0)+":"+m.get(NaN);}', inputs: [0] },
  // delete
  { feature: 'delete-return-values', source: 'function f(x){const m=new Map();const a=m.delete(x);m.set(x,1);return a+":"+m.delete(x)+":"+m.delete(x)+":"+m.has(x)+":"+m.size;}', inputs: keys },
  { feature: 'delete-NaN-key', source: 'function f(x){const m=new Map();m.set(NaN,1);return m.delete(x)+":"+m.size+":"+m.has(NaN);}', inputs: [NaN, 0, 'NaN', undefined] },
  { feature: 'delete-signed-zero', source: 'function f(x){const m=new Map();m.set(x,"v");const a=m.delete(-x);m.set(-x,"w");let o="";m.forEach(function(v,k){o+=v+Object.is(k,-0);});return a+":"+o+":"+m.size;}', inputs: [0, -0] },
  { feature: 'delete-object-identity', source: 'function f(x){const m=new Map();const k={v:x};m.set(k,1);return m.delete({v:x})+":"+m.size+":"+m.delete(k)+":"+m.size;}', inputs: [1] },
  { feature: 'delete-missing-argument', source: 'function f(x){const m=new Map();m.set(undefined,x);return m.delete()+":"+m.size+":"+m.delete();}', inputs: [5] },
  { feature: 'delete-string-by-content', source: 'function f(x){const m=new Map();m.set("ab"+x,1);return m.delete("a"+"b"+x)+":"+m.size;}', inputs: [1, 'z'] },
  { feature: 'delete-then-reinsert-order', source: 'function f(x){' + abc + 'm.delete("a");m.set("a",x);m.forEach(function(v,k){s+=k+v;});return s;}', inputs: [9] },
  // clear
  { feature: 'clear-returns-undefined', source: 'function f(x){const m=new Map();const a=m.clear();m.set(x,1);const b=m.clear();return (a===undefined)+":"+(b===undefined)+":"+m.size+":"+m.has(x)+":"+m.get(x);}', inputs: [1, 'a'] },
  { feature: 'clear-then-set-order', source: 'function f(x){' + abc + 'm.clear();m.set("c",x);m.set("a",2);m.forEach(function(v,k){s+=k+v;});return s+m.size;}', inputs: [7] },
  // forEach basics
  { feature: 'forEach-order-and-args', source: 'function f(x){' + abc + 'm.set("a",x);m.forEach(function(v,k,map){s+=k+v+(map===m)+arguments.length+",";});return s;}', inputs: [9] },
  { feature: 'forEach-returns-undefined', source: 'function f(x){' + abc + 'let c=0;const r=m.forEach(function(){c++;return 5;});return (r===undefined)+":"+c;}', inputs: [0] },
  { feature: 'forEach-empty', source: 'function f(x){let c=0;const r=new Map().forEach(function(){c++;});return c+":"+(r===undefined);}', inputs: [0] },
  { feature: 'forEach-thisArg-strict', source: 'function f(x){"use strict";const m=new Map();m.set(1,1);m.set(2,2);let s="";m.forEach(function(){s+=(this===x)+typeof this+",";},x);return s;}', inputs: [1, 'a', null, undefined, true] },
  { feature: 'forEach-thisArg-default-undefined', source: 'function f(x){"use strict";const m=new Map();m.set(x,x);let s="";m.forEach(function(){s+=typeof this;});return s;}', inputs: [1] },
  { feature: 'forEach-thisArg-object-sloppy', source: 'function f(x){const o={t:x};const m=new Map();m.set(1,1);let r=0;m.forEach(function(){r=this.t;},o);return r;}', inputs: [4] },
  { feature: 'forEach-arrow-lexical-this', source: 'function f(x){"use strict";const m=new Map();m.set(1,1);let r="";m.forEach(()=>{r=typeof this;},{a:1});return r;}', inputs: [0] },
  { feature: 'forEach-builtin-callback', source: 'function f(x){' + abc + 'const a=[];m.forEach(a.push,a);return a.length+":"+a[0]+a[1]+(a[2]===m)+a[3]+a[4];}', inputs: [0] },
  { feature: 'forEach-noncallable-before-iteration', source: 'function f(x){const m=new Map();let reads=0;m.set({get k(){reads++;return 1;}},1);try{m.forEach(x);return "no";}catch(e){return (e instanceof TypeError)+":"+reads+":"+m.size;}}', inputs: [undefined, null, 1, 's', true] },
  { feature: 'forEach-noncallable-object', source: 'function f(x){const m=new Map();m.set(1,1);try{m.forEach({call(){}},x);return "no";}catch(e){return e instanceof TypeError;}}', inputs: [0] },
  // forEach live mutation (ES2025 List semantics)
  { feature: 'forEach-add-during', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k;if(k==="a")m.set("d",4);if(k==="d")m.set("e",5);});return s+m.size;}', inputs: [0] },
  { feature: 'forEach-delete-unvisited', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k;if(k==="a")m.delete("c");});return s+m.size;}', inputs: [0] },
  { feature: 'forEach-delete-visited-reinsert', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k+v;if(k==="b"){m.delete("a");m.set("a",x);}});return s+m.size;}', inputs: [9] },
  { feature: 'forEach-delete-unvisited-reinsert', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k;if(k==="a"){m.delete("b");m.set("b",0);}});return s;}', inputs: [0] },
  { feature: 'forEach-delete-current', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k;m.delete(k);});return s+m.size;}', inputs: [0] },
  { feature: 'forEach-delete-current-and-next', source: 'function f(x){' + abc + 'm.set("d",4);m.forEach(function(v,k){s+=k;if(k==="a"){m.delete("a");m.delete("b");}});return s+m.size;}', inputs: [0] },
  { feature: 'forEach-clear-stops', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k;if(k==="a")m.clear();});return s+m.size;}', inputs: [0] },
  { feature: 'forEach-clear-then-add', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k+v;if(k==="b"){m.clear();m.set("z",x);m.set("a",1);}});return s+m.size;}', inputs: [9] },
  { feature: 'forEach-clear-at-last-then-add', source: 'function f(x){' + abc + 'let once=true;m.forEach(function(v,k){s+=k;if(k==="c"&&once){once=false;m.clear();m.set("c",3);}});return s+m.size;}', inputs: [0] },
  { feature: 'forEach-overwrite-unvisited-value', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k+v;if(k==="a")m.set("c",x);});return s;}', inputs: [8] },
  { feature: 'forEach-grows-to-limit', source: 'function f(x){const m=new Map();m.set(0,0);let c=0;m.forEach(function(v,k){c++;if(k<x)m.set(k+1,v+k);});return c+":"+m.get(x)+":"+m.size;}', inputs: [0, 5, 60] },
  // exceptions
  { feature: 'forEach-callback-throws', source: 'function f(x){' + abc + 'const e0={};try{m.forEach(function(v,k){s+=k;if(k==="b")throw e0;});}catch(e){s+=(e===e0);}m.forEach(function(v,k){s+=k;});return s+m.size;}', inputs: [0] },
  { feature: 'forEach-throws-after-mutation', source: 'function f(x){' + abc + 'try{m.forEach(function(v,k){s+=k;if(k==="b"){m.delete("b");m.set("d",x);throw 1;}});}catch(e){s+=e;}m.forEach(function(v,k){s+=k+v;});return s+m.size;}', inputs: [4] },
  { feature: 'forEach-throw-propagates-nested', source: 'function f(x){' + abc + 'try{m.forEach(function(){m.forEach(function(v,k){if(k===x)throw k;s+=k;});});}catch(e){s+="!"+e;}return s;}', inputs: ['b', 'c', 'q'] },
  // brand checks
  { feature: 'brand-plain-object', source: 'function f(x){const P=Map.prototype;const g=Object.getOwnPropertyDescriptor(P,"size").get;' + tries(['P.delete.call({},1)', 'P.clear.call({})', 'P.forEach.call({},function(){})', 'g.call({})', 'P.size', 'Object.create(P).size', 'P.forEach.call({},x)']) + '}', inputs: [undefined] },
  { feature: 'brand-primitives', source: 'function f(x){const P=Map.prototype;const g=Object.getOwnPropertyDescriptor(P,"size").get;' + tries(['P.delete.call(x,1)', 'P.clear.call(x)', 'P.forEach.call(x,function(){})', 'g.call(x)']) + '}', inputs: [undefined, null, 1, 'map', true] },
  { feature: 'brand-array-and-function', source: 'function f(x){const P=Map.prototype;const g=Object.getOwnPropertyDescriptor(P,"size").get;' + tries(['g.call([])', 'g.call(function(){})', 'P.clear.call([x])', 'P.delete.call(Map,1)', 'P.forEach.call(P,function(){})']) + '}', inputs: [1] },
  { feature: 'brand-borrowed-on-real-map', source: 'function f(x){const m=new Map();m.set(x,1);const P=Map.prototype;const g=Object.getOwnPropertyDescriptor(P,"size").get;const a=g.call(m);const b=P.delete.call(m,x);P.clear.call(m);let c=0;P.forEach.call(m,function(){c++;});return a+":"+b+":"+g.call(m)+":"+c;}', inputs: [1, 'k'] },
  // descriptors, names, lengths
  { feature: 'size-descriptor', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Map.prototype,"size");return typeof d.get+":"+(d.set===undefined)+":"+d.enumerable+":"+d.configurable+":"+("value" in d)+":"+d.get.name+":"+d.get.length;}', inputs: [0] },
  { feature: 'method-descriptors', source: 'function f(x){let s="";const names=["delete","clear","forEach"];for(let i=0;i<3;i++){const d=Object.getOwnPropertyDescriptor(Map.prototype,names[i]);s+=d.value.name+d.value.length+d.writable+d.enumerable+d.configurable+",";}return s;}', inputs: [0] },
  { feature: 'size-not-own-or-writable', source: 'function f(x){"use strict";const m=new Map();m.set(1,1);let t=false;try{m.size=x;}catch(e){t=e instanceof TypeError;}return t+":"+m.size+":"+Object.prototype.hasOwnProperty.call(m,"size");}', inputs: [5] },
  { feature: 'size-sloppy-assignment-ignored', source: 'function f(x){const m=new Map();m.set(1,1);m.size=x;return m.size;}', inputs: [5] },
  // heap reclamation of tombstones (requires collect() to unlink unpinned tombstones)
  { feature: 'gc-delete-reinsert-object-keys', source: 'function f(x){const m=new Map();for(let i=0;i<x;i++){const k={i:i};m.set(k,i);if(!m.delete(k))return "lost"+i;}return m.size;}', inputs: [3000] },
  { feature: 'gc-churn-keeps-live-entries', source: 'function f(x){const m=new Map();m.set("a",1);for(let i=0;i<x;i++){m.set(i,{i:i});m.delete(i);}m.set("b",2);let s="";m.forEach(function(v,k){s+=k+v;});return s+m.size;}', inputs: [3000] },
  { feature: 'gc-clear-cycles', source: 'function f(x){const m=new Map();let t=0;for(let r=0;r<x;r++){for(let i=0;i<10;i++)m.set({r:r},i);t+=m.size;m.clear();}return t+":"+m.size;}', inputs: [300] },
  { feature: 'gc-during-forEach-pins-current', source: 'function f(x){' + abc + 'm.forEach(function(v,k){s+=k;if(k==="a"){m.delete("a");for(let i=0;i<x;i++){const o={i:i};m.set(o,i);m.delete(o);}}});return s+m.size;}', inputs: [2500] },
  // nested forEach
  { feature: 'nested-forEach-pairs', source: 'function f(x){' + abc + 'm.forEach(function(v,k){m.forEach(function(w,j){s+=k+j;});s+=",";});return s;}', inputs: [0] },
  { feature: 'nested-forEach-inner-delete', source: 'function f(x){' + abc + 'm.set("d",4);m.forEach(function(v,k){s+=k+"(";m.forEach(function(w,j){s+=j;if(j===x)m.delete(j);});s+=")";});return s;}', inputs: ['c', 'a', 'd'] },
  { feature: 'nested-forEach-separate-maps', source: 'function f(x){const a=new Map(),b=new Map();a.set(1,"x");a.set(2,"y");b.set(3,"z");let s="";a.forEach(function(v,k,ma){b.forEach(function(w,j,mb){s+=v+w+(ma===a)+(mb===b);if(k===1)b.set(x,"q");});});return s;}', inputs: [4] },
];

// Rejected or not-yet-supported shapes (host rejection / status 6), each with
// the boundary that applies. Not value cases.
export const mapExtraUnsupportedSources = [
  { feature: 'for-of-over-map', source: 'function f(x){const m=new Map();m.set(1,2);let s=0;for(const e of m)s+=e[1];return s;}', expected: 'status 6 via __lanesUnsupported until the generic iterator protocol (1270..1273/2400..2499) lands' },
  { feature: 'new-Map-from-map', source: 'function f(x){const m=new Map();m.set(1,2);return new Map(m).size;}', expected: 'status 6 (Map instance iterable reaches the @@iterator guard)' },
  { feature: 'subclass-Map', source: 'function f(x){class M extends Map{}return new M().size;}', expected: 'status 6 (subclass NewTarget boundary)' },
  { feature: 'async-callback-source', source: 'async function f(x){return new Map().size;}', expected: 'SyntaxError: Expected one synchronous named function declaration' },
];

export const mapExtraResumptionSource = 'function f(x){"use strict";const m=new Map();m.set("a",1).set("b",2);let s="";m.forEach(function(v,k,map){s+=k+v+map.size;if(k==="a"){map.delete("b");map.set("c",x);map.forEach((w,j)=>{s+=j;});}},null);try{m.forEach(function(){throw 7;});}catch(e){s+=e;}const g=Object.getOwnPropertyDescriptor(Map.prototype,"size").get;return s+":"+g.call(m)+":"+m.delete("a")+m.size;}';
export const mapExtraResumptionExpected = 'a12ac' + 'c32' + '7:2:true1';

// Original sources remain required value cases now generic iteration is integrated.
export const mapExtraUnsupportedPostMergeExpected=Object.freeze([2,1]);
