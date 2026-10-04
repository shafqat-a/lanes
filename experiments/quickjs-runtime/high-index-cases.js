// Sparse boundary fixtures: none traverses or allocates the declared length.
export const highIndexCases = Object.freeze([
 ['constructor-half', 'x=>Array(2147483648).length+x', 2147483665],
 ['constructor-maximum', 'x=>new Array(4294967295).length+x', 4294967312],
 ['constructor-overflow', 'x=>{try{Array(4294967296);return false;}catch(e){return (e instanceof RangeError)+":"+x;}}', 'true:17'],
 ['numeric-grow', 'x=>{let a=[];a[2147483648]=x;return a.length+":"+a["2147483648"];}','2147483649:17'],
 ['maximum-index', 'x=>{let a=[];a[4294967294]=x;return a.length+":"+a["4294967294"];}','4294967295:17'],
 ['maximum-named', 'x=>{let a=[];a[4294967295]=x;return a.length+":"+a["4294967295"];}','0:17'],
 ['noncanonical-name', 'x=>{let a=[];a["02147483648"]=x;a["-1"]=1;return a.length+":"+a["02147483648"];}','0:17'],
 ['delete-high', 'x=>{let a=[];a[4294967294]=x;let before=4294967294 in a;delete a["4294967294"];return before+":"+(4294967294 in a)+":"+a.length+":"+x;}','true:false:4294967295:17'],
 ['shrink-high', 'x=>{let a=[];a[2147483647]=x;a[2147483648]=2;a[4294967294]=3;a.length=2147483648;return a.length+":"+a[2147483647]+":"+(2147483648 in a)+":"+(4294967294 in a);}','2147483648:17:false:false'],
 ['partial-shrink', 'x=>{let a=[];Object.defineProperty(a,"2147483648",{value:x,configurable:false});a[4294967294]=3;a.length=1;return a.length+":"+a[2147483648]+":"+(4294967294 in a);}','2147483649:17:false'],
 ['partial-shrink-readonly', 'x=>{let a=[];Object.defineProperty(a,"2147483648",{value:x});a[4294967294]=3;let caught=false;try{Object.defineProperty(a,"length",{value:1,writable:false});}catch(e){caught=e instanceof TypeError;}return caught+":"+a.length+":"+Object.getOwnPropertyDescriptor(a,"length").writable+":"+(4294967294 in a)+":"+x;}','true:2147483649:false:false:17'],
 ['readonly-high-growth', 'x=>{let a=Array(2147483649);Object.defineProperty(a,"length",{writable:false});a[2147483648]=x;a[2147483649]=1;return a.length+":"+a[2147483648]+":"+(2147483649 in a);}','2147483649:17:false'],
 ['readonly-high-define', 'x=>{let a=[];Object.defineProperty(a,"length",{writable:false});try{Object.defineProperty(a,"4294967294",{value:x});return false;}catch(e){return (e instanceof TypeError)+":"+a.length+":"+x;}}','true:0:17'],
 ['accessor-high', 'x=>{let a=[];Object.defineProperty(a,"4294967294",{get:function(){return x;},configurable:true});return a.length+":"+a[4294967294];}','4294967295:17'],
 ['object-order', 'x=>{let a={};a.z=x;a[4294967295]=1;a[4294967294]=2;a[2147483648]=3;a[2147483647]=4;a[1]=5;a.a=6;let k=Object.keys(a);return k[0]+","+k[1]+","+k[2]+","+k[3]+","+k[4]+","+k[5]+","+k[6]+":"+a.z;}','1,2147483647,2147483648,4294967294,z,4294967295,a:17'],
 ['array-own-order', 'x=>{let a=[];a.z=x;a[4294967294]=1;a[2147483648]=2;let k=Object.getOwnPropertyNames(a);return k[0]+","+k[1]+","+k[2]+","+k[3]+":"+x;}','2147483648,4294967294,length,z:17'],
 ['dynamic-key-gc', 'x=>{let a=[];let key="214748"+"3648";a[key]=x;for(let i=0;i<400;i++){let q={value:i};}return a[2147483648]+":"+a.length;}','17:2147483649'],
 ['length-maximum-set', 'x=>{let a=[];a.length=4294967295;a[4294967294]=x;return a.length+":"+a[4294967294];}','4294967295:17'],
 ['length-overflow-set', 'x=>{let a=[];try{a.length=4294967296;return false;}catch(e){return (e instanceof RangeError)+":"+a.length+":"+x;}}','true:0:17'],
 ['pop-maximum', 'x=>{let a=Array(4294967295);a[4294967294]=x;let v=a.pop();return v+":"+a.length+":"+(4294967294 in a);}','17:4294967294:false'],
 ['push-high', 'x=>{let a=Array(2147483648);let n=a.push(x);return n+":"+a[2147483648];}','2147483649:17'],
 ['inherited-high-setter', 'x=>{let p={};let seen=0;Object.defineProperty(p,"2147483648",{set:function(v){seen=v;}});let a=[];Object.setPrototypeOf(a,p);a[2147483648]=x;return seen+":"+a.length+":"+Object.prototype.hasOwnProperty.call(a,"2147483648");}','17:0:false'],
 ['strict-partial-shrink', 'x=>{"use strict";let a=[];Object.defineProperty(a,"2147483648",{value:x});a[4294967294]=3;try{a.length=1;return false;}catch(e){return (e instanceof TypeError)+":"+a.length+":"+(4294967294 in a)+":"+a[2147483648];}}','true:2147483649:false:17'],
 ['enumerability-order', 'x=>{let o={};o.z=x;Object.defineProperty(o,"2147483648",{value:2});o[4294967294]=3;o[1]=4;let a=Object.keys(o),b=Object.getOwnPropertyNames(o);return a[0]+","+a[1]+","+a[2]+":"+b[0]+","+b[1]+","+b[2]+","+b[3]+":"+x;}','1,4294967294,z:1,2147483648,4294967294,z:17'],
 ['string-high-absent', 'x=>{return ("abc"[2147483648]===undefined)+":"+x;}','true:17'],
 ['named-preserved-shrink', 'x=>{let a=[];a[4294967295]=x;a[4294967294]=1;a.length=0;return a.length+":"+a[4294967295]+":"+(4294967294 in a);}','0:17:false'],
 ['numeric-descriptor-alias', 'x=>{let a=[];Object.defineProperty(a,2147483648,{value:x,configurable:true});return Object.getOwnPropertyDescriptor(a,"2147483648").value+":"+a.length;}','17:2147483649'],
 ['negative-fraction-length', 'x=>{let n=0;try{Array(-1);}catch(e){if(e instanceof RangeError)n++;}try{Array(2147483648.5);}catch(e){if(e instanceof RangeError)n++;}return n+":"+x;}','2:17'],
].map(([feature,source,expected])=>Object.freeze({feature:'high-index-'+feature,source:source.startsWith('x=>{') ? 'function kernel(x)'+source.slice(3) : 'function kernel(x){return '+source.slice(3)+';}',input:17,expected})));

export const highIndexResumptionSource = `function highIndexResumption(x){
  let a=[];let prefix="214748";let key=prefix+"3648";
  Object.defineProperty(a,key,{value:x,configurable:false});
  a[4294967294]=x+1;a[4294967295]=x+2;
  let caught=false;
  try{Object.defineProperty(a,"length",{value:1,writable:false});}
  catch(e){caught=e instanceof TypeError;}
  let keys=Object.getOwnPropertyNames(a);
  return caught+":"+a.length+":"+a[key]+":"+(4294967294 in a)+":"+a[4294967295]+":"+
    Object.getOwnPropertyDescriptor(a,"length").writable+":"+keys[0]+","+keys[1]+","+keys[2];
}`;
export const highIndexResumptionExpected = 'true:2147483649:17:false:19:false:2147483648,length,4294967295';
