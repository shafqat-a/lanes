// Independent deterministic differential oracle, not a runtime backend.
// Both methods receive independently created objects with the same adversarial
// descriptors. Compare externally observable return/throw, accessor trace and
// surviving properties, rather than assertions about helper implementation.
import assert from 'node:assert/strict';
import { arrayReduceSources } from './array-reduce-source.js';
import { arrayMutationSources } from './array-mutation-source.js';
import { arrayShiftSources } from './array-shift-source.js';

const seedCount = process.argv[2] === undefined ? 250 : Number(process.argv[2]);
if (!Number.isSafeInteger(seedCount) || seedCount < 1 || seedCount > 100000)
  throw new RangeError('Expected a seed count between 1 and 100000');
const sources = { ...arrayReduceSources, ...arrayMutationSources, ...arrayShiftSources };
const call = Function.prototype.call.bind(Function.prototype.call);
const receiver = value => {
  if (value === null || value === undefined) throw new TypeError('Nullish receiver');
  if (typeof value !== 'object' && typeof value !== 'function') throw new Error('Unsupported boxing');
  return value;
};
const helpers = Object.fromEntries(Object.entries(sources).map(([key, source]) => [
  key.slice(5, 6).toLowerCase() + key.slice(6),
  Function('__lanesNumber', '__lanesArrayObject', '__lanesCall', 'return (' + source + ')')(Number, receiver, call),
]));

function observe(method, seed, implementation) {
  let trace = '';
  const prototype = {};
  const object = Object.create(prototype);
  const length = seed % 7;
  Object.defineProperty(object, 'length', {
    value: length, writable: seed % 11 !== 0, enumerable: true, configurable: true,
  });
  for (let index = 0; index < 7; index++) {
    const kind = (seed * 17 + index * 13) % 9;
    const owner = kind < 3 ? prototype : object;
    if (kind === 0 || kind === 4) continue;
    if (kind === 1 || kind === 5) {
      Object.defineProperty(owner, index, {
        get() {
          trace += 'g' + index + ';';
          if (seed % 5 === 0) delete object[(index + 1) % 7];
          return index + 2;
        },
        set: seed % 4 === 0 ? undefined : function (value) { trace += 's' + index + '=' + value + ';'; },
        configurable: true, enumerable: true,
      });
    } else {
      Object.defineProperty(owner, index, {
        value: index + 3, writable: kind !== 6, configurable: kind !== 7, enumerable: true,
      });
    }
  }
  let args;
  if (method === 'reduce' || method === 'reduceRight') {
    args = [function (accumulator, value, index, passedObject) {
      'use strict';
      // Record callback observables so native and helper results are compared.
      trace += 'c' + index + ':' + (this === undefined) + ':' + (passedObject === object) + ':' + arguments.length + ';';
      if (seed % 6 === 0) delete object[(index + 1) % 7];
      return accumulator + value;
    }];
    if (seed % 2 === 0) args.push(10);
  } else if (method === 'fill') {
    args = [99, (seed % 11) - 5, seed % 3 === 0 ? undefined : seed % 8];
  } else if (method === 'copyWithin') {
    args = [(seed % 11) - 5, (seed % 9) - 4, seed % 3 === 0 ? undefined : seed % 8];
  } else if (method === 'unshift') {
    args = seed % 3 === 0 ? [] : [8, 9];
  } else args = [];
  let result, error;
  try {
    result = Reflect.apply(implementation, object, args);
    if (result === object) result = 'receiver';
  } catch (caught) { error = caught.name; }
  const properties = Object.getOwnPropertyNames(object).map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return [key, 'value' in descriptor ? descriptor.value : 'accessor',
      descriptor.writable, descriptor.enumerable, descriptor.configurable];
  });
  return { trace, result, error, properties };
}

let checks = 0;
for (const [method, helper] of Object.entries(helpers)) {
  for (let seed = 0; seed < seedCount; seed++) {
    assert.deepEqual(observe(method, seed, helper), observe(method, seed, Array.prototype[method]),
      `${method}, seed ${seed}: observable divergence`);
    checks++;
  }
}
console.log(JSON.stringify({ seedCount, hostDifferentialChecks: checks, methods: Object.keys(helpers), gpuChecks: false,
  coverage: 'sparse own/inherited indices, getter/setter traces, mutation during access/callback, non-writable/non-configurable properties, partial effects, callback receiver/arity/identity, relative clamping and omitted arguments' }));
