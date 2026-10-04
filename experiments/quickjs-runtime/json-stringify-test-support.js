import {jsonStringifySources} from './json-stringify-source.js';
export const jsonStringifyHostSetup=`
const __lanesSlice=Function.prototype.call.bind(String.prototype.slice),__lanesCharCodeAt=Function.prototype.call.bind(String.prototype.charCodeAt),__lanesDefineProperty=Object.defineProperty,__lanesText=String,__lanesNumber=Number,__lanesIsArray=Array.isArray;
const __lanesCall=Function.prototype.call.bind(Function.prototype.call);
const __lanesDescriptor=()=>Object.create(null),__lanesOwnKeys=(o,e)=>e?Object.keys(o):Object.getOwnPropertyNames(o);
function __lanesPrimitive(v,h){const exotic=v[Symbol.toPrimitive];if(exotic!==undefined)return exotic.call(v,h?'string':'number');for(const k of h?["toString","valueOf"]:["valueOf","toString"]){let m=v[k];if(typeof m==="function"){let r=m.call(v);if(r===null||(typeof r!=="object"&&typeof r!=="function"))return r;}}throw new TypeError();}
const wrapperValues=[[Number.prototype.valueOf,1],[String.prototype.valueOf,2],[Boolean.prototype.valueOf,3],[BigInt.prototype.valueOf,4]];
function __lanesJSONWrapperKind(v){if(v===null||typeof v!=='object')return 0;for(const [method,k] of wrapperValues){try{method.call(v);return k;}catch{}}return 0;}
function __lanesJSONWrapperValue(v){return Boolean.prototype.valueOf.call(v);}
function __lanesUnsupported(m){let e=new Error(m);e.name='UnsupportedOperation';throw e;}
JSON.stringify=(${jsonStringifySources.stringify});`;
