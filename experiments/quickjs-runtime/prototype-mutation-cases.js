export const prototypeMutationCases=[
 ['ordinary-write',`let o={},p={v:x};Object.setPrototypeOf(o,p);return o.v===x&&Object.getPrototypeOf(o)===p;`],
 ['function-setter',`function g(){}const p={v:x};g.__proto__=p;return g.v===x&&Object.getPrototypeOf(g)===p;`],
 ['self-cycle',`const o={};try{Object.setPrototypeOf(o,o);return false;}catch(e){return e instanceof TypeError&&Object.getPrototypeOf(o)===Object.prototype;}`],
 ['transitive-cycle',`const a={},b={},c={};Object.setPrototypeOf(a,b);Object.setPrototypeOf(b,c);try{Object.setPrototypeOf(c,a);return false;}catch(e){return e instanceof TypeError&&Object.getPrototypeOf(c)===Object.prototype;}`],
 ['setter-cycle',`const a={},b={};a.__proto__=b;try{b.__proto__=a;return false;}catch(e){return e instanceof TypeError;}`],
 ['reflect-cycle-false',`const a={},b={};return Reflect.setPrototypeOf(a,b)&&!Reflect.setPrototypeOf(b,a);`],
 ['nonextensible',`const o={};Object.preventExtensions(o);let threw=false;try{Object.setPrototypeOf(o,{});}catch(e){threw=e instanceof TypeError;}return threw&&Object.setPrototypeOf(o,Object.prototype)===o;`],
 ['immutable',`let threw=false;try{Object.setPrototypeOf(Object.prototype,{});}catch(e){threw=e instanceof TypeError;}return threw&&Object.setPrototypeOf(Object.prototype,null)===Object.prototype;`],
 ['primitive-object-api',`let threw=false;try{Object.setPrototypeOf(3,7);}catch(e){threw=e instanceof TypeError;}return threw&&Object.setPrototypeOf(3,{})===3;`],
 ['nullish-before-invalid',`try{Object.setPrototypeOf(null,3);return false;}catch(e){return e instanceof TypeError;}`],
 ['setter-primitive',`const set=Object.getOwnPropertyDescriptor(Object.prototype,'__proto__').set;return set.call(3,{})===undefined&&set.call({},3)===undefined;`],
 ['setter-nullish',`const set=Object.getOwnPropertyDescriptor(Object.prototype,'__proto__').set;try{set.call(null,3);return false;}catch(e){return e instanceof TypeError;}`],
 ['function-parent',`function p(){}const o={};return Object.setPrototypeOf(o,p)===o&&Object.getPrototypeOf(o)===p;`],
 ['retained-chain-gc',`const a={},b={},c={v:x};Object.setPrototypeOf(a,b);for(let i=0;i<1000;i++){const q={i:i};}Object.setPrototypeOf(b,c);return a.v===x&&Object.getPrototypeOf(a)===b;`]
].map(([name,body])=>({name,feature:name,source:`function f(x){${body}}`,input:7,expected:true,budgets:name==='retained-chain-gc'?[31,4096]:[1,4096],requiresGC:name==='retained-chain-gc'}));
