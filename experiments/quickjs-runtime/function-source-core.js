// ES2025 20.2.3.5. Compiler metadata is UTF-16 text, never guest CPU execution.
// https://tc39.es/ecma262/2025/multipage/fundamental-objects.html#sec-function.prototype.tostring
export const FUNCTION_SOURCE_MAGIC=0x46534f55;
export const functionSourceFields=Object.freeze(['function ','() { [native code] }']);
// Place this row immediately BEFORE each existing function refOffset. All
// reference and constant offsets remain unchanged relative to refOffset.
// Large sources remain executable; only observing their text hits the limit.
export function packFunctionSource(fn,add,text){
 const source=fn.source;
 if(typeof source!=='string')return add([0,0,0,FUNCTION_SOURCE_MAGIC]);
 return add([source.length<=256?text(source):0,source.length,1,FUNCTION_SOURCE_MAGIC]);
}
const nativeNames={
 1101:'[Symbol.hasInstance]',1103:'[Symbol.iterator]',2460:'next',2461:'next',2463:'[Symbol.iterator]',
 1:'charCodeAt',2:'charAt',3:'slice',100:'Object',101:'defineProperty',102:'getOwnPropertyDescriptor',103:'create',104:'getPrototypeOf',105:'setPrototypeOf',106:'is',107:'hasOwn',108:'preventExtensions',109:'isExtensible',
 122:'Number',136:'String',137:'Boolean',200:'Array',201:'isArray',202:'of',203:'from',204:'fromAsync',400:'',401:'call',402:'apply',403:'bind',404:'toString',500:'Function',
 600:'Error',601:'TypeError',602:'ReferenceError',603:'RangeError',604:'SyntaxError',605:'URIError',606:'EvalError',650:'toString',
 1000:'Symbol',1001:'for',1002:'keyFor',1003:'toString',1004:'valueOf',1005:'get description',1050:'getOwnPropertySymbols',1051:'ownKeys',1100:'[Symbol.toPrimitive]',1150:'BigInt',1151:'toString',1152:'valueOf',2000:'raw',
};
// methods supplies the existing public metadata arrays (phase5Methods,
// boxingMethods, objectStaticPlaceholders, String search/extract). Builtin
// image rows supply ordinary Object.prototype and legacy Array method names.
// Never read a guest-visible mutable .name property or invoke its getter.
export function functionSourceWGSL({F,methods=[]}){
 const names={...nativeNames};for(const item of methods)names[item.id]=item.name;
 const arms=Object.entries(names).map(([id,name])=>{if(F[name]===undefined)throw new Error('Missing native source name field: '+name);return `if(id==${id}u){return image[fieldKey(${F[name]}u)];}`;}).join('\n ');
 return `
fn functionInitialName(l:u32,id:u32)->V {
 ${arms}
 for(var i=0u;i<image[params.padding+1u].z;i++){let builtin=image[params.padding+2u+i];if(builtin.z==id){return image[builtin.x];}}
 states[l].status=6u;return undef();
}
fn functionToString(l:u32,value:V)->V {
 var name=image[fieldKey(${F['']}u)];
 if(value.z==5u){
  if(states[l].heap[value.x].kind!=12u){
   let functionIndex=states[l].heap[value.x].value.x;
   let refs=image[functionIndex*2u+1u].x;
   if(refs==0u){states[l].status=2u;return undef();}
   let source=image[refs-1u];
   if(source.w!=${FUNCTION_SOURCE_MAGIC}u){states[l].status=2u;return undef();}
   if(source.z==1u){if(source.y>256u){states[l].status=3u;return undef();}return image[source.x];}
   // A stripped/synthetic internal function has no public source metadata;
   // do not invent a reconstructed source or leak bootstrap implementation.
   states[l].status=6u;return undef();
  }
 }else if(value.z==11u){name=functionInitialName(l,value.x);if(states[l].status!=0u){return undef();}}
 else{states[l].status=4u;return undef();}
 let prefix=image[fieldKey(${F['function ']}u)];let suffix=image[fieldKey(${F['() { [native code] }']}u)];
 let head=makeText(l,prefix,name,0u,prefix.y+name.y);if(states[l].status!=0u){return undef();}
 return makeText(l,head,suffix,0u,head.y+suffix.y);
}
`;
}
export const functionSourceDispatchWGSL='if(id==404u){return functionToString(l,receiver);}';
