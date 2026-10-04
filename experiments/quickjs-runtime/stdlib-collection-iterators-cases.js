// Worker 5 fixtures: Map/Set iterator objects. One named sync `function f(x)`
// per source, one input, primitive result. Iterators are driven by manual
// `it.next()` loops (no generic GetIterator needed). Expected values are
// exact (V8 reference, re-verified by check-stdlib-collection-iterators.mjs).
const DK = 'function drain(it){let s="",r;while(!(r=it.next()).done)s+=r.value+",";return s;}';
const DE = 'function drainE(it){let s="",r;while(!(r=it.next()).done)s+=r.value[0]+"="+r.value[1]+",";return s;}';
const MK = 'const m=new Map();m.set("a",1);m.set("b",2);m.set("c",3);m.set("d",4);';
const SK = 'const s=new Set();s.add("a");s.add("b");s.add("c");s.add("d");';
const MAPNEXT = 'Object.getPrototypeOf(new Map().keys()).next';
const SETNEXT = 'Object.getPrototypeOf(new Set().values()).next';
// Exact expected results (primitive), keyed by feature.
const EXPECTED = Object.freeze({
  'map-entries-order': 'a=3,b=4,3=c,true=null,undefined=-1.5,',
  'map-keys-order': 'z,3,a,-3,',
  'map-values-order': '3,v,9,false,',
  'map-symbol-iterator-entries': 'a=1,b=2,c=3,d=4,e=3,',
  'map-entries-are-arrays': 4,
  'set-values-order': 'z,3,null,-3,',
  'set-keys-order': 'a,b,c,d,3,',
  'set-entries-pairs': '4:a=a,b=b,c=c,d=d,',
  'set-symbol-iterator': 'a,c,d,',
  'map-borrowed-call': '1,2,3,4,a,b,c,d,',
  'map-delete-ahead': 'abd:3',
  'map-delete-behind-reinsert': 'a1b2c3d4a30:4',
  'map-delete-current-reinsert': 'a1b2c3d4b93',
  'map-clear-then-add': 'a1b2x3a8:2',
  'map-clear-at-last-then-add': 'abcdz:1',
  'map-set-existing-updates-value': 'a1,b2,c300,d4,-7',
  'map-add-during': '8:28',
  'map-delete-all-remaining': 'a:true:true:1',
  'map-iterator-before-entries': 'p=3,q=4,',
  'map-empty-stepped-sticky': 'true:true:1',
  'map-exhaustion-sticky': '1,2,3,4,truetruetruetrue',
  'map-two-iterators': 'abadbdtruetrue',
  'map-negative-zero-key': 'true:false:1:p',
  'map-nan-key': 'true:3:1',
  'map-object-key-identity': 'true:true:true',
  'set-delete-ahead': 'ac:2',
  'set-delete-behind-reinsert': 'abcda:4',
  'set-delete-current-reinsert': 'abcda',
  'set-clear-then-add': 'ab3a:2',
  'set-add-during': '1,2,4,8,16,32,',
  'set-add-existing-no-reorder': 'b,c,d,|a,b,c,d,',
  'set-exhaustion-sticky': '4:true:true:new,',
  'set-two-iterators': 'aaccdetrued',
  'set-empty-unstarted-sees-adds': '4,',
  'map-next-wrong-receivers': 8,
  'set-next-wrong-receivers': 6,
  'map-next-on-set-iterator': 'true:3',
  'set-next-on-map-iterator': 'true:3',
  'creator-wrong-receivers': 8,
  'method-identities': 'true:true:true:true',
  'method-names-lengths': 'entries,keys,values,entries,values,values,entries,values|00000',
  'method-descriptors': 'true:false:true:true:false:true:true',
  'iterator-prototype-identity': 'true:true:true:true:true:true',
  'iterator-to-string-tags': '[object Map Iterator][object Set Iterator][object Map Iterator][object Set Iterator]',
  'iterator-to-string-tag-descriptors': 'Map Iterator:false:false:true|Set Iterator:false:false:true',
  'next-name-length-descriptor': 'next0next0:truefalsetrue:truefalsetrue:true:function',
  'iterator-own-properties': 'false:3:1:true:object',
  'entries-arrays-fresh': 'true:true:1:2:1:b',
  'set-entries-arrays-fresh': 'true:3:3:true',
  'result-objects-shape': 'true:2valuedone:true:false:true:true:true:true:2',
  'result-object-writable': '100:4:false:true',
  'gc-map-pinned-deleted-entry': '5=15,6=18,7=21,8=24,9=27,10=30,11=33,2=-1,|31836|9',
  'gc-set-pinned-deleted-chain': 'k10,k11,k12,k13,k14,k15,k3,late3,|941676|10',
  'gc-map-delete-reinsert-churn': '559240|4000|10|3=571,6=573,9=573,8=568,1=571,4=573,7=571,0=574,2=570,5=572,true',
  'gc-set-delete-reinsert-churn': '878686|3500|53172|9|21,6,9,18,3,0,12,24,15,',
  'gc-iterator-keeps-collection-alive': '570:19:46890',
  // Post-merge (requiresGenericIteration).
  'post-for-of-map': '1=3,2=6,',
  'post-for-of-set': '3,b,',
  'post-spread-map': '2:a3:b1',
  'post-spread-set-values': '2:3:4',
  'post-destructure-set': '3:4:undefined',
  'post-destructure-map': 'k3',
  'post-array-from-map': '2:4',
  'post-for-of-map-keys': 6,
  'post-iterator-self-iterable': 'true:true',
  'post-map-copy-constructor': '2:4:true',
  'post-set-copy-constructor': 2,
  'post-for-of-delete-ahead': '134',
  'post-for-of-break': 3,
  'post-iterator-prototype-chain': 'true:true',
});
const c = (feature, input, source, extra = {}) => {
  if (!Object.hasOwn(EXPECTED, feature)) throw new Error(`missing expected value for ${feature}`);
  return Object.freeze({ feature, input, expected: EXPECTED[feature], source, ...extra });
};

