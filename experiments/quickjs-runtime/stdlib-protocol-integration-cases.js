export const stdlibProtocolIntegrationCases=Object.freeze([
 {id:'original-validation-array-from-boundary',inputs:[3,4],source:'function f(x){return Array.from([x]).length;}'},
 {id:'original-math-phase5-sin-boundary',inputs:[3,4],source:'function f(x){try{return Math.sin(x);}catch(e){return "wrong guest catch";}}'},
 {id:'original-validation-sin-boundary',inputs:[3,4],source:'function f(x){return Math.sin(x);}'},

 {id:'reflect-symbol-bigint-construct-throws-after-list',inputs:[3],source:'function f(x){let n=0,caught=0;const args={get length(){n++;return 0;}};try{Reflect.construct(Symbol,args);}catch(e){if(e instanceof TypeError)caught++;}try{Reflect.construct(BigInt,args);}catch(e){if(e instanceof TypeError)caught++;}return caught+":"+n;}'},
 {id:'map-iterator-getter-once',inputs:[3,4],source:'function f(x){let gets=0;const iterable={get [Symbol.iterator](){gets++;return function(){return [["k",x]][Symbol.iterator]();};}};const m=new Map(iterable);return gets+":"+m.get("k");}'},
 {id:'set-iterator-getter-once',inputs:[3,4],source:'function f(x){let gets=0;const iterable={get [Symbol.iterator](){gets++;return function(){return [x][Symbol.iterator]();};}};const s=new Set(iterable);return gets+":"+s.has(x);}'},
 {id:'map-adder-before-iterator-get',inputs:[3],source:'function f(x){let log="";const old=Object.getOwnPropertyDescriptor(Map.prototype,"set");Object.defineProperty(Map.prototype,"set",{configurable:true,get(){log+="a";return old.value;}});try{const iterable={get [Symbol.iterator](){log+="i";return function(){return [[1,x]][Symbol.iterator]();};}};const m=new Map(iterable);return log+":"+m.get(1);}finally{Object.defineProperty(Map.prototype,"set",old);}}'},
 {id:'map-set-shared-iterator-prototype',inputs:[3],source:'function f(x){const p=Object.getPrototypeOf(Object.getPrototypeOf([].values()));return (Object.getPrototypeOf(Object.getPrototypeOf(new Map().keys()))===p)+":"+(Object.getPrototypeOf(Object.getPrototypeOf(new Set().keys()))===p);}'},
 {id:'reflect-array-length-strict-bigint',inputs:[3],source:'function f(x){const a=[];try{Reflect.defineProperty(a,"length",{value:1n});}catch(e){return (e instanceof TypeError)+":"+a.length;}return "wrong";}'},
 {id:'numeric-exotic-number-hint',inputs:[3],source:'function f(x){let log="";const o={[Symbol.toPrimitive](h){log=h;return 4;}};return Math.sqrt(o)+":"+log;}'},
]);
