# BigInt literal integration checklist

Guest literals are packed limbs (tag 18, kind 19). They are not host numbers.
Do not run a bigint through `JS_ToFloat64` or `numberWords`. This bridge does
not edit the compiler, `program.js`, `shader.js`, or `bootstrap.js`.

## Where a numeric literal is packed today

1. Lexer: `next_token` in `vendor/quickjs.c` labels the span `parse_number` and calls `js_atof` with `ATOD_ACCEPT_BIN_OCT | ATOD_ACCEPT_LEGACY_OCTAL | ATOD_ACCEPT_UNDERSCORES | ATOD_ACCEPT_SUFFIX`. The token kind stays `TOK_NUMBER`. A suffix `n` becomes `JS_TAG_SHORT_BIG_INT` or `JS_TAG_BIG_INT`, not a new token number.
2. Emitter: `js_parse_postfix_expr` (`vendor/quickjs.c`) on `TOK_NUMBER`:
   - `JS_TAG_INT` → `OP_push_i32`
   - `JS_TAG_SHORT_BIG_INT` inside int32 → `OP_push_bigint_i32` (`vendor/quickjs-opcode.h`, size 5, i32 operand)
   - otherwise `emit_push_const` (large numbers and multi-limb bigints)
3. Export: `number_value` in `bridge.c` does `JS_ToFloat64` and writes `{"number":[low32,high32]}`. `lanes_compile` emits that only when `JS_IsNumber` is true (`JS_TAG_INT` or float64). `JS_IsBigInt` is not handled. Bigint cpool entries fall through to `{"unsupported":true}` (`bridge.c` constant loop).
4. Image: `packProgram` in `program.js`:
   - `numberWords(n, tag = 0)` writes a little-endian IEEE-754 binary64 into lanes 0 and 1 and the tag into lane 2 (`DataView.setFloat64(..., true)`).
   - `c.number` becomes `add([...c.number, 0, 0])`, a finished tag-0 value.
   - `push_i32` / `push_i8` / `push_i16` / `push_[0-7]` / `push_minus1` call `numberWords` and retarget the opcode to `push`.
   - `push_const` / `push_const8` set the operand to `constants[a].literal` and retarget to `push`.
5. Execute: shader `cases('push', 'push(l,image[arg]);')` copies that `vec4<u32>` onto the stack. Strings use the same push: `text()` stores code units, then a header `[offset, length, 7, selfIndex]`.

## New constant kind (append, do not renumber)

Do not add a `TOK_*` value and do not insert an opcode into `OP` ahead of `phase4Opcodes`. `push_bigint_i32` already exists in the QuickJS opcode table and is absent from the GPU `OP` list.

Append one cpool JSON kind next to `"number"`, `"string"`, and `"function"`:

```json
{"bigint":{"sign":1,"limbs":[1,0]}}
```

`sign` is `-1`, `0`, or `1`. `limbs` are canonical little-endian magnitude u32s. Detect with `JS_IsBigInt`. Do not call `number_value`.

QuickJS `JSBigInt` (`vendor/quickjs.c`) is two's complement, `len >= 1`, little-endian `js_limb_t`. On the wasm bridge `JS_LIMB_BITS` is 32. Convert with the same rules as `fromTwosComplementLimbs` in `representation.js` (a positive value that sets the top bit is stored with an extra 0 sign limb). The guest form is sign plus magnitude, not that two's complement image.

`push_bigint_i32` must be lowered in `packProgram` the way `push_i32` is lowered, but through `packBigIntLiteral(String(operand))`, then `appendBigIntPool`, then opcode `push`. `String` of the i32 is exact for every int32, including the most negative. Do not call `numberWords` on that operand.

A bigint `push_const` uses the new `"bigint"` record. `constants[i].literal` is the pool header index. The existing `push_const` → `push` retarget stays. The shader change below is what makes that push legal.

## Constant-pool record bytes

Each image record is one `vec4<u32>` (16 bytes), little-endian, the same width as `numberWords` and `text()`.

