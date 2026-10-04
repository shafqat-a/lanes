export const objectCopyCases=[
 ['entries-order',`const o={b:2,2:3,1:4,a:5};return Object.entries(o).join('|');`,'1,4|2,3|b,2|a,5'],
 ['entries-mutation',`const o={get a(){delete this.b;this.c=3;return 1;},b:2};return Object.entries(o).join('|');`,'a,1'],
 ['entries-symbols',`const s=Symbol();return Object.entries({a:1,[s]:2}).join();`,'a,1'],
 ['entries-string',`return Object.entries('ab').join('|');`,'0,a|1,b'],
 ['assign-setter-order',`let log='';const o={set a(v){log+='s'+v;}};Object.assign(o,{get a(){log+='g';return 3;}});return log;`,'gs3'],
 ['assign-symbol',`const s=Symbol();const o=Object.assign({},null,undefined,{[s]:x,a:2});return o[s]+o.a;`,9],
 ['assign-failure-prefix',`const o={};Object.defineProperty(o,'b',{value:0});try{Object.assign(o,{a:1,b:2,c:3});}catch(e){return e instanceof TypeError&&o.a===1&&!('c'in o);}return false;`,true],
 ['assign-throw-identity',`const token={};try{Object.assign({},{get a(){throw token;}});}catch(e){return e===token;}return false;`,true],
 ['assign-prototype-setter',`const p={v:4},s={};Object.defineProperty(s,'__proto__',{value:p,enumerable:true});const o=Object.assign({},s);return o.v===4&&!Object.hasOwn(o,'__proto__');`,true],
 ['map-ownkeys',`return Reflect.ownKeys(Map).filter(k=>typeof k==='string').sort().join();`,'groupBy,length,name,prototype'],
 ['set-ownkeys',`return Object.getOwnPropertyNames(Set).sort().join();`,'length,name,prototype'],
 ['map-nonconstructor',`let n=0;for(const k of ['get','set','has']){try{new Map.prototype[k]();}catch(e){if(e instanceof TypeError)n++;}}return n+':'+Object.hasOwn(Map.prototype.get,'prototype');`,'3:false'],
 ['numeric-nonconstructor',`let n=0;try{new Math.sqrt(4);}catch(e){if(e instanceof TypeError)n++;}try{new isNaN(1);}catch(e){if(e instanceof TypeError)n++;}return n+':'+('prototype' in Math.sqrt)+':'+('prototype' in isFinite);`,'2:false:false'],
 ['inherited-prototype',`Function.prototype.prototype=7;return ('prototype' in Math.sqrt)+':'+Math.sqrt.prototype+':'+Object.hasOwn(Math.sqrt,'prototype');`,'true:7:false'],
 ['collection-keys',`const m=new Map([[1,2]]),s=new Set([3]);m.p=4;return Object.entries(m).join()+':'+Object.keys(Object.assign({},s)).length;`,'p,4:0']
].map(([feature,body,expected])=>({feature,name:feature,source:`function f(x){${body}}`,input:7,expected,budgets:[1,4096]}));
