// Former object/primitive key negatives are now positive regressions.
// Primitive receiver writes and full uint32 array indices are admitted.
export const propertyKeyPromotedSources = [
  "function f(x){\"use strict\";const o=Object.freeze({});const k={toString(){throw 7;}};try{o[k]=1;}catch(e){return e===7?1:2;}}",
  "function f(x){const o={a:1};const k={toString(){return \"a\";}};try{return o[k];}catch(e){return 2;}}",
  "function f(x){const o={a:1};const k={toString(){return \"a\";}};try{return k in o;}catch(e){return 2;}}",
  "function f(x){const o={a:1};const k={toString(){return \"a\";}};try{return delete o[k];}catch(e){return 2;}}",
  "function f(x){const k={toString(){return \"a\";}};try{const o={[k]:1};return o.a;}catch(e){return 2;}}",
  "function f(x){const k={toString(){return \"a\";}};try{const o={[k](){return 1;}};return o.a();}catch(e){return 2;}}",
  "function f(x){const k={toString(){return \"a\";}};try{return Object.getOwnPropertyDescriptor({a:1},k).value;}catch(e){return 2;}}",
  "function f(x){const k={toString(){return \"a\";}};try{return Object.hasOwn({a:1},k);}catch(e){return 2;}}",
  "function f(x){const k={toString(){return \"a\";}};try{return ({a:1}).hasOwnProperty(k);}catch(e){return 2;}}",
  "function f(x){const k={toString(){return \"a\";}};try{return ({a:1}).propertyIsEnumerable(k);}catch(e){return 2;}}",
  "function f(x){\"use strict\";const o=Object.freeze({});try{o[-1]=1;}catch(e){return 2;}}"
];
propertyKeyPromotedSources.push("function f(x){const o={};try{o[2147483648]=x;}catch(e){return \"wrong guest catch\";}return o[2147483648];}","function f(x){const o={};o[4294967294]=x;return o[4294967294];}");
propertyKeyPromotedSources.push("function f(x){try{const o=1;o[\"a\"]=2;return 1;}catch(e){return 2;}}");
export const propertyKeyUnsupportedSources = [];
export const propertyKeyUnsupportedNativeExpected = [];
