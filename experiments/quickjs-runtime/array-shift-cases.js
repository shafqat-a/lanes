// Shared native-reference fixtures for Array.prototype.shift and unshift (ES2025 23.1.3.27, 23.1.3.34).
// Results stay primitive so the host boundary can compare them. These strings are not a GPU pass.
// Each entry is [expected result for x = 17, source]; the expectation is the normative ES2025 outcome.
// Indices at or above 2^31 are not exercised (numeric key limit); shift on a 2^53-1 length is never run.
const cases = [
  // shift: basic, return value, element move and trailing delete.
  [true, 'function f(x) { let a=[x,2,3]; let r=a.shift(); return r===x && a.length===2 && a[0]===2 && a[1]===3 && !(2 in a); }'],
  // shift: len 0 still writes length +0 (creating it on a plain object), returns undefined.
  [true, 'function f(x) { let a=[]; let o={length:-5}; let p={}; let n={length:NaN}; return a.shift()===undefined && a.length===0 && Array.prototype.shift.call(o)===undefined && Object.is(o.length,0) && Array.prototype.shift.call(p)===undefined && Object.hasOwn(p,"length") && p.length===0 && Array.prototype.shift.call(n)===undefined && n.length===0; }'],
  // shift: holes are skipped by HasProperty and turned into deletes.
  ['4:falsetruefalsetruefalse:35', 'function f(x) { let a=[x,,3,,5]; a.shift(); return a.length+":"+(0 in a)+(1 in a)+(2 in a)+(3 in a)+(4 in a)+":"+a[1]+a[3]; }'],
  // shift: inherited index is visible and copied into an own property; inherited one survives.
  ['1,17,true,2,true,false', 'function f(x) { let p={1:x}; let o=Object.create(p); o.length=3; o[0]=1; let r=Array.prototype.shift.call(o); return r+","+o[0]+","+Object.hasOwn(o,0)+","+o.length+","+("1" in o)+","+Object.hasOwn(o,1); }'],
  // shift: exact Get/Set order through accessors, then delete of len-1 and length write.
  ['Lg0g1s0=5g2s1=6l2|17', 'function f(x) { let s=""; let o={get length(){ s+="L"; return 3; }, set length(v){ s+="l"+v; }, get 0(){ s+="g0"; return x; }, set 0(v){ s+="s0="+v; }, get 1(){ s+="g1"; return 5; }, set 1(v){ s+="s1="+v; }, get 2(){ s+="g2"; return 6; }, set 2(v){ s+="s2="+v; }}; let r=Array.prototype.shift.call(o); return s+"|"+r; }'],
  // shift: a getter deleting a later element during iteration is observed by HasProperty.
  ['17|set1=c|b,undefined,false,false,3', 'function f(x) { let s=""; let o={length:4, 0:x, get 1(){ delete o[3]; return "b"; }, set 1(v){ s+="set1="+v; }, 2:"c", 3:"d"}; let r=Array.prototype.shift.call(o); return r+"|"+s+"|"+o[0]+","+o[2]+","+(2 in o)+","+(3 in o)+","+o.length; }'],
  // shift: non-writable length throws only at the final Set; moves and delete already happened.
  ['true,2,false,2', 'function f(x) { let a=[x,2]; Object.defineProperty(a,"length",{writable:false}); try { a.shift(); } catch(e) { return (e instanceof TypeError)+","+a[0]+","+(1 in a)+","+a.length; } return "no"; }'],
  // shift: len 0 with non-writable length still throws (Set is attempted even with the same value).
  [true, 'function f(x) { let a=[]; Object.defineProperty(a,"length",{writable:false}); let o={}; Object.defineProperty(o,"length",{value:0,writable:false}); let n=0; try { a.shift(); } catch(e) { if (e instanceof TypeError) n++; } try { Array.prototype.shift.call(o); } catch(e) { if (e instanceof TypeError) n++; } return n===2 && a.length===0 && o.length===0; }'],
  // shift: non-configurable last element makes DeletePropertyOrThrow(len-1) throw after the moves.
  ['true,233,3', 'function f(x) { let a=[x,2,3]; Object.defineProperty(a,2,{configurable:false}); try { a.shift(); } catch(e) { return (e instanceof TypeError)+","+a[0]+a[1]+a[2]+","+a.length; } return "no"; }'],
  // shift: non-writable target element makes the second Set throw.
  ['true,223,3', 'function f(x) { let a=[x,2,3]; Object.defineProperty(a,1,{writable:false}); try { a.shift(); } catch(e) { return (e instanceof TypeError)+","+a[0]+a[1]+a[2]+","+a.length; } return "no"; }'],
  // shift: non-configurable hole target makes the delete in the loop throw.
  ['true,b,b,false,3', 'function f(x) { let o={length:3, 0:x}; Object.defineProperty(o,1,{value:"b",writable:true,configurable:false}); try { Array.prototype.shift.call(o); } catch(e) { return (e instanceof TypeError)+","+o[0]+","+o[1]+","+(2 in o)+","+o.length; } return "no"; }'],
  // shift: ToLength on string/fractional length.
  ['17,y,false,1', 'function f(x) { let o={length:"2.7", 0:x, 1:"y", 2:"z"}; let r=Array.prototype.shift.call(o); return r+","+o[0]+","+(1 in o)+","+o.length+(o[2]==="z"?"":"!"); }'],
  // shift: length getter throws before any Get.
  [true, 'function f(x) { let s=""; let o={get length(){ s+="L"; throw x; }, get 0(){ s+="g"; return 1; }}; try { Array.prototype.shift.call(o); } catch(e) { return e===x && s==="L"; } return false; }'],
  // shift: Get "0" throws, nothing else is touched.
  [true, 'function f(x) { let o={length:2, get 0(){ throw x; }, 1:"b"}; try { Array.prototype.shift.call(o); } catch(e) { return e===x && o.length===2 && o[1]==="b"; } return false; }'],
  // shift: function receiver whose length is non-writable; element delete happens before the throw.
  ['true,false,1', 'function f(x) { function g(a) {} g[0]=x; try { Array.prototype.shift.call(g); } catch(e) { return (e instanceof TypeError)+","+(0 in g)+","+g.length; } return "no"; }'],
  // shift: repeated until empty, then the empty case.
  ['17;1;2;0:undefined', 'function f(x) { let a=[x,1,2]; let s=""; while (a.length) s+=a.shift()+";"; return s+a.length+":"+a.shift(); }'],
  // shift: -0 element is returned unchanged and -0 length is written back as +0.
  [true, 'function f(x) { let o={length:-0}; Array.prototype.shift.call(o); return Object.is(o.length,0) && Object.is([-0,x].shift(),-0); }'],

  // unshift: basic insert at the front, returns the new length.
  ['4:17,y,1,2:4', 'function f(x) { let a=[1,2]; let n=a.unshift(x,"y"); return n+":"+a[0]+","+a[1]+","+a[2]+","+a[3]+":"+a.length; }'],
  // unshift: zero items still returns len.
  ['2:21', 'function f(x) { let a=[1,2]; return a.unshift()+":"+a.length+a[0]; }'],
  // unshift: holes become deletes at the shifted position.
  ['4:a,false,17,false,4', 'function f(x) { let a=[,x,,]; let n=a.unshift("a"); return n+":"+a[0]+","+(1 in a)+","+a[2]+","+(3 in a)+","+a.length; }'],
  // unshift: inherited index is visible through HasProperty and copied as own.
  ['3:ab17:true,3', 'function f(x) { let p={0:x}; let o=Object.create(p); o.length=1; let n=Array.prototype.unshift.call(o,"a","b"); return n+":"+o[0]+o[1]+o[2]+":"+Object.hasOwn(o,2)+","+o.length; }'],
  // unshift: exact Get/Set order (high to low), then items, then length.
  ['Lg1s3=bg0s2=as0=17s1=yl4|4', 'function f(x) { let s=""; let o={get length(){ s+="L"; return 2; }, set length(v){ s+="l"+v; }, get 0(){ s+="g0"; return "a"; }, set 0(v){ s+="s0="+v; }, get 1(){ s+="g1"; return "b"; }, set 1(v){ s+="s1="+v; }, set 2(v){ s+="s2="+v; }, set 3(v){ s+="s3="+v; }}; let n=Array.prototype.unshift.call(o,x,"y"); return s+"|"+n; }'],
  // unshift: len + argCount > 2^53-1 throws TypeError before any write.
  ['true,,9007199254740991', 'function f(x) { let s=""; let o={length:9007199254740991, set 0(v){ s+="w"; }}; try { Array.prototype.unshift.call(o,x); } catch(e) { return (e instanceof TypeError)+","+s+","+o.length; } return "no"; }'],
  // unshift: zero items on a maximal (or clamped) length just re-sets length.
  [true, 'function f(x) { let s=""; let o={length:9007199254740991}; let p={length:Infinity}; let q={get length(){ return 3; }, set length(v){ s+=v; }}; let n=Array.prototype.unshift.call(o); let m=Array.prototype.unshift.call(p); let k=Array.prototype.unshift.call(q); return n===9007199254740991 && o.length===n && m===9007199254740991 && p.length===m && k===3 && s==="3"; }'],
  // unshift: zero items with non-writable length throws because length is always written.
  [true, 'function f(x) { let a=[x]; Object.defineProperty(a,"length",{writable:false}); try { a.unshift(); } catch(e) { return e instanceof TypeError && a.length===1 && a[0]===x; } return false; }'],
  // unshift: non-writable array length rejects the first move beyond length.
  ['true,172,false,2', 'function f(x) { let a=[x,2]; Object.defineProperty(a,"length",{writable:false}); try { a.unshift("a"); } catch(e) { return (e instanceof TypeError)+","+a[0]+a[1]+","+(2 in a)+","+a.length; } return "no"; }'],
  // unshift: non-extensible array-like rejects the first new index.
  ['true,17b,false,2', 'function f(x) { let o={length:2, 0:x, 1:"b"}; Object.preventExtensions(o); try { Array.prototype.unshift.call(o,"a"); } catch(e) { return (e instanceof TypeError)+","+o[0]+o[1]+","+(2 in o)+","+o.length; } return "no"; }'],
  // unshift: non-writable middle element throws after earlier moves (partial state kept).
  ['true,17223,4', 'function f(x) { let a=[x,2,3]; Object.defineProperty(a,1,{writable:false}); try { a.unshift("a"); } catch(e) { return (e instanceof TypeError)+","+a[0]+a[1]+a[2]+a[3]+","+a.length; } return "no"; }'],
  // unshift: hole over a non-configurable target makes DeletePropertyOrThrow throw.
  ['true,17,z,2', 'function f(x) { let o={length:2, 0:x}; Object.defineProperty(o,2,{value:"z",writable:true,configurable:false}); try { Array.prototype.unshift.call(o,"a"); } catch(e) { return (e instanceof TypeError)+","+o[0]+","+o[2]+","+o.length; } return "no"; }'],
  // unshift: a getter deleting an earlier element during iteration is observed.
  ['4:17,false,b,c,4', 'function f(x) { let o={length:3, 0:"a", get 1(){ delete o[0]; return "b"; }, 2:"c"}; let n=Array.prototype.unshift.call(o,x); return n+":"+o[0]+","+(1 in o)+","+o[2]+","+o[3]+","+o.length; }'],
  // unshift: ToLength via valueOf happens once; length written with len + argCount.
  ['LvS2|2a17', 'function f(x) { let s=""; let o={get length(){ s+="L"; return {valueOf(){ s+="v"; return 1; }}; }, set length(v){ s+="S"+v; }}; o[0]=x; let n=Array.prototype.unshift.call(o,"a"); return s+"|"+n+o[0]+o[1]; }'],
  // unshift: a throwing setter stops the algorithm; length is not written.
  [true, 'function f(x) { let o={length:1, 0:"a", set 1(v){ throw x; }}; try { Array.prototype.unshift.call(o,"z"); } catch(e) { return e===x && o[0]==="a" && o.length===1; } return false; }'],
  // unshift: fractional length and argument values captured before the call.
  ['3:17,1,2:3|3:1,1,17', 'function f(x) { let o={length:2.5, 0:1, 1:2}; let n=Array.prototype.unshift.call(o,x); let a=[x]; let m=a.unshift(a.length,a.length); return n+":"+o[0]+","+o[1]+","+o[2]+":"+o.length+"|"+m+":"+a[0]+","+a[1]+","+a[2]; }'],
  // unshift then shift round trip on a sparse array.
  ['5:9,true,false,true,false|9:4:false,true,false', 'function f(x) { let a=[x,,x,,]; let n=a.unshift(9); let s=n+":"+a[0]+","+(1 in a)+","+(2 in a)+","+(3 in a)+","+(4 in a); let r=a.shift(); return s+"|"+r+":"+a.length+":"+(1 in a)+","+(2 in a)+","+(3 in a); }'],
];
export const arrayShiftCases = cases.map(([, source]) => source);
export const arrayShiftExpected = cases.map(([expected]) => expected);

