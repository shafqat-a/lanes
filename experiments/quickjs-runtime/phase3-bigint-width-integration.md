# BigInt fixed-width conversions

`phase3-bigint-width.js` contains guest ToIndex/ToBigInt algorithms and exact
WGSL truncation. It depends on the BigInt conversion increment (1161,1164,1166
and phase3BigintStore). There is no host guest computation.

- Public1170: BigInt.asIntN(bits,value), name asIntN, length2.
- Public1171: BigInt.asUintN(bits,value), name asUintN, length2.
- Private1172: __lanesBigIntWidth(BigInt, bounded width, Boolean signed).

The source validates the original width with ToIndex before converting the
value. Value conversion uses ToBigInt, which rejects Numbers; public BigInt's
Number exception must not be reused. Zero width still converts the value.
Invalid numeric widths throw guest RangeError, invalid string values throw
guest SyntaxError, and incompatible primitive values throw guest TypeError.
Callbacks and their exceptions follow the shared ToPrimitive implementation.

The private width is0..2049. 2049 denotes any validated original width>2048.
For signed conversion such widths preserve any representable guest BigInt.
For unsigned conversion they preserve a nonnegative BigInt; a negative input
would require more than64 words and exits resource status3. At widths0..2048,
infinite two-complement low bits are masked exactly and signed results are
converted back to canonical sign-magnitude, including canonical zero.

The proposed patch `/tmp/lanes-bigint-width-integration.patch` appends four
fields, installs normal writable/nonenumerable/configurable static methods on
existing BigInt constructor node29, registers normal builtin metadata/calls and
private1172, and imports WGSL. It makes no binding, opcode or heap-layout change.
It is NOT applied at source handoff; rebase against the protocol owner's stable
core if necessary. Build entry: `browser-phase3-bigint-width.js`, matching HTML.

Focused browser coverage:22 regular programs×4inputs plus1 step1 resumption,
1 explicit resource boundary and1 fixture requiring actual GC in all lanes.
Host checker: `node experiments/quickjs-runtime/check-phase3-bigint-width.mjs`.
It compares24 native/helper fixtures,1304 u32 limb differentials, and26 normalized
raw native/Wasm programs. It automatically checks packed parity after integration.
Host results do not establish GPU correctness; coordinator owns M1 qualification.
