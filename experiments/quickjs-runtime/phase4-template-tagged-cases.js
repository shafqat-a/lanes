// Phase 4 worker 1 (next wave): tagged template fixtures (ES2025 13.2.8.4
// GetTemplateObject, 13.3.11 tagged templates, 22.1.2.4 String.raw).
// Every `expected` is a fixed ECMAScript result for `input`; check-phase4-templates.mjs
// confirms it with the V8 oracle (node:vm) and a native QuickJS interpreter
// built from vendor/, and requires a different result for input + 1.
// GPU execution is pending (coordinator M1/Safari run); no CPU replay exists.

// Admitted and required: every case must pack with the patched compiler and
// program.js, and its result is normative for the GPU run.
export const taggedTemplateCases = [
  { feature: 'sloppy-tag-this-global', input: 3, expected: 'true:3',
    source: 'function f(x){function tag(s,v){return (typeof this==="object")+":"+v;}return tag`${x}`;}' },

  // --- call shape, arguments and cooked/raw strings
  { feature: 'substitution-arguments', input: 1, expected: 'a|1|b|2|2|2|3',
    source: 'function f(x){function tag(s,v){return [s[0],v,s[1],s.length,s.raw.length,arguments.length].join("|");}return tag`a${x}b`+"|"+(x+2);}' },
  { feature: 'no-substitution-raw-vs-cooked', input: 2, expected: 'r\\n:2:1:2',
    source: 'function f(x){function tag(s){return s.raw[0]+":"+s[0].length+":"+s.length+":"+x;}return tag`r\\n`;}' },
  { feature: 'empty-template-strings', input: 3, expected: '3:,,:3',
    source: 'function f(x){function tag(s,a,b){return s.length+":"+s.join()+":"+(a+b-x);}return tag`${x}${x}`;}' },
  { feature: 'substitution-values-not-stringified', input: 4, expected: 'number:object:true:4',
    source: 'function f(x){const o={};function tag(s,a,b){return typeof a+":"+typeof b+":"+(b===o)+":"+a;}return tag`${x}-${o}`;}' },
  { feature: 'unicode-escapes-cooked', input: 5, expected: 'A:2:\\u0041:5',
    source: 'function f(x){function tag(s,v){return s[0]+":"+s[1].length+":"+s.raw[0]+":"+v;}return tag`\\u0041${x}\\u{1F600}`;}' },
  { feature: 'raw-keeps-escaped-backtick-and-dollar', input: 6, expected: '\\`\\${x}|`${x}|6',
    source: 'function f(x){function tag(s){return s.raw[0]+"|"+s[0]+"|"+x;}return tag`\\`\\${x}`;}' },
  { feature: 'raw-crlf-normalized', input: 7, expected: '3:10:3:7',
    source: 'function f(x){function tag(s){return s.raw[0].length+":"+s.raw[0].charCodeAt(1)+":"+s[0].length+":"+x;}return tag`a\r\nb`;}' },
  { feature: 'line-continuation', input: 8, expected: '2:4:8',
    source: 'function f(x){function tag(s){return s[0].length+":"+s.raw[0].length+":"+x;}return tag`a\\\nb`;}' },
  // --- invalid escapes: cooked undefined, raw present (13.2.8.3 TV / TRV)
  { feature: 'invalid-unicode-escape-cooked-undefined', input: 9, expected: 'true|\\unicode|ok|9',
    source: 'function f(x){function tag(s,v){return (s[0]===undefined)+"|"+s.raw[0]+"|"+s[1]+"|"+v;}return tag`\\unicode${x}ok`;}' },
  { feature: 'invalid-hex-and-octal-escapes', input: 10, expected: 'undefined,undefined,undefined,\x00|\\xg,\\01,\\u{110000},\\0|10',
    source: 'function f(x){function tag(s){return String(s[0])+","+String(s[1])+","+String(s[2])+","+s[3]+"|"+s.raw.join()+"|"+x;}return tag`\\xg${0}\\01${1}\\u{110000}${2}\\0`;}' },
  { feature: 'invalid-escape-only-affects-own-segment', input: 11, expected: 'ok:undefined:fine:11',
    source: 'function f(x){function tag(s){return s[0]+":"+s[1]+":"+s[2]+":"+x;}return tag`ok${x}\\u{${x}fine`;}' },
  // --- GetTemplateObject: identity and per-site caching
  { feature: 'same-site-loop-identity', input: 12, expected: 'true:4:12',
    source: 'function f(x){function tag(s){return s;}let first=null,same=true,n=0;for(let i=0;i<4;i++){const s=tag`a${i}b`;if(first===null)first=s;same=same&&s===first;n++;}return same+":"+n+":"+x;}' },
  { feature: 'same-site-repeated-calls', input: 13, expected: 'true:a13',
    source: 'function f(x){function tag(s){return s;}function g(){return tag`a${x}`;}const p=g(),q=g();return (p===q)+":"+p[0]+x;}' },
  { feature: 'same-site-distinct-closures', input: 14, expected: 'true:true:14',
    source: 'function f(x){function tag(s){return s;}const fs=[];for(let i=0;i<3;i++)fs.push(()=>tag`k${i}`);return (fs[0]()===fs[1]())+":"+(fs[1]()===fs[2]())+":"+x;}' },
  { feature: 'distinct-sites-identical-text', input: 15, expected: 'false:false:true:15',
    source: 'function f(x){function tag(s){return s;}const a=tag`same${x}`,b=tag`same${x}`;const c=tag`same${x}`;return (a===b)+":"+(b===c)+":"+(a.raw[0]===c.raw[0])+":"+x;}' },
  { feature: 'site-identity-independent-of-substitutions', input: 16, expected: 'true:16:17',
    source: 'function f(x){const seen=[];function tag(s,v){seen.push(s);return v;}function g(v){return tag`v${v}`;}const a=g(x),b=g(x+1);return (seen[0]===seen[1])+":"+a+":"+b;}' },
  { feature: 'nested-tagged-templates-distinct', input: 17, expected: 'o:i:17:false',
    source: 'function f(x){let inner;function tag(s,v){return s;}function itag(s,v){inner=s;return v;}const outer=tag`o${itag`i${x}`}`;return outer[0]+":"+inner[0]+":"+x+":"+(outer===inner);}' },
  { feature: 'chained-tags', input: 18, expected: 'ab18',
    source: 'function f(x){let log="";function tag(s){log+=s[0];return tag;}tag`a``b`;return log+x;}' },
  { feature: 'survives-gc', input: 19, expected: 'true:true:p19:q:true:310',
    source: 'function f(x){function tag(s){return s;}function g(){return tag`p${x}q`;}const kept=g();let total=0;for(let i=0;i<300;i++){const o={a:i,b:[i,i+1],c:"s"+i};total+=o.b.length>1?1:0;}const again=g();for(let i=0;i<10;i++){const o={a:[i]};total+=o.a.length;}const third=g();return (kept===again)+":"+(again===third)+":"+third[0]+x+":"+third.raw[1]+":"+Object.isFrozen(third.raw)+":"+total;}' },
  { feature: 'survives-gc-without-guest-reference', input: 20, expected: 'm:n:2:true:20',
    source: 'function f(x){function g(){return (s=>s)`m${x}n`;}g();for(let i=0;i<400;i++){const o={a:i,b:[i]};o.c=o.b;}const s=g();return s[0]+":"+s[1]+":"+s.raw.length+":"+Object.isFrozen(s)+":"+x;}' },
  // --- frozen template object and raw array
  { feature: 'frozen-cooked-and-raw', input: 21, expected: 'true:true:false:false:21',
    source: 'function f(x){function tag(s){return s;}const s=tag`a${x}b`;return Object.isFrozen(s)+":"+Object.isFrozen(s.raw)+":"+Object.isExtensible(s)+":"+Object.isExtensible(s.raw)+":"+x;}' },
  { feature: 'element-descriptors', input: 22, expected: 'false,true,false|false,true,false|false,false,false|22',
    source: 'function f(x){function tag(s){return s;}const s=tag`a${x}`;const d=(o,k)=>{const p=Object.getOwnPropertyDescriptor(o,k);return [p.writable,p.enumerable,p.configurable].join();};return d(s,0)+"|"+d(s.raw,1)+"|"+d(s,"length")+"|"+x;}' },
  { feature: 'raw-property-descriptor', input: 23, expected: 'false,false,false,true|23',
    source: 'function f(x){function tag(s){return s;}const s=tag`a`;const p=Object.getOwnPropertyDescriptor(s,"raw");return [p.writable,p.enumerable,p.configurable,Array.isArray(p.value)].join()+"|"+x;}' },
  { feature: 'own-keys-and-enumeration', input: 24, expected: '0,1|0,1,length,raw|0,1|0,1,length|0,1|24',
    source: 'function f(x){function tag(s){return s;}const s=tag`a${x}b`;let fi=[];for(const k in s)fi.push(k);return Object.keys(s).join()+"|"+Object.getOwnPropertyNames(s).join()+"|"+fi.join()+"|"+Object.getOwnPropertyNames(s.raw).join()+"|"+Object.keys(s.raw).join()+"|"+x;}' },
  { feature: 'is-array-with-array-prototype', input: 25, expected: 'true:true:true:true:25',
    source: 'function f(x){function tag(s){return s;}const s=tag`a`;return Array.isArray(s)+":"+(Object.getPrototypeOf(s)===Array.prototype)+":"+(s.raw instanceof Array)+":"+Array.isArray(s.raw)+":"+x;}' },
  { feature: 'sloppy-writes-ignored', input: 26, expected: 'a|b|2||false|true|26',
    source: 'function f(x){function tag(s){return s;}const s=tag`a${x}b`;s[0]="z";s.length=0;s.extra=1;s.raw="r";const d=delete s[1];const kept=Array.isArray(s.raw);return [s[0],s[1],s.length,s.extra,d,kept].join("|")+"|"+x;}' },
  { feature: 'array-methods-on-template-object', input: 27, expected: 'aa-bb-cc|3|27',
    source: 'function f(x){function tag(s){return s.map(t=>t+t).join("-")+"|"+s.raw.slice(0).length;}return tag`a${x}b${x}c`+"|"+x;}' },
  { feature: 'spread-template-object', input: 28, expected: '3:p,q,r:28',
    source: 'function f(x){function tag(s){return [...s];}const a=tag`p${x}q${x}r`;return a.length+":"+a.join()+":"+x;}' },
  { feature: 'join-with-undefined-cooked', input: 29, expected: 'a/|a/\\u{|2|29',
    source: 'function f(x){function tag(s){return s.join("/")+"|"+s.raw.join("/")+"|"+s.length;}return tag`a${x}\\u{`+"|"+x;}' },
  // --- evaluation order and this
  { feature: 'evaluation-order-member-getter', input: 30, expected: 'G12C:30',
    source: 'function f(x){let log="";const o={get t(){log+="G";return function(s,a,b){log+="C";return a+b;};}};const r=o.t`${(log+="1",x)}${(log+="2",0)}`;return log+":"+r;}' },
  { feature: 'member-tag-this', input: 31, expected: 'm31:true',
    source: 'function f(x){const o={t(s,v){return s[0]+v+":"+(this===o);}};return o.t`m${x}`;}' },
  { feature: 'computed-member-tag-this', input: 32, expected: 'c32:true',
    source: 'function f(x){const k="t";const o={t(s,v){return s[0]+v+":"+(this===o);}};return o[k]`c${x}`;}' },
  { feature: 'plain-tag-strict-this-undefined', input: 33, expected: 'true:33',
    source: 'function f(x){"use strict";function tag(s,v){return (this===undefined)+":"+v;}return tag`${x}`;}' },
  { feature: 'computed-key-before-template', input: 34, expected: 'kg1:34',
    source: 'function f(x){let log="";const o={get m(){log+="g";return (s,v)=>v;}};function key(){log+="k";return "m";}const r=o[key()]`${(log+="1",x)}`;return log+":"+r;}' },
  { feature: 'super-member-tag', input: 35, expected: 'sup35:true',
    source: 'function f(x){class A{t(s,v){return s[0]+v+":"+(this instanceof B);}}class B extends A{g(){return super.t`sup${x}`;}}return new B().g();}' },
  { feature: 'tag-is-bound-function', input: 36, expected: 'B:b36',
    source: 'function f(x){function tag(p,s,v){return p+":"+s[0]+v;}const b=tag.bind(null,"B");return b`b${x}`;}' },
  { feature: 'tag-via-call-and-apply-receives-object', input: 37, expected: 'true:true:37',
    source: 'function f(x){let seen;function tag(s){seen=s;return s;}const s=tag`q${x}`;const r1=tag.call(null,s)===seen;const r2=tag.apply(null,[seen])===s;return r1+":"+r2+":"+x;}' },
  { feature: 'arrow-tag-and-closure-capture', input: 38, expected: 'z:38:39',
    source: 'function f(x){const tag=(s,...v)=>s[0]+":"+v.join(":");return tag`z${x}${x+1}`;}' },
  { feature: 'new-with-tagged-member-expression', input: 39, expected: 'n:39',
    source: 'function f(x){function tag(s){return function C(){this.v=s[0];};}const o=new tag`n${x}`;return o.v+":"+x;}' },
  // --- String.raw (22.1.2.4), a guest helper executed by the GPU VM
  { feature: 'string-raw-tagged', input: 40, expected: 'p\\t40\\nq',
    source: 'function f(x){return String.raw`p\\t${x}\\nq`;}' },
  { feature: 'string-raw-invalid-escape', input: 41, expected: '\\unicode41|\\x',
    source: 'function f(x){return String.raw`\\unicode${x}|\\x`;}' },
  { feature: 'string-raw-explicit-object', input: 42, expected: 'a42b43c',
    source: 'function f(x){return String.raw({raw:["a","b","c"]},x,x+1,"ignored");}' },
  { feature: 'string-raw-fewer-substitutions', input: 43, expected: 'x43yz',
    source: 'function f(x){return String.raw({raw:"xyz"},x);}' },
  { feature: 'string-raw-array-like-raw', input: 44, expected: 'l44m|undefined',
    source: 'function f(x){return String.raw({raw:{length:2,0:"l",1:"m",2:"unused"}},x)+"|"+String.raw({raw:{length:1.9}});}' },
  { feature: 'string-raw-empty', input: 45, expected: ':45',
    source: 'function f(x){return String.raw({raw:[]},1,2)+String.raw({raw:{length:-3}})+":"+x;}' },
  { feature: 'string-raw-tostring-order', input: 46, expected: 'R:A:B|r0A46r1B46r2',
    source: 'function f(x){let log="";const lit={get length(){log+="R:";return 3;},0:"r0",1:"r1",2:"r2"};const a={toString(){log+="A:";return "A"+x;}};const b={toString(){log+="B";return "B"+x;}};const r=String.raw({raw:lit},a,b);return log+"|"+r;}' },
  { feature: 'string-raw-metadata', input: 47, expected: 'function:raw:1:47',
    source: 'function f(x){return typeof String.raw+":"+String.raw.name+":"+String.raw.length+":"+x;}' },
  { feature: 'string-raw-detached-and-bound', input: 48, expected: 'a48b|c48d',
    source: 'function f(x){const r=String.raw;const b=String.raw.bind(null,{raw:["c","d"]});return r({raw:["a","b"]},x)+"|"+b(x);}' },
  { feature: 'string-raw-cooked-unused', input: 49, expected: '\\u0041A49',
    source: 'function f(x){function cooked(s){return s[0];}return String.raw`\\u0041`+cooked`\\u0041`+x;}' },
  // --- next-wave additions: abrupt tag evaluation, recursion, fields, defaults
  { feature: 'tag-getter-throws-skips-substitutions', input: 50, expected: 'RangeError::50',
    source: 'function f(x){let log="";const o={get t(){throw new RangeError("g");}};try{o.t`a${(log+="s",x)}`;return "no";}catch(e){return e.name+":"+log+":"+x;}}' },
  { feature: 'recursive-same-site-identity', input: 51, expected: 'true:r:2:51',
    source: 'function f(x){function tag(s){return s;}function r(n){const s=tag`r${n}`;if(n===0)return s;return r(n-1)===s?s:null;}const s=r(3);return (s!==null)+":"+s[0]+":"+s.length+":"+x;}' },
  { feature: 'class-field-initializer-site', input: 52, expected: 'true:f52',
    source: 'function f(x){function tag(s){return s;}class A{t=tag`f${x}`;}return (new A().t===new A().t)+":"+new A().t[0]+x;}' },
  { feature: 'default-parameter-site', input: 53, expected: 'true:d53',
    source: 'function f(x){function tag(s){return s;}function g(a=tag`d`){return a;}return (g()===g())+":"+g()[0]+x;}' },
  { feature: 'tag-returns-template-object-not-copied', input: 54, expected: 'true:true:54',
    source: 'function f(x){let seen;function tag(s){seen=s;return s;}const r=tag`c${x}`;return (r===seen)+":"+(r.raw===seen.raw)+":"+x;}' },
];

