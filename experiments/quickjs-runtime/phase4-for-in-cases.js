// Phase 4 worker 6: for-in enumeration and lexical binding / TDZ fixtures.
// `expected` values are fixed ES2025 results. The V8 host oracle and a native
// QuickJS interpreter built from vendor/ only confirm them (see
// check-phase4-for-in.mjs); neither is a production execution path.
// Every fixture is input-sensitive and every expected value is distinct.
// Only interoperable-required enumeration behavior is tested: properties added
// during enumeration, enumerability changes during enumeration and deletion of
// shadowing properties are implementation-defined and deliberately absent.
// `requires` names a Phase 4 area other than for-in that the fixture also needs
// (for-of/array iteration is worker 4); such fixtures stay compiler-rejected
// until that area is integrated.
const kind = 'e instanceof ReferenceError?"ref":e instanceof TypeError?"type":"other"';

export const forInCases = [
  // ---- Order: OrdinaryOwnPropertyKeys (integer indices ascending, then strings in creation order) ----
  { feature: 'for-in-own-key-order', input: 7, expected: '2,7,b,a,c,',
    source: `function f(x){const o={b:1,a:2};o[x]=3;o[2]=4;o.c=5;let s="";for(const k in o)s+=k+",";return s;}` },
  { feature: 'for-in-index-vs-noncanonical-string', input: 3, expected: '3|03|3.0|-1|',
    source: `function f(x){const o={};o["0"+x]=1;o[x]=2;o[x+".0"]=3;o["-1"]=4;let s="";for(const k in o)s+=k+"|";return s;}` },
  { feature: 'for-in-key-is-string', input: 5, expected: 'string05:string15:',
    source: `function f(x){let s="";for(const k in [x,x])s+=typeof k+(k+x)+":";return s;}` },
  // ---- Arrays ----
  { feature: 'for-in-array-holes', input: 3, expected: '0:3;2:4;5:3;',
    source: `function f(x){const a=[x,,x+1];a[5]=x;let s="";for(const k in a)s+=k+":"+a[k]+";";return s;}` },
  { feature: 'for-in-array-named-after-indices', input: 4, expected: '0,1,tag,4',
    source: `function f(x){const a=[];a.tag=1;a[1]=x;a[0]=x;let s="";for(const k in a)s+=k+",";return s+a[1];}` },
  { feature: 'for-in-array-truncated-during-iteration', input: 6, expected: 'v0,v1|6',
    source: `function f(x){const a=[x,x,x,x];let s="";for(const k in a){s+=(s?",":"")+"v"+k;if(k==="1")a.length=2;}return s+"|"+a[0];}` },
  // ---- Primitives and wrappers (ToObject) ----
  { feature: 'for-in-string-primitive-indices', input: 42, expected: '0q1422',
    source: `function f(x){let s="";const t="q"+x;for(const k in t)s+=k+t[k];return s;}` },
  { feature: 'for-in-string-wrapper-extra-keys', input: 8, expected: '0,1,5,e,|h8',
    source: `function f(x){const w=new String("h"+x);w.e=1;w[5]=2;let s="";for(const k in w)s+=k+",";return s+"|"+w[0]+w[1];}` },
  { feature: 'for-in-number-primitive-no-keys', input: 5, expected: 'n0:5',
    source: `function f(x){let n=0;for(const k in x)n++;return "n"+n+":"+x;}` },
  { feature: 'for-in-boolean-primitive-no-keys', input: 2, expected: 'b0:true2',
    source: `function f(x){let n=0;for(const k in x>1)n++;return "b"+n+":"+(x>1)+x;}` },
  { feature: 'for-in-null-undefined-skip-body', input: 9, expected: 'skip0-9',
    source: `function f(x){let n=0;for(const k in null)n++;for(const k in undefined)n+=10;let u;for(var v in u)n+=100;return "skip"+n+"-"+x;}` },
  // ---- Prototype chain ----
  { feature: 'for-in-object-create-inherited', input: 1, expected: '1,c,a,b,',
    source: `function f(x){const p={a:1,b:2};const o=Object.create(p);o.c=3;o[x]=0;let s="";for(const k in o)s+=k+",";return s;}` },
  { feature: 'for-in-three-level-chain', input: 2, expected: 'own,mid,top,2',
    source: `function f(x){const top={top:1};const mid=Object.create(top);mid.mid=1;const o=Object.create(mid);o.own=x;let s="";for(const k in o)s+=k+",";return s+o.own;}` },
  { feature: 'for-in-null-prototype-object', input: 6, expected: 'k6,j',
    source: `function f(x){const o=Object.create(null);o["k"+x]=1;o.j=2;let s="";for(const k in o)s+=(s?",":"")+k;return s;}` },
  { feature: 'for-in-shadow-nonenumerable-own', input: 7, expected: 'a,c|7',
    source: `function f(x){const p={a:1,b:2,c:3};const o=Object.create(p);Object.defineProperty(o,"b",{value:x,enumerable:false});let s="";for(const k in o)s+=(s?",":"")+k;return s+"|"+o.b;}` },
  { feature: 'for-in-shadow-enumerable-once', input: 3, expected: 'a=3,b=2,',
    source: `function f(x){const p={a:1,b:2};const o=Object.create(p);o.a=x;let s="";for(const k in o)s+=k+"="+o[k]+",";return s;}` },
  { feature: 'for-in-shadow-across-middle-level', input: 4, expected: 'own,top4',
    source: `function f(x){const top={hidden:1,top:1};const mid=Object.create(top);Object.defineProperty(mid,"hidden",{value:0});const o=Object.create(mid);o.own=1;let s="";for(const k in o)s+=(s?",":"")+k;return s+x;}` },
  { feature: 'for-in-intrinsic-prototype-enumerable', input: 5, expected: '0,1,extra,objectWide|5',
    source: `function f(x){Array.prototype.extra=1;Object.prototype.objectWide=2;const a=[x,x];let s="";for(const k in a)s+=(s?",":"")+k;return s+"|"+a[0];}` },
  { feature: 'for-in-builtin-methods-not-enumerable', input: 2, expected: 'own2',
    source: `function f(x){const o={own:x};let s="";for(const k in o)s+=k+o[k];return s;}` },
  // ---- Mutation during enumeration (interoperable subset) ----
  { feature: 'for-in-delete-before-visit', input: 2, expected: 'ab:2',
    source: `function f(x){const o={a:1,b:2,c:3};let s="";for(const k in o){s+=k;if(k==="b")delete o.c;}return s+":"+x;}` },
  { feature: 'for-in-delete-current-key', input: 11, expected: 'p,q,r:0:11',
    source: `function f(x){const o={p:1,q:2,r:x};let s="",n=0;for(const k in o){s+=(s?",":"")+k;delete o[k];}for(const k in o)n++;return s+":"+n+":"+x;}` },
  { feature: 'for-in-delete-inherited-before-visit', input: 8, expected: 'own:8',
    source: `function f(x){const p={gone:1};const o=Object.create(p);o.own=1;let s="";for(const k in o){s+=k;delete p.gone;}return s+":"+x;}` },
  { feature: 'for-in-values-updated-in-body', input: 3, expected: 'sum9:10,11,12',
    source: `function f(x){const o={a:x,b:x,c:x};let t=0;for(const k in o){t+=o[k];o[k]=o[k]+7+(k==="b"?1:k==="c"?2:0);}return "sum"+t+":"+o.a+","+o.b+","+o.c;}` },
  // ---- Descriptors ----
  { feature: 'for-in-skips-nonenumerable-own', input: 4, expected: 'vis4',
    source: `function f(x){const o={};Object.defineProperty(o,"hid",{value:1,enumerable:false});o.vis=x;let s="";for(const k in o)s+=k+o[k];return s;}` },
  { feature: 'for-in-accessor-not-invoked', input: 6, expected: 'g,h|0|6',
    source: `function f(x){let n=0;const o={get g(){n++;return x;},set h(v){n+=10;}};let s="";for(const k in o)s+=(s?",":"")+k;return s+"|"+n+"|"+o.g;}` },
  { feature: 'for-in-frozen-object', input: 1, expected: 'u,w;1',
    source: `function f(x){const o=Object.freeze({u:x,w:2});let s="";for(const k in o)s+=(s?",":"")+k;return s+";"+o.u;}` },
  // ---- Exotic and function objects ----
  { feature: 'for-in-arguments-mapped', input: 5, expected: '0,1,2|5',
    source: `function f(x){function g(a,b){let s="";for(const k in arguments)s+=(s?",":"")+k;return s+"|"+a;}return g(x,1,2);}` },
  { feature: 'for-in-arguments-strict', input: 2, expected: 'args0|2',
    source: `function f(x){function g(){"use strict";let s="args";for(const k in arguments)s+=k;return s+"|"+arguments[0];}return g(x);}` },
  { feature: 'for-in-function-object', input: 9, expected: 'a,b|9',
    source: `function f(x){function g(){}g.a=x;g.b=1;let s="";for(const k in g)s+=(s?",":"")+k;return s+"|"+g.a;}` },
  { feature: 'for-in-function-prototype-enumerable', input: 3, expected: 'own,shared:3',
    source: `function f(x){const g=function(){};g.own=x;Function.prototype.shared=1;let s="";for(const k in g)s+=(s?",":"")+k;return s+":"+g.own;}` },
  { feature: 'for-in-error-object', input: 7, expected: 'code=7',
    source: `function f(x){const e=new Error("m");e.code=x;let s="";for(const k in e)s+=k+"="+e[k];return s;}` },
  // ---- Heads ----
  { feature: 'for-in-var-head-last-key', input: 2, expected: 'z:2',
    source: `function f(x){var k="none";for(k in {y:1,z:2});return k+":"+x;}` },
  { feature: 'for-in-member-target-head', input: 5, expected: 'pq:q5',
    source: `function f(x){const t={};let s="";for(t.p in {p:1,q:2})s+=t.p;return s+":"+t.p+x;}` },
  { feature: 'for-in-computed-member-target-head', input: 1, expected: 'r0r1|1',
    source: `function f(x){const t=[];let i=0;for(t[i++] in [x,x]);return "r"+t[0]+"r"+t[1]+"|"+x;}` },
  { feature: 'for-in-annexb-var-initializer', input: 4, expected: 'io:i4',
    source: `function f(x){let log="";for(var k=(log+="i","i"+x) in (log+="o",{}));return log+":"+k;}` },
  { feature: 'for-in-expression-evaluated-once', input: 6, expected: 'e1:ab6',
    source: `function f(x){let n=0;function src(){n++;return {a:1,b:2};}let s="";for(const k in src())s+=k;return "e"+n+":"+s+x;}` },
  // ---- Control flow ----
  { feature: 'for-in-break', input: 4, expected: 'ab-4',
    source: `function f(x){let s="";for(const k in {a:1,b:2,c:3,d:4}){s+=k;if(k==="b")break;}return s+"-"+x;}` },
  { feature: 'for-in-continue', input: 3, expected: 'acd3',
    source: `function f(x){let s="";for(const k in {a:1,b:2,c:3,d:4}){if(k==="b")continue;s+=k;}return s+x;}` },
  { feature: 'for-in-return-from-body', input: 2, expected: 'found:m2',
    source: `function f(x){const o={l:1,m:x,n:3};for(const k in o){if(o[k]===x)return "found:"+k+x;}return "none";}` },
  { feature: 'for-in-nested', input: 1, expected: 'aa,ab,ba,bb,|1',
    source: `function f(x){const o={a:1,b:2};let s="";for(const i in o)for(const j in o)s+=i+j+",";return s+"|"+x;}` },
  { feature: 'for-in-labeled-continue-outer', input: 2, expected: 'xp,yp,2',
    source: `function f(x){let s="";outer:for(const i in {x:1,y:2}){for(const j in {p:1,q:2}){s+=i+j+",";continue outer;}}return s+x;}` },
  { feature: 'for-in-break-from-inner-finally', input: 9, expected: 'a!b!!9',
    source: `function f(x){let s="";for(const k in {a:1,b:2,c:3}){try{if(k==="c")break;s+=k;}finally{s+="!";}}return s+x;}` },
  { feature: 'for-in-throw-caught-in-body', input: 5, expected: 'c:b5',
    source: `function f(x){try{for(const k in {a:1,b:2}){if(k==="b")throw k+x;}}catch(e){return "c:"+e;}return "none";}` },
  { feature: 'for-in-return-inside-nested-loops', input: 3, expected: 'ret:q3',
    source: `function f(x){for(const a in {p:1,q:2}){for(const b in [x]){if(a==="q")return "ret:"+a+x;}}return "end";}` },
];