```
number value (tag in lane 2, pushed as-is):
  lane0  ieee754 low u32
  lane1  ieee754 high u32
  lane2  tag 0
  lane3  0

string header (also a value, tag 7):
  lane0  payload offset
  lane1  code-unit length
  lane2  tag 7
  lane3  header index (nonzero => image payload)

bigint pool header (NOT a value; do not put tag 18 here):
  lane0  payload offset (0 when there are no limbs)
  lane1  canonical limb count
  lane2  0x42490000 | signCode     signCode: 0 zero, 1 positive, 2 negative
  lane3  header index

bigint payload, 4 limbs per record, little-endian, tail lanes 0:
  lane0  limb[i]
  lane1  limb[i+1]
  lane2  limb[i+2]
  lane3  limb[i+3]
```

`appendBigIntPool` writes the payload records first, then the header, matching `text()`. Helpers: `bigintLimbRecords`, `bigintPoolHeader`, `readBigIntPool`.

## How the tagged word is emitted

A tag-18 word is not stored in the image. Heap indices are per-lane and allocated by `alloc`.

```
V(heapIndex, 0u, 18u, 0u)
```

Lane 0 is the heap index, the same lane `object` uses for tag 4. Lane 2 is the tag. `makeBigIntValue` / `decodeBigIntValue` reproduce that. `numberWords` proves the tag lane: `numberWords(1)` is `[0, 0x3ff00000, 0, 0]`.

Kind-19 header (`limbHeaderNode`):

```
kind 19
key  0x42490000
value.x  sign bits 0, 1, or 0xffffffff
value.y  limb count (0 when the value is zero)
value.z  1 for image storage, 0 for a heap chunk chain
value.w  image offset of the payload when storage is 1, else 0
next     first chunk when storage is 0, else 0
```

Chunks are also kind 19 so no new heap kind is introduced. Their `key` is the limb base (0, 4, 8, ...), not the sentinel. `value` holds four u32 limbs. `collect` already follows `next` for every kind and does not `markValue` unknown kinds. Do not add kind 19 to a `markValue(node.value)` arm; those lanes are limbs.

Shader push, and only the pool sentinel:

```
let raw = image[arg];
if ((raw.z & 0xffff0000u) == 0x42490000u) { push(l, materialize_bigint(l, arg)); }
else { push(l, raw); }
```

`materialize_bigint` is in `bigint-bridge.wgsl`. It `alloc`s kind 19 with storage 1 and pushes tag 18. Wrong sentinel or a non-canonical header is status 2 (`Invalid bytecode state`). More than 64 limbs is status 3 (`Resource limit`). `alloc` failure is already status 3.

## Fixed nodes and builtin 1150

Current `main` init (`shader.js` ready==0), in order: 1 Object.prototype, 2 Array.prototype, 3 Function.prototype, 4..10 error prototypes, 11..17 error constructors, 18 Array, 19 Object, 20..22 string/number/boolean prototypes, 23 Math, 24 Number constructor, 25 JSON, 26..28 the kind-13 holders for those three prototypes. The next `alloc` is the first `dataProperty` (node 29 today).

Reserve, by inserting `alloc` after the symbol block and before any `dataProperty`:

- 29 BigInt constructor, kind 2, `[[Prototype]]` Function.prototype (node 3), extensible
- 30 BigInt.prototype, kind 2, `[[Prototype]]` Object.prototype (node 1), extensible

Do not move 23, 24, or 25. Do not take 26, 27, or 28 (Symbol constructor, Symbol.prototype, symbol registry), even though those indices are still the kind-13 holders in this tree. `phase345-workplan.json` says `nextFreeFixedIntrinsicNode` is 26; this assignment does not follow that. No well-known-symbol node block is allocated in `shader.js`. If 29 or 30 is later taken by that block, use the next free nodes at or after 31 outside it.