// TypeError cases: caught in-guest (exception identity: e instanceof TypeError).
export const taggedTemplateTypeErrorCases = [
  { feature: 'strict-write-element-throws', input: 1, expected: 'TE:a:1',
    source: 'function f(x){"use strict";function tag(s){return s;}const s=tag`a${x}`;try{s[0]="z";return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+s[0]+":"+x;}}' },
  { feature: 'strict-write-length-throws', input: 2, expected: 'TE:2:2',
    source: 'function f(x){"use strict";function tag(s){return s;}const s=tag`a${x}b`;try{s.length=0;return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+s.length+":"+x;}}' },
  { feature: 'strict-add-property-throws', input: 3, expected: 'TE:undefined:3',
    source: 'function f(x){"use strict";function tag(s){return s;}const s=tag`a`;try{s.raw.extra=1;return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+s.raw.extra+":"+x;}}' },
  { feature: 'strict-delete-throws', input: 4, expected: 'TE:true:4',
    source: 'function f(x){"use strict";function tag(s){return s;}const s=tag`a${x}`;try{delete s.raw;return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+Array.isArray(s.raw)+":"+x;}}' },
  { feature: 'strict-raw-assignment-throws', input: 5, expected: 'TE:q:5',
    source: 'function f(x){"use strict";function tag(s){return s;}const s=tag`q`;try{s.raw[0]="z";return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+s.raw[0]+":"+x;}}' },
  { feature: 'define-property-on-frozen-throws', input: 6, expected: 'TE:a:6',
    source: 'function f(x){function tag(s){return s;}const s=tag`a`;try{Object.defineProperty(s,0,{value:"b"});return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+s[0]+":"+x;}}' },
  { feature: 'push-on-frozen-throws', input: 7, expected: 'TE:1:7',
    source: 'function f(x){function tag(s){return s;}const s=tag`a`;try{s.push("b");return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+s.length+":"+x;}}' },
  { feature: 'non-callable-tag-after-substitutions', input: 8, expected: 'TE:s8',
    source: 'function f(x){let log="";const t=1;try{t`a${(log+="s",x)}`;return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+log+x;}}' },
  { feature: 'undefined-member-tag', input: 9, expected: 'TE:G9',
    source: 'function f(x){let log="";const o={get t(){log+="G";return undefined;}};try{o.t`a${x}`;return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+log+x;}}' },
  { feature: 'string-raw-undefined-template', input: 10, expected: 'TE:10',
    source: 'function f(x){try{String.raw(undefined,x);return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+x;}}' },
  { feature: 'string-raw-missing-raw-property', input: 11, expected: 'TE:11',
    source: 'function f(x){try{String.raw({},x);return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+x;}}' },
  { feature: 'string-raw-not-a-constructor', input: 12, expected: 'TE:12',
    source: 'function f(x){try{new String.raw({raw:[]});return "no";}catch(e){return (e instanceof TypeError?"TE":"other")+":"+x;}}' },
];