export const lexicalCases = [
  // ---- for-in per-iteration bindings ----
  { feature: 'for-in-let-per-iteration-closures', input: 2, expected: 'a2,b2,c2',
    source: `function f(x){const fs=[];for(let k in {a:1,b:2,c:3})fs[fs.length]=function(){return k+x;};return fs[0]()+","+fs[1]()+","+fs[2]();}` },
  { feature: 'for-in-let-closure-mutates-own-copy', input: 3, expected: 'a!3|b?3',
    source: `function f(x){const g=[],h=[];for(let k in {a:1,b:2}){g[g.length]=function(){return k;};h[h.length]=function(v){k=k+v;};}h[0]("!"+x);h[1]("?"+x);return g[0]()+"|"+g[1]();}` },
  { feature: 'for-in-var-shared-binding-control', input: 4, expected: 'c4,c4,c4',
    source: `function f(x){const fs=[];for(var k in {a:1,b:2,c:3})fs[fs.length]=function(){return k+x;};return fs[0]()+","+fs[1]()+","+fs[2]();}` },
  { feature: 'for-in-const-closure-with-break', input: 5, expected: 'p5,q5;2',
    source: `function f(x){const fs=[];for(const k in {p:1,q:2,r:3}){fs[fs.length]=()=>k+x;if(k==="q")break;}return fs[0]()+","+fs[1]()+";"+fs.length;}` },
  { feature: 'for-in-let-body-block-binding', input: 6, expected: 'a:6,b:12',
    source: `function f(x){const fs=[];let n=0;for(let k in {a:1,b:2}){n++;let t=n*x;fs[fs.length]=()=>k+":"+t;}return fs[0]()+","+fs[1]();}` },
  { feature: 'for-in-head-shadows-outer-let', input: 7, expected: 'outer7:ab',
    source: `function f(x){let k="outer"+x;let s="";for(let k in {a:1,b:2})s+=k;return k+":"+s;}` },
  { feature: 'for-in-head-expression-sees-outer-var', input: 8, expected: 'q8',
    source: `function f(x){var k={q:x};let s="";for(var k in k)s+=k;return s+x;}` },
  // ---- for-of heads (array iteration is worker 4) ----
  { feature: 'for-of-let-per-iteration-closures', requires: 'w4-iteration', input: 2, expected: '2/4/6',
    source: `function f(x){const fs=[];for(let v of [x,x*2,x*3])fs[fs.length]=()=>v;return fs[0]()+"/"+fs[1]()+"/"+fs[2]();}` },
  { feature: 'for-of-var-shared-binding-control', requires: 'w4-iteration', input: 3, expected: '9/9',
    source: `function f(x){const fs=[];for(var v of [x,x*3])fs[fs.length]=()=>v;return fs[0]()+"/"+fs[1]();}` },
  { feature: 'for-of-for-in-nested-closures', requires: 'w4-iteration', input: 1, expected: 'a1,b1,a2,b2',
    source: `function f(x){const fs=[];for(const n of [x,x+1])for(const k in {a:1,b:2})fs[fs.length]=()=>k+n;let s="";for(let i=0;i<fs.length;i++)s+=(i?",":"")+fs[i]();return s;}` },
  // ---- Block TDZ (non-throwing paths) ----
  { feature: 'closure-reads-block-const-after-init', input: 3, expected: 61,
    source: `function f(x){const fs=[];for(let i=0;i<2;i++){fs[i]=()=>v+i;const v=x*10;}return fs[0]()+fs[1]();}` },
  { feature: 'block-let-fresh-per-entry', input: 4, expected: '0,4,8',
    source: `function f(x){const fs=[];for(var i=0;i<3;i++){let t=i*x;fs[i]=function(){return t;};}return fs[0]()+","+fs[1]()+","+fs[2]();}` },
  { feature: 'switch-lexical-initialized-fallthrough', input: 0, expected: 'init1',
    source: `function f(x){switch(x){case 0:let a=x+1;case 1:return "init"+a;}return "none"+x;}` },
  { feature: 'typeof-after-block-initialization', input: 2, expected: 'number2',
    source: `function f(x){{let q=x;return typeof q+q;}}` },
];

