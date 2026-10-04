const c=(feature,body,expected,extra={})=>({feature:'finish-'+feature,source:`function f(x){${body}}`,input:3,expected,resumption:true,...extra});
export const sharedFinishCases=Object.freeze([
 c('native-tail-array-result','function g(){return Array.of(x,x+1);}const a=g();return a[0]+a[1];',7),
 c('native-tail-dynamic-string','const desc=Object.getOwnPropertyDescriptor(Symbol.prototype,"description").get;function g(v){return desc.call(v);}return g(Symbol("v"+x));','v3'),
 c('completed-generator-native-tail','function* g(){return x;}const it=g();it.next();function h(){return it.next();}const r=h();return r.done&&r.value===undefined;',true),
 c('nested-tail-constructor-result','function value(){return Array.of(x);}function A(){return value();}const a=new A();return Array.isArray(a)&&a[0]===x;',true),
 c('async-return-native-object','async function g(){return Array.of(x,x+1);}return g().then(a=>a[0]+a[1]);',7,{settlement:'fulfilled'}),
 c('async-generator-suspend-return','async function* g(){yield "y"+x;return "r"+x;}const it=g();return it.next().then(a=>it.next().then(b=>a.value+":"+b.value+":"+b.done));','y3:r3:true',{settlement:'fulfilled'}),
]);
