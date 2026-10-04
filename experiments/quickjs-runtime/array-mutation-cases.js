// Shared native-reference fixtures for fill, copyWithin and reverse. Results stay
// primitive so the host boundary can compare them. These strings are not a GPU pass.
// `d` helpers below render an array-like as "v,v,_,v" where "_" marks a hole
// (HasProperty false), so sparse outcomes are visible in the primitive result.
const show = 'function d(o,n){ let s=""; for(let i=0;i<n;i++){ s+=(i?",":"")+(i in o?""+o[i]:"_"); } return s; }';
export const arrayMutationCases = [
  // fill: basic, return value identity, relative start/end clamping.
  `function f(x) { ${show} let a=[1,2,3,4,5]; let r=a.fill(x,1,-1); return (r===a)+"|"+d(a,5); }`,
  `function f(x) { ${show} return d([1,2,3].fill(x),3)+"|"+d([1,2,3].fill(x,-2),3)+"|"+d([1,2,3].fill(x,5),3)+"|"+d([1,2,3].fill(x,-5),3)+"|"+d([1,2,3].fill(x,1,1),3); }`,
  `function f(x) { ${show} return d([1,2,3].fill(x,NaN,NaN),3)+"|"+d([1,2,3].fill(x,-0,-0),3)+"|"+d([1,2,3].fill(x,-Infinity,Infinity),3)+"|"+d([1,2,3].fill(x,Infinity),3)+"|"+d([1,2,3].fill(x,1.9,2.9),3)+"|"+d([1,2,3].fill(x,-1.9),3)+"|"+d([1,2,3].fill(x,0,-Infinity),3); }`,
  `function f(x) { ${show} return d([1,2,3].fill(x,undefined,undefined),3)+"|"+d([1,2,3].fill(x,null,null),3)+"|"+d([1,2,3].fill(x,"1","2"),3)+"|"+d([1,2,3].fill(x,true),3)+"|"+d([1,2,3].fill(x,0,"-1"),3); }`,
  // fill writes into holes and onto plain array-likes; inherited indices are shadowed by own data props.
  `function f(x) { ${show} let a=Array(4); a[1]=9; a.fill(x,1,3); let p={0:5}; let o=Object.create(p); o.length=2; Array.prototype.fill.call(o,x); return d(a,4)+"|"+Object.prototype.hasOwnProperty.call(o,0)+"|"+p[0]+"|"+o[0]+"|"+o[1]; }`,
  // fill coercion order: length (get + valueOf), start, end; end undefined skips coercion.
  `function f(x) { let s=""; let o={get length(){ s+="l"; return {valueOf(){ s+="L"; return 3; }}; }}; Array.prototype.fill.call(o,x,{valueOf(){ s+="s"; return 0; }},{valueOf(){ s+="e"; return 2; }}); s+="|"+o[0]+o[1]+o[2]; Array.prototype.fill.call(o,x,{valueOf(){ s+="S"; return 0; }}); return s; }`,
  // fill with setters on target indices: visible Set order, setters receive value.
  `function f(x) { let s=""; let o={length:3,set 0(v){ s+="a"+v; },set 1(v){ s+="b"+v; },set 2(v){ s+="c"+v; }}; let r=Array.prototype.fill.call(o,x,-2); return s+(r===o); }`,
  // fill abrupt: length getter throws before start is coerced; start throws before end.
  `function f(x) { let s=""; try{ Array.prototype.fill.call({get length(){ s+="l"; throw x; }},1,{valueOf(){ s+="s"; return 0; }}); }catch(e){ s+=e===x; } try{ Array.prototype.fill.call({length:2},1,{valueOf(){ s+="S"; throw x; }},{valueOf(){ s+="E"; return 1; }}); }catch(e){ s+=e===x; } return s; }`,
  // fill strict Set failures keep partial effects: non-writable index, frozen, setter-less accessor.
  `function f(x) { ${show} let a=[1,2,3,4]; Object.defineProperty(a,"2",{value:3,writable:false}); let s=""; try{ a.fill(x); }catch(e){ s+=e.name; } let o={length:3,0:1,get 1(){ return 2; },2:3}; try{ Array.prototype.fill.call(o,x); }catch(e){ s+=e.name; } let fz=[1,2]; Object.defineProperty(fz,"0",{writable:false,configurable:false}); Object.defineProperty(fz,"1",{writable:false,configurable:false}); Object.preventExtensions(fz); try{ fz.fill(x); }catch(e){ s+=e.name; } return s+"|"+d(a,4)+"|"+d(o,3)+"|"+d(fz,2); }`,
  // fill on empty length does nothing even with throwing setters; length is not written.
  `function f(x) { let s=""; let o={length:0,set 0(v){ s+="!"; }}; Array.prototype.fill.call(o,x); let p={length:-3}; Array.prototype.fill.call(p,x); let q={length:"2"}; Array.prototype.fill.call(q,x); return s+"|"+o.length+"|"+p.length+"|"+(0 in p)+"|"+q.length+q[0]+q[1]+(2 in q); }`,
  // fill on a function receiver uses its length.
  `function f(x) { function g(a,b){} Array.prototype.fill.call(g,x); return g[0]+g[1]+(2 in g); }`,
  // copyWithin: basic forward/backward/overlap cases.
  `function f(x) { ${show} return d([1,2,3,4,5].copyWithin(0,3),5)+"|"+d([1,2,3,4,5].copyWithin(1,3),5)+"|"+d([1,2,3,4,5].copyWithin(1,2),5)+"|"+d([1,2,3,4,5].copyWithin(2,0),5)+"|"+d([1,2,3,4,5].copyWithin(0,3,4),5); }`,
  `function f(x) { ${show} return d([1,2,3,4,5].copyWithin(-2),5)+"|"+d([1,2,3,4,5].copyWithin(-2,-3,-1),5)+"|"+d([1,2,3,4,5].copyWithin(-4,-3,-2),5)+"|"+d([1,2,3,4,5].copyWithin(-4,-3,-1),5)+"|"+d([1,2,3,4,5].copyWithin(0,1,-Infinity),5); }`,
  `function f(x) { ${show} return d([1,2,3].copyWithin(NaN,1),3)+"|"+d([1,2,3].copyWithin(-0,-0),3)+"|"+d([1,2,3].copyWithin(Infinity,0),3)+"|"+d([1,2,3].copyWithin(-Infinity,1),3)+"|"+d([1,2,3].copyWithin(0,1.9,2.9),3)+"|"+d([1,2,3].copyWithin(1.5,undefined,undefined),3)+"|"+d([1,2,3].copyWithin(0,-Infinity,Infinity),3)+"|"+d([1,2,3].copyWithin(0,"2",null),3); }`,
  // copyWithin backward overlap (from < to < from+count) copies right to left.
  `function f(x) { ${show} let a=[x,1,2,3,4,5]; let r=a.copyWithin(2,0,4); return (r===a)+"|"+d(a,6); }`,
  // copyWithin holes in source become deletes on target; inherited source indices are copied as own.
  `function f(x) { ${show} let a=[1,,3,,5]; a.copyWithin(0,1); let b=[1,2,3,4,5]; delete b[0]; b.copyWithin(2,0,2); let p={1:x}; let o=Object.create(p); o.length=3; o[0]=7; Array.prototype.copyWithin.call(o,2,1); return d(a,5)+"|"+d(b,5)+"|"+Object.prototype.hasOwnProperty.call(o,2)+o[2]+"|"+d(o,3); }`,
  // copyWithin observable order: length, target, start, end, then per step HasProperty(from) via proto getter, Get from, Set to.
  `function f(x) { let s=""; let o={get length(){ s+="l"; return {valueOf(){ s+="L"; return 4; }}; },get 2(){ s+="g2"; return x; },get 3(){ s+="g3"; return 9; },set 0(v){ s+="s0="+v; },set 1(v){ s+="s1="+v; }}; Array.prototype.copyWithin.call(o,{valueOf(){ s+="t"; return 0; }},{valueOf(){ s+="s"; return 2; }},{valueOf(){ s+="e"; return 4; }}); return s; }`,
  // copyWithin backward order observed with setters/getters.
  `function f(x) { let s=""; let o={length:4,get 0(){ s+="g0"; return 10; },get 1(){ s+="g1"; return 11; },set 1(v){ s+="s1="+v; },set 2(v){ s+="s2="+v; }}; Array.prototype.copyWithin.call(o,1,0,2); return s; }`,
  // copyWithin mutation during iteration: source getter deletes later source index, which becomes a delete.
  `function f(x) { ${show} let a=[1,2,3,4,5,6]; Object.defineProperty(a,"0",{get(){ delete a[1]; a[2]=x; return 0; },configurable:true}); a.copyWithin(3,0); return d(a,6); }`,
  // copyWithin coercion abrupt: target throws before start/end; end throws after start; count<=0 does nothing.
  `function f(x) { let s=""; try{ [1,2].copyWithin({valueOf(){ s+="t"; throw x; }},{valueOf(){ s+="s"; return 0; }}); }catch(e){ s+=e===x; } try{ [1,2].copyWithin(0,{valueOf(){ s+="S"; return 0; }},{valueOf(){ s+="E"; throw x; }}); }catch(e){ s+=e===x; } let o={length:3,set 0(v){ s+="!"; },get 2(){ s+="?"; return 1; }}; Array.prototype.copyWithin.call(o,0,2,1); Array.prototype.copyWithin.call(o,3,0); return s; }`,
  // copyWithin strict failures: non-writable target keeps earlier copies; non-configurable hole target delete throws.
  `function f(x) { ${show} let a=[1,2,3,4,5]; Object.defineProperty(a,"1",{value:2,writable:false}); let s=""; try{ a.copyWithin(0,2); }catch(e){ s+=e.name; } let b=[1,,3,4]; Object.defineProperty(b,"2",{value:3,configurable:false}); try{ b.copyWithin(2,1); }catch(e){ s+=e.name; } let c=[1,2,3,4]; Object.defineProperty(c,"3",{get(){ return 9; },configurable:true}); try{ c.copyWithin(2,0); }catch(e){ s+=e.name; } return s+"|"+d(a,5)+"|"+d(b,4)+"|"+d(c,4); }`,
  // copyWithin: getter throws mid-copy, earlier writes stay.
  `function f(x) { ${show} let a=[1,2,3,4]; Object.defineProperty(a,"3",{get(){ throw x; }}); try{ a.copyWithin(0,2); }catch(e){ return (e===x)+"|"+d(a,3); } return "bad"; }`,
  // copyWithin with sparse array-like where target index is inherited from prototype: delete of own (absent) succeeds, inherited remains visible.
  `function f(x) { ${show} let p={0:x}; let o=Object.create(p); o.length=3; Array.prototype.copyWithin.call(o,0,1,2); return Object.prototype.hasOwnProperty.call(o,0)+"|"+d(o,3); }`,
  // reverse: even/odd, return identity, empty and single.
  `function f(x) { ${show} let a=[1,2,3,4]; let r=a.reverse(); let b=[x,2,3]; b.reverse(); return (r===a)+"|"+d(a,4)+"|"+d(b,3)+"|"+[].reverse().length+"|"+d([x].reverse(),1); }`,
  // reverse holes: all four cases.
  `function f(x) { ${show} let a=[1,,3,,,6,x]; a.reverse(); let b=Array(4); b.reverse(); let c=[,x]; c.reverse(); let e=[x,,]; e.reverse(); return d(a,7)+"|"+d(b,4)+"|"+d(c,2)+"|"+d(e,2)+"|"+e.length; }`,
  // reverse exact order: Has lower, Get lower, Has upper, Get upper, then Set lower, Set upper.
  `function f(x) { let s=""; let o={get length(){ s+="l"; return {valueOf(){ s+="L"; return 3; }}; },get 0(){ s+="g0"; return "a"; },set 0(v){ s+="s0="+v; },get 2(){ s+="g2"; return "c"; },set 2(v){ s+="s2="+v; },1:"b"}; Array.prototype.reverse.call(o); return s; }`,
  // reverse with inherited elements: proto data indices are read and written as own; a proto getter/setter observes Get then Set.
  `function f(x) { let s=""; let p={0:x,3:4}; let o=Object.create(p); o.length=4; o[1]=2; Array.prototype.reverse.call(o); let pq={get 0(){ s+="p0"; return x; },set 0(v){ s+="P0="+v; }}; let q=Object.create(pq); q.length=2; q[1]=5; Array.prototype.reverse.call(q); return s+"|"+Object.prototype.hasOwnProperty.call(o,0)+o[0]+"|"+o[1]+"|"+(2 in o)+o[2]+"|"+Object.prototype.hasOwnProperty.call(o,3)+o[3]+"|"+Object.prototype.hasOwnProperty.call(q,0)+q[1]; }`,
  // reverse only-upper: Set lower happens before the failing Delete upper; only-lower: failing Delete lower happens before Set upper.
  `function f(x) { let s=""; let o={length:4,1:"b"}; Object.defineProperty(o,"3",{get(){ s+="g3"; return x; },configurable:false}); try{ Array.prototype.reverse.call(o); }catch(e){ s+=e.name; } let q={length:2}; Object.defineProperty(q,"0",{value:x,configurable:false,writable:true}); try{ Array.prototype.reverse.call(q); }catch(e){ s+=e.name; } return s+"|"+o[0]+"|"+(3 in o)+"|"+o[1]+o[2]+"|"+q[0]+(1 in q); }`,
  // reverse mutation during iteration: a getter that deletes the far element or adds one.
  `function f(x) { ${show} let a=[1,2,3,4,5,6]; Object.defineProperty(a,"0",{get(){ delete a[5]; a[4]=x; return 1; },configurable:true}); a.reverse(); return d(a,6); }`,
  // reverse strict failures: frozen array, non-configurable delete, non-writable lower; partial effects preserved.
  `function f(x) { ${show} let s=""; let fz=[1,2]; Object.defineProperty(fz,"0",{writable:false,configurable:false}); Object.defineProperty(fz,"1",{writable:false,configurable:false}); Object.preventExtensions(fz); try{ fz.reverse(); }catch(e){ s+=e.name; } let a=[1,2,3,,5,6]; Object.defineProperty(a,"2",{value:3,configurable:false,writable:true}); try{ a.reverse(); }catch(e){ s+=e.name; } let b=[1,2,3,4]; Object.defineProperty(b,"2",{value:3,writable:false}); try{ b.reverse(); }catch(e){ s+=e.name; } return s+"|"+d(fz,2)+"|"+d(a,6)+"|"+d(b,4); }`,
  // reverse setter-less accessor on upper: lower Set succeeds before upper Set throws.
  `function f(x) { ${show} let o={length:2,0:x}; Object.defineProperty(o,"1",{get(){ return 7; },configurable:true}); try{ Array.prototype.reverse.call(o); }catch(e){ return e.name+"|"+d(o,2); } return "bad"; }`,
  // reverse abrupt length and getter; length ToLength clamping.
  `function f(x) { let s=""; try{ Array.prototype.reverse.call({get length(){ s+="l"; throw x; }}); }catch(e){ s+=e===x; } try{ Array.prototype.reverse.call({length:2,get 0(){ s+="g"; throw x; },get 1(){ s+="!"; return 1; }}); }catch(e){ s+=e===x; } let o={length:2.9,0:1,1:2,2:3}; Array.prototype.reverse.call(o); let q={length:-1,0:1}; Array.prototype.reverse.call(q); return s+"|"+o[0]+o[1]+o[2]+"|"+q[0]; }`,
  // null/undefined receivers throw TypeError for all three.
  'function f(x) { let n=0; try{ Array.prototype.fill.call(null,x); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.copyWithin.call(undefined,0,1); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.reverse.call(null); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.fill.call(undefined); }catch(e){ if(e instanceof TypeError) n++; } return n; }',
  // composed: fill + copyWithin + reverse on the same array; -0 survives as a value.
  `function f(x) { ${show} let a=Array(5).fill(0,0,2); a.copyWithin(3,0); a.reverse(); a.fill(-0,2,3); return d(a,5)+"|"+Object.is(a[2],-0)+"|"+a.length; }`,
];

