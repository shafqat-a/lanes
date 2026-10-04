// Confirmed defects in the ordinary object model of this worktree.
// A defect is source behavior that contradicts ES2025 or an existing local
// test expectation, on a path this runtime can actually execute.
// Explicit status 6 (Unsupported) is not a defect.

export const defects = [];

export const checked = Object.freeze([
  {
    area: "integer index order",
    result: "matches ES2025 and object-operation-cases.js",
    evidence: "shader.js ownKeys: \"Own string keys: array indices ascending, then chronological string keys.\" arrayIndex accepts canonical decimals through 2^32-2. \"10\" and \"2\" are stored by keyOf as n|0x80000000 and sorted numerically, not as strings.",
  },
  {
    area: "string insertion order, delete, redefine, prototype",
    result: "matches the local keys expectation \"ba\" and ES OrdinaryOwnPropertyKeys",
    evidence: "putProperty prepends a new property. delete unlinks. descriptor() updates an existing node in place. setPrototype writes only heap[obj.x].value.x. ownKeys writes named keys backwards, so re-add appends and a prototype change does not reorder.",
  },
  {
    area: "[[DefineOwnProperty]] and [[Set]]",
    result: "matches ValidateAndApplyPropertyDescriptor and strict OrdinarySet",
    evidence: "descriptor() defaults absent flags to 0, rejects a non-configurable value change unless sameValue, and rejects writable true on a non-writable non-configurable data property. putProperty returns status 4 on a non-writable data property without comparing the value. A new assignment uses alloc marked 14 (writable|enumerable|configurable).",
  },
  {
    area: "accessor descriptors",
    result: "implemented, not a data-property fallback",
    evidence: "kind 9. getProperty returns tag 12 with the getter id. putProperty returns tag 12 with the setter id, or status 4 in strict code when the setter id is 0. descriptor() rejects a mixed data/accessor description with status 4. Object-literal getters are allocated with marked 14.",
  },
  {
    area: "function name and length",
    result: "non-enumerable, non-writable, configurable",
    evidence: "closure() sets length and name marked=8. Function.prototype name and length use flags=8 in the same bit layout. cases.js expects !writable && !enumerable && configurable. Assignment to name fails; defineProperty can replace it; delete then assign creates an ordinary property.",
  },
  {
    area: "[[GetPrototypeOf]] / [[SetPrototypeOf]]",
    result: "Object.setPrototypeOf matches ES, including cycles",
    evidence: "setPrototype returns the same value when the parent is already value.x, including when value.w==0 or the object is node 1. Otherwise a non-extensible object or node 1 throws status 4. The parent walk sets cycle when current==obj.x and then throws status 4. Null is parent 0. getPrototypeOf reads value.x.",
  },
  {
    area: "object-literal OP_set_proto",
    result: "not a confirmed defect",
    evidence: "shader.js set_proto assigns [[Prototype]] directly and does not call setPrototype. QuickJS OP_set_proto calls JS_SetPrototypeInternal. ES PropertyDefinitionEvaluation calls [[SetPrototypeOf]] and ignores a normal false result. The new literal is not reachable from the __proto__ expression: the compiler has no proxy, define_field does not run setters, and var/let self-reference is undefined or TDZ. Non-object proto values are ignored, which matches both ES and QuickJS. No local test builds a literal cycle. No patch: calling setPrototype would throw on a non-object proto, which object-literal __proto__ must ignore.",
  },
  {
    area: "inherited properties",
    result: "visible to [[Get]] and in, absent from ownKeys",
    evidence: "getProperty and the in opcode walk value.x. ownKeys walks only the object's own next list. object-operation-cases.js defines an inherited property and checks own names only.",
  },
  {
    area: "non-extensible objects",
    result: "new keys are rejected; allowed configurable updates succeed",
    evidence: "descriptor() throws status 4 when property==0 and value.w==0. An existing configurable property skips that check. preventExtensions (id 108) clears value.w.",
  },
  {
    area: "explicit Unsupported gaps",
    result: "left as status 6; not filed and not given a silent success path",
    evidence: "Object.create's second argument (id 103) requires b.z==3. Sloppy function ownKeys checks image strictness and returns status 6. functionKey rejects caller and arguments. Unmapped builtin prototypes (for example Function id 500) stay tag 11 and setPrototype returns status 6. Object constructor unknown names return status 6 from getProperty so a missing intrinsic is not reported as absent.",
  },
  {
    area: "symbols",
    result: "no string-order defect; symbol bucket is not this patch",
    evidence: "ownKeys has no symbol class because symbol keys are not representable yet. PHASE-4-STATUS.md says string order is exact and __lanesOwnPropertyKeys 1240 must grow a symbol tail. That extension belongs to the symbol-keys worker. This module's ownKeys keeps cls 2 after strings so the two orders agree.",
  },
]);
