export const promiseSpeciesAbsenceCases=[
 {feature:'concat-inherited-object-species',source:'function f(x){const a=[,x];Object.setPrototypeOf(a,{0:7,concat:Array.prototype.concat});return a.concat()[0];}',expected:7},
 {feature:'object-species-absent',source:'function f(x){return Object[Symbol.species]===undefined;}',expected:true},
 {feature:'object-species-inherited-getter',source:'function f(x){let n=0;Object.defineProperty(Function.prototype,Symbol.species,{get(){n++;return x;},configurable:true});return Object[Symbol.species]===x&&n===1;}',expected:true},
 {feature:'finally-generic-object-constructor',source:'function f(x){const o={then(a,b){return typeof a+":"+typeof b+":"+a.length;}};return Promise.prototype.finally.call(o,()=>{})+":"+x;}',expected:'function:function:1:3',expectedNext:'function:function:1:4'},
 {feature:'resolve-object-constructor-mismatch',source:'function f(x){let n=0;const p=Promise.resolve(x);Object.defineProperty(p,"constructor",{get(){n++;return Object;}});const q=Promise.resolve(p);const n1=n;return q.then(v=>n1+":"+(q===p)+":"+v+":"+n);}',expected:'1:false:3:2',expectedNext:'1:false:4:2',settlement:'fulfilled'}
].map(c=>({...c,input:3,budgets:[1,4096]}));
