# BigInt limb foundation (phase 3, assignment 4)

This wave is exact sign-magnitude arithmetic, comparison, and truncating division on guest limbs. It is not Phase 3 completion and not a finished BigInt. No opcodes are wired, no heap nodes are allocated, and the WGSL fragment has not been spliced into `shader.js` or run on a GPU.

The host integer type is not on the guest path. `limbs.js` and `limbs.wgsl` do not call it, do not use `1n`-style literals, and do not implement guest semantics by delegating to it. Only `limbs.test.js` converts limbs to and from that host type, as a differential oracle.

## Layout

A guest integer value is tag **18** plus a heap reference to one **BIGINT_LIMBS** object, heap kind **19**.

```
{ sign: -1 | 0 | 1, length: u32, limbs: little-endian u32 words }
```

- Zero is `sign: 0`, `length: 0`, and no limbs. There is no negative zero.
- Positive sign is `+1`. Negative sign is `-1`.
- Canonical form has no leading zero limb. `limbs.length === length` in JS. Each limb is an integer in `0..4294967295`. If `length > 0`, the last limb is nonzero and the sign is not 0.
- `MAX_LIMBS` is **64** (2048 bits). `ROADMAP.md` does not state a tighter guest bit cap. The heap node cap (`LIMITS.heap` 2048) is a separate allocation limit; it does not shrink the arithmetic width.
- An operation whose mathematical result needs more than 64 significant limbs returns `RESOURCE_LIMIT` and does not wrap, drop limbs, or coerce to Number.
- Tag 18 is not node id 18. Heap kind 19 is not node id 19. Those node ids are the existing Array and Object intrinsics in `objectValue`.

JS values are plain objects. Functions do not mutate caller limb arrays. `fromLimbs` accepts `Array` or `Uint32Array` and copies it. A stored word count above 64 is `RESOURCE_LIMIT` even if the extra words are zero.

WGSL uses `array<u32, 64>` plus `sign` and `len`. Words at indices `>= len` are 0. That is the fixed-array form of the same canonical rule.

## Bounds and outcomes

```js
RESOURCE_LIMIT = { kind: "resource-limit", code: "bigint-limbs" } // frozen
DIV_ZERO       = { kind: "range-error",    code: "bigint-div-zero" } // frozen
```

Producing operations **return** these objects. They do not throw for the limb cap or for division by zero. The bridge should map `RESOURCE_LIMIT` to the existing resource-limit completion (shader `status` 3 is only a generic limit today; the `bigint-limbs` code must stay distinguishable) and map `DIV_ZERO` to a guest `RangeError`.

`compare`, `equal`, `toSign`, `isZero`, and `limbCount` require a real value. A resource-limit outcome or a length above 64 is a thrown `TypeError` or `RangeError`, not a third comparison result. Arithmetic, `neg`, `abs`, `clone`, `divTrunc`, and `remTrunc` propagate `RESOURCE_LIMIT`.

`fromU32` accepts only an integer in `0..4294967295`. `fromI32` accepts only an integer in `-2147483648..2147483647`, including the negative minimum, whose magnitude is the single limb `2147483648`. Out of range throws `RangeError`.

## Exported JS signatures

| Export | Behavior |
|---|---|
| `MAX_LIMBS`, `LIMB_BITS`, `BIGINT_TAG` (18), `BIGINT_HEAP_KIND` (19) | Constants |
| `RESOURCE_LIMIT`, `DIV_ZERO`, `isResourceLimit`, `isDivZero` | Outcomes |
| `fromU32(n)`, `fromI32(n)`, `fromLimbs(sign, limbs)` | Canonical constructors |
| `toSign(a) -> -1 \| 0 \| 1` | Mathematical sign |
| `compare(a, b) -> -1 \| 0 \| 1` | Mathematical order |
| `equal(a, b) -> boolean` | `compare === 0` |
| `neg(a)`, `abs(a)`, `add(a, b)`, `sub(a, b)`, `mul(a, b)` | Canonical results or `RESOURCE_LIMIT` |
| `divTrunc(a, b)`, `remTrunc(a, b)` | ES trunc-toward-zero quotient; remainder sign follows the dividend |
| `isZero`, `isCanonical`, `clone`, `limbCount` | Predicates and copying |

`equal` / `compare` ignore leading zero limbs inside `length`, so a non-canonical encoding can still compare equal to its magnitude. `isCanonical` rejects that encoding (`{ sign: 1, length: 2, limbs: [1, 0] }` is not canonical). Producing operations return canonical values, so `add` of that encoding with zero is canonical `1`.

No recursion. Addition and subtraction are schoolbook scans. Multiplication is schoolbook on 16-bit halves so a 32×32 product stays exact in a Number (the wide sum is below 2^53). Division is restoring binary long division. Loop trip counts are at most `MAX_LIMBS`, except a 32-step bit loop and a 4-step carry spill. Scratch never grows a returned value past 64 limbs. The extra `2^(32*MAX_LIMBS)` place used during division is a single flag, not a 65th stored limb.

