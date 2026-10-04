// Reserved-range registry for waves that add builtin ids, heap kinds, frame
// continuations and fixed heap nodes. Ranges are inclusive. Recording an owner
// here does not initialize anything; phase4-fixed-nodes.js FIXED_RESERVED_LAST
// decides which fixed nodes are excluded from allocation and sweep.
import { PROMISE_ID_FIRST, PROMISE_ID_LAST, PROMISE_KIND_FIRST, PROMISE_KIND_LAST,
  PROMISE_CONTINUATION_FIRST, PROMISE_CONTINUATION_LAST, PROMISE_FIXED_FIRST, PROMISE_FIXED_LAST,
  REGEXP_ID_RANGE, REGEXP_KIND_RANGE, REGEXP_FIXED_RANGE, REGEXP_CONTINUATION_RANGE } from './promise-ids.js';

export const RESERVED_RANGES = Object.freeze({
  builtinIds: Object.freeze([
    { owner: 'stdlib collections/Reflect/numeric', first: 2200, last: 2399 },
    { owner: 'generic iterator protocol', first: 2400, last: 2499 },
    { owner: 'synchronous generators', first: 2500, last: 2599 },
    { owner: 'RegExp (Grok)', first: REGEXP_ID_RANGE[0], last: REGEXP_ID_RANGE[1] },
    { owner: 'Promise + async', first: PROMISE_ID_FIRST, last: PROMISE_ID_LAST },
  ]),
  heapKinds: Object.freeze([
    { owner: 'stdlib collections', first: 40, last: 47 },
    { owner: 'generic iterators / IteratorClose', first: 50, last: 55 },
    { owner: 'synchronous generators (56..58 used, 59..63 spare)', first: 56, last: 63 },
    { owner: 'Promise + async', first: PROMISE_KIND_FIRST, last: PROMISE_KIND_LAST },
    { owner: 'RegExp (Grok)', first: REGEXP_KIND_RANGE[0], last: REGEXP_KIND_RANGE[1] },
  ]),
  continuations: Object.freeze([
    { owner: 'phase4 iteration', first: 40, last: 41 },
    { owner: 'IteratorClose throw', first: 80, last: 81 },
    { owner: 'symbol methods', first: 86, last: 87 },
    { owner: 'stdlib', first: 88, last: 103 },
    { owner: 'synchronous generators', first: 104, last: 119 },
    { owner: 'RegExp (Grok)', first: REGEXP_CONTINUATION_RANGE[0], last: REGEXP_CONTINUATION_RANGE[1] },
    { owner: 'Promise + async', first: PROMISE_CONTINUATION_FIRST, last: PROMISE_CONTINUATION_LAST },
  ]),
  fixedNodes: Object.freeze([
    { owner: 'core init (alloc order)', first: 1, last: 25 },
    { owner: 'phase3 symbols / well-known intrinsics', first: 26, last: 63 },
    { owner: 'phase4 next wave (templates, global, stdlib, generators, iterators)', first: 64, last: 79 },
    { owner: 'protocol/call native backing objects', first: 80, last: 85 },
    { owner: 'RegExp (Grok)', first: REGEXP_FIXED_RANGE[0], last: REGEXP_FIXED_RANGE[1] },
    { owner: 'Promise + async', first: PROMISE_FIXED_FIRST, last: PROMISE_FIXED_LAST },
  ]),
});

// Fixed nodes 26..FIXED_RESERVED_LAST_REQUIRED must never be allocated or swept.
export const FIXED_RESERVED_LAST_REQUIRED = Math.max(...RESERVED_RANGES.fixedNodes.map(r => r.last));

export function assertDisjointRanges(registry = RESERVED_RANGES) {
  for (const [space, ranges] of Object.entries(registry)) {
    const sorted = [...ranges].sort((a, b) => a.first - b.first);
    for (const r of sorted) if (!(Number.isInteger(r.first) && Number.isInteger(r.last) && r.first <= r.last)) throw new Error(`${space}: bad range ${r.owner}`);
    for (let i = 1; i < sorted.length; i++)
      if (sorted[i].first <= sorted[i - 1].last) throw new Error(`${space}: ${sorted[i - 1].owner} overlaps ${sorted[i].owner}`);
  }
  return true;
}

export function ownerOf(space, value, registry = RESERVED_RANGES) {
  return registry[space].find(r => value >= r.first && value <= r.last)?.owner;
}