// Explicit normative outcomes (computed from ES2025 text) for selected entries in
// arrayMutationCases, keyed by index and input. `*` means the same for all inputs.
export const arrayMutationExpected = [
  [0, 1, 'true|1,1,1,1,5'],
  [1, 17, '17,17,17|1,17,17|1,2,3|17,17,17|1,2,3'],
  [2, 0, '1,2,3|1,2,3|0,0,0|1,2,3|1,0,3|1,2,0|1,2,3'],
  [3, -1, '-1,-1,-1|1,2,3|1,-1,3|1,-1,-1|-1,-1,3'],
  [4, 1, '_,1,1,_|true|5|1|1'],
  [5, 17, 'lLse|1717undefinedlLS'],
  [6, 17, 'b17c17true'],
  [7, '*', 'ltrueStrue'],
  [8, 17, 'TypeErrorTypeErrorTypeError|17,17,3,4|17,2,3|1,2'],
  [9, 0, '|0|-3|false|200false'],
  [10, 1, 2],
  [11, '*', '4,5,3,4,5|1,4,5,4,5|1,3,4,5,5|1,2,1,2,3|4,2,3,4,5'],
  [12, '*', '1,2,3,1,2|1,2,3,3,4|1,3,3,4,5|1,3,4,4,5|1,2,3,4,5'],
  [13, '*', '2,3,3|1,2,3|1,2,3|2,3,3|2,2,3|1,1,2|1,2,3|1,2,3'],
  [14, 17, 'true|17,1,17,1,2,3'],
  [15, 17, '_,3,_,5,5|_,2,_,2,5|true17|7,17,17'],
  [16, 17, 'lLtseg2s0=17g3s1=9'],
  [17, '*', 'g1s2=11g0s1=10'],
  [18, 17, '0,_,17,0,_,17'],
  [19, '*', 'ttrueSEtrue'],
  [20, 0, 'TypeErrorTypeErrorTypeError|3,2,3,4,5|1,_,3,3|1,2,1,9'],
  [21, 17, 'true|3,2,3'],
  [22, 17, 'false|17,_,_'],
  [23, 17, 'true|4,3,2,1|3,2,17|0|17'],
  [24, 17, '17,6,_,_,3,_,1|_,_,_,_|17,_|_,17|2'],
  [25, '*', 'lLg0g2s0=cs2=a'],
  [26, 17, 'p0P0=5|true4|undefined|true2|true17|false17'],
  [27, 17, 'g3TypeErrorTypeError|17|true|bundefined|17false'],
  [28, 17, '_,17,4,3,2,1'],
  [29, 17, 'TypeErrorTypeErrorTypeError|1,2|6,5,3,_,2,1|4,3,3,1'],
  [30, 17, 'TypeError|7,7'],
  [31, 17, 'ltruegtrue|213|1'],
  [32, '*', 4],
  [33, '*', '0,0,0,0,0|true|5'],
];

