// Independent adversarial regression cases spanning the second builtin wave.
export const secondwaveReviewCases=Object.freeze([
 ['json-metadata','let d=Object.getOwnPropertyDescriptor(JSON,"parse");let n=0;try{JSON();}catch(e){if(e instanceof TypeError)n++;}return d.writable+":"+d.enumerable+":"+d.configurable+":"+JSON.parse.name+":"+JSON.parse.length+":"+n+":"+(JSON.prototype===undefined)+":"+x;','true:false:true:parse:2:1:true:17'],
 ['json-tag-inheritance','return Object.prototype.toString.call(JSON)+":"+Object.prototype.toString.call(Object.create(JSON))+":"+(JSON===JSON)+":"+x;','[object JSON]:[object JSON]:true:17'],
 ['json-root-gc','let parse=JSON.parse;for(let i=0;i<1000;i++){let a={v:i};}return parse("17")+":"+JSON.parse("true")+":"+x;','17:true:17'],
 ['with-skips-replaced-getter','let a=[1,2,3];Object.defineProperty(a,"1",{get:function(){throw x;}});let b=a.with(1,9);return b.join(":")+":"+x;','1:9:3:17'],
 ['spliced-skips-deleted','let a=[1,2,3];Object.defineProperty(a,"1",{get:function(){throw x;}});return a.toSpliced(1,1,9).join(":")+":"+x;','1:9:3:17'],
 ['copy-length-captured','let a=[1,2,3];let index={valueOf(){a.length=1;return 1;}};let b=a.with(index,x);return b.length+":"+b[0]+":"+b[1]+":"+Object.hasOwn(b,2)+":"+b[2];','3:1:17:true:undefined'],
 ['copy-result-setter-bypass','let n=0;Object.defineProperty(Array.prototype,"0",{set:function(v){n++;},configurable:true});let a=[1,2].toReversed();return n+":"+a[0]+":"+Object.hasOwn(a,0)+":"+x;','0:2:true:17'],
 ['copy-no-species','let a=[1,2];Object.defineProperty(a,"constructor",{get:function(){throw x;}});return a.toReversed().join(":")+":"+a.with(0,3).join(":")+":"+a.toSpliced().join(":");','2:1:3:2:1:2'],
 ['parse-order-empty','let log="";try{Number.parseInt({toString(){log+="s";return "";}},{valueOf(){log+="r";throw x;}});}catch(e){return log+":"+(e===x);}return "wrong";','sr:true'],
 ['parse-radix-wrap','return Number.parseInt("11",4294967298)+":"+Number.parseInt("0x10",4294967296)+":"+Number.parseInt("0x10",10)+":"+x;','3:16:0:17'],
 ['parse-prefix-sign','return Number.parseFloat("-0e+tail")+":"+Object.is(Number.parseFloat("-0e+tail"),-0)+":"+Number.parseFloat("1.e+tail")+":"+Number.isNaN(Number.parseFloat(".e2"))+":"+x;','0:true:1:true:17'],
 ['parse-mutation-immunity','String.prototype.charCodeAt=function(){throw x;};String.prototype.slice=function(){throw x;};return Number.parseInt("ff!",16)+":"+Number.parseFloat("1.25tail")+":"+x;','255:1.25:17'],
 ['json-duplicate-proto','let a=JSON.parse(\'{"__proto__":1,"__proto__":2,"4294967294":3,"a":4}\');let k=Object.keys(a);return a.__proto__+":"+(Object.getPrototypeOf(a)===Object.prototype)+":"+k[0]+":"+k[1]+":"+k[2]+":"+x;','2:true:4294967294:__proto__:a:17'],
 ['json-nul-key','let a=JSON.parse(\'{"\\\\u0000":1,"a\\\\u0022":2}\');return a["\\u0000"]+":"+a[\'a"\']+":"+x;','1:2:17'],
 ['json-top-level-number-boundary','return Object.is(JSON.parse("-0.000e400"),-0)+":"+JSON.parse("9007199254740993")+":"+JSON.parse("5e-324")+":"+x;','true:9007199254740992:5e-324:17'],
].map(([feature,body,expected])=>Object.freeze({feature:'secondwave-'+feature,source:'function f(x){'+body+'}',input:17,expected})));