export const collectionIteratorCases = Object.freeze([
  // Kinds and order.
  c('map-entries-order', 3,`function f(x){${DE}const m=new Map();m.set("a",x);m.set("b",x+1);m.set(3,"c");m.set(true,null);m.set(undefined,-1.5);return drainE(m.entries());}`),
  c('map-keys-order', 3,`function f(x){${DK}const m=new Map();m.set("z",1);m.set(x,2);m.set("a",3);m.set(-x,4);return drain(m.keys());}`),
  c('map-values-order', 3,`function f(x){${DK}const m=new Map();m.set("z",x);m.set("y","v");m.set("x",x*x);m.set("w",false);return drain(m.values());}`),
  c('map-symbol-iterator-entries', 3,`function f(x){${DE}${MK}m.set("e",x);return drainE(m[Symbol.iterator]());}`),
  c('map-entries-are-arrays', 3,`function f(x){${MK}const it=m.entries();let n=0,r;while(!(r=it.next()).done){if(Array.isArray(r.value)&&r.value.length===2)n++;}return n;}`),
  c('set-values-order', 3,`function f(x){${DK}const s=new Set();s.add("z");s.add(x);s.add(null);s.add(-x);s.add("z");return drain(s.values());}`),
  c('set-keys-order', 3,`function f(x){${DK}${SK}s.add(x);return drain(s.keys());}`),
  c('set-entries-pairs', 3,`function f(x){${DE}${SK}const it=s.entries();let same=0,r;while(!(r=it.next()).done){if(r.value[0]===r.value[1]&&r.value.length===2)same++;}return same+":"+drainE(s.entries());}`),
  c('set-symbol-iterator', 3,`function f(x){${DK}${SK}s.delete("b");return drain(s[Symbol.iterator]());}`),
  c('map-borrowed-call', 3,`function f(x){${DK}${MK}return drain(Map.prototype.values.call(m))+drain(Map.prototype.keys.call(m));}`),
  // Map mutation during iteration.
  c('map-delete-ahead', 3,`function f(x){${MK}const it=m.keys();let s="",r;while(!(r=it.next()).done){s+=r.value;if(r.value==="a")m.delete("c");}return s+":"+m.size;}`),
  c('map-delete-behind-reinsert', 3,`function f(x){${MK}const it=m.entries();let s="",once=true,r;while(!(r=it.next()).done){s+=r.value[0]+r.value[1];if(r.value[0]==="c"&&once){once=false;m.delete("a");m.set("a",x*10);}}return s+":"+m.size;}`),
  c('map-delete-current-reinsert', 3,`function f(x){${MK}const it=m.entries();let s="",once=true,r;while(!(r=it.next()).done){s+=r.value[0]+r.value[1];if(r.value[0]==="b"&&once){once=false;m.delete("b");m.set("b",x+90);}}return s;}`),
  c('map-clear-then-add', 3,`function f(x){${MK}const it=m.entries();let s="",r;while(!(r=it.next()).done){s+=r.value[0]+r.value[1];if(r.value[0]==="b"){m.clear();m.set("x",x);m.set("a",8);}}return s+":"+m.size;}`),
  c('map-clear-at-last-then-add', 3,`function f(x){${MK}const it=m.keys();let s="",r;while(!(r=it.next()).done){s+=r.value;if(r.value==="d"){m.clear();m.set("z",x);}}return s+":"+m.size;}`),
  c('map-set-existing-updates-value', 3,`function f(x){${MK}const it=m.entries();let s="",r;while(!(r=it.next()).done){s+=r.value[0]+r.value[1]+",";if(r.value[0]==="a"){m.set("c",x*100);m.set("a",-7);}}return s+m.get("a");}`),
  c('map-add-during', 3,`function f(x){const m=new Map();m.set(0,0);const it=m.keys();let s=0,n=0,r;while(!(r=it.next()).done){n++;s+=r.value;if(m.size<x+5)m.set(m.size,m.size*2);}return n+":"+s;}`),
  c('map-delete-all-remaining', 3,`function f(x){${MK}const it=m.keys();const a=it.next();m.delete("b");m.delete("c");m.delete("d");const b=it.next();return a.value+":"+b.done+":"+(b.value===undefined)+":"+m.size;}`),
  c('map-iterator-before-entries', 3,`function f(x){${DE}const m=new Map();const it=m.entries();m.set("p",x);m.set("q",x+1);return drainE(it);}`),
  c('map-empty-stepped-sticky', 3,`function f(x){const m=new Map();const it=m.keys();const a=it.next().done;m.set(1,x);const b=it.next().done;return a+":"+b+":"+m.size;}`),
  c('map-exhaustion-sticky', 3,`function f(x){${DK}${MK}const it=m.values();const s=drain(it);m.set("e",x);m.delete("a");m.set("a",1);const r1=it.next(),r2=it.next();return s+r1.done+r2.done+(r1.value===undefined)+(r1!==r2);}`),
  c('map-two-iterators', 3,`function f(x){${MK}const i1=m.keys(),i2=m.keys();let s="";s+=i1.next().value;s+=i1.next().value;s+=i2.next().value;m.delete("c");s+=i1.next().value;s+=i2.next().value;s+=i2.next().value;s+=i1.next().done;s+=i2.next().done;return s;}`),
  c('map-negative-zero-key', 3,`function f(x){const m=new Map();m.set(-0,"z");m.set(0,"p");const k=m.keys().next().value;return Object.is(k,0)+":"+Object.is(k,-0)+":"+m.size+":"+m.values().next().value;}`),
  c('map-nan-key', 3,`function f(x){const m=new Map();m.set(NaN,1);m.set(0/0,x);const r=m.entries().next().value;return (r[0]!==r[0])+":"+r[1]+":"+m.size;}`),
  c('map-object-key-identity', 3,`function f(x){const o={v:x},g=function(){};const m=new Map();m.set(o,1);m.set(g,2);const it=m.keys();return (it.next().value===o)+":"+(it.next().value===g)+":"+it.next().done;}`),
  // Set mutation during iteration.
  c('set-delete-ahead', 3,`function f(x){${SK}const it=s.values();let o="",r;while(!(r=it.next()).done){o+=r.value;if(r.value==="a"){s.delete("b");s.delete("d");}}return o+":"+s.size;}`),
  c('set-delete-behind-reinsert', 3,`function f(x){${SK}const it=s.values();let o="",once=true,r;while(!(r=it.next()).done){o+=r.value;if(r.value==="c"&&once){once=false;s.delete("a");s.add("a");}}return o+":"+s.size;}`),
  c('set-delete-current-reinsert', 3,`function f(x){${SK}const it=s.values();let o="",once=true,r;while(!(r=it.next()).done){o+=r.value;if(r.value==="a"&&once){once=false;s.delete("a");s.add("a");}}return o;}`),
  c('set-clear-then-add', 3,`function f(x){${SK}const it=s.values();let o="",r;while(!(r=it.next()).done){o+=r.value;if(r.value==="b"){s.clear();s.add(x);s.add("a");}}return o+":"+s.size;}`),
  c('set-add-during', 3,`function f(x){const s=new Set();s.add(1);const it=s.values();let o="",r;while(!(r=it.next()).done){o+=r.value+",";if(r.value<x*10)s.add(r.value*2);}return o;}`),
  c('set-add-existing-no-reorder', 3,`function f(x){${DK}${SK}const it=s.values();it.next();s.add("c");s.add("a");return drain(it)+"|"+drain(s.values());}`),
  c('set-exhaustion-sticky', 3,`function f(x){${DK}${SK}const it=s.entries();let n=0;while(!it.next().done)n++;s.add(x);s.clear();s.add("new");return n+":"+it.next().done+":"+it.next().done+":"+drain(s.values());}`),
  c('set-two-iterators', 3,`function f(x){${SK}const i1=s.values(),i2=s.entries();let o="";o+=i1.next().value;o+=i2.next().value[1];s.delete("b");s.add("e");o+=i1.next().value;o+=i2.next().value[0];o+=i1.next().value;o+=i1.next().value;o+=i1.next().done;o+=i2.next().value[1];return o;}`),
  c('set-empty-unstarted-sees-adds', 3,`function f(x){${DK}const s=new Set();const it=s.values();s.add(x);s.add(x+1);s.delete(x);return drain(it);}`),
  // Brand checks (catchable TypeError).
  c('map-next-wrong-receivers', 3,`function f(x){const next=${MAPNEXT};const bad=[{},undefined,null,x,"s",new Map(),Object.getPrototypeOf(new Map().keys()),[]];let n=0;for(let i=0;i<bad.length;i++){try{next.call(bad[i]);}catch(e){if(e instanceof TypeError)n++;}}return n;}`),
  c('set-next-wrong-receivers', 3,`function f(x){const next=${SETNEXT};const bad=[{},undefined,true,x,new Set(),Object.getPrototypeOf(new Set().values())];let n=0;for(let i=0;i<bad.length;i++){try{next.call(bad[i]);}catch(e){if(e instanceof TypeError)n++;}}return n;}`),
  c('map-next-on-set-iterator', 3,`function f(x){const next=${MAPNEXT};const s=new Set();s.add(x);const it=s.values();try{next.call(it);return "no error";}catch(e){return (e instanceof TypeError)+":"+it.next().value;}}`),
  c('set-next-on-map-iterator', 3,`function f(x){const next=${SETNEXT};const m=new Map();m.set(x,1);const it=m.keys();try{next.call(it);return "no error";}catch(e){return (e instanceof TypeError)+":"+it.next().value;}}`),
  c('creator-wrong-receivers', 3,`function f(x){const calls=[function(){return Map.prototype.entries.call(new Set());},function(){return Map.prototype.keys.call({});},function(){return Map.prototype.values.call(undefined);},function(){return Map.prototype[Symbol.iterator].call(null);},function(){return Set.prototype.values.call(new Map());},function(){return Set.prototype.entries.call([]);},function(){return Set.prototype.keys.call(x);},function(){return Set.prototype[Symbol.iterator].call(new Map().keys());}];let n=0;for(let i=0;i<calls.length;i++){try{calls[i]();}catch(e){if(e instanceof TypeError)n++;}}return n;}`),
  // Identity, metadata, prototypes.
  c('method-identities', 3,`function f(x){return (Map.prototype[Symbol.iterator]===Map.prototype.entries)+":"+(Set.prototype.keys===Set.prototype.values)+":"+(Set.prototype[Symbol.iterator]===Set.prototype.values)+":"+(Map.prototype.keys!==Map.prototype.values);}`),
  c('method-names-lengths', 3,`function f(x){const M=Map.prototype,S=Set.prototype;return M.entries.name+","+M.keys.name+","+M.values.name+","+M[Symbol.iterator].name+","+S.values.name+","+S.keys.name+","+S.entries.name+","+S[Symbol.iterator].name+"|"+M.entries.length+M.keys.length+M.values.length+S.values.length+S.entries.length;}`),
  c('method-descriptors', 3,`function f(x){const d=Object.getOwnPropertyDescriptor(Set.prototype,"keys"),e=Object.getOwnPropertyDescriptor(Map.prototype,Symbol.iterator);return d.writable+":"+d.enumerable+":"+d.configurable+":"+e.writable+":"+e.enumerable+":"+e.configurable+":"+(e.value===Map.prototype.entries);}`),
  c('iterator-prototype-identity', 3,`function f(x){const m=new Map(),s=new Set();const P=Object.getPrototypeOf(m.entries()),Q=Object.getPrototypeOf(s.values());return (P===Object.getPrototypeOf(new Map().keys()))+":"+(P===Object.getPrototypeOf(m.values()))+":"+(Q===Object.getPrototypeOf(s.entries()))+":"+(P!==Q)+":"+(P!==Map.prototype)+":"+(Object.getPrototypeOf(m[Symbol.iterator]())===P);}`),
  c('iterator-to-string-tags', 3,`function f(x){const ts=Object.prototype.toString;return ts.call(new Map().entries())+ts.call(new Set().values())+ts.call(Object.getPrototypeOf(new Map().keys()))+ts.call(Object.getPrototypeOf(new Set().entries()));}`),
  c('iterator-to-string-tag-descriptors', 3,`function f(x){const a=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(new Map().keys()),Symbol.toStringTag),b=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(new Set().keys()),Symbol.toStringTag);return a.value+":"+a.writable+":"+a.enumerable+":"+a.configurable+"|"+b.value+":"+b.writable+":"+b.enumerable+":"+b.configurable;}`),
  c('next-name-length-descriptor', 3,`function f(x){const P=Object.getPrototypeOf(new Map().keys()),Q=Object.getPrototypeOf(new Set().keys());const d=Object.getOwnPropertyDescriptor(P,"next"),e=Object.getOwnPropertyDescriptor(Q,"next");return P.next.name+P.next.length+Q.next.name+Q.next.length+":"+d.writable+d.enumerable+d.configurable+":"+e.writable+e.enumerable+e.configurable+":"+(P.next!==Q.next)+":"+typeof P.next;}`),
  c('iterator-own-properties', 3,`function f(x){const it=new Map().keys();it.tag=x;return Object.prototype.hasOwnProperty.call(it,"next")+":"+it.tag+":"+Object.keys(it).length+":"+Object.isExtensible(it)+":"+typeof it;}`),
  // Result objects.
  c('entries-arrays-fresh', 3,`function f(x){${MK}const it=m.entries();const a=it.next().value,b=it.next().value;a[1]=99;a.push(5);const c=m.entries().next().value;return (a!==b)+":"+(a!==c)+":"+m.get("a")+":"+c.length+":"+c[1]+":"+b[0];}`),
  c('set-entries-arrays-fresh', 3,`function f(x){const s=new Set();s.add(x);const a=s.entries().next().value,b=s.entries().next().value;a[0]=0;return (a!==b)+":"+b[0]+":"+b[1]+":"+s.has(x);}`),
  c('result-objects-shape', 3,`function f(x){${MK}const it=m.keys();const r1=it.next(),r2=it.next();while(!it.next().done){}const d=it.next(),e=it.next();const ks=Object.keys(r1);return (r1!==r2)+":"+ks.length+ks[0]+ks[1]+":"+(Object.getPrototypeOf(r1)===Object.prototype)+":"+r1.done+":"+("value" in d)+":"+(d.value===undefined)+":"+d.done+":"+(d!==e)+":"+Object.keys(d).length;}`),
  c('result-object-writable', 3,`function f(x){const s=new Set();s.add(x);s.add(x+1);const it=s.values();const r=it.next();r.value=100;r.done=true;const q=it.next();return r.value+":"+q.value+":"+q.done+":"+Object.getOwnPropertyDescriptor(q,"value").enumerable;}`),
  // GC: collection runs while iterators are parked on tombstones / churn.
  c('gc-map-pinned-deleted-entry', 3,`function f(x){const m=new Map();for(let i=0;i<12;i++)m.set(i,i*x);const it=m.entries();it.next();it.next();it.next();m.delete(2);m.delete(3);m.delete(4);m.delete(0);let junk=0;for(let i=0;i<6000;i++){const o={a:i,b:[i,i+1],c:"s"+i};junk=(junk+o.b[1]+o.c.length)%1000003;}m.set(2,-1);let s="",r;while(!(r=it.next()).done)s+=r.value[0]+"="+r.value[1]+",";return s+"|"+junk+"|"+m.size;}`),
  c('gc-set-pinned-deleted-chain', 3,`function f(x){const s=new Set();for(let i=0;i<16;i++)s.add("k"+i);const it=s.values();for(let i=0;i<5;i++)it.next();for(let i=2;i<10;i++)s.delete("k"+i);let junk=0;for(let i=0;i<6000;i++){const a=[i,"t"+i,{v:i}];junk=(junk*3+a[2].v+a[1].length)%999983;}s.add("k3");s.add("late"+x);let o="",r;while(!(r=it.next()).done)o+=r.value+",";return o+"|"+junk+"|"+s.size;}`),
  c('gc-map-delete-reinsert-churn', 3,`function f(x){const m=new Map();for(let i=0;i<10;i++)m.set(i,0);const it=m.keys();let steps=0,acc=0,r;while(steps<4000){r=it.next();if(r.done)break;const k=r.value;const v=m.get(k);m.delete(k);m.set(k,v+1);if(steps%7===0){const j=(k+3)%10;const w=m.get(j);m.delete(j);m.set(j,w+x);}acc=(acc*31+k)%1000003;steps++;}let tail="";const it2=m.entries();for(let i=0;i<10;i++){const e=it2.next().value;tail+=e[0]+"="+e[1]+",";}return acc+"|"+steps+"|"+m.size+"|"+tail+it2.next().done;}`),
  c('gc-set-delete-reinsert-churn', 3,`function f(x){const s=new Set();for(let i=0;i<9;i++)s.add(i*x);const it=s.values();let steps=0,acc=0,junk=0,r;while(steps<3500){r=it.next();if(r.done)break;const v=r.value;s.delete(v);s.add(v);if(steps%5===0){s.delete(((v/x+4)%9)*x);s.add(((v/x+4)%9)*x);}const tmp=[v,steps,{q:v}];junk=(junk+tmp[2].q+tmp.length)%1000003;acc=(acc*17+v)%999983;steps++;}let order="",q;const it2=s.values();while(!(q=it2.next()).done)order+=q.value+",";return acc+"|"+steps+"|"+junk+"|"+s.size+"|"+order;}`),
  c('gc-iterator-keeps-collection-alive', 3,`function f(x){function make(){const m=new Map();for(let i=0;i<20;i++)m.set("k"+i,i*x);return m.values();}const it=make();it.next();let junk=0;for(let i=0;i<6000;i++){junk+=[i,i,i].length+("j"+i).length;}let s=0,n=0,r;while(!(r=it.next()).done){s+=r.value;n++;}return s+":"+n+":"+junk;}`),
]);

