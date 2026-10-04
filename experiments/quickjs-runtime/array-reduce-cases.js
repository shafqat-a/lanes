// Shared native-reference fixtures for Array.prototype.reduce / reduceRight.
// Results stay primitive so the host boundary can compare them. These strings are not a GPU pass.
// arrayReduceExpected[i] is the normative ES2025 result of arrayReduceCases[i] for every input x
// in the check (each case is written so its result does not depend on x).
export const arrayReduceCases = [
  // Basic folding with and without initialValue, both directions.
  'function f(x) { let add=function(a,v){ return a+v; }; return ""+[1,2,3].reduce(add)+","+[1,2,3].reduce(add,10)+","+[1,2,3].reduceRight(add,"")+","+["a","b","c"].reduce(add)+","+["a","b","c"].reduceRight(add); }',
  // Explicit undefined initialValue is present (arguments.length >= 2); omitted is not.
  'function f(x) { let s=""; let r=[].reduce(function(){ s+="c"; return 1; },undefined); let r2=[x].reduceRight(function(a,v,i){ s+=(a===undefined)+":"+i; return 5; },undefined); let r3=[x].reduce(function(){ s+="n"; return 1; }); return s+"|"+(r===undefined)+","+r2+","+(r3===x); }',
  // A single present element without initialValue is returned without calling back; holes are skipped.
  'function f(x) { let n=0; let cb=function(){ n++; return 0; }; let a=[,,x,,]; return a.reduce(cb)===x && a.reduceRight(cb)===x && n===0 && [,x].reduce(cb,7)===0 && n===1; }',
  // Empty and all-holes receivers without initialValue throw TypeError.
  'function f(x) { let n=0; let cb=function(){ return x; }; try{ [].reduce(cb); }catch(e){ if(e instanceof TypeError) n++; } try{ [,,].reduceRight(cb); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.reduce.call({length:3},cb); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.reduceRight.call({length:4},cb); }catch(e){ if(e instanceof TypeError) n++; } return n; }',
  // Order: ToObject, LengthOfArrayLike (get + valueOf), IsCallable, then the empty check.
  'function f(x) { let s=""; try{ Array.prototype.reduce.call({get length(){ s+="l"; return {valueOf(){ s+="v"; return 0; }}; }},"nope"); }catch(e){ s+=e instanceof TypeError?"T":"?"; } try{ Array.prototype.reduceRight.call({get length(){ s+="L"; return 0; }},function(){}); }catch(e){ s+=e instanceof TypeError?"E":"?"; } try{ Array.prototype.reduce.call({get length(){ s+="M"; throw x; }},"nope"); }catch(e){ s+=e===x?"X":"?"; } try{ Array.prototype.reduce.call(null,"nope"); }catch(e){ s+=e instanceof TypeError?"N":"?"; } return s; }',
  // Callback receives undefined this and exactly four arguments; extra reduce arguments are ignored.
  'function f(x) { let a=[x,2,3]; let ok=true; let s=""; a.reduce(function(acc,v,i,o){ "use strict"; if(this!==undefined || arguments.length!==4 || o!==a || v!==a[i]) ok=false; s+=i; return acc; }); a.reduceRight(function(acc,v,i,o){ "use strict"; if(this!==undefined || arguments.length!==4 || o!==a) ok=false; s+=i; return acc; },0,99); return ok+s; }',
  // Inherited indices are found by HasProperty; Get only happens for present indices.
  'function f(x) { let s=""; let p={get 1(){ s+="p"; return 10; }}; let o=Object.create(p); o.length=4; o[3]=1; let r=Array.prototype.reduce.call(o,function(a,v,i){ s+="c"+i; return a+v; }); s+="|"; let r2=Array.prototype.reduceRight.call(o,function(a,v,i){ s+="c"+i; return a+v; }); return s+"|"+r+","+r2; }',
  // Getter order on an array-like with a hole at index 1.
  'function f(x) { let s=""; let o={length:3,get 0(){ s+="a"; return 1; },get 2(){ s+="c"; return 3; }}; let r=Array.prototype.reduce.call(o,function(a,v,i){ s+="f"+i; return a*10+v; }); s+="|"; let r2=Array.prototype.reduceRight.call(o,function(a,v,i){ s+="f"+i; return a*10+v; },x); return s+"|"+r+"|"+(r2===x*100+31); }',
  // Mutation: deleted later elements are skipped, the length snapshot is fixed, appended elements are not visited.
  'function f(x) { let s=""; let a=[1,2,3,4]; let r=a.reduce(function(acc,v,i,o){ s+=i; if(i===1){ delete o[2]; o.push(9); o.length=10; } return acc+v; }); let t=""; let b=[1,2,3,4]; let r2=b.reduceRight(function(acc,v,i,o){ t+=i; if(i===2){ o.length=1; } return acc+v; }); return s+"|"+r+"|"+t+"|"+r2+"|"+a.length; }',
  // Mutation during the initial search and visible writes to not-yet-visited indices.
  'function f(x) { let o={length:3,get 0(){ delete o[1]; return 5; },1:2,2:3}; let r=Array.prototype.reduce.call(o,function(a,v){ return a+v; }); let a=[1,2,3]; let r2=a.reduce(function(acc,v,i,arr){ if(i===1) arr[2]=100; return acc+v; }); let b=[,,]; b[5]=x; let r3=b.reduceRight(function(acc,v,i,arr){ arr[0]=7; return acc+v; },0); return ""+r+","+r2+","+(r3===x+7)+","+b.length; }',
  // Abrupt completions from length valueOf, element getters (initial search and loop), and callbacks propagate.
  'function f(x) { let s=""; try{ Array.prototype.reduce.call({length:{valueOf(){ s+="v"; throw x; }}},"nope"); }catch(e){ s+=(e===x)+";"; } try{ Array.prototype.reduceRight.call({length:2,get 1(){ s+="g"; throw x; },get 0(){ s+="z"; return 1; }},function(){ s+="c"; }); }catch(e){ s+=(e===x)+";"; } try{ [1,2,3].reduce(function(a,v,i){ s+="c"+i; if(i===2) throw x; return a; }); }catch(e){ s+=(e===x)+";"; } try{ Array.prototype.reduce.call({length:3,0:1,get 1(){ s+="G"; throw x; }},function(){ s+="C"; return 0; }); }catch(e){ s+=(e===x); } return s; }',
  // Non-callable callbacks throw TypeError even when the receiver is non-empty or initialValue is present.
  'function f(x) { let n=0; let bad=[null,undefined,{},"f",1,true]; for(let i=0;i<bad.length;i++){ try{ [x].reduce(bad[i],0); }catch(e){ if(e instanceof TypeError) n++; } try{ [x].reduceRight(bad[i]); }catch(e){ if(e instanceof TypeError) n++; } } try{ [x].reduce(); }catch(e){ if(e instanceof TypeError) n++; } return n; }',
  // ToLength on fractional, string, NaN and -Infinity lengths.
  'function f(x) { let cb=function(a,v){ return a+","+v; }; return Array.prototype.reduce.call({length:1.9,0:"z",1:9},cb,"s")+"|"+Array.prototype.reduceRight.call({length:"2",0:"a",1:"b",2:"c"},cb)+"|"+Array.prototype.reduce.call({length:NaN,0:1},cb,"n")+"|"+Array.prototype.reduceRight.call({length:-Infinity,0:1},cb,"m"); }',
  // Function receivers are array-likes through their length property.
  'function f(x) { function fn(a,b){} fn[0]=1; fn[1]=x; return Array.prototype.reduce.call(fn,function(a,v){ return a+v; })===1+x && Array.prototype.reduceRight.call(fn,function(a,v){ return a-v; },0)===-1-x; }',
  // Accumulator values are passed through unchanged, including -0 and NaN.
  'function f(x) { return Object.is([-0].reduce(function(){ return 1; }),-0) && Object.is([1].reduce(function(){ return 2; },-0),2) && Object.is([].reduceRight(function(){ return 1; },-0),-0) && [NaN].reduce(function(a){ return a; },NaN)!==[NaN].reduce(function(a){ return a; },NaN); }',
  // An undefined accumulator returned by the callback is kept; call counts per direction.
  'function f(x) { let n=0; let r=[1,2,3,x].reduce(function(a){ n++; return undefined; }); let m=0; let r2=[1,2,3,x].reduceRight(function(a,v){ m++; return a===undefined?v:a; },undefined); return (r===undefined)+","+n+","+(r2===x)+","+m; }',
  // Array receiver whose prototype chain supplies a hole.
  'function f(x) { let p=Object.create(Array.prototype); p[1]=20; let a=[1,,3]; Object.setPrototypeOf(a,p); return a.reduce(function(acc,v){ return acc+v; })+","+a.reduceRight(function(acc,v,i){ return acc+"/"+i; },""); }',
];

