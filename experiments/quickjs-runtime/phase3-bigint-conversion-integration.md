# BigInt construction and conversions

Implementation files are `phase3-bigint-conversion.js` (WGSL kernels) and
`phase3-bigint-conversion-source.js` (compiled guest algorithms). The host test
adapter never participates in guest execution. Existing tag18/kind19 storage,
64-word magnitude cap and 256-code-unit text cap are unchanged.

Apply `/tmp/lanes-bigint-conversion-integration.patch` to the coordinated core
snapshot. It appends field IDs, registers guest sources/private aliases, routes
public1150/1151 and private1164/1166, imports WGSL, and removes obsolete text
conversion guards. It does not change opcode IDs, bindings or heap layout.

| ID | Contract |
| --- | --- |
| 1150 | Public BigInt(value), guest bigintCall; never constructible |
| 1151 | Public BigInt.prototype.toString(radix), length0, guest bigintToString |
| 1152 | Existing thisBigIntValue, reused privately as __lanesBigIntValueOf |
| 1160 | __lanesBigIntFromDigits(valid nonempty primitive string, integer radix2..36, Boolean negative), exact multiply/add |
| 1161 | __lanesBigIntFromNumber(primitive Number); BigInt or undefined for nonintegral/nonfinite; caller throws RangeError |
| 1162 | __lanesBigIntToText(primitive BigInt, integer radix2..36), lowercase digits |
| 1163 | __lanesBigIntToNumber(primitive BigInt), binary64 nearest/ties-even, including infinity |
| 1164 | __lanesNumber: strict abstract ToNumber, throws TypeError for BigInt after ToPrimitive |
| 1166 | __lanesBigIntParseString: StringIntegerLiteral parser, returns undefined for invalid grammar; shared with mixed comparisons |

1160..1164 were allocated by coordinator. Comparison owner donated1166. Parser
input is already a primitive string; comparison callers must respect this
private contract. Invalid digit/radix private calls fail internal validation;
public invalid grammar throws guest SyntaxError. Resources stay uncatchable
status3 and never become RangeError, SyntaxError or an undefined sentinel.

Public Number122 retains no-argument behavior and explicitly accepts BigInt.
Its BigInt branch calls1163. Every internal __lanesNumber instead maps1164.
`new Number(value)` deliberately calls private alias __lanesNumberConstructor122,
not abstract ToNumber. Math, array lengths, indices and comparator results must
continue rejecting BigInt. Binary/unary numeric helpers and addition now use
ToNumeric: they preserve BigInt from ordinary valueOf/toString, including
increments/decrements, while unary plus rejects it. Custom @@toPrimitive still
uses the shared protocol implementation/boundary; this increment does not
silently approximate it.

Apply the comparison agent's equality/relational replacements together with
this patch: old helpers would invoke strict ToNumber on mixed BigInt operands.
BigInt exponentiation remains a separate explicit boundary. This patch admits
decimal BigInt text for String, JSON.parse, property keys, Array.join, parseInt,
parseFloat and relevant String methods. String argument resource limits remain
observable even if a later consumer could produce a shorter result.

`browser-phase3-bigint-conversion.js` and matching HTML need a build-browser
entry. Current focused coverage:67 regular programs×4inputs,1 step1 resumption,
2 explicit text-resource boundaries; one regular program requires collections
in every lane. It compares fixed expectations against isolated native iframe
oracles, then requires GPU completion/equality. No catch-all passing status.

Host checks: `node experiments/quickjs-runtime/check-phase3-bigint-conversion.mjs`.
Current host fixture set:70 native+helper fixture oracles,56 grammar checks,
9205 u32 arithmetic differentials,77 normalized raw native/Wasm parities.
The checker automatically adds packed parity once bigintCall is registered.
These counts are host evidence, not GPU evidence.

Post-integration migrations completed: old phase3 BigInt constructor/string-add
boundaries, JSON-phase3 parse123n boundary, and divmod object-ToNumeric boundary
are positive with the original source and fixed native expectations. Preserve other boundaries (custom protocols, exponentiation, Symbol
transfer) until independently implemented and tested.

GPU triage corrections before qualification: negative1160 flag uses truth(c)
(guest Boolean payload is binary64); addition admits String+BigInt; update
opcodes and postfix continuation preserve BigInt ToNumeric; Symbol constructor
no longer rejects BigInt before its decimal description conversion. Each has
focused fixtures. M1 Safari itself accepted BigInt("+") as0n; ES2025 requires
SyntaxError. Only that documented exact fixture may differ from the native
oracle; the page records native diagnostics and still requires the normative
GPU value. See StringToBigInt and SignedInteger in the ES2025 specification.
