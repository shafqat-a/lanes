// Standard-library wave, worker 8: GC-pressure probes and single-instruction
// resumption sources for the Map/Set storage contract (STDLIB-WAVE-CONTRACT.md,
// "Storage model" / "GC"). Expectations are ES2025 values, identical in V8;
// check-stdlib-conformance.mjs re-derives every one of them natively.
//
// The heap is 2048 nodes per lane (program.js LIMITS.heap) and collect() runs
// at an instruction boundary when freeCount < 192 (shader.js main()). CHURN
// allocates about five nodes per iteration (object, two properties, array,
// heap string), so churn(600) alone exceeds the heap and forces at least one
// collection; the GPU page requires `collections > 0` for every probe.
import { CHURN } from './stdlib-conformance-cases.js';

const fn = body => `function f(x){${CHURN}${body}}`;

export const stdlibGCCases = [
  { id: 'gc-map-retained-contents', group: 'gc', requiredGC: true, inputs: [1, 3],
    source: fn('const m=new Map();for(let i=0;i<40;i++)m.set(i,{v:i*x});churn(600);let s=0,o="";m.forEach((v,k)=>{s+=v.v;if(k%10===0)o+=k;});return s+":"+o+":"+m.size+":"+m.get(39).v;') },
  { id: 'gc-map-tombstone-churn', group: 'gc', requiredGC: true, inputs: [0, 2],
    note: 'Without unlinking unpinned tombstones, 1500 delete/re-insert rounds append ~3000 entry+cell nodes and exhaust the heap (status 3).',
    source: fn('const m=new Map();for(let i=0;i<1500;i++){m.set("k"+((i+x)%7),i);m.delete("k"+((i+x+3)%7));}let o="";m.forEach((v,k)=>{o+=k+"="+v+";";});return o+m.size;') },
  { id: 'gc-set-sliding-window', group: 'gc', requiredGC: true, inputs: [5, 1],
    source: fn('const s=new Set();for(let i=0;i<2500;i++){s.add(i);if(s.size>x)s.delete(i-x);}let o="";s.forEach(v=>{o+=v+",";});return o+s.size;') },
  { id: 'gc-iterator-parked-on-deleted', group: 'gc', requiredGC: true, inputs: [1],
    note: 'The iterator pins its current entry ("a", now a tombstone). The unpinned tombstone "b" between it and "c" must be unlinked with a.next repaired.',
    source: fn('const m=new Map([["a",1],["b",2],["c",3],["d",4]]);const it=m.keys();let r=it.next().value;m.delete("a");m.delete("b");churn(600);m.set("e",x);for(let i=0;i<3;i++)r+=it.next().value;return r+it.next().done+m.size;') },
  { id: 'gc-iterator-parked-on-deleted-last', group: 'gc', requiredGC: true, inputs: [7],
    note: 'Pinned tombstone is header.last; append after collection must link from it.',
    source: fn('const s=new Set([1,2,3]);const it=s.values();it.next();it.next();it.next();s.delete(3);s.delete(2);churn(600);s.add(x);const n=it.next();let o="";s.forEach(v=>{o+=v;});return n.value+":"+n.done+":"+it.next().done+":"+o;') },
  { id: 'gc-unpinned-last-tombstone-append', group: 'gc', requiredGC: true, inputs: [4],
    note: 'header.last is an unpinned tombstone; collect() must move last back to "b" before the next append.',
    source: fn('const m=new Map([["a",1],["b",2],["c",3]]);m.delete("c");churn(600);m.set("d",x);let o="";m.forEach((v,k)=>{o+=k+v;});m.delete("a");churn(600);m.set("a",0);m.forEach((v,k)=>{o+=k;});return o+m.size;') },
  { id: 'gc-clear-then-append-parked-iterators', group: 'gc', requiredGC: true, inputs: [9, 'z'],
    source: fn('const m=new Map([["a",1],["b",2],["c",3]]);const parked=m.keys(),fresh=m.values(),done=m.entries();parked.next();while(!done.next().done){}m.clear();churn(600);m.set(x,"X");const p=parked.next(),q=fresh.next();return p.value+":"+q.value+":"+done.next().done+":"+parked.next().done+":"+m.size;') },
  { id: 'gc-forEach-callback-allocates', group: 'gc', requiredGC: true, inputs: [2],
    note: 'Collections happen while the forEach helper is suspended in user code; its iterator is a helper local and must stay rooted.',
    source: fn('const m=new Map([["a",1],["b",2],["c",3],["d",4],["e",5],["f",6]]);let o="";m.forEach((v,k)=>{churn(150);o+=k;if(k==="a"){m.delete("b");m.set("g",x);}if(k==="c")m.delete("c");});let s="";m.forEach((v,k)=>{s+=k;});return o+":"+s+":"+m.size;') },
  { id: 'gc-object-keys-only-via-map', group: 'gc', requiredGC: true, inputs: [1, 3],
    source: fn('const m=new Map();for(let i=0;i<30;i++)m.set({id:i},i*x);const s=new Set();for(let i=0;i<30;i++)s.add({id:i});churn(600);let a=0,b=0;m.forEach((v,k)=>{a+=k.id*v;});s.forEach(v=>{b+=v.id;});return a+":"+b+":"+m.size+":"+s.size;') },
  { id: 'gc-value-cells-deep', group: 'gc', requiredGC: true, inputs: [2],
    source: fn('const m=new Map();for(let i=0;i<25;i++)m.set(i,{d:{x:i*x,t:"t"+i}});churn(600);for(let i=0;i<25;i+=2)m.set(i,{d:{x:-i,t:"u"}});churn(600);let s=0,t="";for(let i=0;i<25;i++){s+=m.get(i).d.x;t+=m.get(i).d.t.charAt(0);}return s+":"+t;') },
  { id: 'gc-many-dropped-iterators', group: 'gc', requiredGC: true, inputs: [3],
    source: fn('const m=new Map([[1,"a"],[2,"b"],[3,"c"]]);const it=m.values();it.next();for(let i=0;i<1500;i++){m.keys();m.entries().next();}m.delete(2);return it.next().value+":"+it.next().done+":"+m.size+":"+x;') },
  { id: 'gc-set-composition-under-pressure', group: 'gc', requiredGC: true, inputs: [0, 40],
    source: fn('const a=new Set(),b=new Set();for(let i=0;i<120;i++){a.add(i);b.add(i+80-x);}churn(600);const u=a.union(b),n=a.intersection(b),d=a.symmetricDifference(b);churn(600);let s=0;n.forEach(v=>{s+=v;});return u.size+":"+n.size+":"+d.size+":"+s+":"+a.isSubsetOf(u)+":"+u.isSupersetOf(b);') },
  { id: 'gc-symbol-bigint-heap-string-keys', group: 'gc', requiredGC: true, inputs: [5],
    source: fn('const syms=[];const m=new Map();for(let i=0;i<10;i++){const s=Symbol("s"+i);syms.push(s);m.set(s,i);m.set(BigInt(i),"n"+i);m.set("key"+i,i*x);}churn(600);let a=0;for(let i=0;i<10;i++)a+=m.get(syms[i]);return a+":"+m.get(BigInt(x))+":"+m.get("key"+x)+":"+m.get(Symbol("s1"))+":"+m.size;') },
  { id: 'gc-delete-current-in-forEach', group: 'gc', requiredGC: true, inputs: [1],
    source: fn('const s=new Set([1,2,3,4]);let o="";let added=false;s.forEach(v=>{s.delete(v);churn(200);o+=v;if(!added){added=true;s.add(9);s.add(1);}});return o+":"+s.size;') },
  { id: 'gc-values-iterator-cell-reuse', group: 'gc', requiredGC: true, inputs: [6],
    note: 'Value cells of deleted entries are freed and reused by new entries; the parked values() iterator must read only live cells.',
    source: fn('const m=new Map();for(let i=0;i<8;i++)m.set(i,"v"+i);const it=m.values();it.next();it.next();for(let i=0;i<8;i++)m.delete(i);churn(600);for(let i=10;i<14;i++)m.set(i,"w"+(i+x));let o="";for(let r=it.next();!r.done;r=it.next())o+=r.value;return o+":"+m.size;') },
  { id: 'gc-map-ctor-getters-churn', group: 'gc', requiredGC: true, inputs: [2],
    source: fn('const list=[];for(let i=0;i<30;i++)list.push({get 0(){churn(25);return i;},get 1(){return i*x;}});const m=new Map(list);let s=0;m.forEach(v=>{s+=v;});return s+":"+m.size+":"+m.get(29);') },
  { id: 'gc-class-field-map-and-closure', group: 'gc', requiredGC: true, inputs: [1, 'k'],
    source: fn('class Registry{#unused=0;items=new Map();add(k,v){this.items.set(k,v);return ()=>this.items.get(k);}}const r=new Registry();const getters=[];for(let i=0;i<20;i++)getters.push(r.add(i+"|"+x,{n:i}));churn(600);let s=0;for(const g of getters)s+=g().n;return s+":"+r.items.size;') },
  { id: 'gc-reflect-get-receiver-churn', group: 'gc', requiredGC: true, inputs: [3],
    source: fn('const m=new Map([[1,1]]);const o={get p(){churn(600);return this.size+":"+this.get(1);}};return Reflect.get(o,"p",m)+":"+Reflect.get(Map.prototype,"size",m)+":"+x;') },
];