export const arrayReduceExpected = [
  '6,16,321,abc,cba',
  'true:0|true,5,true',
  true,
  4,
  'lvTLEMXN',
  'true12210',
  'pc3|pc1|11,11',
  'acf2|cf2af0|13|true',
  '13|7|20|8|10',
  '8,103,true,6',
  'vtrue;gtrue;c1c2true;Gtrue',
  13,
  's,z|b,a|n|m',
  true,
  true,
  'true,3,true,4',
  '24,/2/1/0',
];

// One program for single-instruction resumption. reduce: length, valueOf, initial Get of 0, hole at 1,
// callback at 2 deletes 3 so it is skipped. reduceRight with initialValue: 3 now absent, 2, hole, 0.
// Finally an empty array-like without initialValue throws TypeError after its length read.
export const arrayReduceResumptionSource = `function f(x) {
  let order = "";
  const object = {
    get length() { order += "l"; return {valueOf(){ order += "v"; return 4; }}; },
    get 0() { order += "a"; return 1; },
    get 2() { order += "c"; return 3; },
    3: 4
  };
  const sum = Array.prototype.reduce.call(object, function(acc, value, index, original) {
    "use strict";
    if (this !== undefined || original !== object || arguments.length !== 4) throw 123;
    order += "r" + index;
    if (index === 2) delete object[3];
    return acc + value;
  });
  const right = Array.prototype.reduceRight.call(object, function(acc, value, index) {
    "use strict";
    order += "R" + index;
    return acc + ":" + value;
  }, "s");
  let empty = "";
  try {
    Array.prototype.reduce.call({ get length() { order += "e"; return 0; } }, function() { order += "!"; });
  } catch (error) {
    empty = error instanceof TypeError ? "T" : "?";
  }
  if (sum !== 4 || right !== "s:3:1") throw 124;
  return order + empty;
}`;