// One program for single-instruction resumption: shift then unshift on one accessor object.
// shift: L v a (Get 0), index 1 has only a setter so Get yields undefined, index 2 getter c,
// delete 2, length 2. unshift(x): the length getter still reports 3; index 2 is now absent
// (delete 3), index 1 copies undefined into a fresh own 2, index 0 is copied to 1, then x at 0.
export const arrayShiftResumptionSource = `function f(x) {
  let order = "";
  const object = {
    get length() { order += "L"; return {valueOf(){ order += "v"; return 3; }}; },
    set length(v) { order += "S" + v; },
    get 0() { order += "a"; return 5; },
    set 0(v) { order += "w0=" + v; },
    set 1(v) { order += "w1=" + v; },
    get 2() { order += "c"; return 9; },
    set 2(v) { order += "w2=" + v; }
  };
  const first = Array.prototype.shift.call(object);
  const count = Array.prototype.unshift.call(object, x);
  if (!(2 in object) || object[2] !== undefined || (3 in object)) throw 124;
  return order + "|" + first + count;
}`;

export const arrayShiftResumptionExpected = 'Lvaw0=undefinedcw1=9S2Lvaw1=5w0=17S4|54';

// Uncaught completions for the host oracle. GPU registration should prefer the try/catch forms above.
export const arrayShiftNegativeSources = [
  'function f(x) { return Array.prototype.shift.call(null); }',
  'function f(x) { return Array.prototype.shift.call(undefined); }',
  'function f(x) { return Array.prototype.unshift.call(null, x); }',
  'function f(x) { return Array.prototype.unshift.call(undefined); }',
  'function f(x) { return Array.prototype.unshift.call({ length: 9007199254740991 }, x); }',
  'function f(x) { let a = [x]; Object.defineProperty(a, "length", { writable: false }); return a.shift(); }',
  'function f(x) { let a = [x]; Object.defineProperty(a, "length", { writable: false }); return a.unshift(); }',
  'function f(x) { return Array.prototype.shift.call({ get length(){ throw x; } }); }',
  'function f(x) { return Array.prototype.unshift.call({ get length(){ throw x; } }, 1); }',
  'function f(x) { return Array.prototype.shift.call({ length: 2, 0: 1, get 1(){ throw x; } }); }',
  'function f(x) { return Array.prototype.unshift.call({ length: 1, 0: 1, set 1(v){ throw x; } }, 2); }',
];
