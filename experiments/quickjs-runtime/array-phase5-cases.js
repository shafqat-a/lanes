// Each source returns a primitive and runs in a fresh realm. These are test
// oracles only; no fixture is evaluated on the CPU in production.
const shape='function shape(a){let s=""+a.length;for(let i=0;i<a.length;i++)s+=":"+(i in a?"v"+a[i]:"hole");return s;}';
const test=(feature,body)=>({feature,source:'function f(x){'+body+'}',input:3});
export const arrayPhase5Cases=[
 test('join-holes-null-undefined','const a=[x,,null,undefined,false,"z"];return a.join("|");'),
 test('join-default-undefined-separator','return [x,2].join()+":"+[x,2].join(undefined)+":"+[x,2].join(null);'),
 test('join-nested-arrays','return [[x,2],[],[null,undefined],4].join("|");'),
 test('join-receiver-boxing','return Array.prototype.join.call("ab",":")+":"+Array.prototype.join.call(3);'),
 test('join-length-separator-get-order','let log="";const o={get length(){log+="l";return 2;},get 0(){log+="a";return x;},get 1(){log+="b";return 2;}};const sep={toString(){log+="s";return "-";}};const value=Array.prototype.join.call(o,sep);return log+":"+value;'),
 test('join-separator-converts-even-empty','let log="";const value=[].join({toString(){log+="s";return "x";}});return log+":"+value;'),
 test('join-mutation-and-length-snapshot','const a=[1,2,3];Object.defineProperty(a,"0",{get:function(){a.length=1;return x;}});return a.join("|")+":"+a.length;'),
 test('join-inherited-index','const p=Object.create(Array.prototype);p[1]=x;const a=[1,,3];Object.setPrototypeOf(a,p);return a.join("-");'),
 test('join-element-string-hint','let log="";const a=[{toString(){log+="t";return {};},valueOf(){log+="v";return x;}}];const value=a.join();return log+":"+value;'),
 test('join-abrupt-separator-before-elements','let log="";const o={length:1,get 0(){log+="g";return 1;}};try{Array.prototype.join.call(o,{toString(){log+="s";throw x;}});}catch(e){log+=e;}return log;'),
 test('toString-custom-join-receiver-args','const a=[];a.join=function(){"use strict";return (this===a)+":"+arguments.length+":"+x;};return a.toString();'),
 test('toString-custom-join-nonstring-result','const o={join:function(){return x;}};return Array.prototype.toString.call(o);'),
 test('toString-intrinsic-fallback-ignores-public-mutation','const a=[];a.join=0;Object.prototype.toString=function(){return "wrong";};return a.toString();'),
 test('toString-generic-fallback','return Array.prototype.toString.call({join:null})+":"+Array.prototype.toString.call("ab")+":"+Array.prototype.toString.call(2);'),
 test('toString-getter-abrupt','const o={get join(){throw x;}};try{return Array.prototype.toString.call(o);}catch(e){return e+1;}'),
 test('map-holes-and-descriptors',shape+'const a=[x,,3];const b=a.map(function(v,i,o){return v+i+(o===a?1:0);});const d=Object.getOwnPropertyDescriptor(b,"0");return shape(b)+":"+d.writable+d.enumerable+d.configurable;'),
 test('map-callback-this-arg','const context={add:x};return [1,2].map(function(v,i,o){"use strict";return v+this.add+arguments.length;},context).join("|");'),
 test('map-strict-undefined-this','return [x].map(function(v){"use strict";return this===undefined? v:99;})[0];'),
 test('map-mutation-snapshot',shape+'const a=[1,2,3];const b=a.map(function(v,i){if(i===0){delete a[1];a[2]=x;a[3]=4;}return v;});return shape(b)+":"+a.length;'),
 test('map-inherited-index',shape+'const p={1:x};const o=Object.create(p);o[0]=2;o.length=3;return shape(Array.prototype.map.call(o,function(v){return v+1;}));'),
 test('map-string-boxing',shape+'return shape(Array.prototype.map.call("ab",function(v,i,o){return v+i+typeof o;}));'),
 test('map-creates-own-property-bypassing-setter','let called=0;Object.defineProperty(Array.prototype,"0",{set:function(v){called++;},configurable:true});const o={0:x,length:1};const a=Array.prototype.map.call(o,function(v){return v+1;});return called+":"+a[0]+":"+a.hasOwnProperty(0);'),
 test('map-constructor-get-after-callback-validation','let log="";const a=[x];Object.defineProperty(a,"constructor",{get:function(){log+="c";return undefined;}});try{a.map(null);}catch(e){log+=e instanceof TypeError?"T":"?";}const b=a.map(function(v){log+="m";return v;});return log+":"+b[0];'),
 test('map-length-range-before-element-get','let log="";const o={length:4294967296,get 0(){log+="g";return 1;}};try{Array.prototype.map.call(o,function(v){log+="m";return v;});}catch(e){log+=e instanceof RangeError?"R":"?";}return log;'),
 test('map-length-and-callback-validation-order','let log="";const o={get length(){log+="l";return {valueOf(){log+="n";return 0;}};}};try{Array.prototype.map.call(o,null);}catch(e){log+=e instanceof TypeError?"T":"?";}return log;'),
 test('map-callback-abrupt','let log="";try{[1,2,3].map(function(v){log+=v;if(v===2)throw x;return v;});}catch(e){log+=":"+e;}return log;'),
 test('filter-compacts-holes',shape+'return shape([0,,x,4].filter(function(v,i){return i>0;}));'),
 test('filter-preserves-original-value-before-callback-mutation',shape+'const a=[x,2];return shape(a.filter(function(v,i){a[i]=9;return true;}))+":"+a[0];'),
 test('filter-visits-added-inherited-index',shape+'const p={};const o=Object.create(p);o[0]=1;o.length=3;return shape(Array.prototype.filter.call(o,function(v,i){if(i===0)p[2]=x;return true;}));'),
 test('filter-this-arg-truthiness',shape+'return shape([1,2,3].filter(function(v){return v===this.value?{}:0;},{value:2}));'),
 test('filter-boxed-string',shape+'return shape(Array.prototype.filter.call(new String("abc"),function(v,i){return i!==1;}));'),
 test('filter-array-constructor-read','let log="";const a=[x];Object.defineProperty(a,"constructor",{get:function(){log+="c";return undefined;}});const b=a.filter(function(v){log+="f";return true;});return log+":"+b[0];'),
 test('slice-holes-negative-indices',shape+'return shape([0,x,,3,4].slice(-4,-1));'),
 test('slice-inherited-index',shape+'const p={1:x};const o=Object.create(p);o[0]=1;o.length=3;return shape(Array.prototype.slice.call(o));'),
 test('slice-string-boxing',shape+'return shape(Array.prototype.slice.call("abcd",1,3));'),
 test('slice-nan-infinity-fractions',shape+'const a=[x,2,3];return shape(a.slice(NaN,1.9))+"|"+shape(a.slice(-Infinity,Infinity))+"|"+shape(a.slice(Infinity));'),
 test('slice-coercion-before-constructor','let log="";const a=[x,2];Object.defineProperty(a,"constructor",{get:function(){log+="c";return undefined;}});const b=a.slice({valueOf(){log+="s";return 0;}},{valueOf(){log+="e";return 1;}});return log+":"+b[0];'),
 test('slice-length-snapshot-before-coercion',shape+'const a=[x,2,3];const b=a.slice({valueOf(){a.length=1;return 0;}});return shape(b);'),
 test('slice-high-index-short-span',shape+'const o={length:4294967295};o[4294967294]=x;return shape(Array.prototype.slice.call(o,4294967293));'),
 test('slice-count-range-error','try{Array.prototype.slice.call({length:4294967296});return "no";}catch(e){return e instanceof RangeError;}'),
 test('slice-custom-constructor-primitive-typeerror','const a=[x];a.constructor=null;try{a.slice();return "no";}catch(e){return e instanceof TypeError;}'),
 test('methods-nullish-receiver-typeerror','let log="";for(let i=0;i<5;i++){const method=i===0?Array.prototype.join:i===1?Array.prototype.toString:i===2?Array.prototype.map:i===3?Array.prototype.filter:Array.prototype.slice;try{method.call(null,function(v){return v;});log+="n";}catch(e){log+=e instanceof TypeError?"T":"?";}}return log;'),
];
// Preserve the original sources as required positives after species integration.
arrayPhase5Cases.push(...['map','filter','slice'].map(method=>test(method+'-custom-species-unsupported','const a=[x];a.constructor={};try{const b=a.'+method+'(function(v){return v;});return b.length;}catch(e){return "caught";}')));
export const arrayPhase5UnsupportedCases=[];
export const arrayPhase5ResourceCases=[test('join-cycle-resource-limit','const a=[];a[0]=a;return a.join();')];
export const arrayPhase5ResumptionSource='function f(x){let log="";const a=[1,,3];Object.defineProperty(a,"1",{get:function(){log+="g";return x;},configurable:true});const b=a.map(function(v,i){log+="m"+i;return v+1;}).filter(function(v,i){log+="f"+i;return i!==0;});const c=b.slice({valueOf(){log+="s";return 0;}},{valueOf(){log+="e";return 2;}});const result=c.join({toString(){log+="j";return "|";}});return log+":"+result;}';
export const arrayPhase5ResumptionExpected='m0gm1m2f0f1f2sej:4|4';