## WGSL fragment

`limbs.wgsl` is a splice fragment: `bi_from_u32`, `bi_from_i32`, `bi_to_sign`, `bi_compare`, `bi_equal`, `bi_neg`, `bi_abs`, `bi_add`, `bi_sub`, `bi_mul`, `bi_div_trunc`, `bi_rem_trunc`, `bi_is_zero`, `bi_is_canonical`, `bi_clone`, `bi_limb_count`.

`BiResult.status`: `0` ok, `1` limb resource-limit, `2` division by zero, `3` internal fault (JS throws instead; not a guest outcome). `bi_compare` returns `-2` when `len > 64`, which is not an order; JS throws `RangeError` for that input.

### INTEGRATION_GAPS

`shader.js` stores `struct Node { value: vec4<u32>, next, key, kind, marked }`. Four payload words cannot hold 64 limbs. Strings already chain four `u32`s per node through `next` (`unit()`). Suggested packing, not implemented here:

- Tag-18 value: `V(headerIndex, 0u, 18u, 0u)`.
- Kind-19 header `value`: `x` = sign (`0u`, `1u`, or `0xffffffffu` for -1), `y` = length, `z` = first limb-chain node, `w` = 0.
- Each chain node stores four little-endian limbs and links via `next`. 64 limbs are 16 chain nodes plus the header.

`markValue` marks tags 4, 5, and string tag 7 with `w == 0` only. `collect()` roots fixed nodes `1..25` plus env, result, frame receivers, and the stack. Tag 18 is invisible to that collector. Kinds referenced by the current shader are 1..9 and 11..16. Kind 19 is free relative to that shader. This module does not use kinds 17, 18, or 20..39.

This module claims no fixed nodes (the bridge worker owns 29 and 30; `nextFreeFixedIntrinsicNode` in the workplan is 26) and no builtin ids. Phase 3 ids `1150..1179` stay with the bridge. A non-allocated sketch, if the bridge later wants one: 1150 add, 1151 sub, 1152 mul, 1153 divTrunc, 1154 remTrunc, 1155 neg, 1156 compare. Those numbers are not reserved by this module. Bitwise ops and shifts are intentionally absent from the sketch.

## GC rooting rule

Do not treat a tag-18 value as a scalar. While it is live, the kind-19 header and every limb-chain node must be reachable from a root. Live sites are the operand stack, frame receivers, `state.result`, and any continuation or resumption slot that holds the value across an instruction boundary. A limb buffer that exists only in a WGSL local dies at the next dispatch unless it has been written into rooted state first. `markValue` must gain tag 18, and the kind-19 walk must follow the limb chain. This module does not implement the collector.

## Tests

Command, from the worktree root:

```
node --test experiments/quickjs-runtime/phase3/bigint-source/limbs.test.js
```

Observed result (exit code 0):

```
div-oracle-checks=344
oracle-checks=900
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

Wall time on that run was `duration_ms 136.718774`. The counters are the semantic result.

- `oracle-checks=900`: xorshift32 seed `0xC0FFEE01`, 15 values of 0..8 limbs (including 0, 1, and -1), every ordered pair, host comparison of `add`, `sub`, `mul`, and `compare` (225 × 4). No `Math.random`.
- `div-oracle-checks=344`: truncating division and remainder against the host operator, including quotient/remainder sign, division by zero (`DIV_ZERO`), and 64-limb dividends (`(2^2048-1)/3`, exact quotient of a value with itself, division by `2^2047`, negative dividend and divisor).
- Direct cases also matched the host oracle: `0`, `1`, `-1`, `4294967295`, `2^32`, `2^32-1`, `2^53`, `2^53+1` (kept distinct from `2^53`; the binary64 rounding of that magnitude is asserted separately), `-2^53-1`, multi-limb add with carry, subtract that borrows across a 256-bit power of two, multiply that grows a new limb, `neg(neg(x)) === x`, mixed-sign compare, canonical rejection of a leading zero, `sub(x,x)` and `add(x, neg(x))` both sign 0 / length 0, and `RESOURCE_LIMIT` for `2^2048-1` plus one, that value times two, and any product whose minimum width is 65 limbs. A 64-limb product (`2^(32*63)`) is accepted.

## Pending

Not in this wave, and not safe to invent here:

- Bitwise `~`, `&`, `|`, `^`. These need an infinite two's-complement sign extension, which this module does not specify.
- Shifts `<<`, `>>`, and `>>>`, for the same reason.
- Exponentiation, `asIntN` / `asUintN`, literals, `ToString` / `ToBigInt`, and Number↔integer conversions.
- Mixed Number/integer relational comparison and unary `+` (both are ES `TypeError`s, not limb arithmetic).
- QuickJS opcode lowering (`push_bigint_i32` and the rest), builtin exposure, heap packing, and the mark change above.
- GPU compilation or M1/Safari qualification of `limbs.wgsl`.

`divTrunc` and `remTrunc` are implemented and covered by the host oracle above, including remainder sign. They are not pending.