`collect` marks `root<=25` only. Extend that loop through 30 once 29 and 30 exist, or the constructor and prototype will be swept. Also teach `markValue` to mark tag 18 (`shader.js:108` today marks only tags 4, 5, and heap strings).

Global binding, same shape as Number (`packProgram` ref type 4), not Math (ref type 6):

```
if (root && ref.name === 'BigInt') { add([4, 1150, 0, 0]); continue; }
```

`objectView` / `objectValue` must map 1150 ↔ 29 the way they map 122 ↔ 24. The callable word is `V(1150u, 0u, 11u, 0u)`, not tag 18.

`dataProperty` flags (writable=1, enumerable=2, configurable=4), then `marked = flags<<1`:

| property | flags | value |
|---|---|---|
| BigInt.length | 4 | number 1, not a bigint |
| BigInt.name | 4 | string `BigInt` |
| BigInt.prototype | 0 | node 30 |
| BigInt.prototype.constructor | 5 | builtin 1150 |

Append `'BigInt'` to `fieldNames`. Do not insert it in the middle; `FIELDS` indices are positions. `'BigInt'` is not in `fieldNames` today. `length` and `name` already exist.

`construct` (`shader.js:831`) already uses status 4 for an unknown builtin. Keep 1150 off the status-6 exception list. `new BigInt` is TypeError.

`BigInt()` the call is status 6 (`Unsupported runtime operation`). Put an explicit `id==1150u` arm before any `num(` / ToNumber path. Do not implement ToBigInt by coercing to Number. Literals never call this builtin. `toString`, `valueOf`, `asIntN`, and `asUintN` stay absent (`bigintPending`). There is no `asString`.

## typeof

`typeNames` is `number boolean object undefined function string`. `typeof` maps tags 0, 1, 3, 5/11, 7 onto indices 0..5 and everything else, including tag 18, onto index 2 (`"object"`). `image[typeTable+1].z` is `builtins.length` and is scanned by the builtin-install loop. `image[typeTable+1].w` is the field-key table. Do not steal either lane and do not renumber indices 0..5.

Add a new record and read index 6 only for tag 18. The result string is `bigint`.

## Equality and JSON

`equal` returns true for any two values whose tags match and are not a number, a string, or an object/function/builtin. Two different tag-18 values would compare equal. Branch to `bigint_same` before that `return true`. Different tags stay false, so a bigint and a number are already not strictly equal. Do not change that.

`eq` of mixed tags other than null/undefined is status 6. Leave mixed bigint/number abstract equality and mixed relational comparison there. Do not route them through `binary` / `num`.

`1n instanceof BigInt` is already false (`instanceOf` rejects tags other than 4, 5, and 11). Do not box the primitive to "fix" it.

`JSON.stringify` of a bigint is a pending TypeError (status 4). Do not omit the value. The current unsupported ToString completion is not the specified result.

## What must not change

- Phase 5 Math and JSON objects, nodes 23 and 25, their constants, and their builtin id ranges.
- The number literal path: `number_value`, `c.number`, `numberWords`, binary64 lane order, tag 0.
- `push_i32` and the other numeric push lowerings.
- Existing `OP` indices. Do not insert a GPU opcode in front of `phase4Opcodes`. Builtin ids 1150..1179 are not opcode numbers. This bridge uses only 1150. 1151..1179 stay free for arithmetic.
- Heap kinds other than 19. No new value tag besides 18.
- `MAX_LIMBS` 64 (2048 bits). `ROADMAP.md` and the foundations manifest cap the heap at 2048 nodes and strings at 256 units. They do not set a tighter limb cap. QuickJS itself has no 64-limb cap; the guest still uses 64.

## Guest execution warning

The value that `push` produces for a bigint literal must be the packed limbs materialized by `materialize_bigint`. It must not be a host-evaluated number, a `numberWords` encoding of `JS_ToFloat64`, or a tag-0 word that happens to be close in binary64. `9007199254740993` is `2^53+1`. Binary64 cannot hold it. The packed limbs are `[1, 0x200000]`.
