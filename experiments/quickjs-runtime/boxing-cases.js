// Primitive boxing regression fixtures (Object(v), String/Number/Boolean
// wrappers, prototype objects, primitive receivers and primitive-base writes).
// Each program runs in a fresh realm, so prototype mutation needs no restore.
// Every positive program returns a primitive. Most return a compact string of
// several observations, so a failure shows which observation is wrong.
// These strings are fixtures only; host evaluation is a test oracle.

// Joins an array-like of keys with commas without Array.prototype.join.
const J = 'function j(a){let s="";for(let i=0;i<a.length;i++)s+=(i?",":"")+a[i];return s;}';
// Runs g and logs n (no throw), T (TypeError) or ? (another completion).
const T = 'function t(g){try{g();o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}}';

export const boxingSources = [
  'function f(x){try{return (1).toFixed(2);}catch(e){return "wrong guest exception";}}',
  'function f(x){try{return typeof new Number(x).toPrecision;}catch(e){return "wrong guest exception";}}',
  'function f(x){try{return typeof Object.getOwnPropertyDescriptor(Number.prototype,"toFixed");}catch(e){return "wrong guest exception";}}',

  // --- Object(v) and new Object(v) ---
  'function f(x){const s=Object("ab"),n=Object(x),b=Object(true);return typeof s+typeof n+typeof b+":"+s.length+":"+(n==x)+(n+1)+":"+(b.valueOf()===true)+(s instanceof String)+(n instanceof Number)+(b instanceof Boolean);}',
  'function f(x){const o={a:x},fn=function(){};return (Object(o)===o)+":"+(new Object(o)===o)+":"+(Object(fn)===fn)+":"+(new Object(fn)===fn)+":"+(Object("a")!==Object("a"))+":"+(new Object("a") instanceof String)+":"+(new Object(x)).valueOf();}',
  'function f(x){const a=Object(null),b=Object(undefined),c=Object(),d=new Object(),e=new Object(null);return typeof a+":"+(a!==b)+":"+(Object.getPrototypeOf(a)===Object.prototype)+(Object.getPrototypeOf(b)===Object.prototype)+(Object.getPrototypeOf(c)===Object.prototype)+(Object.getPrototypeOf(e)===Object.prototype)+":"+Object.keys(a).length+Object.getOwnPropertyNames(d).length+":"+(c!==d)+Object.isExtensible(b);}',
  'function f(x){const w=Object(String(x));return Object.prototype.toString.call(w)+":"+w.length+":"+w[0]+":"+(Object.getPrototypeOf(w)===String.prototype)+":"+Object.prototype.toString.call(Object(x))+Object.prototype.toString.call(Object(x>0));}',

  // --- new String/Number/Boolean: arguments and no-argument forms ---
  'function f(x){const s=new String(x),n=new Number(x),b=new Boolean(x);return typeof s+typeof n+typeof b+":"+s.valueOf()+":"+n.valueOf()+":"+b.valueOf()+":"+s.length+":"+(s==String(x))+(n==x)+(b==Boolean(x));}',
  'function f(x){const s=new String(),n=new Number(),b=new Boolean();return "["+s.valueOf()+"]"+s.length+":"+Object.is(n.valueOf(),0)+":"+b.valueOf()+":"+typeof s+typeof n+typeof b+":"+Object.getOwnPropertyNames(s).length;}',
  'function f(x){return new String(undefined).valueOf()+":"+new String(null).valueOf()+":"+new Number(undefined).valueOf()+":"+new Number(null).valueOf()+":"+new Boolean(undefined).valueOf()+":"+new Boolean(null).valueOf()+":"+new String(true).valueOf()+":"+new Number(true).valueOf()+":"+new Number(false).valueOf();}',
  'function f(x){return new Number("12").valueOf()+":"+new Number(" 0x1f ").valueOf()+":"+new Number("").valueOf()+":"+new Number("1e3").valueOf()+":"+new Number("abc").valueOf()+":"+Object.is(new Number("-0").valueOf(),-0)+":"+new Number(String(x)+"5").valueOf();}',
  'function f(x){return new Boolean("").valueOf()+","+new Boolean("0").valueOf()+","+new Boolean(0).valueOf()+","+new Boolean(NaN).valueOf()+","+new Boolean(-0).valueOf()+","+new Boolean({}).valueOf()+","+new Boolean(new Boolean(false)).valueOf()+","+new Boolean(x).valueOf()+","+new Boolean(String(x)).valueOf();}',
  'function f(x){const s=new String(new String("q")),n=new Number(new Number(x)),b=new Boolean(new Number(0));return s.valueOf()+s.length+":"+n.valueOf()+":"+b.valueOf()+":"+new String(new Number(x)).valueOf()+":"+new Number(new String(" 7 ")).valueOf()+":"+new String(new Boolean(false)).valueOf();}',
  // Conversion order: String uses hint string (toString first), Number hint number (valueOf first).
  'function f(x){let o="";const s=new String({toString(){o+="t";return "s"+x;},valueOf(){o+="v";return 1;}});const n=new Number({toString(){o+="T";return "2";},valueOf(){o+="V";return x;}});return o+":"+s.valueOf()+":"+n.valueOf();}',
  // OrdinaryToPrimitive fallback when the first method returns an object; Boolean never converts.
  'function f(x){let o="";const s=new String({toString(){o+="t";return {};},valueOf(){o+="v";return x;}});const n=new Number({valueOf(){o+="V";return {};},toString(){o+="T";return "4";}});const b=new Boolean({valueOf(){o+="B";return false;}});return o+":"+s.valueOf()+":"+n.valueOf()+":"+b.valueOf();}',
  'function f(x){let o="";const s=new String({toString(){o+="t";return x;}});const n=new Number({valueOf(){o+="v";return "3"+x;}});const m=new Number({valueOf(){o+="w";return true;}});return o+":"+typeof s.valueOf()+s.valueOf()+":"+n.valueOf()+":"+m.valueOf();}',
  'function f(x){let o="";const proto={toString(){o+="p";return "in"+x;}};const s=new String(Object.create(proto));return o+":"+s.valueOf()+":"+s.length;}',
  // String/Number/Boolean called as functions still return primitives.
  'function f(x){const w=new String("q"),n=new Number(3),b=new Boolean(false);return typeof String(w)+String(w)+":"+typeof Number(n)+Number(n)+":"+typeof Boolean(b)+Boolean(b)+":"+String(new Number(-0))+":"+Number(new String(" 12 "))+":"+String(new Boolean(true))+":"+typeof String(x)+typeof Number(String(x))+typeof Boolean(x);}',
  'function f(x){return "["+String()+"]"+Number()+Boolean()+":"+typeof String()+":"+String(undefined)+":"+Number(undefined)+":"+String(null)+":"+String(x)+Number(String(x));}',

  // --- String wrapper exotic: indices, length, descriptors ---
  'function f(x){const w=new String("ab"+x);return w[0]+w[1]+":"+w.length+":"+w[w.length]+":"+w[w.length-1]+":"+w["1"]+":"+w["01"]+":"+w["-0"]+":"+w["1.0"]+":"+w["-1"];}',
  'function f(x){const w=new String("ab");const d=Object.getOwnPropertyDescriptor(w,"0"),l=Object.getOwnPropertyDescriptor(w,"length"),u=Object.getOwnPropertyDescriptor(w,"2");return d.value+d.writable+d.enumerable+d.configurable+":"+l.value+l.writable+l.enumerable+l.configurable+":"+typeof u+":"+("get" in d)+("value" in l)+":"+Object.getOwnPropertyDescriptor(w,1).value;}',
  // [[OwnPropertyKeys]]: string indices, other array indices ascending, then string keys in creation order.
  'function f(x){' + J + 'const w=new String("ab");w.x=1;w[5]=2;w.y=3;w[3]=4;w[x+10]=5;return j(Object.getOwnPropertyNames(w))+"|"+j(Object.keys(w));}',
  'function f(x){' + J + 'const w=new String("");w.k=x;w[0]="z";return j(Object.getOwnPropertyNames(w))+"|"+j(Object.keys(w))+"|"+w[0]+w.length;}',
  'function f(x){' + J + 'const w=new String("abc");w[9]=1;w[4]=2;w.q=0;w[x+20]=3;delete w[9];w[6]=4;return j(Object.getOwnPropertyNames(w))+"|"+j(Object.keys(w));}',
  'function f(x){' + J + 'const n=new Number(x),b=new Boolean(true);n.b=1;n[1]=2;b.z=0;return j(Object.getOwnPropertyNames(n))+"|"+j(Object.keys(b))+"|"+Object.getOwnPropertyNames(new Number(5)).length+n.b+n[1];}',
  'function f(x){const w=new String("ab");return ("0" in w)+","+("length" in w)+","+(2 in w)+","+("charAt" in w)+","+(1 in w)+","+w.hasOwnProperty("0")+","+w.hasOwnProperty(1)+","+w.hasOwnProperty("length")+","+w.hasOwnProperty("2")+","+w.hasOwnProperty("charAt")+","+w.propertyIsEnumerable("0")+","+w.propertyIsEnumerable("length")+","+w.propertyIsEnumerable(2);}',
  'function f(x){const w=new String(String(x));return Object.hasOwn(w,"0")+","+Object.hasOwn(w,"length")+","+Object.hasOwn(w,String(w.length))+","+Object.hasOwn(new Number(1),"length")+","+Object.prototype.hasOwnProperty.call(w,w.length-1);}',
  // Sloppy writes to index/length are ignored; new own properties work.
  'function f(x){const w=new String("ab");w[0]="z";w.length=9;w.length+=3;w[2]="c";w.extra=x;return w[0]+w[1]+w[2]+":"+w.length+":"+w.extra+":"+w.valueOf()+":"+Object.keys(w).length;}',
  'function f(x){"use strict";const w=new String("ab");let o="";try{w[0]="z";o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}try{w.length=0;o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}try{w.length++;o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}w[2]="c";w.k=x;return o+":"+w[0]+w[1]+w[2]+w.length+":"+w.k;}',
  'function f(x){const w=new String("ab");w[3]=1;w.k=2;const a=delete w[0],b=delete w.length,c=delete w[3],d=delete w.k,e=delete w[7],g=delete w["1"];return a+","+b+","+c+","+d+","+e+","+g+":"+w[0]+w.length+(3 in w)+("k" in w);}',
  'function f(x){"use strict";const w=new String("ab");let o="";try{delete w[0];o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}try{delete w.length;o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}w.z=1;o+=delete w.z;o+=delete w[9];return o+w[0]+w.length;}',
  // Object.defineProperty: compatible redefinitions succeed, incompatible ones throw.
  'function f(x){const w=new String("ab");const r1=Object.defineProperty(w,"0",{value:"a"})===w;Object.defineProperty(w,"1",{value:"b",writable:false,enumerable:true,configurable:false});Object.defineProperty(w,"length",{value:2,writable:false});Object.defineProperty(w,"0",{});Object.defineProperty(w,"2",{value:x,enumerable:false,configurable:true,writable:true});Object.defineProperty(w,"k",{get:function(){return "g"+this.length;}});return r1+":"+w[0]+w[1]+w.length+":"+w[2]+":"+w.k+":"+Object.keys(w).length+":"+Object.getOwnPropertyNames(w).length;}',
  'function f(x){const w=new String("ab");let o="";function d(k,v){try{Object.defineProperty(w,k,v);o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}}d("0",{value:"z"});d("0",{writable:true});d("0",{enumerable:false});d("0",{configurable:true});d("0",{get:function(){}});d("length",{value:3});d("length",{enumerable:true});d("1",{value:"b"});d("2",{value:"c"});d(String(x+5),{value:x});return o+":"+w[0]+w[2]+w.length+":"+w[x+5];}',
  // Integrity levels on wrappers.
  'function f(x){const a=new String("ab"),b=new String(""),c=new Number(x),d=new Boolean(true);const r=[Object.isFrozen(a),Object.isSealed(a),Object.isExtensible(a)];Object.preventExtensions(b);Object.preventExtensions(c);const s=[Object.isFrozen(b),Object.isSealed(b),Object.isFrozen(c),Object.isExtensible(c)];Object.freeze(a);Object.seal(d);a.k=1;d.k=2;return r[0]+","+r[1]+","+r[2]+"|"+s[0]+","+s[1]+","+s[2]+","+s[3]+"|"+Object.isFrozen(a)+Object.isSealed(a)+Object.isExtensible(a)+a.k+":"+Object.isSealed(d)+Object.isFrozen(d)+d.k+":"+a.valueOf()+a.length;}',
  'function f(x){"use strict";const w=new String("ab");w.k=x;Object.freeze(w);let o="";try{w.k=1;o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}try{w.z=1;o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}const d=Object.getOwnPropertyDescriptor(w,"k");return o+":"+w.k+":"+d.writable+d.configurable+":"+Object.isFrozen(w);}',
  // Inherited exotic properties through Object.create(new String(...)).
  'function f(x){const p=new String("ab"+x),o=Object.create(p);o[0]="z";o.length=1;o[9]="q";return o[0]+o[1]+":"+o.length+":"+("0" in o)+o.hasOwnProperty("0")+o.hasOwnProperty(9)+":"+Object.keys(o).length+":"+(Object.getPrototypeOf(o)===p)+":"+typeof o.charAt+":"+Object.prototype.toString.call(o);}',
  'function f(x){"use strict";const o=Object.create(new String("ab"));let s="";try{o[0]="z";s+="n";}catch(e){s+=e instanceof TypeError?"T":"?";}try{o.length=5;s+="n";}catch(e){s+=e instanceof TypeError?"T":"?";}o[2]="c";o.x=x;return s+":"+o[0]+o[2]+o.length+o.x+":"+Object.keys(o).length;}',
  // An object inheriting from a wrapper has no [[StringData]]: ToString(o) reaches thisStringValue.
  'function f(x){const o=Object.create(new String("xyz"));let r,s;try{r=o.charAt(1);}catch(e){r=e instanceof TypeError?"T":"?";}try{s=o+"";}catch(e){s=e instanceof TypeError?"T":"?";}return r+s+o[x>0?1:0];}',
  // A wrapper with a null prototype keeps its exotic own properties.
  'function f(x){const w=Object.setPrototypeOf(new String("ab"),null);let r;try{r=w+"";}catch(e){r=e instanceof TypeError?"T":"?";}return w[0]+w.length+":"+typeof w.charAt+":"+r+":"+Object.prototype.toString.call(w)+":"+String.prototype.toString.call(w)+":"+Object.keys(w).length;}',

  // --- valueOf/toString builtins and thisXValue receiver checks ---
  'function f(x){const s="ab"+x;return String.prototype.toString.call(s)+":"+String.prototype.valueOf.call(new String(s))+":"+s.toString()+":"+new String(s).toString()+":"+typeof new String(s).valueOf()+":"+(new String(s).valueOf()===s);}',
  'function f(x){return (x).toString()+","+x.toString(10)+","+(-0).toString()+","+NaN.toString()+","+(1.5).toString()+","+(1e21).toString()+","+Infinity.toString()+","+(-Infinity).toString(10)+","+new Number(x).toString()+","+(0.1).toString()+","+(-2.5e-7).toString();}',
  'function f(x){let o="";const r=(x).toString({valueOf(){o+="r";return 10;}});return r+":"+o+":"+(17).toString(undefined)+":"+(5).toString(10.9)+":"+(255).toString("10")+":"+Number.prototype.toString.call(new Number(x),10)+":"+Number.prototype.toString.call(Number.prototype);}',
  'function f(x){const n=new Number(x);return Number.prototype.valueOf.call(x)+":"+Number.prototype.valueOf.call(n)+":"+typeof n.valueOf()+":"+Object.is(new Number(-0).valueOf(),-0)+":"+(x).valueOf()+":"+NaN.valueOf();}',
  'function f(x){const b=x>0;return b.toString()+","+b.valueOf()+","+new Boolean(b).toString()+","+Boolean.prototype.toString.call(!b)+","+Boolean.prototype.valueOf.call(new Boolean(!b))+","+typeof true.valueOf()+","+false.toString();}',
  'function f(x){let o="";' + T + 't(function(){String.prototype.valueOf.call(1);});t(function(){String.prototype.toString.call({});});t(function(){Number.prototype.valueOf.call("1");});t(function(){Number.prototype.toString.call(true);});t(function(){Boolean.prototype.toString.call({});});t(function(){Boolean.prototype.valueOf.call(0);});t(function(){String.prototype.toString.call(new Number(1));});t(function(){Number.prototype.valueOf.call(new Boolean(true));});t(function(){Boolean.prototype.toString.call(new String("true"));});t(function(){String.prototype.valueOf.call(x);});t(function(){String.prototype.valueOf.call(Object.create(String.prototype));});return o;}',
  // Radix: ToIntegerOrInfinity then 2..36 check; thisNumberValue happens before radix conversion.
  'function f(x){let o="";function t(r){try{(x).toString(r);o+="n";}catch(e){o+=e instanceof RangeError?"R":e instanceof TypeError?"T":"?";}}t(1);t(37);t(0);t(-10);t(Infinity);t(NaN);t(10);t(undefined);try{Number.prototype.toString.call("1",{valueOf(){o+="v";return 10;}});}catch(e){o+=e instanceof TypeError?"T":"?";}return o;}',

  // --- Prototype objects ---
  'function f(x){return (Object.getPrototypeOf("a")===String.prototype)+","+(Object.getPrototypeOf(x)===Number.prototype)+","+(Object.getPrototypeOf(true)===Boolean.prototype)+","+(String.prototype.constructor===String)+","+(Number.prototype.constructor===Number)+","+(Boolean.prototype.constructor===Boolean)+","+("a".constructor===String)+","+((1).constructor===Number)+","+(false.constructor===Boolean)+","+(Object.getPrototypeOf(String.prototype)===Object.prototype)+","+(Object.getPrototypeOf(Number.prototype)===Object.prototype)+","+(Object.getPrototypeOf(Boolean.prototype)===Object.prototype);}',
  'function f(x){const t=Object.prototype.toString;return t.call(String.prototype)+t.call(Number.prototype)+t.call(Boolean.prototype)+":"+String.prototype.length+":"+typeof String.prototype[0]+":"+Number.prototype.valueOf()+":"+Boolean.prototype.valueOf()+":["+String.prototype.toString()+String.prototype.valueOf()+"]:"+Number.prototype.toString()+":"+Boolean.prototype.toString()+":"+(String.prototype=="")+(Number.prototype==0);}',
  'function f(x){return ("a".charAt===String.prototype.charAt)+","+(new String("a").slice===String.prototype.slice)+","+((x).toString===Number.prototype.toString)+","+(true.valueOf===Boolean.prototype.valueOf)+","+("a".toString!==Object.prototype.toString)+","+("a".hasOwnProperty===Object.prototype.hasOwnProperty)+","+((1).valueOf!==String.prototype.valueOf)+","+typeof "a".charCodeAt+","+(new String("a").constructor===String);}',
  'function f(x){return (new String("a") instanceof String)+","+("a" instanceof String)+","+(new Number(x) instanceof Number)+","+(x instanceof Number)+","+(new Boolean(false) instanceof Boolean)+","+(true instanceof Boolean)+","+(new String("") instanceof Object)+","+("" instanceof Object)+","+(Object(x) instanceof Number)+","+(new Number(1) instanceof String)+","+(Object.create(String.prototype) instanceof String);}',
  'function f(x){return Object.prototype.isPrototypeOf.call(String.prototype,"a")+","+String.prototype.isPrototypeOf(new String("a"))+","+Number.prototype.isPrototypeOf(x)+","+Number.prototype.isPrototypeOf(Object(x))+","+Object.prototype.isPrototypeOf(new Boolean(true))+","+Object.prototype.isPrototypeOf.call(Object.prototype,true)+","+String.prototype.isPrototypeOf(Object.create(new String("q")));}',
  'function f(x){const d=Object.getOwnPropertyDescriptor(String.prototype,"charAt"),l=Object.getOwnPropertyDescriptor(String.prototype,"length");return typeof d.value+d.writable+d.enumerable+d.configurable+":"+l.value+l.writable+l.enumerable+l.configurable+":"+String.prototype.hasOwnProperty("slice")+String.prototype.propertyIsEnumerable("charAt")+Number.prototype.hasOwnProperty("toString")+Boolean.prototype.hasOwnProperty("valueOf")+String.prototype.hasOwnProperty("0")+Number.prototype.hasOwnProperty("charAt");}',
  'function f(x){return typeof String+typeof Number+typeof Boolean+":"+String.name+Number.name+Boolean.name+":"+String.length+Number.length+Boolean.length+":"+(String.prototype===String.prototype)+":"+(Object.getPrototypeOf(new String(""))===String.prototype);}',
  // Unimplemented ES2025 prototype names exist, so HasProperty is true even
  // Reading pending names such as toFixed remains unsupported.
  'function f(x){return ("trim" in new String("a"))+","+("toFixed" in Object(x))+","+("nope" in new String("a"));}',
  // String.prototype is a String exotic object of length 0: index keys >= 0 are ordinary.
  'function f(x){String.prototype[0]="z";return typeof String.prototype[0]+":"+String.prototype.length+":"+""[0]+":"+"ab"[0]+":"+Object.getOwnPropertyNames(new String("")).length+":"+String.prototype.toString();}',

  // --- User methods and accessors reached from primitives ---
  'function f(x){String.prototype.info=function(){return typeof this+":"+(this instanceof String)+":"+this.length+":"+(this==String(x))+":"+(this===this);};return String(x).info();}',
  'function f(x){String.prototype.info=function(){"use strict";return typeof this+":"+(this instanceof String)+":"+this.length+":"+(this===String(x));};return String(x).info()+":"+new String("ab").info();}',
  'function f(x){String.prototype.self=function(){return this;};const s=String(x),a=s.self(),b=s.self();return (a!==b)+","+(a==s)+","+(a==b)+","+typeof a+","+(a.valueOf()===b.valueOf())+","+(Object.getPrototypeOf(a)===String.prototype)+","+a.length;}',
  'function f(x){Number.prototype.twice=function(){return this*2;};Number.prototype.kind=function(){"use strict";return typeof this;};Number.prototype.boxed=function(){return typeof this;};return x.twice()+":"+(x).kind()+":"+(x).boxed()+":"+(3.5).twice()+":"+new Number(x).kind();}',
  'function f(x){Boolean.prototype.not=function(){return !this;};Boolean.prototype.notStrict=function(){"use strict";return !this;};const b=x>0;return b.not()+","+b.notStrict()+","+false.not()+","+false.notStrict()+","+new Boolean(false).notStrict();}',
  'function f(x){Object.prototype.who=function(){return typeof this;};Object.prototype.whoStrict=function(){"use strict";return typeof this;};return "a".who()+","+(x).who()+","+true.who()+","+"a".whoStrict()+","+(x).whoStrict()+","+true.whoStrict()+","+({}).whoStrict();}',
  'function f(x){Object.defineProperty(String.prototype,"first",{get:function(){"use strict";return typeof this+":"+this.charAt(0)+":"+this.length;},configurable:true});Object.defineProperty(String.prototype,"boxedFirst",{get:function(){return typeof this+":"+this[0];}});const s=String(x);return s.first+"|"+s.boxedFirst+"|"+new String("zz").first;}',
  'function f(x){Object.defineProperty(Number.prototype,"sq",{get:function(){"use strict";return this*this;}});Object.defineProperty(Number.prototype,"tp",{get:function(){return typeof this;}});return x.sq+":"+(x).tp+":"+new Number(3).sq;}',
  'function f(x){Object.defineProperty(Object.prototype,"t",{get:function(){"use strict";return typeof this;},configurable:true});return "a".t+(x).t+true.t+({}).t+new String("a").t;}',
  'function f(x){Object.defineProperty(Boolean.prototype,"bit",{get:function(){"use strict";return this?1:0;}});return (x>0).bit+":"+true.bit+false.bit+":"+new Boolean(false).bit;}',
  'function f(x){String.prototype.k="proto";const w=new String("ab");w.k="own";return "ab".k+":"+w.k+":"+Object.create(w).k+":"+delete w.k+":"+w.k;}',
  'function f(x){Number.prototype.base=10;Boolean.prototype.flag="f";Object.prototype.common="c";return (x).base+x+":"+true.flag+":"+"s".common+(1).common+false.common+":"+typeof "s".flag;}',
  // Index-named accessor on String.prototype is shadowed by exotic own indices only within length.
  'function f(x){Object.defineProperty(String.prototype,"5",{get:function(){"use strict";return "p"+this.length;}});Object.prototype[1]="op";return "ab"[5]+":"+"abcdefg"[5]+":"+"ab"[1]+":"+"a"[1]+":"+new String("ab")[5]+":"+(x)[1];}',
  // Overriding charCodeAt/charAt changes those lookups but not the string search builtins.
  'function f(x){String.prototype.charCodeAt=function(){return 99;};String.prototype.charAt=function(){return "Z";};const s="abc"+x;return "a".charCodeAt(0)+":"+s.charAt(1)+":"+s.indexOf("b")+":"+s.includes("c")+":"+s.lastIndexOf("c")+":"+s.startsWith("ab")+":"+s.endsWith(String(x))+":"+s[1]+":"+s.slice(1,2);}',
  'function f(x){const orig=String.prototype.slice;String.prototype.slice=function(a,b){return "S"+orig.call(this,a,b);};return "abc".slice(1)+":"+"abc".indexOf("c")+":"+orig.call("xyz",x>0?1:0)+":"+"abc".charAt(2);}',
  'function f(x){const saved=String.prototype.charAt;const r=delete String.prototype.charAt;return r+":"+typeof "a".charAt+":"+("charAt" in new String("a"))+":"+saved.call("ab",1)+":"+"abc".indexOf("c");}',
  'function f(x){return typeof "a".foo+typeof (x).bar+typeof true.baz+typeof new String("a").qux+":"+"a".hasOwnProperty("length")+(x).hasOwnProperty("x")+"ab".propertyIsEnumerable(0)+"ab".propertyIsEnumerable("length");}',
  // Overriding prototype toString/valueOf changes wrapper conversions only.
  'function f(x){String.prototype.toString=function(){return "T";};String.prototype.valueOf=function(){return "V";};const w=new String("ab");return w+""+":"+String(w)+":"+(w=="V")+":"+("ab"+x)+":"+"ab".slice(1)+":"+w.length;}',
  'function f(x){Number.prototype.valueOf=function(){return 100;};const n=new Number(x);return (n+1)+":"+(x+1)+":"+(n>50)+":"+String(n)+":"+Number(n);}',
  'function f(x){Boolean.prototype.valueOf=function(){return 7;};const b=new Boolean(x>0);return (b+1)+":"+(b?"t":"f")+":"+String(b)+":"+(true+1);}',

  // --- Primitive-base writes ---
  'function f(x){const s="ab";s.x=1;s[0]="z";s.length=5;let n=x;n.y=2;n.toString=3;true.z=4;return typeof s.x+s[0]+s.length+":"+typeof n.y+":"+n.toString()+":"+typeof true.z;}',
  'function f(x){"use strict";let o="";' + T + 't(function(){"ab".x=1;});t(function(){"ab"[0]="z";});t(function(){"ab".length=1;});t(function(){(x).y=2;});t(function(){true.z=3;});t(function(){"ab".charAt=1;});t(function(){(x).toString=1;});t(function(){"ab"[5]=1;});return o;}',
  'function f(x){let log="";Object.defineProperty(String.prototype,"sv",{set:function(v){"use strict";log+="S"+typeof this+v+";";},configurable:true});Object.defineProperty(Number.prototype,"nv",{set:function(v){log+="N"+typeof this+(this instanceof Number)+v+";";}});Object.defineProperty(Object.prototype,"ov",{set:function(v){"use strict";log+="O"+typeof this+v+";";},configurable:true});"ab".sv=1;(x).nv=2;true.ov=3;"q".ov=4;return log;}',
  'function f(x){"use strict";let log="";Object.defineProperty(Number.prototype,"nv",{set:function(v){log+=typeof this+(this===x)+v;}});let r;try{(x).nv=x;r="ok";}catch(e){r="E";}return log+":"+r+":"+typeof (x).nv;}',
  'function f(x){"use strict";Object.defineProperty(String.prototype,"ro",{get:function(){return 1;}});Object.defineProperty(Number.prototype,"k",{value:5});let o="";try{"a".ro=2;o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}try{(x).k=2;o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}return o+":"+"a".ro+(x).k;}',
  'function f(x){Object.defineProperty(String.prototype,"ro",{get:function(){return 1;}});Object.defineProperty(Number.prototype,"k",{value:5});"a".ro=2;(x).k=2;return "a".ro+":"+(x).k;}',
  // __proto__ setter returns undefined for primitive receivers, even in strict code.
  'function f(x){"use strict";const s="ab";s.__proto__={};(x).__proto__=null;const r=(s.__proto__===String.prototype)+","+((x).__proto__===Number.prototype)+","+(true.__proto__===Boolean.prototype);const w=new String("q");w.__proto__=Number.prototype;return r+","+(Object.getPrototypeOf(w)===Number.prototype)+","+("q".__proto__===String.prototype);}',
  'function f(x){"ab".__proto__=1;(x).__proto__={};return typeof "ab".__proto__.charAt+":"+(Object.getPrototypeOf(x)===Number.prototype);}',
  'function f(x){const a=delete "ab"[0],b=delete "ab".length,c=delete "ab".x,d=delete (x).x,e=delete true.y,g=delete "ab"[2],h=delete "ab".charAt,k=delete "ab"[String(x)];return a+","+b+","+c+","+d+","+e+","+g+","+h+","+k+","+typeof "ab".charAt;}',
  'function f(x){"use strict";let o="";try{delete "ab"[0];o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}try{delete "ab".length;o+="n";}catch(e){o+=e instanceof TypeError?"T":"?";}o+=delete "ab".x;o+=delete (x).y;o+=delete "ab"[2];return o;}',

  // --- Object statics with primitive arguments ---
  'function f(x){return (Object.getPrototypeOf(1)===Number.prototype)+","+(Object.getPrototypeOf(true)===Boolean.prototype)+","+(Object.getPrototypeOf("a")===String.prototype)+","+(Object.getPrototypeOf(new Number(x))===Number.prototype)+","+(Object.getPrototypeOf(String(x))===String.prototype);}',
  'function f(x){const d=Object.getOwnPropertyDescriptor("ab",0),l=Object.getOwnPropertyDescriptor("ab","length"),n=Object.getOwnPropertyDescriptor(x,"x"),m=Object.getOwnPropertyDescriptor("ab","charAt");return d.value+d.writable+d.enumerable+d.configurable+":"+l.value+l.writable+l.enumerable+":"+typeof n+typeof m+":"+typeof Object.getOwnPropertyDescriptor(true,"valueOf");}',
  'function f(x){' + J + 'const s=String(x);return Object.hasOwn("ab","1")+","+Object.hasOwn("ab","2")+","+Object.hasOwn("ab","length")+","+Object.hasOwn(x,"x")+"|"+j(Object.keys(s))+"|"+j(Object.getOwnPropertyNames("ab"))+"|"+Object.keys(x).length+Object.keys(true).length+Object.getOwnPropertyNames(x).length+"|"+Object.prototype.hasOwnProperty.call("ab","0")+Object.prototype.hasOwnProperty.call(x,"0")+Object.prototype.propertyIsEnumerable.call("ab",1);}',
  'function f(x){const t=Object.prototype.toString;return t.call("a")+t.call(x)+t.call(true)+t.call(new String(""))+":"+typeof Object.prototype.valueOf.call("a")+":"+(Object.prototype.valueOf.call(x) instanceof Number)+":"+Object.prototype.valueOf.call(true).valueOf();}',
  'function f(x){return Object.isFrozen("ab")+","+Object.isSealed(x)+","+Object.isExtensible(true)+","+Object.freeze("ab")+","+Object.seal(x)+","+Object.preventExtensions(true)+","+(Object.setPrototypeOf("a",null)==="a");}',

  // --- charAt/charCodeAt/slice with wrapper and non-string receivers ---
  'function f(x){const w=new String("abc"+x);return w.charAt(1)+w.charCodeAt(2)+":"+w.slice(1,3)+":"+w.slice(-2)+":"+w.charAt(w.length-1)+":"+String.prototype.charAt.call(w,0);}',
  'function f(x){return "".charAt.call(x,0)+":"+"".charCodeAt.call(123,1)+":"+"".slice.call(12345,1,3)+":"+"".charAt.call(true,0)+"".slice.call(false,1)+":"+"".slice.call(x,1)+":"+"".charCodeAt.call(-0,0)+":"+"".slice.call(1e21,1,3)+":"+"".charAt.call(new Number(x),0)+"".slice.call(new Boolean(true),2);}',
  'function f(x){const s="abcde";return s.charAt({valueOf(){return 1;}})+s.charAt("2")+s.charAt(NaN)+"["+s.charAt(Infinity)+s.charAt(-1)+"]"+s.charCodeAt("1")+":"+s.charCodeAt(-1)+":"+s.charCodeAt(Infinity)+":"+s.charCodeAt(NaN)+":"+s.charAt(x)+":"+s.charAt(1.9)+s.charAt(true)+s.charAt(null)+s.charAt(undefined)+s.charAt(" 3 ")+s.charAt(new Number(4));}',
  'function f(x){const s="abcde";return s.slice(1,Infinity)+":"+s.slice(NaN,2)+":"+s.slice("1","-1")+":"+s.slice(-Infinity,1)+":"+s.slice(3,1)+"|"+s.slice({valueOf(){return 2;}},undefined)+":"+s.slice(x)+":"+s.slice(0,x)+":"+s.slice(-3,-1)+":"+s.slice(1.7,3.2)+":"+s.slice(null,true)+":"+s.slice(new String("3"));}',
  'function f(x){let o="";const r="".slice.call({toString(){o+="r";return "abc";},valueOf(){o+="R";return 1;}},{valueOf(){o+="s";return 1;},toString(){o+="S";return "0";}},{valueOf(){o+="e";return 2;}});const c="".charAt.call({toString(){o+="c";return "xy"+x;}},{valueOf(){o+="p";return 2;}});const k=new String("pq").charCodeAt({valueOf(){o+="k";return 1;}});return o+":"+r+":"+c+":"+k;}',
  'function f(x){let o="";try{"".slice.call({toString(){o+="r";throw x;}},{valueOf(){o+="s";return 0;}});}catch(e){o+=e===x?"E":"?";}try{"abc".charAt({valueOf(){o+="p";throw x;}});}catch(e){o+=e===x?"E":"?";}try{"".charCodeAt.call(null,{valueOf(){o+="n";return 0;}});}catch(e){o+=e instanceof TypeError?"T":"?";}try{new String("ab").slice(0,{valueOf(){o+="q";throw x;}});}catch(e){o+=e===x?"E":"?";}return o;}',
  'function f(x){return "".charAt.name+"".charAt.length+":"+"".charCodeAt.name+"".charCodeAt.length+":"+"".slice.name+"".slice.length+":"+String.prototype.toString.name+String.prototype.toString.length+":"+String.prototype.valueOf.name+String.prototype.valueOf.length+":"+Number.prototype.toString.name+Number.prototype.toString.length+":"+Number.prototype.valueOf.name+Number.prototype.valueOf.length+":"+Boolean.prototype.toString.name+Boolean.prototype.toString.length+Boolean.prototype.valueOf.name+Boolean.prototype.valueOf.length;}',
  'function f(x){const b="".charAt.bind("xyz");const t=Number.prototype.toString.bind(x);return b(1)+":"+b.name+":"+b.length+":"+"".slice.apply("abcdef",[2,4])+":"+t()+":"+t.length+":"+String.prototype.valueOf.call("v")+Boolean.prototype.toString.apply(false)+":"+"".charCodeAt.call(new String("A"));}',
  'function f(x){const w=new String("a\\uD83D\\uDE00");return w.length+":"+w.charCodeAt(1)+":"+w[2].charCodeAt(0)+":"+Object.keys(w).length+":"+w.slice(1).length+":"+(w[1]+w[2]==="\\uD83D\\uDE00");}',

  // --- Wrapper conversions in operators ---
  'function f(x){const s=new String("a"),n=new Number(2),b=new Boolean(false);return (s=="a")+","+(s==="a")+","+(n+1)+","+(s+"b")+","+(n+"x")+","+(b?1:2)+","+(new Number(5)>4)+","+(new Number(1)==new Number(1))+","+(s==s)+","+(-new Number(3))+","+(new String("5")*2)+","+(new Boolean(true)+1)+","+(new String("a")<new String("b"))+","+(new String("a")+new Number(1));}',
  'function f(x){const n=new Number(x),s=new String(x);return (n==x)+","+(n===x)+","+(n+n)+","+(s+s)+","+(n==s)+","+(n*1===x)+","+typeof (n+0)+","+!n+","+(n>=x)+","+(s==x)+","+(new Boolean(x>0)==(x>0));}',
  'function f(x){const w=Object(x);let r="";switch(w){case x:r="prim";break;default:r="obj";}return r+":"+typeof w+":"+(w!=x)+":"+(w!==x)+":"+(Object(x)===Object(x))+":"+(w===w);}',
  'function f(x){let n=0;if(new Boolean(false))n+=1;if(new Number(0))n+=10;if(new String(""))n+=100;if(Object(false))n+=1000;return n+":"+(new Boolean(false)&&"y")+":"+!!new Number(NaN)+":"+(new String("")||"z");}',
  'function f(x){let n=new Number(x);n++;let s=new String("4");s-=1;let b=new Boolean(true);b+=1;return typeof n+n+":"+typeof s+s+":"+typeof b+b;}',

  // --- this boxing via call/apply/bind and callbacks ---
  'function f(x){function s(){return typeof this;}function t(){"use strict";return typeof this;}return s.call(x)+","+s.apply("a")+","+s.bind(true)()+","+t.call(x)+","+t.apply("a")+","+t.bind(true)()+","+t.call(new Number(x));}',
  'function f(x){function self(){return this;}const a=self.call(x),b=self.call(x),o={};return (a instanceof Number)+","+(a!==b)+","+(a==x)+","+self.call("ab").length+","+(self.bind(5)()+1)+","+self.apply(true).valueOf()+","+(self.call(o)===o)+","+(self.call(a)===a);}',
  'function f(x){"use strict";function self(){return this;}return (self.call(x)===x)+","+(self.apply("ab")==="ab")+","+(self.bind(false)()===false)+","+Object.is(self.call(-0),-0);}',
  'function f(x){const o={m:function(){return typeof this+(this==x);}};return o.m.call(x)+":"+o.m.call(o).slice(0,6)+":"+o.m.apply(String(x));}',
  'function f(x){let r="";[1].forEach(function(){r+=typeof this;},x);[1].forEach(function(){"use strict";r+=typeof this;},x);[1].forEach(function(){r+=this.length;},"abc");return r;}',
  'function f(x){function g(){return this+1;}function h(){"use strict";return this+1;}const b=g.bind(x),c=h.bind(x);return b()+":"+c()+":"+g.call("a")+":"+h.call("a")+":"+typeof g.call(true);}',
];