export const arrayReduceResumptionExpected = 'lvacr2lvcR2aR0eT';

// Uncaught completions for the host oracle, compared by error name (TypeError) or thrown value.
export const arrayReduceNegativeSources = [
  'function f(x) { return Array.prototype.reduce.call(null, function(){ return 1; }); }',
  'function f(x) { return Array.prototype.reduceRight.call(undefined, function(){ return 1; }, 0); }',
  'function f(x) { return [].reduce(function(){ return 1; }); }',
  'function f(x) { return [,,].reduceRight(function(){ return 1; }); }',
  'function f(x) { return Array.prototype.reduce.call({ length: 0 }, function(){ return 1; }); }',
  'function f(x) { return [x].reduce(null, 0); }',
  'function f(x) { return [x].reduceRight(); }',
  'function f(x) { return [1, x].reduce(function(){ throw x; }); }',
  'function f(x) { return [1, x].reduceRight(function(){ throw x; }, 0); }',
  'function f(x) { return Array.prototype.reduce.call({ get length(){ throw x; } }, "nope"); }',
  'function f(x) { return Array.prototype.reduceRight.call({ length: 2, get 1(){ throw x; } }, function(){ return 1; }); }',
  'function f(x) { return Array.prototype.reduce.call({ length: { valueOf(){ throw x; } } }, function(){ return 1; }); }',
];
