// ES2025 25.5.2, guest-only serializer; host execution is confined to tests.
// https://tc39.es/ecma262/2025/multipage/structured-data.html#sec-json.stringify
export const jsonStringifySources=Object.freeze({stringify:String.raw`function jsonStringifyBootstrap(value,replacer,space){
 "use strict";
 function objectLike(v){return v!==null&&(typeof v==="object"||typeof v==="function");}
 function text(v){if(objectLike(v))v=__lanesPrimitive(v,true);if(typeof v==="symbol")throw new TypeError("Cannot convert Symbol to string");return __lanesText(v);}
 function define(o,k,v){__lanesDefineProperty(o,k,{value:v,writable:true,enumerable:true,configurable:true});}
 const stack=__lanesDescriptor();let depth=0;let indent="",gap="",list,replace;
 if(typeof replacer==="function")replace=replacer;
 else if(__lanesIsArray(replacer)){
  list=__lanesDescriptor();let count=0;const length=replacer.length;
  for(let i=0;i<length;i++){
   let item=replacer[i];const type=typeof item;let name;
   if(type==="string"||type==="number")name=text(item);
   else if(objectLike(item)){const kind=__lanesJSONWrapperKind(item);if(kind===1||kind===2)name=text(item);}
   if(name!==undefined){let duplicate=false;for(let j=0;j<count;j++)if(list[j]===name)duplicate=true;if(!duplicate){define(list,count,name);count++;}}
  }
  define(list,"length",count);
 }
 if(objectLike(space)){const kind=__lanesJSONWrapperKind(space);if(kind===1)space=__lanesNumber(space);else if(kind===2)space=text(space);}
 if(typeof space==="number"){let n=space;if(n>10)n=10;for(let i=1;i<=n;i++)gap+=" ";}
 else if(typeof space==="string")gap=__lanesSlice(space,0,10);
 function hex(n){return __lanesSlice("0123456789abcdef",n,n+1);}
 function escapeUnit(c){return "\\u"+hex((c>>>12)&15)+hex((c>>>8)&15)+hex((c>>>4)&15)+hex(c&15);}
 function quote(s){
  let result='"';const length=s.length;
  for(let i=0;i<length;i++){
   const c=__lanesCharCodeAt(s,i);
   if(c===34)result+='\\"';else if(c===92)result+='\\\\';
   else if(c===8)result+='\\b';else if(c===9)result+='\\t';else if(c===10)result+='\\n';else if(c===12)result+='\\f';else if(c===13)result+='\\r';
   else if(c<32)result+=escapeUnit(c);
   else if(c>=55296&&c<=56319){const next=__lanesCharCodeAt(s,i+1);if(next>=56320&&next<=57343){result+=__lanesSlice(s,i,i+2);i++;}else result+=escapeUnit(c);}
   else if(c>=56320&&c<=57343)result+=escapeUnit(c);
   else result+=__lanesSlice(s,i,i+1);
  }
  return result+'"';
 }
 function serialize(key,holder){
  let item=holder[key];
  if(objectLike(item)||typeof item==="bigint"){const method=item.toJSON;if(typeof method==="function")item=__lanesCall(method,item,key);}
  if(replace!==undefined)item=__lanesCall(replace,holder,key,item);
  if(objectLike(item)){
   const kind=__lanesJSONWrapperKind(item);
   if(kind===1)item=__lanesNumber(item);else if(kind===2)item=text(item);else if(kind===3)item=__lanesJSONWrapperValue(item);else if(kind===4)throw new TypeError("Cannot serialize BigInt");
  }
  if(item===null)return "null";
  const type=typeof item;
  if(type==="string")return quote(item);
  if(type==="boolean")return item?"true":"false";
  if(type==="number"){if(item!==item||item===Infinity||item===-Infinity)return "null";return text(item);}
  if(type==="bigint")throw new TypeError("Cannot serialize BigInt");
  if(type!=="object")return undefined;
  for(let i=0;i<depth;i++)if(stack[i]===item)throw new TypeError("Converting circular structure to JSON");
  define(stack,depth,item);depth++;
  const previous=indent;indent+=gap;const array=__lanesIsArray(item);
  const names=array?undefined:(list===undefined?__lanesOwnKeys(item,true):list);
  const length=array?item.length:names.length;let out="",count=0;
  for(let i=0;i<length;i++){
   const name=array?text(i):names[i];let part=serialize(name,item);
   if(part===undefined){if(!array)continue;part="null";}
   if(count!==0)out+=",";
   if(gap!=="")out+="\n"+indent;
   if(!array)out+=quote(name)+(gap===""?":":": ");
   out+=part;count++;
  }
  depth--;delete stack[depth];indent=previous;
  if(count!==0&&gap!=="")out+="\n"+previous;
  return (array?"[":"{")+out+(array?"]":"}");
 }
 const holder={};define(holder,"",value);return serialize("",holder);
}`});