// Error-identity wrapper used for the TypeError/RangeError fixtures below.
export const wrapErrorSource = (source, name) =>
  `function f(x){const run=(${source});try{run(x);}catch(e){return e instanceof ${name};}return false;}`;

// Bodies that throw a guest TypeError natively. Browser runs wrap them as
// `try{run(x)}catch(e){return e instanceof TypeError}`.
export const boxingTypeErrorSources = [
  // thisStringValue / thisNumberValue / thisBooleanValue
  'function f(x){return String.prototype.valueOf.call(1);}',
  'function f(x){return String.prototype.toString.call({});}',
  'function f(x){return String.prototype.toString.call(Object.create(String.prototype));}',
  'function f(x){return String.prototype.valueOf.call(null);}',
  'function f(x){return String.prototype.toString.call(undefined);}',
  'function f(x){return Number.prototype.valueOf.call("1");}',
  'function f(x){return Number.prototype.toString.call(new String("1"));}',
  'function f(x){return Number.prototype.valueOf.call(Object.create(Number.prototype));}',
  'function f(x){return Number.prototype.toString.call("1",1);}',
  'function f(x){return Boolean.prototype.toString.call({});}',
  'function f(x){return Boolean.prototype.valueOf.call(0);}',
  'function f(x){return Boolean.prototype.valueOf.call(new Number(0));}',
  // RequireObjectCoercible in string methods
  'function f(x){return "".charAt.call(null,0);}',
  'function f(x){return "".charCodeAt.call(undefined,0);}',
  'function f(x){return "".slice.call(null,0);}',
  // Strict writes to primitive bases and wrappers
  'function f(x){"use strict";"ab"[0]="z";return 1;}',
  'function f(x){"use strict";"ab".x=1;return 1;}',
  'function f(x){"use strict";(x).y=1;return 1;}',
  'function f(x){"use strict";true.z=1;return 1;}',
  'function f(x){"use strict";"ab".length=1;return 1;}',
  'function f(x){"use strict";"ab".charAt=1;return 1;}',
  'function f(x){"use strict";new String("ab")[1]="q";return 1;}',
  'function f(x){"use strict";new String("ab").length=3;return 1;}',
  'function f(x){"use strict";Object.create(new String("ab"))[0]="z";return 1;}',
  'function f(x){"use strict";const w=Object.freeze(new String("a"));w.k=1;return 1;}',
  'function f(x){"use strict";Object.defineProperty(String.prototype,"ro",{get:function(){return 1;}});"a".ro=2;return 1;}',
  'function f(x){"use strict";Object.defineProperty(Number.prototype,"k",{value:5});(x).k=2;return 1;}',
  // Strict deletes of non-configurable properties
  'function f(x){"use strict";return delete "ab"[0];}',
  'function f(x){"use strict";return delete new String("ab").length;}',
  // Incompatible defineProperty on wrappers; primitive target
  'function f(x){return Object.defineProperty(new String("ab"),"0",{value:"z"});}',
  'function f(x){return Object.defineProperty(new String("ab"),"0",{writable:true});}',
  'function f(x){return Object.defineProperty(new String("ab"),"1",{enumerable:false});}',
  'function f(x){return Object.defineProperty(new String("ab"),"0",{get:function(){return "a";}});}',
  'function f(x){return Object.defineProperty(new String("ab"),"length",{value:3});}',
  'function f(x){return Object.defineProperty("ab","x",{value:1});}',
  'function f(x){return Object.defineProperty(x,"x",{value:1});}',
  // `in` requires an object right-hand side
  'function f(x){return "0" in "ab";}',
  'function f(x){return "x" in x;}',
  'function f(x){return "valueOf" in true;}',
  // Conversion failures in wrapper construction
  'function f(x){return new Number({valueOf(){return {};},toString(){return {};}});}',
  'function f(x){return new String({toString(){return {};},valueOf(){return {};}});}',
  'function f(x){return new Number(Object.create(null));}',
  // ToString of objects without [[StringData]] reaching String.prototype.toString
  'function f(x){return Object.create(new String("xyz")).charAt(0);}',
  'function f(x){return Object.setPrototypeOf(new String("ab"),null)+"";}',
  // Object.prototype methods with nullish receivers
  'function f(x){return Object.prototype.valueOf.call(null);}',
  'function f(x){return Object.prototype.hasOwnProperty.call(undefined,"x");}',
];

