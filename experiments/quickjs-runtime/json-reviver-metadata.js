export const jsonReviverNewIntrinsics=Object.freeze({__lanesReviverDelete:1860,__lanesReviverDefine:1861});
export const jsonReviverIntrinsics=Object.freeze({...jsonReviverNewIntrinsics,__lanesIsArray:201,__lanesOwnKeys:140,__lanesCall:113});
// 1860(holder,canonicalStringKey): ordinary [[Delete]], returns Boolean.
// A non-configurable property returns false, never strict guest TypeError.
// 1861(holder,canonicalStringKey,value): CreateDataProperty with writable,
// enumerable and configurable all true. Incompatible descriptor or a
// non-extensible holder returns false without invoking target setters.
// Both preserve genuine abrupt/Unsupported/resource completions; do not
// implement by catching and swallowing arbitrary guest exceptions.
export const jsonReviverGaps=Object.freeze([
 'Implements the ECMAScript 2025 two-argument reviver contract. Later JSON.parse source/context proposals are outside this target; callbacks receive exactly key and value.',
 'Exotic objects inserted by callbacks follow runtime admission boundaries; no CPU guest fallback. Deep/cyclic callback-created graphs may hit explicit frame/resource limits.',
]);
