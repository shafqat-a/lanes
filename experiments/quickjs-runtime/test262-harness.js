export function wrapTest262(body, strict) {
  return `function adaptedTest(input) { ${strict ? '"use strict";' : ''}
const assert = {
  sameValue(a,b){if(!Object.is(a,b))throw "assert.sameValue";},
  notSameValue(a,b){if(Object.is(a,b))throw "assert.notSameValue";}
};
${body}
return true; }`;
}
