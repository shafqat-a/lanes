// Shared native-reference fixtures for find, findIndex, findLast, findLastIndex, and lastIndexOf.
// Results stay primitive so the host boundary can compare them. These strings are not a GPU pass.
export const arraySearchSources = [
  'function f(x) { return Object.is([1].lastIndexOf(1,-0),0) && Object.is([1].lastIndexOf(1,-0.5),0) && [1].lastIndexOf(1,-Infinity)===-1; }',
  'function f(x) { let n=0; return [].find(function(){ n++; return true; })===undefined && [].findIndex(function(){ n++; return true; })===-1 && [].findLast(function(){ n++; return true; })===undefined && [].findLastIndex(function(){ n++; return true; })===-1 && [].lastIndexOf(x)===-1 && n===0; }',
  'function f(x) { let hole=[x,,x]; let present=[x,undefined,x]; let n=0; let i=hole.findIndex(function(v){ n++; return v===undefined; }); let j=hole.findLastIndex(function(v){ n++; return v===undefined; }); return i===1 && j===1 && n===4 && hole.lastIndexOf(undefined)===-1 && present.lastIndexOf(undefined)===1 && hole.find(function(v){ return v===undefined; })===undefined; }',
  'function f(x) { let s=""; let o={length:3,get 0(){s+="0";return 1;},get 1(){s+="1";return 2;},get 2(){s+="2";return 3;}}; Array.prototype.find.call(o,function(v){ s+="c"; return v===2; }); s+="|"; Array.prototype.findLast.call(o,function(v){ s+="c"; return v===2; }); return s==="0c1c|2c1c"; }',
  'function f(x) { let n=0; let cb=function(){ "use strict"; n+=this===null?1:100; return false; }; [x,2].find(cb,null); [x,2].findIndex(cb,null); [x,2].findLast(cb,null); [x,2].findLastIndex(cb,null); let m=0; [x].find(function(){ "use strict"; m=this; return true; },5); return n===8 && m===5; }',
  'function f(x) { let cb=function(v){ return v===2; }; cb.call=function(){ throw x; }; let bound=function(v){ "use strict"; return this===9 && v===x; }.bind(9); return [x,2].find(cb)===2 && [x,2].findLastIndex(cb)===1 && [x].find(bound,4)===x; }',
  'function f(x) { let s=""; let found=[9,x].find(function(v,i,o){ return v===x && i===1 && o.length===2; }); try { Array.prototype.findLast.call({get length(){ s+="l"; return {valueOf(){ s+="v"; return 1; }}; },get 0(){ s+="g"; return x; }},"nope"); } catch(e){ return found===x && s==="lv" && e instanceof TypeError; } return false; }',
  'function f(x) { let n=0; try{ Array.prototype.find.call(null,function(){ return true; }); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.findIndex.call(undefined,function(){ return true; }); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.findLast.call(null,function(){ return true; }); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.findLastIndex.call(undefined,function(){ return true; }); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.lastIndexOf.call(null,x); }catch(e){ if(e instanceof TypeError) n++; } try{ Array.prototype.lastIndexOf.call(undefined,x); }catch(e){ if(e instanceof TypeError) n++; } return n; }',
  'function f(x) { let s=""; try{ Array.prototype.findIndex.call({get length(){ s+="l"; throw x; },get 0(){ s+="g"; return 1; }},function(){ s+="c"; return true; }); }catch(e){ if(e!==x || s!=="l") return false; } s=""; try{ Array.prototype.findLast.call({length:1,get 0(){ s+="g"; throw x; }},function(){ s+="c"; return true; }); }catch(e){ if(e!==x || s!=="g") return false; } s=""; try{ [x].findLastIndex(function(){ s+="c"; throw x; }); }catch(e){ return e===x && s==="c"; } return false; }',
  'function f(x) { let a=[x,9,x]; return ""+a.lastIndexOf(x)+","+a.lastIndexOf(x,undefined)+","+a.lastIndexOf(x,NaN)+","+a.lastIndexOf(x,Infinity)+","+a.lastIndexOf(x,-Infinity)+","+a.lastIndexOf(x,null)+","+a.lastIndexOf(x,-0); }',
  'function f(x) { let a=[x,9,x,8]; return ""+a.lastIndexOf(x,2.9)+","+a.lastIndexOf(x,1.9)+","+a.lastIndexOf(x,-1.2)+","+a.lastIndexOf(x,-4)+","+a.lastIndexOf(x,-5)+","+a.lastIndexOf(9,-0.2); }',
  'function f(x) { let s=""; let r=Array.prototype.lastIndexOf.call({get length(){ s+="l"; return {valueOf(){ s+="v"; return 0; }}; },get 0(){ s+="g"; return x; }},x,{valueOf(){ s+="i"; throw x; }}); return s+r; }',
  'function f(x) { let s=""; let o={0:4,1:x,2:4,get length(){ s+="l"; return 3; }}; let r=Array.prototype.lastIndexOf.call(o,x,{valueOf(){ s+="i"; delete o[1]; o[0]=x; return 2; }}); return s+r; }',
  'function f(x) { let s=""; let o={get length(){ s+="l"; return {valueOf(){ s+="v"; return 3; }}; },get 0(){ s+="a"; return x; },get 1(){ s+="b"; return 2; },get 2(){ s+="c"; return x; }}; let n=0; let found=Array.prototype.find.call(o,function(v,i){ s+="f"+i; n++; if(i===0){ o.length=0; delete o[2]; } return v===x && i===2; },null); return s+(found===undefined && n===3); }',
  'function f(x) { let n=0; Array.prototype.findLast.call({length:1.9,0:x,1:5},function(){ n++; return false; }); let m=0; Array.prototype.find.call({length:NaN,0:x},function(){ m++; return false; }); Array.prototype.find.call({length:-Infinity,0:x},function(){ m++; return false; }); let p=0; Array.prototype.findLastIndex.call({length:"1.2",0:x,1:5},function(){ p++; return false; }); let s=""; try{ Array.prototype.findIndex.call({get length(){ s+="l"; return {valueOf(){ s+="v"; return Infinity; }}; },get 0(){ s+="g"; throw x; }},function(){ s+="c"; return true; }); }catch(e){ return n===1 && m===0 && p===1 && s==="lvg" && e===x; } return false; }',
  'function f(x) { let s=""; let p={get 1(){ s+="p"; return x; }}; let o=Object.create(p); o.length=3; o[2]=4; let n=0; let found=Array.prototype.find.call(o,function(v,i){ n++; s+=i; return false; }); let last=Array.prototype.lastIndexOf.call(o,x); function fn(a,b){} fn[1]=x; return found===undefined && n===3 && last===1 && s==="0p12p" && Array.prototype.findLastIndex.call(fn,function(v){ return v===x; })===1 && Array.prototype.lastIndexOf.call(fn,x)===1; }',
  'function f(x) { return [0,8].find(function(v){ return v; })===8 && [0,8].findIndex(function(){ return 0; })===-1 && [0,8].findLastIndex(function(){ return "yes"; })===1 && [x].find(function(){ return 0; })===undefined && [9,x,9].find(function(){ return 1; })===9 && [9,x,9].findIndex(function(v){ return v===x; })===1 && [9,x,9].findLast(function(v){ return v===9; })===9 && [9,x,9].findLastIndex(function(v){ return v===9; })===2; }',
  'function f(x) { let a=[x,2,x]; let seen=false; a.find(function(v,i,o){ seen=o===a && i===0 && v===x; return true; }); let o={0:x,length:1}; let same=false; Array.prototype.findLast.call(o,function(v,i,original){ same=original===o && v===x && i===0; return true; }); let item={v:x}; let list=[1,item,2,item]; return seen && same && list.lastIndexOf(item)===3 && list.findLastIndex(function(v){ return v===item; })===3; }',
  'function f(x) { return Object.is([-0].find(function(){ return true; }),-0) && [-0,1].lastIndexOf(0)===0 && [1,-0].lastIndexOf(0)===1 && [NaN,x].lastIndexOf(NaN)===-1 && Object.is([NaN].find(function(v){ return v!==v; }),NaN); }',
  'function f(x) { let s=""; try{ Array.prototype.lastIndexOf.call({get length(){ s+="l"; return 2; },get 1(){ s+="b"; throw x; },get 0(){ s+="a"; return x; }},x); }catch(e){ return s==="lb" && e===x; } return false; }',
  'function f(x) { let s=""; let o={0:x,1:3,get length(){ s+="l"; return {valueOf(){ s+="v"; return 2; }}; }}; let r=Array.prototype.lastIndexOf.call(o,x,{valueOf(){ s+="i"; return 5; }}); try{ Array.prototype.lastIndexOf.call({get length(){ s+="L"; return 2; },get 0(){ s+="a"; return x; },get 1(){ s+="b"; return x; }},x,{valueOf(){ s+="I"; throw x; }}); }catch(e){ return s==="lviLI" && r===0 && e===x; } return false; }',
  'function f(x) { let s=""; let a=[1,2,3]; a.find(function(v,i){ s+=v; if(i===0){ a.length=1; a.push(8); } return false; }); let t=""; let b=[x,2,3]; b.findLast(function(v,i,o){ t+=i; if(i===2){ delete o[0]; o.push(4); } return false; }); return s==="18undefined" && t==="210"; }',
  'function f(x) { let a=[3,x,3,x,4]; return a.findIndex(function(v){ return v===x; })*10+a.findLastIndex(function(v){ return v===x; }); }',
  'function f(x) { let s=""; let o={length:4,get 0(){ s+="0"; return 1; },get 3(){ s+="3"; return x; }}; let i=Array.prototype.findLastIndex.call(o,function(v,index){ s+=index; return v===x; }); return s==="33" && i===3 && [9,2,2].lastIndexOf(2,-1)===2 && [9,2,2].lastIndexOf(2,0)===-1; }',
];

