# Array.from integration contract

The helper implements ES2025 [23.1.2.1 Array.from](https://tc39.es/ecma262/2025/multipage/indexed-collections.html#sec-array.from) as guest bytecode. Host evaluation appears only in test support and browser reference oracles.

- Public ID203 is the existing `Array.from` identity. Install `arrayFromSources`, merge `arrayFromIntrinsics`, append metadata field `arrayFrom`, and include `arrayFromMetadata` in the shader's builtin metadata/dispatch list. Existing constructor property installation already supplies ID203.
- Requires the staged standard-library IsConstructor2312 implementation. Symbol and BigInt return true from IsConstructor despite throwing when actually constructed. Bound targets must be unwrapped without reading guest `prototype` properties.
- Reuses iteratorStep1271, iteratorCloseThrow2440, call113, null-prototype descriptor112, ToObject926, strict ToNumber1164, primitive text111 and CreateDataPropertyBool1861. No new builtin IDs, storage bindings or heap kinds.
- The iterable path reads `@@iterator` exactly once, constructs the result before calling that method, and creates the existing kind3 iterator record. It closes only mapper/element-definition/length-overflow abrupt completions. Step/done/value failures and the final length setter do not close. Throw-close retains the original guest exception even when the return getter/call fails.
- The array-like path captures length before constructing, defines every index including absent source slots, and uses strict final length assignment. Both paths bypass inherited numeric setters when creating result elements.

Finite heap/frame/stack and execution budgets retain their existing resource diagnostics. The helper has no CPU fallback, hidden host iterator, arbitrary truncation, or successful partial result at a resource boundary. Proxy-dependent semantics require the separate Proxy implementation.

`array-from-check.mjs` checks fixed native/helper outcomes, differential cases and native/Wasm bytecode parity. Once registration is present, it also checks exact packed code and image parity. `browser-array-from.html` runs40 programs/157 input values, including one mandatory-GC fixture and one single-instruction resumption fixture, plus one separately counted resource boundary. `?collections=1` adds Map/Set consumers (42 programs/165 values). Browser reports are required before claiming GPU qualification.

Integration patches are prepared separately for the current core (`/tmp/lanes-array-from-integration.patch`) and the isolated standard-library stage (`/tmp/lanes-array-from-stdlib-integration.patch`). Apply only the matching patch after its IsConstructor dependency is integrated. No live core files were edited by this task.