// Iterable-protocol forms over Map/Set (and their iterator objects). Today
// these reach the explicit __lanesUnsupported guard in __lanesIteratorOpen
// (status 6, host rejection, not a guest catch) because Map.prototype /
// Set.prototype carry @@iterator (iterationKind 0) and iterator objects are
// plain kind-46 objects (iterationKind 0). Expected: Unsupported.
export const collectionIteratorUnsupportedSources = Object.freeze([
  'function f(x){const m=new Map();m.set(1,x);let s=0;for(const [k,v] of m)s+=k+v;return s;}',
  'function f(x){const s=new Set();s.add(x);let t=0;for(const v of s)t+=v;return t;}',
  'function f(x){const m=new Map();m.set(1,x);return [...m].length;}',
  'function f(x){const s=new Set();s.add(x);return [...s][0];}',
  'function f(x){const s=new Set();s.add(x);s.add(x+1);const [a,b]=s;return a+b;}',
  'function f(x){const m=new Map();m.set("k",x);const [[k,v]]=m;return k+v;}',
  'function f(x){const m=new Map();m.set(1,x);return Array.from(m).length;}',
  'function f(x){const m=new Map();m.set(1,x);let s=0;for(const k of m.keys())s+=k;return s;}',
  'function f(x){const s=new Set();s.add(x);return [...s.values()].length;}',
  'function f(x){const m=new Map();m.set(1,x);return new Map(m).size;}',
  'function f(x){const s=new Set();s.add(x);return new Set(s).size;}',
  'function f(x){const s=new Set();s.add(x);try{for(const v of s){}return "no error";}catch(e){return "wrong guest catch";}}',
]);

