# Phase 3 GC fixtures

Host-side fixtures only. The GPU has not run them. Phase 3 is not complete.

## Schema

`validateFixture(fixture)` in `schema.js` returns `{ ok, errors }`. A fixture is:

```text
{
  id, description, source, rootsRequired: string[],
  suspend: { after: string } | null,
  pressure: { symbols, bigints, objects, limbs },
  expect: { type: "value"|"throw"|"unsupported"|"resource-limit", value?, name?, messageIncludes? },
  notes
}
```

`source` is one sync function of one parameter. It must parse as ECMAScript (`acorn`, `ecmaVersion: "latest"`). The validator does not execute it. A safepoint is the comment `// SUSPEND` between statements. `suspend.after` must be `SUSPEND_AFTER` from `schema.js`. `suspend: null` means the program has no completed safepoint.

Role names, not node ids:

- `fixed:Math`, `fixed:Number`, `fixed:JSON` on every standard-env fixture
- `fixed:Symbol`, `fixed:SymbolPrototype`, `fixed:SymbolRegistry` when the source uses `Symbol`
- `wellknown:iterator`, `wellknown:toStringTag`, `wellknown:toPrimitive` in that same case
- `fixed:BigInt`, `fixed:BigIntPrototype` when a bigint literal or `BigInt` is used
- `symbol:<binding>`, `symbol:<array>#<index>`, `symbol:for:<key>`
- `limb:<binding>` for an in-range tag-18 value
- `object:<binding>` for an object or array still reachable at the safepoint

`rootsRequired` must equal the live set at the safepoint (or at end of allocation, if there is no safepoint). Missing a live role that the code after `// SUSPEND` reads is `omits a root for a value used after suspend`. Listing a symbol that was deleted and dropped is `requires a root for a collectable value`. Reading a binding after its heap value was dropped and is otherwise unreachable is `expects a collected value to still be readable`.

`pressure` counts guest-visible allocations the analyzer sees: `Symbol()` calls, first `Symbol.for` of each string, bigint literals, array and object literals, `Object.create`, and `Object.defineProperty` descriptor objects. It does not count env cells, property nodes, or result arrays from `Reflect.ownKeys`. `notes` must contain `claims pressure: ...`. A claimed kind must be a positive count, and every positive count must be claimed.

`MAX_LIMBS` is 64 u32 limbs. `ROADMAP.md` and `shader.js` do not state another bound. One bigint whose magnitude uses at least 64 limbs must expect `resource-limit` and must not list a `limb:` root. A `value` that contains `9007199254740992`, or a numeric `value` on a bigint fixture, is rejected as a coerced Number.

`root-model.js` is the same closure on an explicit scenario, not on source text. `liveRoots(scenario)` returns a sorted role list. `assertConsistent(scenario)` checks the scenario shape and that every live object's prototype, symbol keys, and heap values are live. It returns `true` or throws.

Scenario rules:

- `standardEnv` roots `fixed:Math`, `fixed:Number`, `fixed:JSON`
- `symbolGlobal` roots `fixed:Symbol`, `fixed:SymbolPrototype`, `fixed:SymbolRegistry`, and the three `wellknown:` roles, and therefore every `registry` member
- a registered symbol that is reachable by itself also roots `fixed:SymbolRegistry` and the other members
- registry membership does not keep a symbol when `symbolGlobal` is false and no member is reachable from outside the registry
- a `limb:` role is live only while a tag-18 stack value or a property value still points at it
- symbol keys and heap property values of a live object are live
- an object is live from the stack, a rooted global, or the prototype chain of a live object

## Resumption mechanism

These fixtures do not allocate continuations, opcodes, or builtin ids. They use the instruction-boundary safepoint that already exists.

