// Host-only stand-ins for private GPU primitives; never imported by runtime.
import {Script} from 'node:vm';
import {jsonPhase5Sources} from './json-phase5-source.js';
export const jsonReviverHostSetup=`
const __lanesSlice=Function.prototype.call.bind(String.prototype.slice),__lanesCharCodeAt=Function.prototype.call.bind(String.prototype.charCodeAt),__lanesCodeUnit=String.fromCharCode,__lanesDefineProperty=Object.defineProperty,__lanesText=String,__lanesNumber=Number,__lanesIsArray=Array.isArray;
const __lanesOwnKeys=(o,e)=>e?Object.keys(o):Object.getOwnPropertyNames(o);
const __lanesReviverDelete=Reflect.deleteProperty;
const __lanesReviverDefine=(o,k,v)=>Reflect.defineProperty(o,k,{value:v,writable:true,enumerable:true,configurable:true});
const __lanesCall=Function.prototype.call.bind(Function.prototype.call);
function __lanesPrimitive(v,h){const exotic=v[Symbol.toPrimitive];if(exotic!==undefined&&exotic!==null){const r=Reflect.apply(exotic,v,[h?'string':'number']);if(r===null||(typeof r!=='object'&&typeof r!=='function'))return r;throw new TypeError();}for(const k of h?["toString","valueOf"]:["valueOf","toString"]){let m=v[k];if(typeof m==="function"){let r=Reflect.apply(m,v,[]);if(r===null||(typeof r!=="object"&&typeof r!=="function"))return r;}}throw new TypeError();}
function __lanesUnsupported(message){const e=new Error(message);e.name='UnsupportedOperation';throw e;}
JSON.parse=(${jsonPhase5Sources.parse});`;
export function evaluateJSONReviver(source,input,helper=true){return new Script((helper?jsonReviverHostSetup:'')+`(${source})(input)`).runInNewContext({input},{timeout:2000});}