// One program for single-instruction resumption. Order is length, valueOf, Gets, then strict callbacks.
// find stops on the hole at index 1. lastIndexOf reads fromIndex after that snapshot and stops at index 2.
// findLastIndex then walks from the end back to the value 5.
export const arraySearchResumptionSource = `function f(x) {
  let order = "";
  const receiver = {marker: 7};
  const object = {
    get length() { order += "l"; return {valueOf(){ order += "v"; return 3; }}; },
    get 0() { order += "a"; return 5; },
    get 2() { order += "c"; return 9; }
  };
  const found = Array.prototype.find.call(object, function(value, index, original) {
    "use strict";
    if (this !== receiver || original !== object || arguments.length !== 3) throw 123;
    order += "f" + index + (value === undefined ? "u" : value);
    return index === 1;
  }, receiver);
  const at = Array.prototype.lastIndexOf.call(object, 9, { valueOf() { order += "i"; return -1; } });
  const tail = Array.prototype.findLastIndex.call(object, function(value, index, original) {
    "use strict";
    if (this !== receiver || original !== object) throw 125;
    order += "b" + index;
    return value === 5;
  }, receiver);
  if (found !== undefined || at !== 2 || tail !== 0) throw 124;
  return order;
}`;

export const arraySearchResumptionExpected = 'lvaf05f1ulviclvcb2b1ab0';

// Uncaught completions for the host oracle. GPU registration should prefer the try/catch forms above.
export const arraySearchNegativeSources = [
  'function f(x) { return Array.prototype.find.call(null, function(){ return true; }); }',
  'function f(x) { return Array.prototype.findLast.call(undefined, function(){ return true; }); }',
  'function f(x) { return Array.prototype.lastIndexOf.call(null, x); }',
  'function f(x) { return [1, x].find(null); }',
  'function f(x) { return [1, x].findIndex(1); }',
  'function f(x) { return [1, x].findLast("nope"); }',
  'function f(x) { return [1, x].findLastIndex({}); }',
  'function f(x) { return [x].find(); }',
  'function f(x) { return [1, x].find(function(){ throw x; }); }',
  'function f(x) { return Array.prototype.findLastIndex.call({ get length(){ throw x; } }, function(){ return true; }); }',
  'function f(x) { return Array.prototype.lastIndexOf.call({ get length(){ return 1; }, get 0(){ throw x; } }, x); }',
  'function f(x) { return Array.prototype.lastIndexOf.call({ length: 2, 0: x, 1: x }, x, { valueOf(){ throw x; } }); }',
];