- `experiments/quickjs-runtime/shader.js`, WGSL `fn main`: `for (var step=0u; step<params.budget && states[l].status==0u; step++)`. The loop fetches `code[states[l].pc]`, then increments `pc` and `steps`. When the budget ends, `status` stays 0 and the lane state remains.
- The comment above the fetch says collection runs only at instruction boundaries. `fn collect` runs there when `freeCount<192`, then sets `status` 3 if the heap is still that full. `LIMITS.heap` in `program.js` is 2048.
- `fn collect` pre-marks nodes `1..25` inclusive, then `env`, `result`, every frame's `env` and `receiver`, then every `stack[0..sp)`. The grey scan follows `next` and the kind edges below.
- `experiments/quickjs-runtime/runtime.js`: `start` returns a job whose `step(count)` writes `Params.budget`. `run` stops with `Execution limit; use start()/step() to resume`. One guest instruction per dispatch is `step(1)`. `Snapshot.pad` is `State.pc` (the next instruction).
- `fn finish` resumes `Frame.tail` inside one instruction (tails 2, 3, 4, 5, 6, and 7 in that function). These fixtures do not use that path. A `// SUSPEND` is between guest instructions, so `collect` can run before the next one.

The numeric bytecode index is proposed-pending. `program.js` rejects an unknown root global (`Unsupported global or module reference`), and `Symbol` and `BigInt` are not wired, so no QuickJS pc is claimed. `suspend.after` says `bytecode index pending` and anchors the source comment.

Proven fixed nodes, from the `alloc` order in `fn main` (the shader comment already names nodes 20–22):

| node | binding |
|---|---|
| 23 | `mathObject` |
| 24 | `numberConstructor` object |
| 25 | `jsonObject` |

`program.js` encodes global `Math` as a tag-4 cell for node 23 and global `JSON` as a tag-4 cell for node 25. Global `Number` is builtin id 122 (tag 11), not node 24. Node 24 is still inside the `1..25` pre-root loop. `objectMethod` id 155 returns `[object Math]` and `[object JSON]` when the prototype walk hits nodes 23 and 25. That is the oracle for `fixed-math-json-tostring`.

`fn markValue` marks tags 4, 5, and 7 (`w==0`) only. Tags 17 and 18 are not marked. The grey scan has no kind 17, 18, 19, or 21 arm. Symbol keys are already marked when `(key & 0xc0000000) == 0x40000000` on kinds 3, 9, and 15: the cell id is `key & 0x3fffffff`. Kind 20 (symbol-key sidecar) is not used.

## Fixture ids

| id | expect |
|---|---|
| `symbol-identity-across-suspend` | `"distinct"` |
| `symbol-for-registry-across-suspend` | `"same"` |
| `symbol-key-keeps-cell` | `"kept"` |
| `unreachable-symbol-collectable` | `1` (the dead symbol is not a root) |
| `bigint-limb-local-across-suspend` | `"9007199254740993"` |
| `bigint-max-limbs-resource-limit` | `resource-limit`; `2^2047`, 64 limbs; `suspend: null` |
| `bigint-add-after-suspend` | `"18014398509481986"` |
| `ownkeys-order-after-suspend` | `"0,2,z,a,Sb,Sa,"` |
| `for-in-excludes-symbols-after-suspend` | `"1,b,a,"` |
| `object-spread-enumerable-symbols-after-suspend` | `"spread"` |
| `prototype-swap-inherited-in` | `"inherited"` |
| `fixed-math-json-tostring` | `"[object Math][object JSON]"` |
| `descriptor-writable-keeps-symbol-key` | `"held"` |
| `unique-symbols-same-description-under-pressure` | `"distinct"` |
| `keyfor-unique-and-registered-after-suspend` | `"undef:k"` |
| `bigint-json-stringify-unsupported` | `unsupported` |

`bigint-json-stringify-unsupported` is `unsupported`, not the spec TypeError. `json-stringify-source.js` returns `__lanesUnsupported("BigInt serialization pending")` for `typeof bigint`, and `objectMethod` id 141 only sets status 6. The host text is `Unsupported runtime operation`. A decimal string or a Number is wrong. `9007199254740993n` is two u32 limbs; `Number(9007199254740993)` is `9007199254740992`, which these fixtures do not expect.