// TypeError raised inside for-in contexts; caught in the guest.
export const forInTypeErrorCases = [
  { feature: 'for-in-const-head-assign-in-body', input: 3, expected: 'type:a3',
    source: `function f(x){let last="";try{for(const k in {a:1,b:2}){last=k;k="z";}}catch(e){return (${kind})+":"+last+x;}return "none";}` },
  { feature: 'for-in-outer-const-head-target', input: 4, expected: 'type-c4',
    source: `function f(x){const c="c";try{for(c in {a:1});}catch(e){return (${kind})+"-"+c+x;}return "none";}` },
  { feature: 'for-in-member-target-of-undefined', input: 5, expected: 'type#5',
    source: `function f(x){let t;try{for(t.p in {a:1});}catch(e){return (${kind})+"#"+x;}return "none";}` },
  { feature: 'for-in-expression-property-of-null', input: 6, expected: 'type@0:6',
    source: `function f(x){let n=0;try{const o=null;for(const k in o.p)n++;}catch(e){return (${kind})+"@"+n+":"+x;}return "none";}` },
  { feature: 'for-in-strict-frozen-member-target', input: 7, expected: 'type!70',
    source: `function f(x){"use strict";const t=Object.freeze({p:0});try{for(t.p in {a:1});}catch(e){return (${kind})+"!"+x+t.p;}return "none";}` },
  { feature: 'for-in-key-called-as-function', input: 8, expected: 'type/k8',
    source: `function f(x){try{for(const k in {k:1})k();}catch(e){return (${kind})+"/k"+x;}return "none";}` },
];

