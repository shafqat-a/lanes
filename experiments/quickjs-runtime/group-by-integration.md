# GroupBy integration contract

Implements ES2025 [Map.groupBy / GroupBy](https://tc39.es/ecma262/2025/multipage/keyed-collections.html#sec-map.groupby) and [Object.groupBy](https://tc39.es/ecma262/2025/multipage/fundamental-objects.html#sec-object.groupby) in guest source. Production never runs guest callbacks or iteration on the CPU.

Public2212 is the reserved Map.groupBy identity. Object.groupBy uses2380 and field`objectGroupBy`. Both have length2 and ignore their receiver. `groupByMethods` supplies registry-ready owner/name/id/field/source metadata; `groupBySources` and `groupByIntrinsics` support direct integration.

The standard-library prerequisite supplies collectionCreate2260, MapGet2263 and MapSet2264. These operate on private slots, retain key identity, and normalize negative zero. The helpers reuse iteratorOpen1270, iteratorStep1271, throw-close2440, callback113, ToPropertyKey900, null-prototype allocation112, data-property definition1861 and text111. No new private IDs or heap kinds are introduced.

The callback receives exactly(value,index) with undefined receiver. Callback and Object key-conversion errors close the iterator while retaining the original exception. Iterator step/value failures do not close. Object results have null prototype; Symbol keys are retained. Group arrays are created intrinsically and filled through private data-property definition, bypassing inherited setters and mutated public methods. Intermediate containers cannot escape to callbacks.

`/tmp/lanes-group-by-integration.patch` targets the staged standard-library core and changes registry/shader only: adds Object owner19, installs both methods, registers private aliases, removes the Map.groupBy gap and recognizes deleted Object.groupBy as an ordinary missing property. It is not applied to live core. A separate isolated combined tree at`/tmp/lanes-group-by-stage` passes32 exact native/Wasm packed comparisons.

`group-by-check.mjs` verifies125 directed native/helper values,480 differential cases and34 raw compiler comparisons. `browser-group-by.html` requires32 GPU programs/125 values, one real GC probe, one single-instruction resumption and one separately counted heap-resource boundary. Finite VM budgets and missing Proxy semantics remain explicit limits. GPU qualification is pending.
