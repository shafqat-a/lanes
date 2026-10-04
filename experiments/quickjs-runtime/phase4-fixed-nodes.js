// Fixed intrinsic heap node layout (single source of truth).
//
//   1..25   allocated in main() init, in order, by alloc() (objectProto=1,
//           arrayProto=2, functionProto=3, ..., Math 23, Number 24, JSON 25).
//   26..63  RESERVED for Phase 3 (Symbols / well-known intrinsics). Never on
//           the free list, never swept; Phase 3 initializes and marks them.
//   64..79  RESERVED for the Phase 4 next wave:
//             64 tagged-template [[TemplateMap]] registry (kind 32)
//             65 global object (sloppy global this; phase4-global.js)
//             66..73 collections wave (not initialized here)
//             74 %GeneratorPrototype%, 75 %GeneratorFunctionPrototype%,
//                76 generator constructor placeholder (not initialized here)
//             77 %IteratorPrototype% (kind 2, [[Prototype]] node 1)
//             78 %ArrayIteratorPrototype% (kind 2, [[Prototype]] node 77)
//             79 %StringIteratorPrototype% (kind 2, [[Prototype]] node 77)
//
// Invariants enforced by shader.js:
//   80..85 protocol/call native function backing objects (kind 2).
//   - init builds the free list with 26..85 excluded, so alloc() can never
//     hand out a reserved node (node 25's successor is 106);
//   - collect() marks 1..25 and every assigned phase-4 fixed node as roots,
//     and its sweep never puts 26..85 on the free list (marks are cleared);
//   - freeCount starts at heap-1-(FIXED_RESERVED_LAST-FIXED_RESERVED_FIRST+1).
export const FIXED_INIT_LAST = 25;
export const FIXED_RESERVED_FIRST = 26;
export const PHASE3_FIXED_FIRST = 26;
export const PHASE3_FIXED_LAST = 63;
export const PHASE4_FIXED_FIRST = 64;
export const PHASE4_FIXED_LAST = 79;
// Protocol function backing objects: immutable identity, mutable own properties.
// 86..89 RegExp (Grok), 90..105 Promise + async (promise-ids.js, reserved-ranges.js).
export const FIXED_RESERVED_LAST = 105;
export const FIXED_RESERVED_COUNT = FIXED_RESERVED_LAST - FIXED_RESERVED_FIRST + 1;

export const TEMPLATE_REGISTRY_NODE = 64;
export const GLOBAL_OBJECT_NODE = 65;
// Written in place by shader init (not alloc). Kind 51/52 iterators point here.
export const ITERATOR_PROTO_NODE = 77;
export const ARRAY_ITERATOR_PROTO_NODE = 78;
export const STRING_ITERATOR_PROTO_NODE = 79;

// Phase-4 fixed nodes that are initialized and therefore GC roots.
export const PHASE4_FIXED_ROOTS = Object.freeze([
  TEMPLATE_REGISTRY_NODE, GLOBAL_OBJECT_NODE,
  ITERATOR_PROTO_NODE, ARRAY_ITERATOR_PROTO_NODE, STRING_ITERATOR_PROTO_NODE,
]);