// ReferenceError from TDZ in for-in/for-of heads, blocks and switch cases; caught in the guest.
export const lexicalReferenceErrorCases = [
  { feature: 'for-in-let-self-reference-tdz', input: 5, expected: 'ref:5',
    source: `function f(x){try{for(let x in x){}return "no";}catch(e){return (${kind})+":"+x;}}` },
  { feature: 'for-in-const-computed-key-tdz', input: 6, expected: 'ref;6',
    source: `function f(x){const k="k";try{for(const k in {[k]:x}){}return "no";}catch(e){return (${kind})+";"+x;}}` },
  { feature: 'for-in-head-closure-stays-tdz', input: 7, expected: 'ref:ab:7',
    source: `function f(x){let g;let s="";for(let k in (g=function(){return k;},{a:1,b:2}))s+=k;try{return "no"+g();}catch(e){return (${kind})+":"+s+":"+x;}}` },
  { feature: 'for-of-let-self-reference-tdz', requires: 'w4-iteration', input: 8, expected: 'ref8',
    source: `function f(x){try{for(let y of [y]){}return "no";}catch(e){return (${kind})+x;}}` },
  { feature: 'for-of-head-closure-stays-tdz', requires: 'w4-iteration', input: 4, expected: 'ref|8',
    source: `function f(x){let g;let t=0;for(const v of (g=()=>v,[x,x]))t+=v;try{return "no"+g();}catch(e){return (${kind})+"|"+t;}}` },
  { feature: 'block-typeof-tdz-shadowing-outer', input: 2, expected: 'ref-typeof2',
    source: `function f(x){let q=x;{try{return typeof q;}catch(e){return (${kind})+"-typeof"+x;}let q=1;}}` },
  { feature: 'closure-typeof-tdz-before-init', input: 3, expected: 'ref~3',
    source: `function f(x){const g=()=>typeof later;try{g();}catch(e){return (${kind})+"~"+x;}let later=1;return "no";}` },
  { feature: 'switch-case-read-before-init', input: 1, expected: 'ref^1',
    source: `function f(x){switch(x){case 0:let a=x;case 1:try{return "read"+a;}catch(e){return (${kind})+"^"+x;}}return "none"+x;}` },
  { feature: 'switch-case-closure-before-init', input: 4, expected: 'ref&4',
    source: `function f(x){switch(x){case 0:const c=1;case 4:{const g=()=>c;try{return "c"+g();}catch(e){return (${kind})+"&"+x;}}}return "none";}` },
  { feature: 'default-parameter-tdz', input: 9, expected: 'ref=9',
    source: `function f(x){function g(a=b,b=x){return a;}try{return "no"+g();}catch(e){return (${kind})+"="+x;}}` },
  { feature: 'for-in-body-closure-reads-later-let', input: 2, expected: 'ref%a2',
    source: `function f(x){try{for(const k in {a:1}){const g=()=>v;g();let v=k;}}catch(e){return (${kind})+"%a"+x;}return "no";}` },
];