// One program for single-instruction resumption. Each method is called on a plain
// object with accessors so the full Has/Get/Set/Delete order is recorded.
export const arrayMutationResumptionSource = `function f(x) {
  let order = "";
  const object = {
    get length() { order += "l"; return {valueOf(){ order += "v"; return 4; }}; },
    get 0() { order += "a"; return 1; },
    set 0(v) { order += "A" + v; },
    get 3() { order += "d"; return 4; },
    set 3(v) { order += "D" + v; },
    2: 3
  };
  const filled = Array.prototype.fill.call(object, 7, {valueOf(){ order += "s"; return -1; }});
  order += "|";
  const copied = Array.prototype.copyWithin.call(object, 1, {valueOf(){ order += "f"; return 2; }});
  order += "|" + object[1] + object[2] + "|";
  delete object[1];
  object[2] = 8;
  const reversed = Array.prototype.reverse.call(object);
  if (filled !== object || copied !== object || reversed !== object) throw 124;
  return order + "|" + (1 in object) + object[2];
}`;

export const arrayMutationResumptionExpected = 'lvsD7|lvfd|34|lvadA4D1|trueundefined';

// Uncaught completions for the host oracle, compared by error name or thrown value.
export const arrayMutationNegativeSources = [
  'function f(x) { return Array.prototype.fill.call(null, x); }',
  'function f(x) { return Array.prototype.copyWithin.call(undefined, 0, 1); }',
  'function f(x) { return Array.prototype.reverse.call(null); }',
  // Frozen-like receivers built from defineProperty/preventExtensions (Object.freeze is a guest placeholder).
  'function f(x) { let a = [1, x]; Object.defineProperty(a, "0", {writable: false}); return a.fill(x); }',
  'function f(x) { let a = [1, x]; Object.defineProperty(a, "0", {writable: false}); return a.copyWithin(0, 1); }',
  'function f(x) { let a = [1, x]; Object.preventExtensions(a); Object.defineProperty(a, "1", {writable: false}); return a.reverse(); }',
  'function f(x) { let a = [1, , 3]; Object.defineProperty(a, "0", {value: 1, configurable: false}); return a.copyWithin(0, 1); }',
  'function f(x) { return Array.prototype.fill.call({ get length(){ throw x; } }, 1); }',
  'function f(x) { return [1, 2].fill(1, { valueOf(){ throw x; } }); }',
  'function f(x) { return [1, 2].copyWithin(0, 0, { valueOf(){ throw x; } }); }',
  'function f(x) { return Array.prototype.reverse.call({ length: 2, 0: 1, get 1(){ throw x; } }); }',
  'function f(x) { return Array.prototype.fill.call({ length: 1, set 0(v){ throw x; } }, 1); }',
];
