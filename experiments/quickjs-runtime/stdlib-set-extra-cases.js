// Worker 4 cases: Set.prototype.size/clear/forEach and the ES2025 Set
// composition methods. Each source is one named synchronous function taking
// one input and returning a primitive. Expected values are native V8 (Node
// 26, ES2025 set methods) results, compared by check-stdlib-set-extra.mjs
// against the guest helpers running on the host collection model (oracle only).
// GPU runs are coordinator-owned. Sets are built with `new Set(array)` /
// `.add` (worker 3); Set arguments additionally need Set.prototype.keys and
// %SetIteratorPrototype%.next (collection-iterator worker): such cases carry
// requires:['setKeys'].
const S = 'function str(r){let o="";r.forEach(function(v){o+=String(v)+",";});return o;}';
const T = 'try{ROUTINE;}catch(e){n+=e instanceof TypeError?"T":e instanceof RangeError?"R":"?";}';
const tries = calls => 'let n="";' + calls.map(c => T.replace('ROUTINE', c)).join('') + 'return n;';
const methods = ['union', 'intersection', 'difference', 'symmetricDifference', 'isSubsetOf', 'isSupersetOf', 'isDisjointFrom'];
// A logging set-like: size getter (via valueOf), has/keys getters, keys()
// returning an iterator whose `next` getter and results' done/value getters
// log. `VALUES` is the list of yielded values; has(v) is true for HAS.
const like = (size, values, has) => `let s="";const vals=${values};const other={get size(){s+="S";return {valueOf(){s+="v";return ${size};}};},get has(){s+="H";return function(v){s+="h"+String(v);return ${has};};},get keys(){s+="K";return function(){s+="k";let i=0;return {get next(){s+="N";return function(){s+="n";const j=i++;return {get done(){s+="d";return j>=vals.length;},get value(){s+="="+String(vals[j]);return vals[j];}};};},get return(){s+="R";return undefined;}};};}};`;
const both = (body) => `function f(x){${S}${body}}`;