// Single-instruction resumption probes: the page starts each program and
// drives it with job.step(1) until done, so collection/suspension can occur
// at every instruction boundary inside the stdlib helpers and user callbacks.
// Kept short: every instruction costs one GPU dispatch.
export const stdlibResumptionSources = [
  { id: 'resume-map-ctor-getters-and-patched-set', input: 3, expected: 'k3v3sk4v4s|7:9|true',
    source: 'function f(x){let log="";const orig=Map.prototype.set;Map.prototype.set=function(k,v){log+="s";return orig.call(this,k,v+1);};const e=k=>({get 0(){log+="k"+k;return k;},get 1(){log+="v"+k;return k*2;}});let m;try{m=new Map([e(x),e(x+1)]);}finally{Map.prototype.set=orig;}return log+"|"+m.get(x)+":"+m.get(x+1)+"|"+(Map.prototype.set===orig);}' },
  { id: 'resume-set-composition-setlike-callbacks', input: 3, expected: 'shkn3n|1,2,3,|h1h2|false:true',
    source: 'function f(x){let log="";const like={get size(){log+="s";return 1;},get has(){log+="h";return v=>v===x;},get keys(){log+="k";return ()=>{let d=false;return {next(){log+="n"+(d?"":x);const r=d?{done:true}:{value:x,done:false};d=true;return r;}};};}};const u=new Set([1,2]).union(like);let o="";u.forEach(v=>{o+=v+",";});let h="";const sub=new Set([1,2]).isSubsetOf({size:5,has(v){h+="h"+v;return v===1;},keys(){}});return log+"|"+o+"|"+h+"|"+sub+":"+u.has(x);}' },
  { id: 'resume-reflect-get-receiver-getters', input: 3, expected: '2:6:2:true',
    source: 'function f(x){const m=new Map([[1,x],[2,x*2]]);const o={get p(){return this.get(2);},get q(){return this.size;}};return Reflect.get(Map.prototype,"size",m)+":"+Reflect.get(o,"p",m)+":"+Reflect.get(o,"q",m)+":"+(Reflect.apply(Map.prototype.has,m,[1]));}' },
  { id: 'resume-forEach-mutation-and-iterator', input: 3, expected: 'a1c3d3|c,d,|true',
    source: 'function f(x){const m=new Map([["a",1],["b",2],["c",3]]);const it=m.keys();it.next();let o="";m.forEach((v,k)=>{o+=k+v;if(k==="a"){m.delete("b");m.delete("a");m.set("d",x);}});let r="";for(let n=it.next();!n.done;n=it.next())r+=n.value+",";return o+"|"+r+"|"+it.next().done;}' },
  { id: 'resume-isNaN-valueOf-callback', input: 3, expected: 'vwtwt:false:true:false',
    source: 'function f(x){let log="";const a={valueOf(){log+="v";return x;}},b={valueOf(){log+="w";return {};},toString(){log+="t";return "zz";}};const r=isNaN(a)+":"+isNaN(b)+":"+isFinite(b);return log+":"+r;}' },
];