// Uncaught TypeError: the GPU run must end with status 4 (TypeError).
export const taggedTemplateThrowCases = [
  { feature: 'uncaught-strict-frozen-write', input: 1, throws: true, expected: 'TypeError',
    source: 'function f(x){"use strict";function tag(s){return s;}tag`a${x}`[0]="b";return x;}' },
  { feature: 'uncaught-non-callable-tag', input: 2, throws: true, expected: 'TypeError',
    source: 'function f(x){const o={};return o.missing`a${x}`;}' },
];

// Admitted, but the GPU run must report status 6 (Unsupported runtime
// operation): reflective String constructor queries have no String backing
// object. Sloppy tag this-binding is covered by the admitted global fixtures.
export const taggedTemplateUnsupportedCases = [
  { outcome: "value", expected: "q2", feature: 'symbol-in-tag', input: 2, normative: 'q2',
    source: 'function f(x){function tag(s){return [...s][Symbol.iterator]?s[0]+x:"no";}return tag`q`;}' },

  { feature: 'string-raw-own-descriptor', input: 1, expectedStatus: 6, normative: 'true:1',
    source: 'function f(x){return Object.getOwnPropertyDescriptor(String,"raw").writable+":"+x;}' },
  { feature: 'string-raw-in-operator', input: 2, expectedStatus: 6, normative: 'true:2',
    source: 'function f(x){return ("raw" in String)+":"+x;}' },
  // Dynamic code: a template site inside a Function-constructor body is a
  // separate parse sharing the realm [[TemplateMap]]; the Function
  // constructor itself (builtin 500) is a runtime status 6 boundary.
  { feature: 'function-constructor-template-site', input: 4, expectedStatus: 6, normative: 'a4',
    source: 'function f(x){return Function("return (s=>s)`a`")()[0]+x;}' },
];