// Bodies that throw a guest RangeError natively (radix out of 2..36).
export const boxingRangeErrorSources = [
  'function f(x){return (1).toString(1);}',
  'function f(x){return (x).toString(37);}',
  'function f(x){return new Number(x).toString(0);}',
  'function f(x){return Number.prototype.toString.call(5,Infinity);}',
  'function f(x){return (x).toString(-Infinity);}',
  'function f(x){return (x).toString({valueOf(){return 100;}});}',
];

// Must end with the uncatchable "Unsupported runtime operation" status. The
// guest catch returns a sentinel, so a wrongly catchable error is detected.
const W = 'catch(e){return "wrong guest exception";}';
export const boxingUnsupportedSources = [
  // Own-key enumeration of the prototype objects
  'function f(x){try{return Object.getOwnPropertyNames(String.prototype).length;}' + W + '}',
  'function f(x){try{return Object.keys(Number.prototype).length;}' + W + '}',
  'function f(x){try{return Object.getOwnPropertyNames(Boolean.prototype).length;}' + W + '}',
  'function f(x){try{return Object.keys(String.prototype).length;}' + W + '}',
  // Unimplemented ES2025 prototype names
  'function f(x){try{return "a,b".split(",").length;}' + W + '}',
  // toFixed/toExponential/toPrecision are implemented by the standard-library wave.
  'function f(x){try{return Number.prototype.toLocaleString.call(1);}' + W + '}',
  'function f(x){try{return (x).toLocaleString();}' + W + '}',
  'function f(x){try{return typeof new Number(x).toLocaleString;}' + W + '}',
  // Own-property queries of unimplemented names (HasProperty via `in` is true)
  'function f(x){try{return delete String.prototype.split;}' + W + '}',
  'function f(x){try{return typeof Object.getOwnPropertyDescriptor(Number.prototype,"toLocaleString");}' + W + '}',
  // Non-decimal radix
  'function f(x){try{return (255).toString(16);}' + W + '}',
  'function f(x){try{return (x).toString(2);}' + W + '}',
  'function f(x){try{return new Number(35).toString(36);}' + W + '}',
  // Array.prototype methods with primitive receivers
  'function f(x){try{return Array.prototype.indexOf.call("ab","b");}' + W + '}',
  'function f(x){try{return Array.prototype.at.call("ab",0);}' + W + '}',
  'function f(x){try{return Array.prototype.every.call(1,function(){return false;});}' + W + '}',
  // ToObject on primitive descriptor maps
  'function f(x){try{Object.defineProperties({},"a");return "no error";}catch(e){return e instanceof TypeError?"native TypeError":"wrong guest exception";}}',
  // Constructor statics and builtin-constructor descriptors
  'function f(x){try{return String.fromCharCode(65);}' + W + '}',
  'function f(x){try{return Object.getOwnPropertyDescriptor(String,"prototype").writable;}' + W + '}',
];

