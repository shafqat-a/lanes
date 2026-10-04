// Phase 4 worker 2 fixtures: rest parameters and spread (calls, method calls,
// `new`, array literals). `expected` values are fixed ECMAScript results; the
// V8 and native QuickJS oracles in check-phase4-spread.mjs only confirm them.
// `dependsOn` lists opcodes owned by other workers that a case needs (none of
// these cases needs any). GPU execution additionally needs worker 4's
// iteration builtins (1270-1273) for every case that emits `append`.
const listArgs = `function g(){let s="";for(let i=0;i<arguments.length;i++)s+=arguments[i]+",";return s;}`;

export const spreadCases = [
  // Rest parameters.
  { feature: 'rest-basic', input: 1, expected: '1:2:2:3',
    source: `function f(x){function g(a,...r){return a+":"+r.length+":"+r[0]+":"+r[1];}return g(x,x+1,x+2);}` },
  { feature: 'rest-function-length-excludes-rest', input: 5, expected: 1205,
    source: `function f(x){function g(a,...r){return r;}const r=g(1,2,3);return g.length*1000+r.length*100+x;}` },
  { feature: 'rest-empty-is-array', input: 3, expected: 'true:0:3:true',
    source: `function f(x){function g(a,b,...r){return Array.isArray(r)+":"+r.length+":"+a+":"+(b===undefined);}return g(x);}` },
  { feature: 'rest-arguments-unmapped-and-unaffected', input: 4, expected: '3:4:8:99:7',
    source: `function f(x){function g(a,...r){r[0]=99;a=7;return arguments.length+":"+arguments[0]+":"+arguments[1]+":"+r[0]+":"+a;}return g(x,x*2,x*3);}` },
  { feature: 'rest-arrow', input: 6, expected: 36,
    source: `function f(x){const g=(...r)=>r.length*10+r[r.length-1];return g(1,2,x);}` },
  { feature: 'rest-with-default-parameter', input: 3, expected: 86,
    source: `function f(x){function g(a=x*2,...r){return a+r.length;}return g()+g(undefined,1,2)*10;}` },
  { feature: 'rest-is-fresh-mutable-array', input: 9, expected: '4:18:3',
    source: `function f(x){function g(...r){r.push(x);return r;}const a=g(5,6,7);const b=g();return a.length+":"+a[3]*2+":"+(b.length+2);}` },
  { feature: 'rest-skips-declared-only', input: 2, expected: '0|4|3',
    source: `function f(x){function g(a,b,c,...r){return r.length;}function h(a,...r){return r.length+r[0];}return g(1,2)+"|"+h(1,x,3)+"|"+h(x,x);}` },

  // Spread calls.
  { feature: 'spread-call-basic', input: 1, expected: 127,
    source: `function f(x){function g(a,b,c){return a*100+b*10+c;}const a=[x,x+1];return g(...a,7);}` },
  { feature: 'spread-call-mixed-positions', input: 3, expected: '1,3,4,5,9,',
    source: `function f(x){${listArgs}return g(1,...[x],...[x+1,x+2],9);}` },
  { feature: 'spread-call-empty', input: 5, expected: 'n0:5',
    source: `function f(x){function g(){return arguments.length;}return "n"+g(...[])+":"+g(...[],...[x])*x;}` },
  { feature: 'spread-call-holes-become-undefined', input: 2, expected: 'true/2;true/undefined;true/4;',
    source: `function f(x){function g(){let s="";for(let i=0;i<arguments.length;i++)s+=(i in arguments)+"/"+arguments[i]+";";return s;}return g(...[x,,x+2]);}` },
  { feature: 'spread-call-inherited-index-getters-in-order', input: 2, expected: '2|6|8|g1g2',
    source: `function f(x){let log="";Object.defineProperty(Array.prototype,"1",{get:function(){log+="g1";return x*3;},configurable:true});Object.defineProperty(Array.prototype,"2",{get:function(){log+="g2";return x*4;},configurable:true});function g(a,b,c){return a+"|"+b+"|"+c;}const a=[x];a.length=3;const r=g(...a);delete Array.prototype[1];delete Array.prototype[2];return r+"|"+log;}` },
  { feature: 'spread-call-own-getters-in-order-after-callee', input: 2, expected: 'm01c6',
    source: `function f(x){let log="";const o={get m(){log+="m";return function(a,b){log+="c";return a+b;};}};const a=[];Object.defineProperty(a,"0",{get:function(){log+="0";return x;},enumerable:true,configurable:true});Object.defineProperty(a,"1",{get:function(){log+="1";return 2*x;},enumerable:true,configurable:true});const r=o.m(...a);return log+r;}` },
  { feature: 'spread-call-callee-before-arguments', input: 4, expected: 'FAB:3:4',
    source: `function f(x){let log="";function get(){log+="F";return function(){return arguments.length+":"+arguments[1];};}const r=get()((log+="A",x),...(log+="B",[x,x]));return log+":"+r;}` },
  { feature: 'spread-call-getter-throw-propagates', input: 3, expected: 'thrown3:0',
    source: `function f(x){let calls=0;function g(){calls++;return 1;}const a=[1,2];Object.defineProperty(a,"1",{get:function(){throw "thrown"+x;}});try{g(...a);return "none";}catch(e){return e+":"+calls;}}` },
  { feature: 'spread-arguments-object', input: 2, expected: 11,
    source: `function f(x){function h(a,b,c){return a*b+c;}function g(){return h(...arguments);}return g(x,x+1,5);}` },
  { feature: 'spread-string-code-points', input: 5, expected: '3:2:56320:5',
    source: `function f(x){function g(){return arguments.length+":"+arguments[0].length+":"+arguments[1].charCodeAt(0)+":"+arguments[2];}return g(..."\\uD83D\\uDE00\\uDC00"+x);}` },
  { feature: 'spread-string-wrapper', input: 7, expected: 'a|b|7',
    source: `function f(x){function g(a,b,c){return a+"|"+b+"|"+c;}return g(...new String("ab"),x);}` },
  { feature: 'spread-nested', input: 3, expected: 43,
    source: `function f(x){function g(){return arguments.length;}function h(...r){return [...r,...[...r]];}return g(...h(x,x))*10+h(x)[1];}` },
  { feature: 'spread-new', input: 5, expected: '15:true',
    source: `function f(x){function P(a,b){this.s=a+b;}const p=new P(...[x],10);return p.s+":"+(p instanceof P);}` },
  { feature: 'spread-new-return-override', input: 8, expected: 'o8',
    source: `function f(x){function P(a){return {v:"o"+a};}return new P(...[x]).v;}` },
  { feature: 'spread-method-this', input: 3, expected: 312,
    source: `function f(x){const o={k:x,m:function(a,b){return this.k*100+a*10+b;}};return o.m(...[1,2]);}` },
  { feature: 'spread-computed-method-this', input: 6, expected: 'true:66',
    source: `function f(x){const o={m:function(a,b){return (this===o)+":"+a+b;}};const k="m";return o[k](...[x],x);}` },
  { feature: 'spread-plain-call-this-undefined', input: 1, expected: 'undefined1',
    source: `function f(x){"use strict";function g(a){return typeof this+a;}return g(...[x]);}` },
  { feature: 'spread-function-call-wrapper', input: 1, expected: 'w6',
    source: `function f(x){function g(a){return "w"+(this.v+a);}return g.call(...[{v:x},5]);}` },
  { feature: 'spread-builtin-push', input: 4, expected: 305,
    source: `function f(x){const a=[1];const n=a.push(...[x,x+1]);return n*100+a[2];}` },
  { feature: 'spread-array-constructor', input: 3, expected: 'A3:2',
    source: `function f(x){return "A"+Array(...[x]).length+":"+Array(...[x,x]).length;}` },
  { feature: 'spread-mutation-push-extends-iteration', input: 7, expected: '3:7',
    source: `function f(x){const a=[1,2];Object.defineProperty(a,"1",{get:function(){if(a.length<3)a.push(x);return 2;},configurable:true});function g(){return arguments.length+":"+arguments[arguments.length-1];}return g(...a);}` },
  { feature: 'spread-mutation-shrink-stops-iteration', input: 11, expected: 'len1:11',
    source: `function f(x){const a=[0,1,2];Object.defineProperty(a,"0",{get:function(){a.length=1;return x;},configurable:true});const b=[...a];return "len"+b.length+":"+b[0];}` },

  // Spread in array literals.
  { feature: 'array-literal-spread', input: 1, expected: '012129:6',
    source: `function f(x){const a=[x,x+1];const b=[0,...a,...a,9];let s="";for(let i=0;i<b.length;i++)s+=b[i];return s+":"+b.length;}` },
  { feature: 'array-literal-spread-then-hole', input: 4, expected: '3:false:5',
    source: `function f(x){const b=[...[x],,x+1,];return b.length+":"+(1 in b)+":"+b[2];}` },
  { feature: 'array-literal-spread-trailing-hole-length', input: 6, expected: '3:6:false',
    source: `function f(x){const b=[...[x,x],,];return b.length+":"+b[1]+":"+(2 in b);}` },
  { feature: 'array-literal-spread-fills-holes', input: 8, expected: 'true:3:8',
    source: `function f(x){const b=[...[x,,x]];return (1 in b)+":"+b.length+":"+b[2];}` },
  { feature: 'array-literal-spread-copy-is-fresh', input: 2, expected: '2:9:2',
    source: `function f(x){const a=[x];const b=[...a];b[0]=9;return a[0]+":"+b[0]+":"+(a!==b?2:0);}` },
  { feature: 'array-literal-spread-ignores-prototype-setter', input: 5, expected: 'set0:5',
    source: `function f(x){let hits=0;Object.defineProperty(Array.prototype,"0",{set:function(v){hits++;},configurable:true});const b=[...[x]];delete Array.prototype[0];return "set"+hits+":"+b[0];}` },
  { feature: 'array-literal-spread-string', input: 2, expected: '4:2',
    source: `function f(x){const b=[..."ab\\uD83D\\uDE00",...""+x];return b.length+":"+b[3];}` },
  { feature: 'array-literal-spread-elements-are-data', input: 3, expected: 'true:true:true:3',
    source: `function f(x){const b=[...[x]];const d=Object.getOwnPropertyDescriptor(b,"0");return d.writable+":"+d.enumerable+":"+d.configurable+":"+d.value;}` },
];

