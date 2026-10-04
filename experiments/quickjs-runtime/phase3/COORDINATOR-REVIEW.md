Coordinator review of the in-progress draft. These findings are integration requirements, not a claim that the final lead patch has these defects. Please reconcile the two reproduced model seams before final integration.

# Early phase 3 integration contract review

Read-only snapshot of running worker `/home/shafqat/.local/state/lanes-external-agents/worktrees/grok-20261003094416-e8b8086a`. No tracked core changes yet: only new `phase3/` files. These are models, a Symbol WGSL fragment, and fixtures; **not an integrated GPU implementation**. No external or main production files edited.

## Usable representation promises

- Symbol value tag17; `V.x` is the kind17 cell heap pointer, not the unique identity. Cell `value=(identity,descriptionHead,registryKeyHead,flags)`. Kind18 registry stores count/nextIdentity/head/capacity. Strings are copied into kind10 heap chains; empty and absent descriptions are distinct.
- Symbol constructor/prototype/registry propose fixed nodes26/27/28; preserve Math23, Number24, JSON25 and insert new fixed allocations before the existing primitive-holder allocations. Symbol constructor uses capture4/builtin1000 with backing node26, not ordinary-global capture6. Public IDs1000..1006; protocol IDs1100..1103.
- Protocol model additionally proposes BigInt fixed nodes29/30, well-known cells31..45 and table46/kind21. One coordinated allocation/root plan must supersede the Symbol fragment's current root<=28 instruction.
- BigInt model proposes tag18, kind19, canonical sign-magnitude little-endian u32 limbs; zero sign/length0; cap64limbs/2048bits with explicit resource result. Arithmetic splits multiplication into16-bit pieces. `limbs.js` currently uses host JS arrays/objects/Math.floor and exports ES modules: this is an arithmetic model, not yet compilable GPU guest helper source or WGSL/storage integration.
- Symbol key kind20 is mentioned but no key implementation was present at review time. Its encoding and tracing contract remain undecided in the files reviewed.

## Concrete conflicting contracts (reproduced)

1. `symbol-cell.js` emits cells with numeric `tag:17`; `symbol-protocols/well-known.js` requires `tag:'symbol'`. Directly passing an identity cell to protocol `isSymbolCell` returns false. Agree on one shape or explicitly adapt at the seam; isolated model tests cannot establish cross-module correctness.
2. Protocols use well-known unique identities31..45 and require ordinary allocation to skip them. Symbol registry initialization starts at1; allocation never skips31..45. Reproduction: the31st ordinary Symbol has identity31, equal to proposed `WELL_KNOWN_ID.asyncIterator`. Reserve unique identities centrally before minting guest symbols; fixed heap pointers must not accidentally become the identity namespace.
3. The well-known list claims dispose/asyncDispose as ES2025 entries. The pinned ES2025 well-known-symbol table does not list them. Treat them as optional later extensions rather than required2025 coverage; reconfirm the final inventory against https://tc39.es/ecma262/2025/multipage/ecmascript-data-types-and-values.html#sec-well-known-symbols .

## Integration hazards against current main

- Update **truth**, equal/SameValue, typeof, primitive/object classification, markValue and all collector tracing before admitting tags17/18. Current truth makes both unknown tags false; current equal's fallback makes same-tag unknown values equal. Symbol property keys must root the corresponding cells/descriptions, including keys reachable only through properties. BigInt limbs need roots and bounds across single-instruction resumptions.
- Existing key words distinguish immediate indices (`0x80000000`) and heap strings (`0x40000000`), including canonical high indices encoded as text. New symbol keys must be disjoint and supported by sameKey/keyName/arrayIndex/property lookup, descriptor operations and deletion. OwnPropertyKeys must order symbols last; Object.keys/getOwnPropertyNames/JSON.stringify/for-in omit them; object spread includes enumerable symbols. No accidental stringification of Symbol keys.
- Phase4 iteration presently infers intrinsic Array/String iteration without observable GetMethod. Once symbols are admitted, perform actual `@@iterator` lookup/call, preserve getter/callback exceptions, and handle custom iterator records/close. A recognized intrinsic fast path is safe only after that lookup. `resolveIteratorMethod` currently converts caught TypeError into a fresh status/message record: never lose guest exception identity when turning this model into runtime control flow.
- Private129 currently means ordinary primitive conversion. Implement inherited/accessor `@@toPrimitive` via guest continuations, honoring default/number/string hints, before allowing protocol overrides. The new model's own-method bags are not a prototype-aware runtime Get implementation.
- Replace Math/JSON's temporary inherited-node toStringTag bridge with actual `Get(@@toStringTag)`, including throwing getters, deletion, override and non-string fallback. Preserve nodes23/25 and current JSON own-string-property enumeration.
- JSON.stringify must omit primitive Symbol values per position, omit symbol keys, honor replacer/toJSON ordering, and throw for BigInt only at its proper serialization stage (after applicable toJSON/replacer). Boxed Symbol/BigInt require proper internal-slot handling, not blanket TypeError.
- Sort comparator ToNumber must reject primitive or object-produced BigInt/Symbol; default sort uses ToString and must reject Symbol but format BigInt. Number(...) permits BigInt conversion whereas abstract ToNumber in math/length/comparators does not: one shared122 path cannot silently conflate them. Number parsers and Unicode casing likewise need correct shared ToString once BigInt is admitted; existing explicit Unsupported guards may remain honest until implemented.
- Main Unicode tables are concurrently moving to read-only storage binding5 because large WGSL constant arrays stalled Safari. Worker fragment's 'bindings0..4' comment is stale; preserve the new binding/resources when merging, and do not allocate competing bindings without coordinator agreement.

## Questions required before integration

Which owner produces final tagged-value/key/BigInt heap layouts, unified well-known identity allocation, complete GC hooks, and prototype-aware resumable protocol dispatch? Which unsupported boundaries remain explicit? What cross-module tests cover >45Symbol allocations, symbol-only key retention across GC, dynamic @@iterator/toPrimitive/tag getters, JSON/sort/string conversions, BigInt cap/zero/division errors, and instruction-budget1 resumption? Wait for actual implementation deliverables; do not infer readiness from standalone host-model tests.


## Fixed-node reservation update

Coordinator reserves fixed intrinsic nodes26..63 for phase3. Claude nextwave now reserves64..79 (templatecache64/globalobject65 proposed). Do not consume64..79 forphase3fixedroots. Heapkindnumbers areseparate. Coordinate allocation/free-list initialization and GC roots; simplychanging numericconstants isnot sufficient, since currentprimitiveholders are dynamicallyallocated afterthelastfixednode. The final merge must preventdynamicallocations fromoverwriting reservedrootnodes. Main Unicodebuffer binding5 isimplemented and passedM1GPU; preserveit.