// Resumption: callbacks in wrapper construction, a strict String.prototype
// getter read from a primitive, a sloppy Number.prototype setter invoked by a
// sloppy primitive write, a sloppy method boxing `this`, wrapper valueOf in +,
// and two caught TypeErrors.
export const boxingResumptionSource = `function f(x) {
  let log = "";
  const s = new String({ toString() { log += "t"; return "ab" + x; }, valueOf() { log += "T"; return 0; } });
  const n = new Number({ valueOf() { log += "v"; return x; }, toString() { log += "V"; return "9"; } });
  Object.defineProperty(String.prototype, "probe", { get: function () { "use strict"; log += "g" + typeof this; return this.length; }, configurable: true });
  Object.defineProperty(Number.prototype, "sink", { set: function (v) { log += "s" + typeof this + (this instanceof Number) + v; } });
  String.prototype.boxed = function (k) { log += "m" + typeof this; return this.charAt(k) + this.length; };
  const len = "xyz".probe;
  (x).sink = 5;
  const m = String(x).boxed({ valueOf() { log += "k"; return 0; } });
  const sum = n + new Number(1);
  const text = s + "|" + n.toString() + "|" + (17).toString(10);
  let caught = "";
  try { (function () { "use strict"; "ab"[0] = "z"; })(); } catch (e) { caught = e instanceof TypeError ? "T" : "?"; }
  try { Number.prototype.valueOf.call("1"); } catch (e) { caught += e instanceof TypeError ? "T" : "?"; }
  return log + ":" + len + ":" + m + ":" + sum + ":" + text + ":" + caught + ":" + s.length + ":" + Object.keys(s).length;
}`;
export const boxingResumptionExpected = 'tvgstringsobjecttrue5mobjectk:3:12:18:ab17|17|17:TT:4:4';

