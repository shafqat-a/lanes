# Species integration contract

The atomic patch exposes Symbol.species and implements its current admitted consumers together. It replaces the live bootstrap entries for Array.prototype.map/filter/slice with `arraySpeciesSources` through the standard-library registry; their existing public IDs1402/1403/1404 are retained. The older source module remains a historical source definition, not the registered runtime implementation after this patch.

Public getters2381/2382/2383 install on Array backing18, Map66 and Set68. Each getter is strict, length0, named `get [Symbol.species]`, configurable and non-enumerable, with no setter. Symbol.species is the preallocated node39 and has the usual non-writable/non-configurable Symbol constructor property. Private2384 is ArraySpeciesCreate. It depends on IsConstructor2312, IsArray201, strict Number1164, ToObject926, Call113 and data-property definition1861.

The algorithm reads an array's constructor and then its species, including for the intrinsic Array constructor. Null or undefined species defaults to the privately captured intrinsic Array; other nonconstructors throw TypeError. Non-array inputs do not read constructor/species. Map/filter validate callbacks before species access. Slice performs start/end coercion first and strictly sets the result length afterward. Map/filter never impose a final length property on custom objects. Holes and inherited source properties retain their method-specific semantics. Result element creation bypasses inherited setters.

The VM admits one guest realm and primitive API inputs. The specification's foreign-realm intrinsic Array special case is unreachable under that contract; admitting foreign guest constructors in future requires that realm-sensitive branch. Proxy semantics remain dependent on the separate Proxy implementation. Concat, flat/flatMap, splice, Promise and typed-array species consumers are not newly admitted by this patch.

Apply `/tmp/lanes-array-species-integration.patch` only with the staged standard-library integration. It updates registry, symbol-key reservation, shader exposure/gaps and array gap metadata atomically. It has been applied only to `/tmp/lanes-array-species-stage`, not live core or the owner's standard-library stage. Merge the separate GroupBy patch carefully because both extend registry methods/aliases.

Verification:45 fixed fixtures,177 directed native/helper checks,360 differential method cases,52 raw native/Wasm comparisons and45 exact packed code/image comparisons passed. Generated shader checks confirm all three getter IDs and no undefined numeric constants. GPU qualification remains pending. `browser-array-species.html` requires45 programs/177 values, one actual-GC fixture, one single-instruction resumption and one separately counted heap boundary.

After applying, retain and promote these existing boundary sources: phase3 `species-key-pending` now returns`"symbol"`; all3 `arrayPhase5UnsupportedCases` now return1; standard-library Map/Set species probes returntrue. Add `Map[@@species]` to the standard-library suite's feature set and remove only the corresponding stale gap descriptions. These migrations are not applied in live files before integration.

Normative reference: [ES2025 ArraySpeciesCreate](https://tc39.es/ecma262/2025/multipage/abstract-operations.html#sec-arrayspeciescreate).
