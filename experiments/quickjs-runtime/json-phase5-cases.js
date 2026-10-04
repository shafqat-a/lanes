const program=body=>'function f(x){'+body+'}';
export const jsonPhase5Cases=Object.freeze([
 ['scalars','return JSON.parse("true")+":"+JSON.parse("false")+":"+(JSON.parse("null")===null)+":"+JSON.parse("17")+":"+x;','true:false:true:17:17'],
 ['numbers','return Object.is(JSON.parse("-0"),-0)+":"+JSON.parse("1.25e2")+":"+JSON.parse("1e400")+":"+Object.is(JSON.parse("-1e-400"),-0)+":"+x;','true:125:Infinity:true:17'],
 ['nested','let a=JSON.parse(\'{"a":[1,true,null,{"b":"ok"}]}\');return a.a.length+":"+a.a[0]+":"+a.a[1]+":"+(a.a[2]===null)+":"+a.a[3].b+":"+x;','4:1:true:true:ok:17'],
 ['duplicate','let a=JSON.parse(\'{"a":1,"b":2,"a":3}\');let k=Object.keys(a);return a.a+":"+k[0]+":"+k[1]+":"+x;','3:a:b:17'],
 ['proto-data','let a=JSON.parse(\'{"__proto__":{"bad":1},"constructor":7}\');return (Object.getPrototypeOf(a)===Object.prototype)+":"+Object.hasOwn(a,"__proto__")+":"+a.__proto__.bad+":"+a.constructor+":"+x;','true:true:1:7:17'],
 ['setter-bypass','let calls=0;Object.defineProperty(Object.prototype,"a",{set:function(v){calls++;},configurable:true});Object.defineProperty(Array.prototype,"0",{set:function(v){calls++;},configurable:true});let a=JSON.parse(\'{"a":[8]}\');return calls+":"+a.a[0]+":"+Object.hasOwn(a.a,0)+":"+x;','0:8:true:17'],
 ['descriptor','let a=JSON.parse(\'{"a":1}\');let d=Object.getOwnPropertyDescriptor(a,"a");return d.value+":"+d.writable+":"+d.enumerable+":"+d.configurable+":"+x;','1:true:true:true:17'],
 ['unicode','let s=JSON.parse(\'"\\\\uD800x\\\\uDC00\\\\uD83D\\\\uDE00"\');return s.length+":"+s.charCodeAt(0)+":"+s.charCodeAt(2)+":"+s.codePointAt(3)+":"+x;','5:55296:56320:128512:17'],
 ['escapes','let s=JSON.parse(\'"\\\\b\\\\f\\\\n\\\\r\\\\t\\\\/\\\\\\\\\\\\\\""\');return s.length+":"+s.charCodeAt(0)+":"+s.charCodeAt(1)+":"+s.charCodeAt(2)+":"+s.charCodeAt(3)+":"+s.charCodeAt(4)+":"+x;','8:8:12:10:13:9:17'],
 ['coercion','let n=0;let a=JSON.parse({toString(){n++;return "[1,2]";}},{});return n+":"+a.length+":"+JSON.parse(17)+":"+JSON.parse(null)+":"+x;','1:2:17:null:17'],
 ['whitespace','return JSON.parse(" \\t\\r\\n [1] \\n")[0]+":"+x;','1:17'],
 ['mutation-immunity','String.prototype.slice=function(){throw x;};String.prototype.charCodeAt=function(){throw x;};Object.defineProperty=function(){throw x;};return JSON.parse(\'{"a":2}\').a+":"+x;','2:17'],
].map(([feature,body,expected])=>Object.freeze({feature:'json-phase5-'+feature,source:program(body),input:17,expected})));
export const jsonPhase5InvalidTexts=Object.freeze(['',' ','undefined','NaN','Infinity','+1','01','-01','1.','1e','1e+','--1','[1,]','[,1]','[1,,2]','{"a":1,}','{a:1}','{"a" 1}','true false','nullx','"abc','"\\x20"','"\\u123"','"\\uZZZZ"','"\n"','\uFEFF1','\u00A01','/*x*/1','[','{','"\\"']);
export const jsonPhase5SyntaxSources=Object.freeze(jsonPhase5InvalidTexts.map(text=>`function f(x){try{JSON.parse(${JSON.stringify(text)});return false;}catch(e){return e instanceof SyntaxError;}}`));
export const jsonPhase5ReviverCoercionSource='function f(x){const token={value:x};let calls=0;try{JSON.parse({toString(){throw token;}},function(k,v){calls++;return v;});}catch(e){return (e===token)+":"+calls+":"+e.value;}return "wrong";}';
export const jsonPhase5ResumptionSource='function f(x){let log="";let a=JSON.parse({toString(){log+="s";return "{\\"a\\":[1,2],\\"b\\":\\"\\\\uD800\\"}";}});return log+":"+a.a.length+":"+a.a[1]+":"+a.b.charCodeAt(0)+":"+x;}';
export const jsonPhase5ResumptionExpected='s:2:2:55296:17';
// Valid JSON whose nesting deliberately exceeds the current guest frame limit.
// It is a resource boundary, never a SyntaxError or semantic passing case.
export const jsonPhase5ResourceCases=Object.freeze([
 Object.freeze({source:'function f(x){return JSON.parse('+JSON.stringify('['.repeat(40)+'0'+']'.repeat(40))+').length;}',input:17,expected:1,reason:'nested parser exceeds guest frame limit'}),
]);
