// ES2025 23.1.3: https://tc39.es/ecma262/2025/multipage/indexed-collections.html
// Observable built-in arities, independent of self-hosted helper parameters.
// This is read-only name/length support, not a complete function-object model.
export const arrayBuiltinLengths = Object.freeze({
  at: 1, concat: 1, copyWithin: 2, entries: 0, every: 1, fill: 1,
  filter: 1, find: 1, findIndex: 1, findLast: 1, findLastIndex: 1,
  flat: 0, flatMap: 1, forEach: 1, includes: 1, indexOf: 1, join: 1,
  keys: 0, lastIndexOf: 1, map: 1, pop: 0, push: 1, reduce: 1,
  reduceRight: 1, reverse: 0, shift: 0, slice: 2, some: 1, sort: 1,
  splice: 2, toReversed: 0, toSorted: 1, toSpliced: 2, unshift: 1,
  values: 0, with: 2, toString: 0, toLocaleString: 0,
});
