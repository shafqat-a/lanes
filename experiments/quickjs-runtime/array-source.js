import { arrayReduceSources } from './array-reduce-source.js';
import { arrayMutationSources } from './array-mutation-source.js';
import { arrayShiftSources } from './array-shift-source.js';

// Self-hosted ES2025 Array.prototype algorithm subsets. These strings are
// compiled to guest bytecode; production never evaluates them on the CPU.
// Primitive boxing is explicitly unsupported by the private receiver guard.
const setup = `
  "use strict";
  const object = __lanesArrayObject(this);
  let length = __lanesNumber(object.length);
  if (!(length > 0)) length = 0;
  else if (length > 9007199254740991) length = 9007199254740991;
  else length = length - length % 1;
`;
const integer = `
  let index = __lanesNumber(fromIndex);
  if (index !== index) index = 0;
  else if (index !== Infinity && index !== -Infinity) index = index - index % 1;
`;
export const arraySources = Object.freeze({
  arrayPush: `function pushBootstrap() {${setup}
    const count = arguments.length;
    if (length + count > 9007199254740991) throw new TypeError("Array-like length overflow");
    for (let i = 0; i < count; i++) object[length + i] = arguments[i];
    object.length = length + count;
    return length + count;
  }`,
  arrayPop: `function popBootstrap() {${setup}
    if (length === 0) { object.length = 0; return undefined; }
    const index = length - 1;
    const element = object[index];
    delete object[index];
    object.length = index;
    return element;
  }`,
  arrayAt: `function atBootstrap(fromIndex) {${setup}${integer}
    if (index < 0) index = length + index;
    if (index < 0 || index >= length) return undefined;
    return object[index];
  }`,
  arrayIndexOf: `function indexOfBootstrap(search, fromIndex) {${setup}
    if (length === 0) return -1;${integer}
    if (index >= length) return -1;
    if (index < 0) index = length + index;
    if (index < 0) index = 0;
    for (; index < length; index++) {
      if (index in object && object[index] === search) return index;
    }
    return -1;
  }`,
  arrayIncludes: `function includesBootstrap(search, fromIndex) {${setup}
    if (length === 0) return false;${integer}
    if (index >= length) return false;
    if (index < 0) index = length + index;
    if (index < 0) index = 0;
    for (; index < length; index++) {
      const element = object[index];
      if (element === search || (element !== element && search !== search)) return true;
    }
    return false;
  }`,
  ...Object.fromEntries(['every', 'some', 'forEach'].map(method => [
    'array' + method[0].toUpperCase() + method.slice(1),
    `function ${method}Bootstrap(callback, thisArg) {${setup}
      if (typeof callback !== "function") throw new TypeError("Callback is not callable");
      for (let index = 0; index < length; index++) {
        if (index in object) {
          const element = object[index];
          const result = __lanesCall(callback, thisArg, element, index, object);
          ${method === 'every' ? 'if (!result) return false;' : method === 'some' ? 'if (result) return true;' : ''}
        }
      }
      return ${method === 'every' ? 'true' : method === 'some' ? 'false' : 'undefined'};
    }`,
  ])),
  // find/findLast always Get, so holes are visited. lastIndexOf uses HasProperty,
  // so holes are skipped and inherited elements remain visible. A missing fromIndex
  // (arguments.length < 2) starts at len-1; a passed value, including undefined, is
  // ToIntegerOrInfinity. Primitive receivers and indices at or above 2^31 stay on
  // the existing private-receiver and numeric-key limits.
  ...Object.fromEntries(['find', 'findIndex', 'findLast', 'findLastIndex'].map(method => {
    const reverse = method.includes('Last');
    const returnsIndex = method.includes('Index');
    const found = returnsIndex ? 'index' : 'element';
    const missing = returnsIndex ? '-1' : 'undefined';
    const loop = reverse
      ? `for (let index = length - 1; index >= 0; index--) {
        const element = object[index];
        if (__lanesCall(callback, thisArg, element, index, object)) return ${found};
      }`
      : `for (let index = 0; index < length; index++) {
        const element = object[index];
        if (__lanesCall(callback, thisArg, element, index, object)) return ${found};
      }`;
    return ['array' + method[0].toUpperCase() + method.slice(1), `function ${method}Bootstrap(callback, thisArg) {${setup}
    if (typeof callback !== "function") throw new TypeError("Callback is not callable");
    ${loop}
    return ${missing};
  }`];
  })),
  arrayLastIndexOf: `function lastIndexOfBootstrap(search, fromIndex) {${setup}
    if (length === 0) return -1;
    let index = length - 1;
    if (arguments.length > 1) {
      index = __lanesNumber(fromIndex);
      if (index !== index) index = 0;
      else if (index !== Infinity && index !== -Infinity) index = index - index % 1;
    }
    if (index === -Infinity) return -1;
    if (index >= length) index = length - 1;
    else if (index < 0) index = length + index;
    for (; index >= 0; index--) {
      if (index in object && object[index] === search) return index;
    }
    return -1;
  }`,
  ...arrayReduceSources,
  ...arrayMutationSources,
  ...arrayShiftSources,
});
export const arrayBuiltins = ['at','concat','copyWithin','entries','every','fill','filter','find','findIndex','findLast','findLastIndex','flat','flatMap','forEach','includes','indexOf','join','keys','lastIndexOf','map','pop','push','reduce','reduceRight','reverse','shift','slice','some','sort','splice','toReversed','toSorted','toSpliced','unshift','values','with','toString','toLocaleString'];
export const arrayMethods = Object.freeze(Object.fromEntries(
  arrayBuiltins.map((name,index)=>[300+index,'array'+name[0].toUpperCase()+name.slice(1)])
    .filter(([,helper])=>Object.hasOwn(arraySources,helper))
));
