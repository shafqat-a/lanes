# BigInt literal bridge contract

BigInt is not complete. This directory is the literal packing path, the tag-18 word, the kind-19 limb header, and an honest constructor stub. Arithmetic, ToBigInt, mixed comparison, `toString` / `valueOf`, and JSON are not implemented.

## Word layout (found, not invented)

`shader.js:36` is `alias V = vec4<u32>`. `shader.js:39` is `struct Node { value: V, next, key, kind, marked }`. The value tag is lane 2 (`V.z`). There is no NaN-box and no tag shift. `program.js:48` `numberWords` writes a little-endian binary64 with `DataView.setFloat64(0, n, true)` into lanes 0..1 and assigns `a[2] = tag`. `numberWords(1)` is `[0, 0x3ff00000, 0, 0]`. Tag compare in the shader is `value.z == Nu` (full lane, mask `0xffffffff`, shift 0).

Tag 18 uses that same word:

```
[heapIndex, 0, 18, 0]
```

Lane 0 is the heap index, the same lane tag-4 objects use. Valid indices are `1 .. LIMITS.heap-1` (`program.js:32`, heap 2048). `makeBigIntValue` / `decodeBigIntValue` reproduce it. The read-only image does not store this word.

Kind 19 `BIGINT_LIMBS` header:

| field | meaning |
|---|---|
| `kind` | 19 |
| `key` | `0x42490000` (`BIGINT_HEADER_KEY`) |
| `value.x` | sign bits `0`, `1`, or `0xffffffff` |
| `value.y` | limb count; `0` for canonical zero |
| `value.z` | `0` heap chunk chain, `1` image payload |
| `value.w` | image offset when storage is 1, else 0 |
| `next` | first chunk when storage is 0, else 0 |
| `marked` | 0 |

Chunks are also kind 19 (no second heap kind). `key` is the limb base 0, 4, 8, .... `value` is four little-endian u32 limbs. `collect` already follows every `next` and does not `markValue` an unknown kind. Do not treat limb lanes as pointers.

`MAX_LIMBS` is 64 (2048 bits). `ROADMAP.md` and `quickjs-foundations-integration-manifest.json` cap the heap at 2048 nodes and strings at 256 units. They do not set a tighter limb cap. QuickJS `JSBigInt` (`vendor/quickjs.c`, around the `tab[]` comment) is two's complement, `len >= 1`, with no 64-limb cap. The guest keeps sign-magnitude and the 64-limb bound. `fromTwosComplementLimbs` is the import helper; a positive QuickJS value that sets the top bit has an extra 0 sign limb, so the input may be 65 limbs while the magnitude still fits.

## Constant-pool bytes

Same record width as `text()` and `numberWords`: one `vec4<u32>`, little-endian. The pool header is not a tag-18 value. Lane 2 is `0x42490000 | signCode` (0 zero, 1 positive, 2 negative). Payload records hold four limbs, lowest limb in lane 0. `appendBigIntPool` writes payload then header, and lane 3 is the header index, matching `text()`.

Shader `push` must call `materialize_bigint` when `(image[arg].z & 0xffff0000u) == 0x42490000u`. Otherwise it keeps copying the vec4. See `compiler-bridge.md` and `bigint-bridge.wgsl`.

## IDs and nodes

| use | id |
|---|---|
| value tag | 18 |
| heap kind | 19 |
| BigInt call builtin | 1150 (tag 11 word `[1150, 0, 11, 0]`) |
| next free builtin in 1150..1179 | 1151 |
| BigInt constructor node | 29 |
| BigInt.prototype node | 30 |

1151..1179 are not claimed. No GPU opcode was added. `push_bigint_i32` stays a QuickJS opcode and lowers to existing `push` of a pool header.

Node 29 is kind 2, `[[Prototype]]` node 3 (Function.prototype). Node 30 is kind 2, `[[Prototype]]` node 1 (Object.prototype). Both extensible.

`shader.js` `main` currently allocates 23 Math, 24 Number, 25 JSON, then kind-13 holders at 26..28. The first `dataProperty` therefore receives node 29. Those holders are not the symbol nodes. This bridge does not take 23..28. `phase345-workplan.json` `nextFreeFixedIntrinsicNode` is 26; that disagrees with the symbol reservation 26..28, and this contract follows the assignment (29 and 30). No well-known-symbol block is allocated in `shader.js`. `collect` roots only `1..25` (`shader.js:110`) and must be extended through 30. `markValue` (`shader.js:108`) does not root tag 18.

Property flags are the `dataProperty` argument (`shader.js:943`): writable 1, enumerable 2, configurable 4, stored as `flags<<1`.

| property | flags | value |
|---|---|---|
| length | 4 | number 1 |
| name | 4 | string `BigInt` |
| prototype | 0 | node 30 |
| constructor | 5 | builtin 1150 |

`BigInt()` is status 6, code `bigint-tobigint`. It does not coerce. `new BigInt` is status 4, code `bigint-new`. `construct` already status-4s unknown builtins; do not put 1150 on the status-6 list at `shader.js:831`.

`typeof` tag 18 must be `"bigint"`. Today it falls through to `"object"` (`shader.js:1556`). `typeNames` (`program.js:85`) has six names, and `image[typeTable+1].z` is `builtins.length`. Do not reuse that lane.

## Tests

Command:

```
node --test experiments/quickjs-runtime/phase3/bigint-bridge/bigint-bridge.test.js
```

Result: 10 pass, 0 fail, duration about 145 ms. Host `BigInt` is used only in the test, as the packing oracle. Checked: `0`, `1`, `-1`, `4294967295`, `4294967296`, `9007199254740993` (limbs `[1, 0x200000]`), a 40-digit integer, `-0` / `-0n` canonicalized to sign 0 and decimal `0`, `0xff`, `0b1010`, `0o755`, separators, pool header roundtrip, tag-word heap index, strict equality (`1n === 1` false, `1n === 1n` true across different heap indices), overflow of `2^2048` as `resource-limit` / `bigint-limbs`, and exact fit of `2^2048-1` (64 limbs). Implementation files do not call host `BigInt`.

## Pending

- ToBigInt (`BigInt(string)` / `BigInt(number)` / objects). Status 6. Not a Number coercion.
- `BigInt.prototype.toString`, `valueOf`, `toLocaleString`. Not installed. `asString` is not an ES method and is not invented.
- `BigInt.asIntN`, `BigInt.asUintN`.
- `@@toStringTag`. No symbol key is installed here.
- Abstract equality and mixed relational comparison. Leave them unsupported. Do not use `Number()`.
- `JSON.stringify` of a bigint is a pending TypeError (status 4), not an omission and not the current unsupported ToString completion.
- Arithmetic, bitwise ops, and exponentiation.
- BigInt wrapper objects. `instanceof` already returns false for tag 18; leave it.
- Truthiness of a non-zero bigint (`truth` at `shader.js:58` is false for tag 18).
- `equal` (`shader.js:78`) would treat every pair of tag-18 values as equal until it calls `bigint_same`.
- Parent edits listed in `compiler-bridge.md` (bridge export, `packProgram` lowering, push materialize, roots, `objectView` / `objectValue`, `typeof` record, field name `BigInt`).

Guest execution of a literal must push the packed limbs, not a host-evaluated binary64 number.
