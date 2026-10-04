# BigInt bitwise and shift increment

Source-only module `phase3-bigint-bitwise.js` exports `phase3BigintBitwiseWGSL`.
`phase3BigintBitwise(l,a,b,op)` implements op0 AND,1 OR,2 XOR,3 NOT. NOT ignoresb.
`phase3BigintShift(l,a,b,left)` implements left/right shift with a signed BigInt
count. Negative counts reverse direction. No new IDs, fields, opcodes, fixed
nodes, buffers or heap layouts are needed.

The prepared shared-core patch `/tmp/lanes-bigint-bitwise-integration.patch`
imports/interpolates the WGSL and routes existing binary arithmetic indices4–6
to bitwise,7–8 to shifts, and9 (`shr`, unsigned right shift) to guest TypeError.
The existing tag18 unary `not` branch calls operation3. The parent owns applying
this patch and adding `phase3-bigint-bitwise` to the browser page list.

Both algorithms preserve the64-limb/2048-bit magnitude cap. Negative bitwise
results convert from infinite two-complement representation back to canonical
sign-magnitude. A carry beyond64 limbs becomes status3, never truncated zero.
Right shifts round negative numbers toward negative infinity. Shift counts may
have any supported BigInt width: huge arithmetic right shifts return0/-1, huge
left shifts of nonzero values become status3, and zero remains zero. Results
use at most16 kind19 chunks plus one header and retain the standard truthhint.

Host arithmetic transcriptions and native fixed oracles are exercised by
`check-phase3-bigint-bitwise.mjs`; GPU verification is separate. The browser
checks semantic positives, four native-valid2049-bit resource outcomes, required
GC, and one-instruction resumption. Promote the earlier `bigint-not-pending`
fixture from Unsupported to its normative positive once this increment lands.
