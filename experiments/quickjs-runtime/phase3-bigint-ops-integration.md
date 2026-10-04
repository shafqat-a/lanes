# BigInt division and remainder integration

`phase3-bigint-ops.js` exports `phase3BigintOpsWGSL`, containing
`phase3BigintDivMod(l, a, b, wantRemainder) -> V`. It consumes two tag-18
values using the existing `bigint_header`/`bigint_limb` representation. It
allocates kind-19 chunks and a header exactly like existing arithmetic. No
new builtin IDs, fields, opcodes, fixed nodes, buffers or heap kinds are needed.

Import and interpolate the WGSL after `phase3ArithWGSL` in `shader.js`.
In the existing both-operands-tag18 branch for
`sub,mul,div,mod,and,or,xor,shl,sar,shr`, route index2/3 as:

```js
else if(${index}u==2u||${index}u==3u){
  let result=phase3BigintDivMod(l,a,b,${index}u==3u);
  if(states[l].status!=0u){break;}
  push(l,result);
}
```

The prepared patch is `/tmp/lanes-bigint-divmod-integration.patch`. A shared-core
owner must apply it after coordinating other shader work. Add the
`phase3-bigint-ops` page to the browser build's named-page list.

The restoring-division loop is bounded by2048 dividend bits,64 remainder words
and one transient carry bit. Each iteration compares/subtracts at most64 words.
No quotient or remainder can exceed the input's2048-bit cap. Allocation is at
most16 chunks plus one header. Internal scratch arrays are shader-local; no
host arithmetic participates in guest execution. A single operation completes
inside one interpreter instruction; it cannot be suspended halfway through
its bounded inner loop. Guest programs can resume between those instructions.

Division and remainder by zero set status8, which the existing VM converts to a
catchable guest RangeError. The existing generic RangeError message is not
specific to division; tests require the exception class and prototype, not
unspecified diagnostic wording. Quotients truncate toward zero. Nonzero
remainders have the dividend sign. Zero is canonical sign0/length0/truthhint0.
Genuine prior unsupported/resource statuses are preserved.

The increment covers primitive BigInt operands. Mixed BigInt/Number arithmetic
retains guest TypeError. Object-to-BigInt ToNumeric remains an explicit pending
boundary, verified separately. Bitwise operators, shifts and remaining BigInt
conversion protocols are outside this division/remainder increment.

`check-phase3-bigint-ops.mjs` checks fixed native fixtures, a u32 transcription
of the actual shader loop against native BigInt, selected worker limb oracles,
and native/Wasm packing parity. These host checks do not count as GPU execution.
`browser-phase3-bigint-ops.js` executes25 directed programs over4 inputs, requires
actual GC in its retained-result case, checks the object-coercion boundary, and
runs a repeated division/remainder program with one-instruction dispatches.
