// Differential fixtures return primitives so the GPU boundary remains explicit.
export const objectOperationSources = [
  `function f(x){const k=Object.getOwnPropertyNames(Array.prototype);let constructor=0;let length=0;let at=0;for(let i=0;i<k.length;i++){if(k[i]==="constructor")constructor++;if(k[i]==="length")length++;if(k[i]==="at")at++;}const d=Object.getOwnPropertyDescriptor(Array.prototype,"constructor");return k.length+":"+constructor+":"+length+":"+at+":"+(d.value===Array&&d.writable&&!d.enumerable&&d.configurable);}`,
  `function f(x){const k=Object.getOwnPropertyNames(Object.prototype);let constructor=0;let proto=0;let legacy=0;for(let i=0;i<k.length;i++){if(k[i]==="constructor")constructor++;if(k[i]==="__proto__")proto++;if(k[i]==="__defineGetter__"||k[i]==="__defineSetter__"||k[i]==="__lookupGetter__"||k[i]==="__lookupSetter__")legacy++;}return k.length+":"+constructor+":"+proto+":"+legacy;}`,
  `function f(x){const o={b:1,10:2,a:3,2:4};const k=Object.keys(o);return k.length+":"+k[0]+","+k[1]+","+k[2]+","+k[3];}`,
  `function f(x){const o={a:1,b:2};delete o.a;o.a=3;Object.defineProperty(o,"b",{value:4});const k=Object.keys(o);return k[0]+k[1];}`,
  `function f(x){let calls=0;const o=Object.create({inherited:1});Object.defineProperty(o,"hidden",{value:2});Object.defineProperty(o,"visible",{get:function(){calls++;return 3;},enumerable:true});const a=Object.getOwnPropertyNames(o);const b=Object.keys(o);return a.length+":"+a[0]+":"+a[1]+":"+b[0]+":"+calls;}`,
  `function f(x){const a=[1,,3];a.z=4;const k=Object.getOwnPropertyNames(a);return k.length+":"+k[0]+":"+k[1]+":"+k[2]+":"+k[3];}`,
  `function f(x){const a=[1,,3];a.z=4;const k=Object.keys(a);return k.length+":"+k[0]+":"+k[1]+":"+k[2];}`,
  `function f(x){"use strict";function g(a,b){}g.extra=1;const k=Object.getOwnPropertyNames(g);return k.length+":"+k[0]+":"+k[1]+":"+k[2]+":"+k[3];}`,
  `function f(x){"use strict";function g(a,b){}const h=g.bind(null);const k=Object.getOwnPropertyNames(h);return k.length+":"+k[0]+":"+k[1];}`,
  `function f(x){const k=Object.getOwnPropertyNames("abc");return k.length+":"+k[0]+":"+k[2]+":"+k[3];}`,
  `function f(x){return Object.keys(1).length+Object.keys(true).length+Object.keys("ab").length;}`,
  `function f(x){const o={};return Object.defineProperties(o,{a:{value:x,writable:true,enumerable:true},b:{get:function(){return this.a+1;},enumerable:true}})===o&&o.b===x+1;}`,
  `function f(x){const o={};let log="";const d={};Object.defineProperty(d,"a",{enumerable:true,get:function(){log=log+"a";return {get value(){log=log+"v";return x;}};}});Object.defineProperty(d,"b",{enumerable:true,get:function(){log=log+("a" in o?"bad":"b");return {value:3};}});Object.defineProperties(o,d);return log+":"+o.a+":"+o.b;}`,
  `function f(x){const o={};try{Object.defineProperties(o,{a:{value:1},b:{get:3}});}catch(e){return e instanceof TypeError&&!("a" in o);}return false;}`,
  `function f(x){const o={};Object.defineProperty(o,"b",{value:1});try{Object.defineProperties(o,{a:{value:2},b:{value:3}});}catch(e){return o.a===2&&o.b===1&&e instanceof TypeError;}return false;}`,
  `function f(x){const o={};const d={a:{value:1},b:{value:2}};Object.defineProperty(d,"a",{get:function(){delete d.b;d.c={value:3};return {value:4};}});Object.defineProperties(o,d);return o.a===4&&!("b" in o)&&!("c" in o);}`,
  `function f(x){const o={};const d={a:{value:1},b:{value:2}};Object.defineProperty(d,"a",{get:function(){Object.defineProperty(d,"b",{enumerable:false});return {value:4};}});Object.defineProperties(o,d);return o.a===4&&!("b" in o);}`,
  `function f(x){const p={inherited:{value:2}};const d=Object.create(p);Object.defineProperty(d,"hidden",{value:{value:3}});d.a={value:1};const o=Object.defineProperties({},d);return o.a===1&&!("hidden" in o)&&!("inherited" in o);}`,
  `function f(x){let log="";const d={get enumerable(){log=log+"e";return true;},get configurable(){log=log+"c";return true;},get value(){log=log+"v";return 7;},get writable(){log=log+"w";return false;}};const o=Object.defineProperties({},{a:d});return log+":"+o.a;}`,
  `function f(x){let log="";const a=[1,2,3];Object.defineProperties(a,{length:{value:{valueOf:function(){log=log+"l";return 1;}}},z:{get value(){log=log+"z";return 5;}}});return log+":"+a.length+":"+a.z;}`,
  `function f(x){const o={a:1};return Object.seal(o)===o&&Object.isSealed(o)&&!Object.isFrozen(o)&&!Object.isExtensible(o);}`,
  `function f(x){const o={a:1};Object.freeze(o);o.a=2;return o.a===1&&Object.isFrozen(o)&&Object.isSealed(o)&&!Object.getOwnPropertyDescriptor(o,"a").writable;}`,
  `function f(x){const o={a:1};Object.seal(o);o.a=2;o.b=3;return o.a===2&&!("b" in o)&&!delete o.a;}`,
  `function f(x){let value=0;const o={get a(){return value;},set a(v){value=v;}};Object.freeze(o);o.a=x;return Object.isFrozen(o)&&o.a===x;}`,
  `function f(x){const a=[1,,3];Object.freeze(a);a[0]=9;a.length=1;return a[0]===1&&a.length===3&&Object.isFrozen(a)&&!Object.getOwnPropertyDescriptor(a,"length").writable;}`,
  `function f(x){const a=[1];Object.seal(a);return Object.isSealed(a)&&!Object.isFrozen(a)&&Object.getOwnPropertyDescriptor(a,"length").writable;}`,
  `function f(x){const o=Object.create(null);return !Object.isSealed(o)&&!Object.isFrozen(o)&&Object.freeze(o)===o&&Object.isFrozen(o);}`,
  `function f(x){"use strict";function g(a){}Object.freeze(g);return Object.isFrozen(g)&&Object.isSealed(g)&&!Object.isFrozen(g.prototype);}`,
  `function f(x){return Object.freeze(null)===null&&Object.seal(undefined)===undefined&&Object.isFrozen("s")&&Object.isSealed(3);}`,
  `function f(x){const o={};Object.defineProperty(o,"a",{value:3});Object.preventExtensions(o);return Object.isFrozen(o)&&Object.isSealed(o);}`,
  `function f(x){let calls=0;const o={get a(){calls++;throw 1;}};Object.freeze(o);return Object.isFrozen(o)&&Object.isSealed(o)&&calls===0;}`,
  `function f(x){const o={a:1};Object.freeze(o);try{Object.defineProperty(o,"a",{value:2});}catch(e){return e instanceof TypeError&&o.a===1;}return false;}`,
  `function f(x){const original=Object.defineProperties;Object.defineProperty=undefined;Object.getOwnPropertyNames=undefined;Object.getOwnPropertyDescriptor=undefined;const o=original({},{a:{value:x}});return o.a;}`,
  `function f(x){const original=Object.freeze;Object.preventExtensions=undefined;Object.defineProperty=undefined;Object.getOwnPropertyNames=undefined;Object.getOwnPropertyDescriptor=undefined;const o=original({a:1});o.a=2;return o.a;}`,
  `function f(x){function g(a){Object.freeze(arguments);a=9;return arguments[0]===x&&Object.isFrozen(arguments);}return g(x);}`,
  `function f(x){"use strict";const k=Object.getOwnPropertyNames(arguments);return k.length+":"+k[0]+":"+k[1]+":"+k[2];}`,
  `function f(x){const o={};for(let i=0;i<80;i++){o["p"+i]=i;}let total=0;const k=Object.keys(o);for(let i=0;i<k.length;i++){total=total+o[k[i]];}return total+":"+k[0]+":"+k[79];}`,
  `function f(x){const o={"01":1,"4294967295":2,0:3,"":4};const k=Object.keys(o);return k[0]+":"+k[1]+":"+k[2]+":"+k[3];}`,
];
// V8 14.x can report a sealed empty array frozen despite writable length.
// Keep this spec-directed check separate from automatic native-oracle cases.
export const objectOperationDirectedCases = [{
  source: `function f(x){const a=[];Object.seal(a);return Object.isFrozen(a);}`,
  input: 17, expected: false,
}];
export const objectOperationResumptionSource = `function f(x){
  let log="";const target={};const descriptors={
    get a(){log=log+"a";return {get value(){log=log+"v";return x;},enumerable:true};},
    get b(){log=log+("a" in target?"bad":"b");return {get:function(){return this.a+1;},enumerable:true};}
  };
  Object.defineProperties(target,descriptors);Object.freeze(target);
  const names=Object.keys(target);
  return log+":"+names[0]+":"+names[1]+":"+target.b+":"+Object.isFrozen(target);
}`;
export const objectOperationResumptionExpected = 'avb:a:b:18:true';
export const objectOperationNegativeSources = [
  `function f(x){return Object.keys(null);}`,
  `function f(x){return Object.getOwnPropertyNames(undefined);}`,
  `function f(x){return Object.defineProperties(1,{});}`,
  `function f(x){return Object.defineProperties({},null);}`,
  `function f(x){return Object.defineProperties({},{a:{get:1}});}`,
];
export const objectOperationUnsupportedSources = [
  `function f(x){return Object.getOwnPropertyNames(Object);}`,
  `function f(x){function g(){}return Object.getOwnPropertyNames(g);}`,
  `function f(x){return Object.defineProperties({},"a");}`,
];

// ES2025 ObjectDefineProperties snapshots OwnPropertyKeys, then re-reads each
// own descriptor before Get/ToPropertyDescriptor. Safari 26.4's native fast path
// differs when an earlier getter deletes or hides a later property; the spec
// requires skipping it. Keep these cases and record any oracle divergence.
export const objectOperationNormativeExpectations = new Map(
  objectOperationSources.filter(source => source.includes('delete d.b;d.c=') || source.includes('Object.defineProperty(d,"b",{enumerable:false})'))
    .map(source => [source, true]),
);
