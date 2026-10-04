const cases=[];const add=(feature,body,expected=true,extra={})=>cases.push({feature:'group-by-'+feature,source:`function f(x){${body}}`,input:3,expected,...extra});
for(const name of ['Map','Object']){
 const read=name==='Map'?'r.get("a")':'r.a';
 add(name+'-counter-args-this',`let log="";const r=${name}.groupBy([x,x+1],function(v,k){"use strict";log+=(this===undefined)+":"+arguments.length+":"+k+";";return "a";});return log==="true:2:0;true:2:1;"&&${read}[0]===x&&${read}[1]===x+1;`);
 add(name+'-receiver-ignored',`const r=${name}.groupBy.call(function(){throw 9;},[x],()=>"a");return ${read}[0]===x;`);
 add(name+'-callback-validation',`let log="";const input={get [Symbol.iterator](){log+="i";throw 9;}};try{${name}.groupBy(input,{});}catch(e){return e instanceof TypeError&&log==="";}return false;`);
 add(name+'-arraylike-not-iterable',`try{${name}.groupBy({0:x,length:1},()=>0);}catch(e){return e instanceof TypeError;}return false;`);
 add(name+'-null-input',`try{${name}.groupBy(null,()=>0);}catch(e){return e instanceof TypeError;}return false;`);
 add(name+'-callback-throw-close',`let log="";const token={};const input={[Symbol.iterator](){return {next(){return {value:x};},get return(){log+="g";return function(){log+="r";throw 8;};}};}};try{${name}.groupBy(input,()=>{throw token;});}catch(e){return e===token&&log==="gr";}return false;`);
 add(name+'-step-throw-no-close',`let closed=0;const token={};const input={[Symbol.iterator](){return {next(){throw token;},return(){closed++;return {};}};}};try{${name}.groupBy(input,()=>0);}catch(e){return e===token&&closed===0;}return false;`);
 add(name+'-value-throw-no-close',`let closed=0;const token={};const input={[Symbol.iterator](){return {next(){return {get value(){throw token;}};},return(){closed++;return {};}};}};try{${name}.groupBy(input,()=>0);}catch(e){return e===token&&closed===0;}return false;`);
 add(name+'-holes-dense',`const r=${name}.groupBy([,x],()=>"a");const a=${read};return a.length===2&&Object.hasOwn(a,"0")&&a[0]===undefined&&a[1]===x;`);
 add(name+'-string-codepoints',`const r=${name}.groupBy("a\\uD83D\\uDE00",()=>"a");const a=${read};return a.length===2&&a[1].length===2;`);
 add(name+'-numeric-prototype-setter',`let n=0;Object.defineProperty(Array.prototype,"0",{set(v){n++;},configurable:true});const input={ [Symbol.iterator](){let i=0;return {next(){return i++===0?{value:x}:{done:true};}};}};const r=${name}.groupBy(input,()=>"a");return n===0&&${read}[0]===x;`);
}
add('object-null-prototype-dangerous-keys','const r=Object.groupBy(["__proto__","constructor","toString"],v=>v);return Object.getPrototypeOf(r)===null&&r.__proto__[0]==="__proto__"&&r.constructor[0]==="constructor"&&r.toString[0]==="toString";');
add('object-symbol-propertykey','const s=Symbol("s");let log="";const key={[Symbol.toPrimitive](hint){log+=hint;return s;}};const r=Object.groupBy([x,x+1],()=>key);return log==="stringstring"&&Object.getOwnPropertySymbols(r)[0]===s&&r[s].length===2;');
add('object-key-order-and-attributes','const r=Object.groupBy(["b","2","1","b"],v=>v);const d=Object.getOwnPropertyDescriptor(r,"b");return Object.keys(r).join(":")==="1:2:b"&&d.writable&&d.enumerable&&d.configurable&&d.value.length===2;');
add('object-key-conversion-closes','const token={};let closed=0;const input={[Symbol.iterator](){return {next(){return {value:x};},return(){closed++;throw 7;}};}};try{Object.groupBy(input,()=>({[Symbol.toPrimitive](){throw token;}}));}catch(e){return e===token&&closed===1;}return false;');
add('map-key-identity-no-coercion','const a={toString(){throw 9;}},b={valueOf(){throw 8;}};const r=Map.groupBy([a,b,a],v=>v);return r.size===2&&r.get(a).length===2&&r.get(b)[0]===b;');
add('map-nan-and-negative-zero','const r=Map.groupBy([0,-0,NaN,NaN],v=>v);const keys=[...r.keys()];return r.size===2&&1/keys[0]===Infinity&&r.get(-0).length===2&&r.get(NaN).length===2;');
add('map-symbol-and-bigint-keys','const s=Symbol("s"),t=Symbol("s");const r=Map.groupBy([s,t,1n,1],v=>v);return r.size===4&&r.get(s)[0]===s&&r.get(1n)[0]===1n&&r.get(1)[0]===1;');
add('private-intrinsic-mutation-immunity','const map=Map.groupBy,object=Object.groupBy,get=Map.prototype.get;Map.prototype.set=function(){throw 8;};Map.prototype.get=function(){throw 9;};Array.prototype.push=function(){throw 7;};Object.create=function(){throw 6;};Object.defineProperty=function(){throw 5;};const a=map([x],()=>"k"),b=object([x],()=>"k");return get.call(a,"k")[0]===x&&b.k[0]===x;');
add('object-resumption','let log="";const r=Object.groupBy([1,2,3],function(v,k){log+="c"+k;return {[Symbol.toPrimitive](h){log+="k"+v;return v%2;}};});return log+":"+r[1].join(",")+":"+r[0].join(",");','c0k1c1k2c2k3:1,3:2',{resumption:true});
add('map-gc-retained-keys-values','const key={marker:x};const r=Map.groupBy([x,x+1,x+2],function(v){for(let i=0;i<240;i++){const waste={a:i,b:i+1};}return key;});return r.get(key).length===3&&r.get(key)[2]===x+2&&[...r.keys()][0]===key;',true,{requiresGC:true});
export const groupByCases=Object.freeze(cases);
export const groupByResourceCases=Object.freeze([{feature:'group-by-output-heap-limit',source:'function f(){return Object.groupBy({[Symbol.iterator](){let i=0;return {next(){return {done:i>=100000,value:i++};}};}},()=>0);}',input:0}]);
