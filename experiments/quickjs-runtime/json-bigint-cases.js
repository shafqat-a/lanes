const c=(name,body,expected)=>({feature:'json-bigint-'+name,source:`function f(x){${body}}`,input:3,expected});
export const jsonBigIntCases=Object.freeze([
 c('root-replacer-holder','let log="";const s=JSON.stringify(1n,function(k,v){log+=k+":"+(this[k]===v)+":"+typeof v;return "saved";});return log+":"+s;',':true:bigint:"saved"'),
 c('nested-replacer-rescue','return JSON.stringify({a:1n,b:[2n]},function(k,v){return typeof v==="bigint"?true:v;});','{"a":true,"b":[true]}'),
 c('prototype-tojson-strict-this','BigInt.prototype.toJSON=function(k){"use strict";return typeof this+":"+k+":"+arguments.length;};return JSON.stringify({a:1n});','{"a":"bigint:a:1"}'),
 c('prototype-getter-before-replacer','let log="";Object.defineProperty(BigInt.prototype,"toJSON",{get:function(){"use strict";log+="g"+typeof this;return function(k){"use strict";log+="j"+k;return 7;};}});const s=JSON.stringify(1n,function(k,v){log+="r"+typeof v;return v;});return log+":"+s;','gbigintjrnumber:7'),
 c('tojson-getter-abrupt','const token={};let calls=0;Object.defineProperty(BigInt.prototype,"toJSON",{get:function(){throw token;}});try{JSON.stringify(1n,function(){calls++;});}catch(e){return e===token&&calls===0;}return false;',true),
 c('tojson-call-abrupt','const token={};let calls=0;BigInt.prototype.toJSON=function(){throw token;};try{JSON.stringify(1n,function(){calls++;});}catch(e){return e===token&&calls===0;}return false;',true),
 c('replacer-abrupt','const token={};BigInt.prototype.toJSON=function(){return 3n;};try{JSON.stringify(1n,function(){throw token;});}catch(e){return e===token;}return false;',true),
 c('noncallable-tojson-rescue','BigInt.prototype.toJSON=7;return JSON.stringify(1n,function(k,v){return typeof v==="bigint"?null:v;});','null'),
 c('tojson-bigint-then-replacer','let calls=0;BigInt.prototype.toJSON=function(){calls++;return 2n;};return JSON.stringify(1n,function(k,v){return typeof v==="bigint"?"rescued":v;})+":"+calls;','"rescued":1'),
 c('replacer-return-not-reprocessed','let calls=0;BigInt.prototype.toJSON=function(){calls++;return 4;};try{JSON.stringify(0,function(){return 1n;});}catch(e){return e instanceof TypeError&&calls===0;}return false;',true),
 c('tojson-object-not-reprocessed','const result={toJSON:function(){throw 9;},a:4};BigInt.prototype.toJSON=function(){return result;};return JSON.stringify(1n);','{"a":4}'),
 c('wrapper-replacer-rescue','const o=Object(1n);return JSON.stringify(o,function(k,v){return v===o?"wrapped":v;});','"wrapped"'),
 c('wrapper-valueof-never-called','const o=Object(1n);o.valueOf=function(){throw 9;};o[Symbol.toPrimitive]=function(){throw 10;};try{JSON.stringify(o);}catch(e){return e instanceof TypeError;}return false;',true),
 c('wrapper-tojson-this','const o=Object(1n);o.toJSON=function(k){return this===o&&k==="";};return JSON.stringify(o);','true'),
 c('wrapper-returned-by-replacer','let calls=0;const o=Object(1n);o.toJSON=function(){calls++;return 3;};try{JSON.stringify(0,function(){return o;});}catch(e){return e instanceof TypeError&&calls===0;}return false;',true),
 c('root-symbol-result','BigInt.prototype.toJSON=function(){return Symbol("x");};return JSON.stringify(1n);',undefined),
 c('nested-symbol-result','BigInt.prototype.toJSON=function(){return Symbol("x");};return JSON.stringify({a:1n,b:[2n]});','{"b":[null]}'),
 c('replacer-sees-symbol-after-tojson','BigInt.prototype.toJSON=function(){return Symbol("x");};return JSON.stringify(1n,function(k,v){return typeof v;});','"symbol"'),
 c('bigint-replacer-list-items-ignored','return JSON.stringify({a:1,b:2},[1n,Object(2n),"b"]);','{"b":2}'),
 c('bigint-space-ignored','return JSON.stringify({a:1},null,Object(2n));','{"a":1}'),
 c('prototype-getter-mutation-order','let n=0;Object.defineProperty(BigInt.prototype,"toJSON",{get:function(){n++;if(n===1)return function(){return 1;};return undefined;}});return JSON.stringify([1n,2n],function(k,v){return typeof v==="bigint"?2:v;})+":"+n;','[1,2]:2'),
]);
export const jsonBigIntResumptionSource='function f(x){let log="";BigInt.prototype.toJSON=function(k){"use strict";log+="j"+k;return this;};const s=JSON.stringify({a:1n,b:[2n]},function(k,v){log+="r"+k;return typeof v==="bigint"?x:v;});return log+":"+s;}';
export const jsonBigIntResumptionExpected='rjararbj0r0:{"a":3,"b":[3]}';