`Reflect` is not a global arm in `program.js`. The own-keys order is still ES2025 OrdinaryOwnPropertyKeys. `phase4-object-spread.js` already says `__lanesOwnPropertyKeys` / `ownKeys()` must append symbol keys after strings. `for-in` must keep skipping them.

## Tests and results

Command, from the worktree root, no GPU and no guest execution:

```text
node --test experiments/quickjs-runtime/phase3/gc-fixtures/gc-fixtures.test.js
```

Result: 9 tests, 9 pass, 0 fail, 0 skipped. `duration_ms` 141.252517. The `NO_COLOR` / `FORCE_COLOR` warning is from the test runner environment, not these fixtures.

The tests check every fixture, unique ids, positive claimed pressure, the normative expectations above, rejection of a collected read, a missing `symbol:a` root, an extra root on the collectable symbol, and a `value` expectation for the 64-limb literal. Root-model cases: dropping the last stack reference removes `symbol:a`; `symbolGlobal` plus registry membership keeps `symbol:reg` with an empty stack; an unreachable registry does not; a reached member keeps the other members; `limb:n` follows a tag-18 stack value and a property value and disappears with that value; `fixed:Math`, `fixed:Number`, and `fixed:JSON` remain on an empty stack; a symbol key keeps `symbol:k` with no stack symbol, including through a prototype; a missing object throws.

## What the parent must root

- Keep the `1..25` pre-root. Do not treat nodes 23, 24, or 25 as collectable.
- New intrinsics start at node 26 and are outside that loop. Root them by role: Symbol constructor, `Symbol.prototype`, the symbol registry, BigInt constructor, `BigInt.prototype`, and the well-known table. A global capture that `markValue` does not understand is not enough.
- Extend `markValue` for tag 17 (symbol cell id) and tag 18 (limb object id).
- Kind 17 `SYMBOL_CELL`: a live cell keeps its description string (existing tag 7 / kind 10 chunks). `Symbol()` cells are not interned by description.
- Kind 18 `SYMBOL_REGISTRY`: live if any registered symbol is reachable or if `Symbol.for` / `Symbol.keyFor` can still be called. If it is live, every member symbol is live.
- Kind 19 `BIGINT_LIMBS`: live exactly while a tag-18 value points at it. Do not truncate. A value of 64 or more u32 limbs is status 3, not a shorter vector and not a Number.
- Kind 21 well-known table: live with the Symbol constructor. Fixtures name `iterator`, `toStringTag`, and `toPrimitive`; the whole table is live, not only those three.
- Kind 20 is unnecessary while symbol keys keep the `0x40000000` encoding. Kinds 24..39 are not phase 3 and these fixtures do not use them.
- Locals live in kind-1 env cells until the frame returns, not only on the operand stack. Clearing a local (`= null`) and `delete` of the last key drops a unique symbol. A symbol key of a live object does not drop.
- At `step(1)` boundaries, temporaries from the instruction that just finished must already be in a root (stack, env, or heap edge). `collect` does not scan mid-instruction temps except through `Frame.tail`, which these fixtures do not use.
- Guest `pressure` counts will not by themselves force `freeCount<192`. The coordinator should still cross an instruction boundary with `step(1)` and let `collect` run when the heap is under that threshold. Dead symbols in the pressure loops are not roots.

## Pending

- No numeric bytecode index until a compiler accepts these sources.
- No GPU run, and no claim that the current collector implements tags 17 or 18.
- `Reflect.ownKeys` is the spec surface; the runtime still has to expose that order through the existing `ownKeys` path.
- JSON bigint stays the status-6 admission until `json-stringify-source.js` changes. Do not silently turn it into a string or a Number.
- Phase 3 is not complete.