export const setExtraCases = [
  // size
  { feature: 'size-basic', source: 'function f(x){return new Set([1,2,2,x]).size;}', inputs: [3, 1, NaN, -0] },
  { feature: 'size-signed-zero-NaN', source: 'function f(x){const a=new Set();a.add(0);a.add(-0);a.add(NaN);a.add(0/0);a.add(x);return a.size;}', inputs: [0, NaN, 'a'] },
  { feature: 'size-after-delete-clear', source: 'function f(x){const a=new Set([1,2,3,x]);const p=a.size;a.delete(2);const q=a.size;a.clear();const r=a.size;a.add(9);return p+":"+q+":"+r+":"+a.size;}', inputs: [4, 1] },
  { feature: 'size-descriptor', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Set.prototype,"size");return typeof d.get+":"+d.set+":"+d.enumerable+":"+d.configurable+":"+d.get.name+":"+d.get.length+":"+("value" in d);}', inputs: [0] },
  { feature: 'size-brand', source: 'function f(x){const g=Object.getOwnPropertyDescriptor(Set.prototype,"size").get;' + tries(['g.call({})', 'g.call(Set.prototype)', 'g.call(new Map())', 'g.call(x)', 'Set.prototype.size']) + '}', inputs: [1, undefined] },
  { feature: 'size-inherited-object', source: 'function f(x){const o=Object.create(new Set([x]));try{return o.size;}catch(e){return e instanceof TypeError;}}', inputs: [1] },
  // clear
  { feature: 'clear-basic', source: 'function f(x){const a=new Set([1,2,x]);const r=a.clear();return (r===undefined)+":"+a.size+":"+a.has(1)+":"+a.has(x);}', inputs: [3, 'q'] },
  { feature: 'clear-then-add-order', source: both('const a=new Set([1,2,3]);a.clear();a.add(x);a.add(1);return str(a)+a.size;'), inputs: [7] },
  { feature: 'clear-metadata', source: 'function f(x){const d=Object.getOwnPropertyDescriptor(Set.prototype,"clear");return d.value.name+":"+d.value.length+":"+d.writable+":"+d.enumerable+":"+d.configurable;}', inputs: [0] },
  { feature: 'clear-brand', source: 'function f(x){const c=Set.prototype.clear;' + tries(['c.call({})', 'c.call(Set.prototype)', 'c.call(new Map())', 'c.call(x)']) + '}', inputs: [1] },
  // forEach basics
  { feature: 'forEach-args-thisArg', source: 'function f(x){const a=new Set([x,"b",true]);const o={};let s="";a.forEach(function(v,k,t){s+=String(v)+"="+String(k)+":"+(t===a)+(this===o)+arguments.length+";";},o);return s;}', inputs: [1, null] },
  { feature: 'forEach-thisArg-strict-undefined', source: 'function f(x){"use strict";const a=new Set([x]);let s="";a.forEach(function(){s+=typeof this;});a.forEach(function(){s+=typeof this;},x);return s;}', inputs: [1, 'a'] },
  { feature: 'forEach-returns-undefined-metadata', source: 'function f(x){const a=new Set([1,2]);let c=0;const r=a.forEach(function(){c++;return 5;});const d=Object.getOwnPropertyDescriptor(Set.prototype,"forEach");return (r===undefined)+":"+c+":"+d.value.name+":"+d.value.length+":"+d.writable+d.enumerable+d.configurable;}', inputs: [0] },
  { feature: 'forEach-noncallable-first', source: 'function f(x){let reads=0;const a=new Set([{get k(){reads++;return 1;}}]);' + tries(['a.forEach(x)', 'a.forEach({})', 'Set.prototype.forEach.call({},function(){reads++;})', 'Set.prototype.forEach.call(new Map(),x)']) + '}', inputs: [undefined, null, 1, 's'] },
  { feature: 'forEach-callback-throws', source: 'function f(x){const a=new Set([1,2,3]);let c=0;try{a.forEach(function(v){c++;if(v===2)throw x;});}catch(e){return (e===x)+":"+c;}return "no";}', inputs: [5] },
  { feature: 'forEach-signed-zero', source: 'function f(x){let r="";new Set([x]).forEach(function(v,k){r=Object.is(v,0)+":"+Object.is(k,0);});return r;}', inputs: [-0, 0] },
  { feature: 'forEach-append-visited', source: 'function f(x){const a=new Set([1,2]);let s="";a.forEach(function(v){s+=v;if(v<x)a.add(v+2);});return s+":"+a.size;}', inputs: [5, 1] },
  { feature: 'forEach-delete-unvisited-skipped', source: 'function f(x){const a=new Set([1,2,3,4]);let s="";a.forEach(function(v){s+=v;if(v===1){a.delete(3);a.delete(x);}});return s+":"+a.size;}', inputs: [4, 1, 9] },
  { feature: 'forEach-delete-readd-visited', source: 'function f(x){const a=new Set([1,2,3]);let s="",once=true;a.forEach(function(v){s+=v;if(v===3&&once){once=false;a.delete(x);a.add(x);}});return s;}', inputs: [1, 3] },
  { feature: 'forEach-delete-current-readd', source: 'function f(x){const a=new Set([1,2,3]);let s="";a.forEach(function(v){s+=v;if(v===2&&s.length<5){a.delete(2);a.add(2);}});return s+":"+a.size;}', inputs: [0] },
  { feature: 'forEach-clear-add-continues', source: 'function f(x){const a=new Set([1,2,3]);let s="";a.forEach(function(v){s+=v;if(v===2){a.clear();a.add(x);a.add(1);}});return s+":"+a.size;}', inputs: [7, 3] },
  { feature: 'forEach-clear-only-stops', source: 'function f(x){const a=new Set([1,2,3]);let s="";a.forEach(function(v){s+=v;a.clear();});return s+":"+a.size;}', inputs: [0] },
  // composition metadata and brand
  { feature: 'composition-metadata', source: 'function f(x){let s="";const m=' + JSON.stringify(methods) + ';for(let i=0;i<m.length;i++){const d=Object.getOwnPropertyDescriptor(Set.prototype,m[i]);s+=d.value.name+d.value.length+d.writable+d.enumerable+d.configurable+",";}return s;}', inputs: [0] },
  { feature: 'composition-brand', source: 'function f(x){if(x==="__fixture_object__")x={};const o={size:0,has(){},keys(){}};' + tries(methods.map(m => `Set.prototype.${m}.call(x,o)`)) + '}', inputs: ['__fixture_object__', 1, undefined] },
  { feature: 'composition-brand-before-record', source: 'function f(x){let s="";const o={get size(){s+="S";return 0;}};let n=0;' + methods.map(m => `try{Set.prototype.${m}.call(new Map(),o);}catch(e){if(e instanceof TypeError)n++;}`).join('') + 'return n+":"+s;}', inputs: [0] },
  { feature: 'composition-result-fresh-set', source: 'function f(x){const a=new Set([1]);const o={size:1,has(v){return true;},keys(){return {next(){return {done:true};}};}};const u=a.union(o),i=a.intersection(o),d=a.difference(o),y=a.symmetricDifference(o);return (u!==a)+":"+(Object.getPrototypeOf(u)===Set.prototype)+(Object.getPrototypeOf(i)===Set.prototype)+(Object.getPrototypeOf(d)===Set.prototype)+(Object.getPrototypeOf(y)===Set.prototype)+":"+(u!==y)+":"+u.has(1)+i.has(1)+d.has(1)+y.has(1);}', inputs: [0] },
  // GetSetRecord errors and order
  { feature: 'record-non-object', source: 'function f(x){const a=new Set([1]);' + tries(methods.map(m => `a.${m}(x)`)) + '}', inputs: [undefined, null, 1, 's', true] },
  { feature: 'record-size-conversions', source: 'function f(x){const a=new Set([1]);const k=function(){return {next(){return {done:true};}};};let r="";const z=[undefined,NaN,"x",{},-1,-Infinity,-0.5,"2",Infinity,null,true,1.9];for(let i=0;i<z.length;i++){try{r+=a.union({size:z[i],has(){},keys:k}).size;}catch(e){r+=e instanceof TypeError?"T":e instanceof RangeError?"R":"?";}}return r;}', inputs: [0] },
  { feature: 'record-size-bigint-symbol', source: 'function f(x){const a=new Set([1]);const k=function(){return {next(){return {done:true};}};};' + tries(['a.union({size:1n,has(){},keys:k})', 'a.union({size:Symbol(),has(){},keys:k})']) + '}', inputs: [0] },
  { feature: 'record-order-has-noncallable', source: 'function f(x){if(x==="__fixture_object__")x={};' + like(1, '[]', 'true').replace('get has(){s+="H";return function(v){s+="h"+String(v);return true;};}', 'get has(){s+="H";return x;}') + 'try{new Set([1]).union(other);}catch(e){return s+":"+(e instanceof TypeError);}return "no";}', inputs: [undefined, 1, '__fixture_object__'] },
  { feature: 'record-order-keys-noncallable', source: 'function f(x){let s="";const o={get size(){s+="S";return 1;},get has(){s+="H";return function(){};},get keys(){s+="K";return x;}};try{new Set([1]).isSubsetOf(o);}catch(e){return s+":"+(e instanceof TypeError);}return "no";}', inputs: [undefined, null, 'k'] },
  { feature: 'record-order-negative-before-has', source: 'function f(x){let s="";const o={get size(){s+="S";return x;},get has(){s+="H";return function(){};},keys(){}};try{new Set([1]).intersection(o);}catch(e){return s+":"+(e instanceof RangeError)+(e instanceof TypeError);}return "no";}', inputs: [-1, NaN, undefined] },
  { feature: 'record-size-getter-throws', source: 'function f(x){const o={get size(){throw x;}};try{new Set([1]).difference(o);}catch(e){return e===x;}return "no";}', inputs: [3] },
  { feature: 'record-size-integer-branch', source: 'function f(x){let s="";const o={size:x,has(v){s+="h";return true;},keys(){s+="k";return {next(){return {done:true};}};}};new Set([1,2,3]).intersection(o);new Set([1,2,3]).isDisjointFrom(o);return s;}', inputs: [2.9, 3, 3.5, Infinity, 0.5] },
  { feature: 'keys-result-non-object', source: 'function f(x){const o={size:0,has(){},keys(){return x;}};' + tries(['new Set([1]).union(o)', 'new Set([1]).symmetricDifference(o)', 'new Set([1,2]).intersection(o)', 'new Set([1,2]).difference(o)', 'new Set([1]).isSupersetOf(o)', 'new Set([1]).isDisjointFrom(o)']) + '}', inputs: [undefined, 1, 's'] },
  { feature: 'next-result-non-object', expected: ['TTTTTT','TTTTTT','TTTTTT'], specNote: 'ES2025 IteratorNext (7.4.6) throws TypeError when next returns a non-object: https://tc39.es/ecma262/2025/multipage/abstract-operations.html#sec-iteratornext . Safari native worker returns TTTTTT for undefined but times out for 1 and string s (quickjs-safari-native-set-worker-probe.json); GPU must return the fixed normative value.', source: 'function f(x){const o={size:0,has(){},keys(){return {next(){return x;}};}};' + tries(['new Set([1]).union(o)', 'new Set([1]).symmetricDifference(o)', 'new Set([1,2]).intersection(o)', 'new Set([1,2]).difference(o)', 'new Set([1]).isSupersetOf(o)', 'new Set([1]).isDisjointFrom(o)']) + '}', inputs: [undefined, 1, 's'] },
  { feature: 'next-noncallable', source: 'function f(x){let s="";const o={size:0,has(){},keys(){s+="k";return {get next(){s+="N";return x;}};}};' + tries(['new Set([1]).union(o)', 'new Set([1]).isSupersetOf(o)']) + '+":"+s;}', inputs: [undefined, 1] },
  { feature: 'has-throws-propagates', source: 'function f(x){const o={size:9,has(){throw x;},keys(){}};try{new Set([1]).isSubsetOf(o);}catch(e){return e===x;}return "no";}', inputs: [4] },
  { feature: 'has-result-ToBoolean', source: 'function f(x){if(x==="__fixture_object__")x={};const o={size:9,has(){return x;},keys(){}};const a=new Set([1,2]);return a.intersection(o).size+":"+a.difference(o).size+":"+a.isSubsetOf(o)+":"+a.isDisjointFrom(o);}', inputs: [0, '', 'a', '__fixture_object__', null, NaN, 1n] },
  { feature: 'done-ToBoolean', source: 'function f(x){if(x==="__fixture_object__")x={};let c=0;const o={size:0,has(){},keys(){return {next(){c++;return c>3?{done:x,value:9}:{done:c===3?x:0,value:c};}};}};const r=new Set().union(o);let t="";r.forEach(function(v){t+=v;});return t+":"+c;}', inputs: [1, 'y', true, '__fixture_object__'] },
  // union
  { feature: 'union-set-like-log', source: both(like(2, '[3,1,4,-0]', 'false') + 'const r=new Set([1,2]).union(other);return s+"|"+str(r)+r.size;'), inputs: [0] },
  { feature: 'union-sets', requires: ['setKeys'], source: both('const a=new Set([1,2,3]);const r=a.union(new Set([3,x,5,1]));return str(r)+":"+r.size+":"+a.size;'), inputs: [4, 2] },
  { feature: 'union-keys-mutates-this', source: both('const a=new Set([1,2]);const o={size:1,has(){},keys(){a.add(x);a.delete(1);let i=0;return {next(){a.add(50+i);return i++?{done:true}:{done:false,value:7};}};}};return str(a.union(o))+"|"+str(a);'), inputs: [9] },
  { feature: 'union-negative-zero', source: 'function f(x){const o={size:1,has(){},keys(){let d=false;return {next(){const r={done:d,value:-0};d=true;return r;}};}};let r="";new Set(x?[0]:[1]).union(o).forEach(function(v){r+=Object.is(v,-0)?"m":"p";});return r;}', inputs: [0, 1] },
  // intersection
  { feature: 'intersection-this-smaller-log', source: both(like(5, '[]', 'v!==2') + 'const r=new Set([1,2,3]).intersection(other);return s+"|"+str(r);'), inputs: [0] },
  { feature: 'intersection-this-larger-log', source: both(like(1, '[4,2,9,2,-0]', 'true') + 'const r=new Set([0,5,4,3,2,1]).intersection(other);return s+"|"+str(r)+r.size;'), inputs: [0] },
  { feature: 'intersection-sets-order', requires: ['setKeys'], source: both('const a=new Set([5,4,3,2,1]);return str(a.intersection(new Set([2,4])))+"|"+str(new Set([2,4,x]).intersection(a));'), inputs: [1, 9] },
  { feature: 'intersection-has-readds', source: both('const a=new Set([1,2,3]);let s="",once=true;const o={size:9,has(v){s+="h"+v;if(v===1&&once){once=false;a.delete(1);a.add(1);}return v!==x;},keys(){}};const r=a.intersection(o);return s+"|"+str(r)+"|"+str(a);'), inputs: [2, 1] },
  { feature: 'intersection-has-appends-this', source: both('const a=new Set([1,2]);let s="";const o={size:9,has(v){s+=v;if(v<x)a.add(v+2);return v%2===1;},keys(){}};return s+"|"+str(a.intersection(o))+(s);'), inputs: [5] },
  { feature: 'intersection-negative-zero', source: 'function f(x){const o={size:0,has(){},keys(){let d=false;return {next(){const r={done:d,value:-0};d=true;return r;}};}};let r="";new Set([0,1]).intersection(o).forEach(function(v){r+=Object.is(v,-0)?"m":"p";});return r+x;}', inputs: [0] },
  // difference
  { feature: 'difference-this-smaller-log', source: both(like(3, '[]', 'v===2') + 'const r=new Set([1,2,3]).difference(other);return s+"|"+str(r);'), inputs: [0] },
  { feature: 'difference-this-larger-log', source: both(like(1, '[3,9,-0,3]', 'true') + 'const r=new Set([0,1,2,3]).difference(other);return s+"|"+str(r);'), inputs: [0] },
  { feature: 'difference-has-mutates-this-ignored', source: both('const a=new Set([1,2,3]);let s="";const o={size:9,has(v){s+=v;a.add(v+10);a.delete(3);return v===x;},keys(){}};return s+"|"+str(a.difference(o))+"|"+str(a);'), inputs: [1, 3] },
  { feature: 'difference-sets', requires: ['setKeys'], source: both('const a=new Set([1,2,3,4]);return str(a.difference(new Set([2,x])))+"|"+str(a.difference(new Set([0,9,8,7,6,1])));'), inputs: [4, 5] },
  // symmetricDifference
  { feature: 'symmetricDifference-log', source: both(like(0, '[3,4,1,4,1,-0]', 'true') + 'const r=new Set([0,1,2,3]).symmetricDifference(other);return s+"|"+str(r);'), inputs: [0] },
  { feature: 'symmetricDifference-sets', requires: ['setKeys'], source: both('return str(new Set([1,2,3]).symmetricDifference(new Set([3,x,1,5])));'), inputs: [4, 2] },
  { feature: 'symmetricDifference-keys-mutates-this', source: both('const a=new Set([1,2]);let i=0;const o={size:0,has(){},keys(){return {next(){if(i===0)a.add(3);if(i===1)a.delete(1);i++;return i>3?{done:true}:{done:false,value:i};}};}};return str(a.symmetricDifference(o))+"|"+str(a);'), inputs: [0] },
  // predicates
  { feature: 'isSubsetOf-size-shortcut-log', source: 'function f(x){' + like(1, '[]', 'true') + 'return new Set([1,2]).isSubsetOf(other)+":"+s;}', inputs: [0] },
  { feature: 'isSubsetOf-has-log', source: 'function f(x){' + like(5, '[]', 'v!==x') + 'return new Set([1,2,3]).isSubsetOf(other)+":"+s;}', inputs: [2, 9] },
  { feature: 'isSubsetOf-live-append', source: 'function f(x){const a=new Set([1]);let s="";const o={size:9,has(v){s+=v;if(v<x)a.add(v+1);return true;},keys(){}};return a.isSubsetOf(o)+":"+s;}', inputs: [4] },
  { feature: 'isSupersetOf-size-shortcut-log', source: 'function f(x){' + like(3, '[1]', 'true') + 'return new Set([1,2]).isSupersetOf(other)+":"+s;}', inputs: [0] },
  { feature: 'isSupersetOf-close-log', source: 'function f(x){' + like(1, '[1,x,2]', 'true') + 'return new Set([1,2]).isSupersetOf(other)+":"+s;}', inputs: [2, 7, -0] },
  { feature: 'isSupersetOf-return-called', source: 'function f(x){if(x==="__fixture_object__")x={};let s="";const it={next(){s+="n";return {done:false,value:9};},return(){s+="r"+arguments.length+(this===it);return x;}};const o={size:0,has(){},keys(){return it;}};try{return new Set([1]).isSupersetOf(o)+":"+s;}catch(e){return (e instanceof TypeError)+":"+s;}}', inputs: ['__fixture_object__', 1, undefined] },
  { feature: 'isSupersetOf-return-noncallable', source: 'function f(x){if(x==="__fixture_object__")x={};const o={size:0,has(){},keys(){return {next(){return {done:false,value:9};},return:x};}};try{return new Set([1]).isSupersetOf(o);}catch(e){return e instanceof TypeError;}}', inputs: [undefined, null, 1, '__fixture_object__'] },
  { feature: 'isDisjointFrom-has-branch', source: 'function f(x){' + like(9, '[]', 'v===x') + 'return new Set([1,2,3]).isDisjointFrom(other)+":"+s;}', inputs: [2, 7] },
  { feature: 'isDisjointFrom-keys-close', source: 'function f(x){let s="";const o={size:1,has(){},keys(){let i=0;return {next(){i++;s+="n"+i;return {done:i>3,value:i===2?x:10+i};},return(){s+="r";return {};}};}};return new Set([1,2,3]).isDisjointFrom(o)+":"+s;}', inputs: [2, 9, -0] },
  { feature: 'isDisjointFrom-keys-negative-zero', source: 'function f(x){const o={size:0,has(){},keys(){let d=false;return {next(){const r={done:d,value:-0};d=true;return r;},return(){return {};}};}};return new Set([x]).isDisjointFrom(o);}', inputs: [0, 1] },
  { feature: 'predicates-sets', requires: ['setKeys'], source: 'function f(x){const a=new Set([1,2]),b=new Set([1,2,x]),c=new Set([8,9]);return ""+a.isSubsetOf(b)+b.isSubsetOf(a)+b.isSupersetOf(a)+a.isSupersetOf(b)+a.isDisjointFrom(c)+b.isDisjointFrom(a)+a.isSubsetOf(a)+c.isSupersetOf(new Set());}', inputs: [3, 1] },
  { feature: 'predicates-empty', source: 'function f(x){const e=new Set(),o={size:x,has(){return true;},keys(){return {next(){return {done:true};}};}};return ""+e.isSubsetOf(o)+e.isSupersetOf(o)+e.isDisjointFrom(o)+new Set([1]).isSupersetOf(o)+new Set([1]).isDisjointFrom(o);}', inputs: [0, 1] },
  { feature: 'set-argument-own-has-used', requires: ['setKeys'], source: both('const b=new Set([1]);b.has=function(v){return v===x;};return str(new Set([1,2,3]).intersection(b))+"|"+str(new Set([5]).intersection(b));'), inputs: [2, 1] },
  // GC: heap pressure while composition results are being built (2048 nodes).
  { feature: 'composition-gc-pressure', source: 'function f(x){const a=new Set(),b=new Set();for(let i=0;i<x;i++){a.add(i);b.add(i+(x>>1));}let g=0;const o={size:x*2,has(v){for(let j=0;j<3;j++)g+=({p:j,q:v}).p;return v%2===0;},keys(){return {next(){g+=({p:1}).p;return {done:true};}};}};const small={size:2,has(){},keys(){let i=0;return {next(){const r={done:i>=x,value:i*3};i++;return r;}};}};const u=a.union(small),n=a.intersection(o),d=a.difference(o),y=a.symmetricDifference(small),k=a.intersection(small);let t=0;u.forEach(function(v){t+=v;});y.forEach(function(v){t+=v;});return u.size+":"+n.size+":"+d.size+":"+y.size+":"+k.size+":"+t+":"+a.isSubsetOf(o)+":"+(g>0)+":"+b.size;}', inputs: [120] },
];