// Explicit ES2025 expectations where a native engine is known to deviate.
// None are currently known for Node (V8) or Safari (JSC); any native mismatch
// with the GPU fails the browser check until it is investigated and recorded here.
export const boxingNormativeExpectations = new Map();
boxingSources.push(
  'function f(x){try{return typeof "a".concat;}' + W + '}',
  'function f(x){try{return typeof Object.create(String.prototype).substring;}' + W + '}',
  'function f(x){try{return String.prototype.hasOwnProperty("concat");}' + W + '}',
);
// Formerly compiler-rejected; admitted since the Phase 4 to_string template
// lowering (each substitution is converted with ToString before the next).
export const boxingTemplateSources = [
  'function f(x){try{return `a${x}`;}' + W + '}',
  'function f(x){try{return `${new String("q")}!`;}' + W + '}',
];
boxingSources.push(...boxingTemplateSources);
// Formerly compiler-rejected; admitted since the Phase 4 tagged-template
// lowering (per-site frozen template objects, String.raw). They run as
// ordinary positive boxing programs (native/Wasm parity, native realms, GPU).
export const boxingTaggedTemplateSources = [
  'function f(x){function tag(s,v){return s[0]+v;}try{return tag`a${new String(x)}`;}' + W + '}',
  'function f(x){try{return String.raw`a${x}`;}' + W + '}',
];
boxingSources.push(...boxingTaggedTemplateSources);
// Compatibility alias (phase4-template-tagged-cases.js taggedTemplateFormerlyRejected):
// these sources are now ADMITTED, not rejected.
export const boxingCompilerRejectedSources = boxingTaggedTemplateSources;

