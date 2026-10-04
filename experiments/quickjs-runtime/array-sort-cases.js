const cases=[];
function add(feature,body){cases.push({feature,source:`function f(x){${body}}`,input:3});}
for(const method of ['sort','toSorted']){
 add(`${method}: numeric order`, `const a=[x+2,x-1,x,x+1];const b=a.${method}((a,b)=>a-b);return b.join(',')+'|'+(a===b);`);
 add(`${method}: default lexicographic`, `return [10,2,x,1].${method}().join(',');`);
 add(`${method}: stable equality and NaN`, `const a=[{n:1,s:'a'},{n:0,s:'b'},{n:1,s:'c'},{n:0,s:'d'}];const b=a.${method}((a,b)=>a.n-b.n);return b.map(a=>a.s).join('')+':'+[x,2,1].${method}(()=>NaN).join(',');`);
 add(`${method}: holes undefined dense copy`, `const a=[,x,undefined,,1];const b=a.${method}((a,b)=>a-b);let s='';for(let i=0;i<b.length;i++)s+=(Object.hasOwn(b,i)?typeof b[i]+':'+b[i]:'hole')+';';return s;`);
 add(`${method}: undefined bypasses comparator`, `let bad=false;const b=[undefined,x,1,undefined].${method}((a,b)=>{if(a===undefined||b===undefined)bad=true;return a-b;});return b.join(',')+':'+bad;`);
 add(`${method}: comparator result ToNumber`, `let n=0;const b=[x+1,x].${method}((a,b)=>({valueOf(){n++;return a-b;}}));return b.join(',')+':'+(n>0);`);
 add(`${method}: strict callback this and arity`, `let ok=true;[x+1,x].${method}(function(a,b){'use strict';ok=ok&&this===undefined&&arguments.length===2;return a-b;});return ok;`);
 add(`${method}: generic inherited indexed property`, `const p={0:x+2};const a=Object.create(p);a.length=3;a[1]=x;const b=Array.prototype.${method}.call(a,(a,b)=>a-b);return b[0]+':'+b[1]+':'+b[2]+':'+Object.hasOwn(b,2)+':'+(a===b);`);
 add(`${method}: snapshot before comparison`, `let phase=0,ok=true;const a={length:2,get 0(){if(phase!==0)ok=false;return x+1},get 1(){if(phase!==0)ok=false;return x},set 0(v){if(phase!==1)ok=false},set 1(v){if(phase!==1)ok=false}};Array.prototype.${method}.call(a,(a,b)=>{phase=1;return a-b});return ok&&phase===1;`);
 add(`${method}: comparator validation before length`, `let n=0;const o={get length(){n++;throw 7;}};try{Array.prototype.${method}.call(o,{});}catch(e){return (e instanceof TypeError)+':'+n;}return 'wrong';`);
 add(`${method}: getter changes later presence`, `const a={length:3,get 0(){delete this[1];this[2]=x;return 2},1:9};const b=Array.prototype.${method}.call(a,()=>0);return b[0]+':'+b[1]+':'+b[2]+':'+Object.hasOwn(b,2);` .replace('get 0(){','get 0(){').replace('},1:9','},set 0(v){Object.defineProperty(this,0,{value:v,writable:true,configurable:true,enumerable:true});},1:9'));
 add(`${method}: comparator throws before writes`, `const a=[x+1,x];try{a.${method}(()=>{throw 17;});}catch(e){return e+':'+a.join(',');}return 'wrong';`);
 add(`${method}: comparator changes length snapshot`, `const a=[x+2,x+1,x];let once=false;const b=a.${method}((a0,b0)=>{if(!once){once=true;a.length=0;}return a0-b0;});return b.join(',')+':'+a.length;`);
 add(`${method}: default ToString hint`, `let ok=true,n=0;const a={toString(){n++;return 'b'},valueOf(){ok=false;return 'a'}};const b={toString(){n++;return 'a'},valueOf(){ok=false;return 'z'}};return ([a,b].${method}()[0]===b)+':'+ok+':'+(n>0);`);
 add(`${method}: invalid comparator zero length`, `try{[].${method}(null);}catch(e){return e instanceof TypeError;}return false;`);
 add(`${method}: noncallable class comparator invoked`, `try{[x+1,x].${method}(class C{});}catch(e){return e instanceof TypeError;}return false;`);
 add(`${method}: default UTF16 order`, `return ['\\uE000','\\uD800\\uDC00','a','\\uDFFF'].${method}().map(s=>s.charCodeAt(0)).join(',');`);
 add(`${method}: signed zero stability`, `const a=[-0,0,-0,0].${method}((a,b)=>a-b);return a.map(v=>Object.is(v,-0)?'-':'+').join('');`);
 add(`${method}: public metadata`, `return Array.prototype.${method}.name+':'+Array.prototype.${method}.length;`);
}
add('sort: partial writeback then readonly throws', `const a=[3,2,1];Object.defineProperty(a,1,{writable:false});try{a.sort((a,b)=>a-b);}catch(e){return (e instanceof TypeError)+':'+a.join(',');}return 'wrong';`);
add('sort: deleting nonconfigurable trailing slot throws', `const a=[,x];Object.defineProperty(a,1,{configurable:false});try{a.sort();}catch(e){return (e instanceof TypeError)+':'+a[0]+':'+a[1];}return 'wrong';`);
add('sort: empty primitive returns wrapper', `const result=Array.prototype.sort.call(x);return typeof result+':'+result.valueOf();`);
add('sort: string readonly index throws', `try{Array.prototype.sort.call('ba');}catch(e){return e instanceof TypeError;}return false;`);
add('toSorted: string generic copies', `return Array.prototype.toSorted.call('cba').join(',');`);
add('toSorted: frozen source remains unchanged', `const a=Object.freeze([x+1,x]);return a.toSorted((a,b)=>a-b).join(',')+':'+a.join(',');`);
add('toSorted: ArrayCreate range before index reads', `let n=0;const a={length:4294967296,get 0(){n++;return 1}};try{Array.prototype.toSorted.call(a);}catch(e){return (e instanceof RangeError)+':'+n;}return 'wrong';`);
add('sort: destructuring comparator phase4 regression', `const a=[{v:x+2},{v:x},{v:x+1}];a.sort(({v:a},{v:b})=>a-b);return a.map(({v})=>v).join(',');`);
add('sort: temporary list ignores Array prototype setter', `let called=0;Object.defineProperty(Array.prototype,0,{get(){return 99},set(){called++},configurable:true});const a=[x+1,x];a.sort((a,b)=>a-b);return a.join(',')+':'+called;`);
add('toSorted: fresh properties ignore Array prototype setter', `let called=0;Object.defineProperty(Array.prototype,0,{get(){return 99},set(){called++},configurable:true});const a=[x+1,x];const b=a.toSorted((a,b)=>a-b);return b.join(',')+':'+called+':'+Object.hasOwn(b,0);`);
add('sort: snapshot survives allocation and garbage collection', `const a=[{v:x+2},{v:x},{v:x+1}];const b=a.sort((a,b)=>{for(let i=0;i<240;i++){const discarded={n:i,s:'discard'+i};}return a.v-b.v;});return b.map(o=>o.v).join(',');`);
export const arraySortCases=Object.freeze(cases.map(Object.freeze));
export const arraySortResumptionSource=`function f(x){let reads=0,compared=false;const o={length:3,get 0(){reads++;return x+2},set 0(v){Object.defineProperty(this,0,{value:v,writable:true,configurable:true})},get 1(){reads++;return x},set 1(v){Object.defineProperty(this,1,{value:v,writable:true,configurable:true})},get 2(){reads++;return x+1},set 2(v){Object.defineProperty(this,2,{value:v,writable:true,configurable:true})}};Array.prototype.sort.call(o,(a,b)=>{if(reads!==3)throw 91;compared=true;return {valueOf(){return a-b}}});return o[0]+':'+o[1]+':'+o[2]+':'+reads+':'+compared;}`;
export const arraySortResumptionExpected='3:4:5:3:true';
export const arraySortResourceCases=Object.freeze([{feature:'toSorted: dense output exceeds heap',source:'function f(x){return new Array(10000).toSorted().length;}'}]);
