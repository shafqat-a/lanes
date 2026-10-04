// Shared native-reference/GPU fixtures. Primitive results keep the host boundary simple.
export const arrayMethodSources = [
  'function f(x) { let a=[x];let n=a.push(2,3);return n*100+a.pop()*10+a.length; }',
  'function f(x) { let a=[];return a.pop()===undefined&&a.length===0; }',
  'function f(x) { let a=Array(3);a[1]=x;return a.pop()===undefined&&a.length===2&&!(0 in a); }',
  'function f(x) { let a=[1];Object.defineProperty(a,"length",{writable:false});try{a.push();}catch(e){return e instanceof TypeError;}return false; }',
  'function f(x) { let a=[];Object.defineProperty(a,"length",{writable:false});try{a.pop();}catch(e){return e instanceof TypeError;}return false; }',
  'function f(x) { let a=[1,2];Object.defineProperty(a,"1",{configurable:false});try{a.pop();}catch(e){return e instanceof TypeError&&a.length===2&&a[1]===2;}return false; }',
  'function f(x) { let o={length:1,0:x};let n=Array.prototype.push.call(o,7);return n*100+Array.prototype.pop.call(o)*10+o.length; }',
  'function f(x) { let s="";let o={get length(){s+="l";return {valueOf(){s+="v";return 1;}};},set length(v){s+="s";},get 0(){s+="g";return x;}};Array.prototype.pop.call(o);return s; }',
  'function f(x) { let s="";let o={get length(){s+="l";return 0;},set length(v){s+="n";},set 0(v){s+="a";},set 1(v){s+="b";throw x;}};try{Array.prototype.push.call(o,1,2);}catch(e){return s;}return "bad"; }',
  'function f(x) { let o={length:-2};return Array.prototype.push.call(o,x)===1&&o[0]===x&&o.length===1; }',
  'function f(x) { let a=[1,x,3];return a.at(-2)===x&&a.at(-4)===undefined&&a.at(Infinity)===undefined&&a.at(-Infinity)===undefined; }',
  'function f(x) { let s="";let o={get length(){s+="l";return 2;},get 1(){s+="g";return x;}};Array.prototype.at.call(o,{valueOf(){s+="i";return -1.9;}});return s; }',
  'function f(x) { return [7,8].at(NaN)===7&&[7,8].at(-0)===7&&[7,8].at(1.9)===8; }',
  'function f(x) { let a=Array(2);return a.includes(undefined)&&a.indexOf(undefined)===-1; }',
  'function f(x) { let a=[NaN,-0,x];return a.includes(NaN)&&a.indexOf(NaN)===-1&&a.includes(0)&&a.indexOf(0)===1; }',
  'function f(x) { let a=[1,2,1];return a.indexOf(1,-1)===2&&a.indexOf(1,Infinity)===-1&&a.indexOf(1,-Infinity)===0&&a.includes(1,-Infinity)&&!a.includes(1,Infinity); }',
  'function f(x) { let a=[];let index={valueOf(){throw 7;}};return a.indexOf(1,index)===-1&&!a.includes(1,index); }',
  'function f(x) { let p={1:x};let o=Object.create(p);o.length=3;return Array.prototype.indexOf.call(o,x)===1&&Array.prototype.includes.call(o,x); }',
  'function f(x) { let n=0;let a=[1,2,3];return !a.every(function(v){n++;return v<2;})&&n===2; }',
  'function f(x) { let n=0;let a=[1,2,3];return a.some(function(v){n++;return v===2;})&&n===2; }',
  'function f(x) { let n=0;let a=Array(4);a[2]=x;let result=a.forEach(function(v,i,o){if(v===x&&i===2&&o===a)n++;});return n===1&&result===undefined; }',
  'function f(x) { let a=[1,2,3];let s="";a.forEach(function(v,i){s+=v;if(i===0){delete a[1];a.push(4);a[2]=9;}});return s; }',
  'function f(x) { let o={0:1,length:3};let s="";Array.prototype.forEach.call(o,function(v,i){s+=i;if(i===0)o[2]=7;});return s; }',
  'function f(x) { let n=0;let cb=function(v,i,o){"use strict";n+=this===null?1:100;};[1,2].forEach(cb,null);return n; }',
  'function f(x) { let cb=function(v){return v===x;};cb.call=function(){throw 8;};return [x].every(cb); }',
  'function f(x) { let s="";let o={get length(){s+="l";return {valueOf(){s+="v";return 0;}};}};try{Array.prototype.every.call(o,null);}catch(e){return s+(e instanceof TypeError);}return "bad"; }',
  'function f(x) { let s="";let o={get length(){s+="l";return 1;},get 0(){s+="g";throw x;}};try{Array.prototype.forEach.call(o,function(){s+="c";});}catch(e){return s;}return "bad"; }',
  'function f(x) { let a=[1,2];try{a.some(function(){throw x;});}catch(e){return e;}return 99; }',
  'function f(x) { let n=0;try{Array.prototype.push.call(null,1);}catch(e){if(e instanceof TypeError)n++;}try{Array.prototype.at.call(undefined);}catch(e){if(e instanceof TypeError)n++;}return n; }',
  'function f(x) { function o(a,b){};o[1]=x;return Array.prototype.at.call(o,-1); }',
  'function f(x) { let a=[1];Object.preventExtensions(a);try{a.push(2);}catch(e){return e instanceof TypeError&&a.length===1;}return false; }',
  'function f(x) { let a=[1];Object.defineProperty(a,"length",{writable:false});try{a.pop();}catch(e){return e instanceof TypeError&&a.length===1&&!(0 in a);}return false; }',
];

export const arrayMethodResumptionSource = `function f(x) {
  let order = "";
  const receiver = {marker:7};
  const object = {
    get length() { order += "l"; return {valueOf(){order += "v"; return 3;}}; },
    get 0() { order += "g"; return 5; },
    2: 9
  };
  Array.prototype.forEach.call(object, function(value,index,original) {
    "use strict";
    if(this !== receiver || original !== object) throw 123;
    order += index;
    order += value;
  }, receiver);
  return order;
}`;
