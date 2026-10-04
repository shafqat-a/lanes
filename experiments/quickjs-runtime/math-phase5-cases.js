import {numericPhase5Metadata,numberPhase5Constants,mathPhase5Constants} from './math-phase5-metadata.js';
export const mathPhase5Inputs=[NaN,Infinity,-Infinity,-0,0,5e-324,-5e-324,-1.5,-1,-0.5000000000000001,-0.5,-0.49999999999999994,0.49999999999999994,0.5,0.5000000000000001,1.5,1048575.9999999999,1048576.5,4294967295.5,4503599627370495.5,4503599627370496,9007199254740991,9007199254740992];
export const mathPhase5Cases=[
 {feature:'Math-inherited-tag',source:'function f(x){return Object.prototype.toString.call(Math)+":"+Object.prototype.toString.call(Object.create(Math));}',inputs:[3]},
 {feature:'Math-not-callable-or-constructible',source:'function f(x){let n=0;try{Math();}catch(e){if(e instanceof TypeError)n++;}try{new Math();}catch(e){if(e instanceof TypeError)n++;}return n;}',inputs:[3]},
 {feature:'numeric-property-descriptors',source:'function f(x){const a=Object.getOwnPropertyDescriptor(Math,"PI"),b=Object.getOwnPropertyDescriptor(Number,"EPSILON"),c=Object.getOwnPropertyDescriptor(Number,"isFinite");return a.writable+":"+a.enumerable+":"+a.configurable+":"+b.writable+":"+b.configurable+":"+c.writable+":"+c.enumerable+":"+c.configurable;}',inputs:[3]},
 {feature:'numeric-intrinsic-GC-roots',source:'function f(x){const m=Math,n=Number;function read(){return m.floor(x+0.5)+":"+n.isSafeInteger(x)+":"+(m===Math)+":"+(n===Number);}for(let i=0;i<400;i++){({n:i});}return read();}',inputs:[3]},
 ...numericPhase5Metadata.filter(m=>!["min","max"].includes(m.name)).map(m=>({feature:m.owner+"."+m.name+"-missing-arguments",source:`function f(x){return ${m.owner}.${m.name}();}`,inputs:[3]})),
 ...numericPhase5Metadata.filter(m=>m.length===1).map(m=>({feature:m.owner+'.'+m.name,source:`function f(x){return ${m.owner}.${m.name}(x);}`,inputs:mathPhase5Inputs})),
 ...['min','max'].flatMap(name=>[
  {feature:name+'-zero',source:`function f(x){return Math.${name}(-0,0,x);}`,inputs:mathPhase5Inputs},
  {feature:name+'-no-arguments',source:`function f(x){return Math.${name}();}`,inputs:[3]},
  {feature:name+'-reverse-zero',source:`function f(x){return Math.${name}(0,-0);}`,inputs:[3]},
  {feature:name+'-NaN',source:`function f(x){return Math.${name}(x,NaN,1);}`,inputs:[3]},
 ]),
 {feature:'pow-exact',source:'function f(x){return Math.pow(-2,x);}',inputs:[-3,-1,-0,0,.5,1,2,3,Infinity,NaN]},
 {feature:'pow-zero',source:'function f(x){return Math.pow(-0,x);}',inputs:[-3,-2,-1,-0,0,.5,1,2,3,Infinity,NaN]},
 {feature:'pow-NaN-zero',source:'function f(x){return Math.pow(NaN,0);}',inputs:[3]},
 ...numericPhase5Metadata.map(m=>({feature:m.owner+'.'+m.name+'-metadata',source:`function f(x){return ${m.owner}.${m.name}.name+":"+${m.owner}.${m.name}.length;}`,inputs:[3]})),
 ...Object.entries({Number:numberPhase5Constants,Math:mathPhase5Constants}).flatMap(([owner,constants])=>Object.keys(constants).map(name=>({feature:owner+'.'+name,source:`function f(x){return ${owner}.${name};}`,inputs:[3]}))),
 ...['isFinite','isNaN','isInteger','isSafeInteger'].map(name=>({feature:name+'-no-coercion',source:`function f(x){let called=0;const o={valueOf(){called++;throw x;}};return Number.${name}(o)+":"+Number.${name}(new Number(1))+":"+Number.${name}("1")+":"+Number.${name}(null)+":"+called;}`,inputs:[3]})),
 {feature:'min-coerce-all-after-NaN',source:'function f(x){let s="";function n(k,v){return {valueOf(){s+=k;return v;}};}const r=Math.min(n("a",NaN),n("b",2),n("c",1));return s+":"+Number.isNaN(r);}',inputs:[3]},
 {feature:'max-throw-after-NaN',source:'function f(x){let s="";try{Math.max({valueOf(){s+="a";return NaN;}},{valueOf(){s+="b";throw x;}},{valueOf(){s+="c";return 1;}});}catch(e){return s+":"+(e===x);}return "bad";}',inputs:[3]},
 {feature:'pow-coercion-order',source:'function f(x){let s="";const r=Math.pow({valueOf(){s+="a";return "2";}},{valueOf(){s+="b";return x;}});return s+":"+r;}',inputs:[3]},
 {feature:'round-fallback-coercion',source:'function f(x){let s="";const r=Math.round({valueOf(){s+="v";return {};},toString(){s+="t";return "-0.5";}});return s+":"+Object.is(r,-0);}',inputs:[3]},
 {feature:'constant-immutable',source:'function f(x){"use strict";let n=0;try{Number.EPSILON=1;}catch(e){if(e instanceof TypeError)n++;}try{Math.PI=1;}catch(e){if(e instanceof TypeError)n++;}return n;}',inputs:[3]},
 {feature:'Math-identity',source:'function f(x){return typeof Math+":"+(Object.getPrototypeOf(Math)===Object.prototype)+":"+(Math===Math);}',inputs:[3]},
 {feature:'borrowed-methods',source:'function f(x){return Math.floor.call(null,-1.2)+":"+Math.max.apply(null,[-0,0,3])+":"+Number.isFinite.bind(null,1)();}',inputs:[3]},
];
export const mathPhase5ResumptionSource='function f(x){let s="";const a={get valueOf(){s+="g";return function(){s+="a";return -1.5;};}};const b={valueOf(){s+="b";return x;}};const r=Math.max(Math.round(a),Math.pow(2,b));return s+":"+r+":"+Object.is(Math.ceil(-0.1),-0);}';
export const mathPhase5ResumptionExpected='gab:8:true';
export const mathPhase5UnsupportedSources=['function f(x){try{return Math.random()+x;}catch(e){return "wrong guest catch";}}'];
