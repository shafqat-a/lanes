// Ordinary prototype validation executes as resumable guest bytecode on the GPU.
// Public identities stay 105 (Object.setPrototypeOf) and 121 (Annex B setter).
export const prototypeSources=Object.freeze({
 objectSetPrototype:`function objectSetPrototype(target,proto){
  "use strict";
  if(target===null||target===undefined)throw new TypeError("Cannot set prototype of null or undefined");
  if(proto!==null&&typeof proto!=="object"&&typeof proto!=="function")throw new TypeError("Invalid prototype");
  if(typeof target!=="object"&&typeof target!=="function")return target;
  if(!__lanesReflectSetPrototype(target,proto))throw new TypeError("Cannot set prototype");
  return target;
 }`,
 legacySetPrototype:`function legacySetPrototype(proto){
  "use strict";
  const target=this;
  if(target===null||target===undefined)throw new TypeError("Cannot set prototype of null or undefined");
  if(proto!==null&&typeof proto!=="object"&&typeof proto!=="function")return;
  if(typeof target!=="object"&&typeof target!=="function")return;
  if(!__lanesReflectSetPrototype(target,proto))throw new TypeError("Cannot set prototype");
 }`
});
export const prototypeIntrinsics=Object.freeze({__lanesReflectSetPrototype:2311});