// Spread of null/undefined: GetIterator throws a catchable TypeError.
export const spreadTypeErrorCases = [
  { feature: 'spread-call-null-typeerror', input: 1, expected: 'true:null1',
    source: `function f(x){function g(){return 1;}try{g(...null);return "no";}catch(e){return (e instanceof TypeError)+":null"+x;}}` },
  { feature: 'array-literal-spread-undefined-typeerror', input: 2, expected: 'true:undef2',
    source: `function f(x){try{const b=[1,...undefined];return "no"+b.length;}catch(e){return (e instanceof TypeError)+":undef"+x;}}` },
  { feature: 'spread-typeerror-after-callee-and-earlier-args', input: 3, expected: 'cab:true:3',
    source: `function f(x){let log="";function g(){log+="g";return 1;}try{(log+="c",g)((log+="a",x),...(log+="b",undefined));}catch(e){return log+":"+(e instanceof TypeError)+":"+x;}return "no";}` },
  { feature: 'spread-new-null-typeerror', input: 4, expected: 'false:true:4',
    source: `function f(x){let made=false;function P(){made=true;}try{new P(...null);}catch(e){return made+":"+(e instanceof TypeError)+":"+x;}return "no";}` },
];

// Historical export retained for stable suite IDs. Missing @@iterator now
// throws guest TypeError, caught by each unchanged source.
export const spreadUnsupportedCases = [
  { outcome: "value", expected: "TypeError1", feature: 'spread-plain-object', input: 1, oracle: 'TypeError1',
    source: `function f(x){function g(){return 0;}try{return g(...{a:x});}catch(e){return e.name+x;}}` },
  { outcome: "value", expected: "TypeError2", feature: 'spread-array-like-object', input: 2, oracle: 'TypeError2',
    source: `function f(x){try{const b=[...{length:1,0:x}];return b.length;}catch(e){return e.name+x;}}` },
  { outcome: "value", expected: "TypeError3", feature: 'spread-number', input: 3, oracle: 'TypeError3',
    source: `function f(x){function g(){return 0;}try{return g(...x);}catch(e){return e.name+x;}}` },
  { outcome: "value", expected: "TypeError4", feature: 'spread-function-object', input: 4, oracle: 'TypeError4',
    source: `function f(x){function g(){return 0;}try{return [...g].length;}catch(e){return e.name+x;}}` },
];

// More than LIMITS.args (16) spread arguments: explicit resource limit (status 3).
export const spreadResourceCases = [
  { feature: 'spread-call-17-arguments', input: 1, outcome: 'resource', oracle: 17,
    source: `function f(x){function g(){return arguments.length;}const a=[];for(let i=0;i<16+x;i++)a.push(i);return g(...a);}` },
  { feature: 'spread-new-17-arguments', input: 1, outcome: 'resource', oracle: 18,
    source: `function f(x){function P(){this.n=arguments.length;}const a=[];for(let i=0;i<16+x;i++)a.push(i);return new P(...a,0).n;}` },
];