export const setExtraResumptionSource = 'function f(x){let s="";const a=new Set([1,2,3]);const o={get size(){s+="S";return {valueOf(){s+="v";return 2;}};},get has(){s+="H";return function(v){s+="h"+v;return v===x;};},get keys(){s+="K";return function(){s+="k";let i=0;return {get next(){s+="N";return function(){i++;s+="n";return {done:i>2,value:i+1};};},return(){s+="r";return {};}};};}};let t="";a.union(o).forEach(function(v){t+=v;});a.forEach(function(v){if(v===1)a.add(4);t+=v;});a.delete(4);a.delete(1);const p=a.isSubsetOf(o),q=a.isSupersetOf(o),n=a.intersection(o).size;return s+":"+t+":"+p+q+n;}';
export const setExtraResumptionExpected = "SvHKkNnnnSvHKh2SvHKkNnnnSvHKh2h3:1231234:falsetrue1";

// Must stay host rejections (status 6), never a guest catch.
export const setExtraUnsupportedSources = [
  'function f(x){try{return new Set(new Set([x])).size;}catch(e){return "wrong guest catch";}}',
  'function f(x){class S extends Set{}try{return new S([x]).union(new Set()).size;}catch(e){return "wrong guest catch";}}',
];

// Original sources remain required value cases now generic iteration is integrated.
export const setExtraUnsupportedPostMergeExpected=Object.freeze([1]);
