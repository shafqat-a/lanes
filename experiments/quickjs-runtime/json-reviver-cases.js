const c=(name,body,expected)=>({feature:'json-reviver-'+name,source:`function f(x){${body}}`,input:3,expected});
export const jsonReviverCases=Object.freeze([
 c('postorder','let log="";const r=JSON.parse("{\\"a\\":[1,{\\"b\\":2}],\\"c\\":3}",function(k,v){log+=k+",";return typeof v==="number"?v*2:v;});return log+JSON.stringify(r);','0,b,1,a,c,,{"a":[2,{"b":4}],"c":6}'),
 c('numeric-order','let log="";JSON.parse("{\\"9\\":9,\\"2\\":2,\\"a\\":1}",function(k,v){log+=k+",";return v;});return log;','2,9,a,,'),
 c('root-holder','return JSON.parse("1",function(k,v){return k===""&&this[""]===1&&Object.getPrototypeOf(this)===Object.prototype;});',true),
 c('root-undefined','return JSON.parse("1",function(){return undefined;});',undefined),
 c('root-replaced','return JSON.parse("null",function(k,v){return v===null?x:0;});',3),
 c('deleted-object','const r=JSON.parse("{\\"a\\":1,\\"b\\":2}",function(k,v){return k==="a"?undefined:v;});return JSON.stringify(r);','{"b":2}'),
 c('deleted-array','const r=JSON.parse("[1,2]",function(k,v){return k==="0"?undefined:v;});return r.length+":"+Object.hasOwn(r,"0")+":"+r[1];','2:false:2'),
 c('added-not-visited','let log="";const r=JSON.parse("{\\"a\\":1}",function(k,v){log+=k+",";if(k==="a")this.b=2;return v;});return log+JSON.stringify(r);','a,,{"a":1,"b":2}'),
 c('delete-next-still-visited','let log="";const r=JSON.parse("{\\"a\\":1,\\"b\\":2}",function(k,v){if(k==="a")delete this.b;log+=k+":"+typeof v+",";return v;});return log+JSON.stringify(r);','a:number,b:undefined,:object,{"a":1}'),
 c('delete-next-inherited-get','const r=JSON.parse("{\\"a\\":1,\\"b\\":2}",function(k,v){if(k==="a"){delete this.b;Object.setPrototypeOf(this,{b:9});}return v;});return r.b+":"+Object.hasOwn(r,"b");','9:true'),
 c('next-getter','let log="";JSON.parse("{\\"a\\":1,\\"b\\":2}",function(k,v){if(k==="a")Object.defineProperty(this,"b",{get:function(){log+="g";return 8;},configurable:true});if(k==="b")log+=v;return v;});return log;','g8'),
 c('enumerability-snapshot','let log="";JSON.parse("{\\"a\\":1,\\"b\\":2}",function(k,v){if(k==="a")Object.defineProperty(this,"b",{enumerable:false});log+=k;return v;});return log;','ab'),
 c('array-length-snapshot','let log="";const r=JSON.parse("[1,2,3]",function(k,v){if(k==="0")this.length=1;log+=k+":"+typeof v+",";return v;});return log+r.length;','0:number,1:undefined,2:undefined,:object,1'),
 c('array-inherited','const r=JSON.parse("[1,2]",function(k,v){if(k==="0"){delete this[1];Object.setPrototypeOf(this,{1:7});}return v;});return r[1]+":"+Object.hasOwn(r,"1");','7:true'),
 c('array-added-not-visited','let log="";const r=JSON.parse("[1]",function(k,v){if(k==="0"){this[1]=2;this.a=3;}log+=k;return v;});return log+":"+r.length+":"+r.a;','0:2:3'),
 c('replace-next-subtree','let log="";JSON.parse("{\\"a\\":1,\\"b\\":2}",function(k,v){if(k==="a")this.b={c:9};log+=k;return v;});return log;','acb'),
 c('returned-subtree-not-revisited','let log="";const r=JSON.parse("[1]",function(k,v){log+=k;if(k==="0")return {a:2};return v;});return log+":"+JSON.stringify(r);','0:[{"a":2}]'),
 c('nonconfig-update-ignored','const r=JSON.parse("{\\"a\\":1}",function(k,v){if(k==="a"){Object.defineProperty(this,k,{value:1,writable:false,configurable:false});return 9;}return v;});return r.a; ',1),
 c('nonconfig-delete-ignored','const r=JSON.parse("{\\"a\\":1}",function(k,v){if(k==="a"){Object.defineProperty(this,k,{configurable:false});return undefined;}return v;});return r.a;',1),
 c('frozen-samevalue-ignored','const r=JSON.parse("{\\"a\\":1}",function(k,v){if(k==="a")Object.freeze(this);return v;});return r.a+":"+Object.isFrozen(r);','1:true'),
 c('nonconfig-accessor-no-set','let called=0;const r=JSON.parse("{\\"a\\":1}",function(k,v){if(k==="a"){Object.defineProperty(this,k,{get:function(){return 7;},set:function(){called++;},configurable:false});return 9;}return v;});return r.a+":"+called;','7:0'),
 c('nonextensible-create-ignored','const r=JSON.parse("{\\"a\\":1}",function(k,v){if(k==="a"){delete this.a;Object.preventExtensions(this);return 9;}return v;});return Object.hasOwn(r,"a");',false),
 c('readonly-arraylength-ignored','const r=JSON.parse("[1]",function(k,v){if(k==="0"){this.length=0;Object.defineProperty(this,"length",{writable:false});return 9;}return v;});return r.length+":"+Object.hasOwn(r,"0");','0:false'),
 c('define-bypasses-setter','let called=0;const r=JSON.parse("{\\"a\\":1}",function(k,v){if(k==="a"){delete this.a;const p={};Object.defineProperty(p,"a",{set:function(){called++;}});Object.setPrototypeOf(this,p);return 9;}return v;});return r.a+":"+called;','9:0'),
 c('throw-identity','const token={};try{JSON.parse("[1]",function(k,v){if(k==="0")throw token;return v;});}catch(e){return e===token;}return false;',true),
 c('inherited-getter-throw','const token={};try{JSON.parse("{\\"a\\":1,\\"b\\":2}",function(k,v){if(k==="a"){delete this.b;const p={};Object.defineProperty(p,"b",{get:function(){throw token;}});Object.setPrototypeOf(this,p);}return v;});}catch(e){return e===token;}return false;',true),
 c('syntax-before-callback','let calls=0;try{JSON.parse("{",function(){calls++;});}catch(e){return e instanceof SyntaxError&&calls===0;}return false;',true),
 c('coercion-before-callback','let log="";const r=JSON.parse({toString:function(){log+="s";return "1";}},function(k,v){log+="r";return v;});return log+":"+r;','sr:1'),
 c('old-unsupported-promoted','try{JSON.parse({toString:function(){throw x;}},function(k,v,context){return v;});}catch(e){return e===x;}return false;',true),
 c('noncallable-ignored','return JSON.parse("1",{get call(){throw 1;},get apply(){throw 2;}});',1),
 c('proto-name','let log="";const r=JSON.parse("{\\"__proto__\\":1}",function(k,v){log+=k;return v;});return log+":"+r.__proto__+":"+(Object.getPrototypeOf(r)===Object.prototype);','__proto__:1:true'),
]);
// ES2025 has exactly two callback arguments. Modern native engines may
// implement the later source-context extension; use the fixed oracle here.
export const jsonReviverNormativeCases=Object.freeze([
 {...c('exact-two-arguments','return JSON.parse("1",function(){return arguments.length;});',2),allowedNativeExpected:3,nativeReferenceDifference:'Later JSON.parse source-context extension adds a third callback argument.'},
]);
export const jsonReviverResumptionSource='function f(x){let log="";const r=JSON.parse("{\\"a\\":[1,2]}",function(k,v){log+=k;if(typeof v==="number")return v+x;return v;});return log+":"+JSON.stringify(r);}';
export const jsonReviverResumptionExpected='01a:{"a":[4,5]}';