export const boxingInputNormativeExpectations = new Map([["function f(x){const p=new String(\"ab\"+x),o=Object.create(p);o[0]=\"z\";o.length=1;o[9]=\"q\";return o[0]+o[1]+\":\"+o.length+\":\"+(\"0\" in o)+o.hasOwnProperty(\"0\")+o.hasOwnProperty(9)+\":\"+Object.keys(o).length+\":\"+(Object.getPrototypeOf(o)===p)+\":\"+typeof o.charAt+\":\"+Object.prototype.toString.call(o);}", {expectedForInput: input => "ab:"+("ab"+input).length+":truefalsetrue:1:true:function:[object Object]", spec:"https://tc39.es/ecma262/2025/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinarysetwithowndescriptor",note:"String exotic indices are nonwritable own properties; an inherited nonwritable data descriptor prevents creation on the receiver."}]]);

boxingInputNormativeExpectations.set("function f(x){\"use strict\";const o=Object.create(new String(\"ab\"));let s=\"\";try{o[0]=\"z\";s+=\"n\";}catch(e){s+=e instanceof TypeError?\"T\":\"?\";}try{o.length=5;s+=\"n\";}catch(e){s+=e instanceof TypeError?\"T\":\"?\";}o[2]=\"c\";o.x=x;return s+\":\"+o[0]+o[2]+o.length+o.x+\":\"+Object.keys(o).length;}",{expectedForInput: input=>"TT:ac2"+input+":2",spec:"https://tc39.es/ecma262/2025/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinarysetwithowndescriptor",note:"Strict assignment to an inherited nonwritable String index throws TypeError."});
boxingInputNormativeExpectations.set("function f(x){const run=(function f(x){\"use strict\";Object.create(new String(\"ab\"))[0]=\"z\";return 1;});try{run(x);}catch(e){return e instanceof TypeError;}return false;}",{expectedForInput:()=>true,spec:"https://tc39.es/ecma262/2025/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinarysetwithowndescriptor",note:"The guest must catch TypeError for the rejected inherited-index write."});
export const boxingNegativeNormativeExpectations=new Map([["function f(x){\"use strict\";Object.create(new String(\"ab\"))[0]=\"z\";return 1;}",{expectedError:"TypeError",spec:"https://tc39.es/ecma262/2025/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinarysetwithowndescriptor",note:"Strict PutValue throws when inherited nonwritable String index Set returns false."}]]);

// These prior Unsupported fixtures now execute through phase5 builtins.
export const boxingPhase5BoundarySources = [
  'function f(x){function g(){return typeof this;}try{return g();}' + W + '}',
  'function f(x){function g(){return typeof this;}try{return g.call(null);}' + W + '}',
  'function f(x){function g(){return typeof this;}try{return g.call(undefined);}' + W + '}',
  'function f(x){try{return "a".toUpperCase();}' + W + '}',
  'function f(x){try{return "ab".at(x);}' + W + '}',
  'function f(x){try{return "a".padStart(3,"-");}' + W + '}',
  'function f(x){try{return typeof "".trim;}' + W + '}',
  'function f(x){try{return typeof new String("a").repeat;}' + W + '}',
  'function f(x){try{return Number.isInteger(x);}' + W + '}',
];
boxingSources.push(...boxingPhase5BoundarySources);