// Explicit resource limits. `stage: 'pack'` cases throw RangeError from
// packProgram (no GPU run); `normative` is the ECMAScript value.
export const taggedTemplateLimitCases = [
  { feature: 'more-than-15-substitutions', input: 1, stage: 'pack', reason: /GPU tagged template limit/, normative: 17,
    source: 'function f(x){function tag(s){return s.length;}return tag`${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}${x}`+x-1;}' },
  { feature: 'template-string-over-256-units', input: 2, stage: 'pack', reason: /GPU string limit/, normative: 259,
    source: `function f(x){function tag(s){return s.raw[0].length;}return tag\`${'r'.repeat(257)}\`+x;}` },
];

// Compiler-rejected tagged forms (SyntaxError from packProgram).
export const taggedTemplateRejectedCases = [
  { feature: 'eval-tag', input: 1, reason: /Unsupported global or module reference: eval/, normative: '11',
    source: 'function f(x){return eval`1`+x;}' },
];

// Early errors (ES2025 13.3.1.1 OptionalChain with TemplateLiteral; 13.2.8.1
// NotEscapeSequence only allowed in tagged templates): SyntaxError at parse
// time in V8, native QuickJS and the GPU compiler path (packProgram).
export const taggedTemplateEarlyErrorCases = [
  { feature: 'optional-chain-member-tag', source: 'function f(x){const o={t(s){return s;}};return o?.t`a${x}`;}' },
  { feature: 'optional-chain-direct-tag', source: 'function f(x){const t=s=>s;return t?.`a`;}' },
  { feature: 'optional-chain-nested-member-tag', source: 'function f(x){const o={a:{b(s){return s;}}};return o?.a.b`x`;}' },
  { feature: 'optional-call-then-tag', source: 'function f(x){const g=()=>s=>s;return g?.()`x`;}' },
  { feature: 'untagged-invalid-unicode-escape', source: 'function f(x){return `\\unicode${x}`;}' },
  { feature: 'untagged-invalid-octal-escape', source: 'function f(x){return `\\01${x}`;}' },
];

// Tagged sources in older corpora that were compiler-rejected before this
// change and are admitted afterwards (lead updates those suites on integration).
export const taggedTemplateFormerlyRejected = [
  { file: 'boxing-cases.js', list: 'boxingCompilerRejectedSources' },
  { file: 'string-extract-cases.js', list: 'stringExtractCompilerRejectedSources' },
  { file: 'template-cases.js', list: 'templateRejectedCases' },
  { file: 'phase4-regression-cases.js', list: 'phase4ExplicitUnsupportedCases', features: ['unsupported-tagged-template', 'unsupported-string-raw'] },
];
