const fixture=(name,body,expected)=>({feature:'json-phase3-'+name,source:`function f(x){${body}}`,input:3,expected});
export const jsonPhase3Cases=Object.freeze([
 fixture('bigint-parse-source','return JSON.parse(123n);',123),
 fixture('bigint-replacer-rescue','return JSON.stringify(1n,function(k,v){return typeof v==="bigint"?"one":v;});','"one"'),
 fixture('bigint-tojson-before-replacer','let log="";BigInt.prototype.toJSON=function(k){log+="j"+k;return 4;};const result=JSON.stringify({a:1n},function(k,v){log+="r"+k;return v;});return log+":"+result;','rjara:{"a":4}'),
 fixture('bigint-without-rescue-typeerror','try{JSON.stringify(1n);}catch(e){return e instanceof TypeError;}return false;',true),
 fixture('bigint-wrapper-without-rescue-typeerror','try{JSON.stringify(Object(1n));}catch(e){return e instanceof TypeError;}return false;',true),
 fixture('bigint-wrapper-tojson','const o=Object(1n);o.toJSON=function(k){return k+"ok";};return JSON.stringify({a:o});','{"a":"aok"}'),
 fixture('reviver-bigint-result','return typeof JSON.parse("1",function(k,v){return 1n;});','bigint'),
 fixture('symbol-root','return JSON.stringify(Symbol("x"));',undefined),
 fixture('symbol-array','return JSON.stringify([Symbol("x"),1]);','[null,1]'),
 fixture('symbol-object-value','return JSON.stringify({a:Symbol("x"),b:2});','{"b":2}'),
 fixture('symbol-key-getter-ignored','const o={a:1};Object.defineProperty(o,Symbol("k"),{get:function(){throw 9;},enumerable:true});return JSON.stringify(o);','{"a":1}'),
 fixture('symbol-replacer-root','return JSON.stringify(Symbol("x"),function(k,v){return typeof v==="symbol"?"rescued":v;});','"rescued"'),
 fixture('symbol-replacer-results','return JSON.stringify({a:1,b:[2]},function(k,v){return k==="a"||k==="0"?Symbol("x"):v;});','{"b":[null]}'),
 fixture('symbol-replacer-list','const s=Symbol("a");return JSON.stringify({a:1,b:2},[s,Object(s),"b"]);','{"b":2}'),
 fixture('symbol-wrapper-own-strings','const o=Object(Symbol("x"));o.a=1;o[Symbol("y")]=2;return JSON.stringify(o);','{"a":1}'),
 fixture('symbol-prototype-tojson-not-called','Symbol.prototype.toJSON=function(){throw 9;};return JSON.stringify([Symbol("x")]);','[null]'),
 fixture('symbol-space-ignored','return JSON.stringify([1],null,Symbol("space"));','[1]'),
 fixture('symbol-parse-typeerror','try{JSON.parse(Symbol("1"));}catch(e){return e instanceof TypeError;}return false;',true),
 fixture('reviver-add-symbol-key','const s=Symbol("k");let log="";const result=JSON.parse("{\\"a\\":1}",function(k,v){log+=k;if(k==="a")this[s]=7;return v;});return log+":"+result[s]+":"+Object.keys(result).length+":"+Object.getOwnPropertySymbols(result).length;','a:7:1:1'),
 fixture('reviver-insert-symbol-key-object','const s=Symbol("k");let log="";JSON.parse("{\\"a\\":1,\\"b\\":2}",function(k,v){if(k==="a"){const o={z:3};Object.defineProperty(o,s,{get:function(){throw 9;},enumerable:true});this.b=o;}log+=k;return v;});return log;','azb'),
 fixture('reviver-returns-symbol','const result=JSON.parse("[1]",function(k,v){return k==="0"?Symbol("x"):v;});return typeof result[0]+":"+JSON.stringify(result);','symbol:[null]'),
 fixture('parse-symbol-toprimitive','return JSON.parse({[Symbol.toPrimitive]:function(h){return h==="string"?"2":"9";},toString:function(){return "1";}});',2),
 fixture('stringify-boxed-string-toprimitive','const s=new String("a");s[Symbol.toPrimitive]=function(h){return h==="string"?"b":"bad";};return JSON.stringify(s);','"b"'),
 fixture('stringify-space-toprimitive','const s=new Number(0);s[Symbol.toPrimitive]=function(h){return h==="number"?2:0;};return JSON.stringify([1],null,s);','[\n  1\n]'),
]);
// Former conversion-boundary fixtures now require successful @@toPrimitive.
export const jsonPhase3CoercionCases=Object.freeze([]);
// All existing BigInt JSON cases are now positive; retain the boundary export
// for report schema compatibility rather than silently dropping fixture rows.
export const jsonPhase3BigIntPendingCases=Object.freeze([]);