// Same order as collectionIteratorUnsupportedSources: values after the generic
// protocol merge (input 3).
export const collectionIteratorUnsupportedPostMergeExpected = Object.freeze([4, 3, 1, 3, 7, 'k3', 1, 1, 1, 1, 1, 'no error']);

// Expected values once Grok's generic iterator protocol (GetIterator calling
// @@iterator, IteratorStep calling `next`) is merged and nodes 70/71 inherit
// %IteratorPrototype%. Each flips from Unsupported to a value check.
export const collectionIteratorPostMergeCases = Object.freeze([
  c('post-for-of-map', 3,'function f(x){const m=new Map();m.set(1,x);m.set(2,x*2);let s="";for(const [k,v] of m)s+=k+"="+v+",";return s;}'),
  c('post-for-of-set', 3,'function f(x){const s=new Set();s.add(x);s.add("b");s.add(x);let t="";for(const v of s)t+=v+",";return t;}'),
  c('post-spread-map', 3,'function f(x){const m=new Map();m.set("a",x);m.set("b",1);const a=[...m];return a.length+":"+a[0][0]+a[0][1]+":"+a[1][0]+a[1][1];}'),
  c('post-spread-set-values', 3,'function f(x){const s=new Set();s.add(x);s.add(x+1);const a=[...s.values()];return a.length+":"+a[0]+":"+a[1];}'),
  c('post-destructure-set', 3,'function f(x){const s=new Set();s.add(x);s.add(x+1);const [a,b,c]=s;return a+":"+b+":"+c;}'),
  c('post-destructure-map', 3,'function f(x){const m=new Map();m.set("k",x);const [[k,v]]=m;return k+v;}'),
  c('post-array-from-map', 3,'function f(x){const m=new Map();m.set(1,x);m.set(2,x+1);const a=Array.from(m);return a.length+":"+a[1][1];}'),
  c('post-for-of-map-keys', 3,'function f(x){const m=new Map();m.set(1,x);m.set(5,x);let s=0;for(const k of m.keys())s+=k;return s;}'),
  c('post-iterator-self-iterable', 3,'function f(x){const it=new Map().entries(),jt=new Set().values();return (it[Symbol.iterator]()===it)+":"+(jt[Symbol.iterator]()===jt);}'),
  c('post-map-copy-constructor', 3,'function f(x){const m=new Map();m.set(1,x);m.set(2,x+1);const n=new Map(m);return n.size+":"+n.get(2)+":"+(n!==m);}'),
  c('post-set-copy-constructor', 3,'function f(x){const s=new Set();s.add(x);s.add(x);s.add(1);return new Set(s).size;}'),
  c('post-for-of-delete-ahead', 3,'function f(x){const s=new Set();s.add(1);s.add(2);s.add(3);let t="";for(const v of s){t+=v;if(v===1)s.delete(2);if(v===3&&x>0){s.add(4);x=0;}}return t;}'),
  c('post-for-of-break', 3,'function f(x){const m=new Map();m.set(1,1);m.set(2,2);m.set(3,3);const it=m.keys();for(const k of it){if(k===2)break;}return it.next().value;}'),
  c('post-iterator-prototype-chain', 3,'function f(x){const P=Object.getPrototypeOf(new Map().keys()),Q=Object.getPrototypeOf(new Set().keys());const I=Object.getPrototypeOf([][Symbol.iterator]());return (Object.getPrototypeOf(P)===Object.getPrototypeOf(I))+":"+(Object.getPrototypeOf(Q)===Object.getPrototypeOf(I));}'),
].map(item => Object.freeze({ ...item, requiresGenericIteration: true })));

// Resumption: iterator helpers called from a getter that runs inside another
// iterator loop, with deletion behind the outer iterator.
export const collectionIteratorResumptionSource = 'function f(x){const m=new Map();const o={get v(){const it=m.values();let s=0,r;while(!(r=it.next()).done)s+=r.value;return s;}};for(let i=1;i<=x+2;i++)m.set(i,i*i);const it=m.entries();let out="",r;while(!(r=it.next()).done){out+=r.value[0]+":"+o.v+",";if(r.value[0]===2)m.delete(4);}return out;}';
export const collectionIteratorResumptionExpected = '1:55,2:55,3:39,5:39,';
