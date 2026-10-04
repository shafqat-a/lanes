// ES2025 25.5.1.2 InternalizeJSONProperty: callback receives exactly two args.
// Current native engines may implement the newer source-context proposal. Only
// the explicitly marked arity fixture allows that native-reference difference.
const rows=[
 ['postorder','let log="";JSON.parse(\'{"a":{"b":1},"c":[2]}\',function(k,v){log+=k+",";return v;});return log;','b,a,0,c,,'],
 ['object-key-snapshot','let log="";const out=JSON.parse(\'{"a":1,"b":2}\',function(k,v){log+=k+",";if(k==="a")this.c=3;return v;});return log+":"+JSON.stringify(out);','a,b,,:{"a":1,"b":2,"c":3}'],
 ['array-length-snapshot','let log="";const out=JSON.parse(\'[1,2]\',function(k,v){log+=k+",";if(k==="0")this[2]=3;return v;});return log+":"+JSON.stringify(out);','0,1,,:[1,2,3]'],
 ['array-shrink-still-visits','let log="";const out=JSON.parse(\'[1,2]\',function(k,v){if(k!=="")log+=k+"="+v+";";if(k==="0"){this.length=0;return 10;}if(k==="1")return 11;return v;});return log+":"+JSON.stringify(out);','0=1;1=undefined;:[10,11]'],
 ['inherited-get-after-delete','let seen="";const out=JSON.parse(\'{"a":1,"b":2}\',function(k,v){if(k==="a"){delete this.b;Object.setPrototypeOf(this,{b:9});}if(k==="b")seen+=v;return v;});return seen+":"+Object.hasOwn(out,"b")+":"+JSON.stringify(out);','9:true:{"a":1,"b":9}'],
 ['ignore-failed-delete','const out=JSON.parse(\'{"a":1}\',function(k,v){if(k==="a"){Object.defineProperty(this,k,{configurable:false});return undefined;}return v;});return out.a+":"+Object.getOwnPropertyDescriptor(out,"a").configurable;','1:false'],
 ['ignore-failed-create-readonly','const out=JSON.parse(\'{"a":1}\',function(k,v){if(k==="a"){Object.defineProperty(this,k,{writable:false,configurable:false});return 7;}return v;});return out.a+":"+Object.getOwnPropertyDescriptor(out,"a").writable;','1:false'],
 ['ignore-failed-create-nonextensible','let seen="";const out=JSON.parse(\'{"a":1,"b":2}\',function(k,v){if(k==="a"){delete this.b;Object.preventExtensions(this);}if(k==="b"){seen+=v;return 9;}return v;});return seen+":"+Object.hasOwn(out,"b")+":"+JSON.stringify(out);','undefined:false:{"a":1}'],
 ['ignore-failed-create-accessor','let called=0;const out=JSON.parse(\'{"a":1}\',function(k,v){if(k==="a"){Object.defineProperty(this,k,{get(){called++;return 8;},configurable:false});return 7;}return v;});const d=Object.getOwnPropertyDescriptor(out,"a");return typeof d.get+":"+called+":"+out.a+":"+called;','function:0:8:1'],
 ['callback-holder-root-empty-key','let ok=true,root=0;const out=JSON.parse(\'{"a":1}\',function(k,v){"use strict";if(k==="a")ok=ok&&this.a===v;if(k===""){root++;ok=ok&&this[""]===v&&Object.keys(this).join(",")==="";return v.a+4;}return v;});return ok+":"+root+":"+out;','true:1:5'],
 ['exception-identity','const token={};let count=0;try{JSON.parse(\'{"a":1,"b":2}\',function(k,v){count++;throw token;});}catch(e){return (e===token)+":"+count;}return "wrong";','true:1'],
 ['getter-created-before-object-visit','let log="",reads=0;JSON.parse(\'{"a":1,"b":2}\',function(k,v){log+=k+",";if(k==="a")Object.defineProperty(this,"b",{get(){reads++;return {nested:7};},configurable:true,enumerable:true});return v;});return log+":"+reads;','a,nested,b,,:1'],
 ['createdata-bypasses-inherited-setter','let calls=0;const out=JSON.parse(\'{"a":1,"b":2}\',function(k,v){if(k==="a"){delete this.b;Object.setPrototypeOf(this,{set b(v){calls++;}});}if(k==="b")return 9;return v;});return calls+":"+Object.hasOwn(out,"b")+":"+out.b;','0:true:9'],
 ['root-undefined','return JSON.parse(\'{"a":1}\',function(k,v){if(k==="")return undefined;return v;})===undefined;',true],
];
export const jsonReviverReviewCases=Object.freeze(rows.map(([name,body,expected])=>Object.freeze({feature:'json-reviver-review-'+name,source:'function f(x){'+body+'}',input:17,expected})));
export const jsonReviverReviewVersionCases=Object.freeze([
 Object.freeze({feature:'json-reviver-review-es2025-two-arguments',source:'function f(x){let log="";JSON.parse(\'{"a":1}\',function(k,v){log+=k+":"+arguments.length+":"+(arguments[2]===undefined)+";";return v;});return log;}',input:17,expected:'a:2:true;:2:true;',allowedNativeExpected:'a:3:false;:3:false;',nativeReferenceDifference:'ES2025 InternalizeJSONProperty calls reviver with [name,val]; newer JSON.parse source-context implementations supply a third argument.'}),
]);
