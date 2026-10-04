const targets=[
 ['function-call','Function.prototype.call','call',1],
 ['has-instance','Function.prototype[Symbol.hasInstance]','[Symbol.hasInstance]',1],
 ['string-iterator','String.prototype[Symbol.iterator]','[Symbol.iterator]',0],
 ['array-next','Object.getPrototypeOf([].values()).next','next',0],
 ['string-next','Object.getPrototypeOf(""[Symbol.iterator]()).next','next',0],
 ['iterator-identity','Object.getPrototypeOf(Object.getPrototypeOf([].values()))[Symbol.iterator]','[Symbol.iterator]',0],
];
const c=(feature,body,extra={})=>({feature:'protocol-metadata-'+feature,source:`function f(x){${body}}`,input:3,expected:true,...extra});
export const phase6MetadataCases=Object.freeze(targets.flatMap(([label,target,name,length])=>[
 c(label+'-descriptors',`const fn=${target};const n=Object.getOwnPropertyDescriptor(fn,"name"),l=Object.getOwnPropertyDescriptor(fn,"length");return fn===${target}&&Object.getPrototypeOf(fn)===Function.prototype&&n.value===${JSON.stringify(name)}&&l.value===${length}&&!n.writable&&!n.enumerable&&n.configurable&&!l.writable&&!l.enumerable&&l.configurable&&Object.getOwnPropertyNames(fn).join(",")==="length,name";`),
 c(label+'-native-source-mutable-metadata',`const fn=${target};const before=Function.prototype.toString.call(fn);Object.defineProperty(fn,"name",{get(){throw 9;}});delete fn.length;const after=Function.prototype.toString.call(fn);return before===after&&before.indexOf("[native code]")>=0&&fn.length===0&&fn===${target};`),
 c(label+'-gc-retention',`const fn=${target};fn.marker={sentinel:17};Object.defineProperty(fn,"name",{value:"changed"});for(let i=0;i<700;i++){const garbage={i:i};}return fn===${target}&&fn.marker.sentinel===17&&fn.name==="changed"&&fn.length===${length};`,{requiresGC:true}),
 ]).concat([
 c('call-bind-test262-property-helper','const call=Function.prototype.call;const has=call.bind(Object.prototype.hasOwnProperty);const enumerable=call.bind(Object.prototype.propertyIsEnumerable);const join=call.bind(Array.prototype.join);const push=call.bind(Array.prototype.push);const a=[];push(a,"a");push(a,"b");return has(a,"0")&&enumerable(a,"1")&&join(a,"-")==="a-b"&&has.length===1;'),
]));

export const phase6MetadataResourceCase={feature:"protocol-metadata-retained-heap-exhaustion",source:`function f(){const fn=Function.prototype[Symbol.hasInstance];fn.retained=[];for(let i=0;i<3000;i++)fn.retained[i]={i:i};return fn.retained.length;}`,input:3,expected:3000};
