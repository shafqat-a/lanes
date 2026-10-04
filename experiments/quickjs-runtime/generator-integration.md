# Synchronous generator integration contract

Status: production WGSL extension and an executable integration recipe are staged in new files. Live core is unchanged. Host/native/Wasm checks pass; GPU compilation and execution have not run for this extension. This is not yet a qualified runtime feature.

## Apply and qualify

`generatorIntegrationPatch(originalFiles, {iteratorPrototypeNode:77,toStringTagNode:42})` from `generator-integration-patch.js` returns patched strings for `program.js`, `phase4-registry.js`, `phase4-class-elements.js`, `bootstrap.js`, and `shader.js`. It does not write files. Every replacement requires exactly one matching anchor and fails on core drift. Preserve unrelated dirty changes when applying; rerun the preview after another core integration.

No vendor/bridge/compiler rebuild is required: the existing compiler exports synchronous generator kind 1 and `initial_yield`, `yield`, `yield_star`, `return_async`. The packer marks kind 1 with bit 18 of function-info.w and appends GPU opcodes/fields. Async functions remain rejected. Existing generator class/private methods become admitted.

Generic iteration now initializes shared IteratorPrototype at fixed node 77. Its Symbol.iterator identity is node 34. Generator prototype is fixed 74 and GeneratorFunction prototype is fixed 75; fixed 76 remains reserved but unused. Existing reserved-root allocation/sweep must continue covering initialized nodes through 79. Generator methods are IDs 2500/2501/2502 (next/return/throw); 2503 identifies GeneratorFunction, whose dynamic-code invocation/construction remains explicitly unsupported. Guest delegation helpers2504/2505 implement cached iterator next and dynamic return/throw calls. Continuation104 unpacks the private call-result pair; other104–119 slots remain reserved.

Add browser build entries `browser-generators.js` and `browser-generators.html`. Default page checks all55 programs/110 values, six mandatory GC-pressure cases, and five one-instruction resumptions. `?coreOnly=1` explicitly narrows to41core programs; a narrowed delegation suite is never reported as qualified. Browser results use `quickjsReport`/`quickjsError` and dispose runtime/jobs.

## Runtime representation and control flow

A generator is an ordinary object (tag 4, heap kind 2) with an unflagged value.z link to its brand/state header (kind 56). This does not use the high-bit function-backing owner encoding. Header stores saved PC, environment, saved operand-list head, lifecycle, owning object, and a saved-this node. Operand nodes are kind 57; saved-this is kind 58. Heap kinds 59–63 remain unused. Active generator environments use value.w=6 and value.z=owning object, distinct from constructor environment marker 5.

Calling a generator creates its activation and runs parameter initialization before `initial_yield`, matching QuickJS/native timing. Suspension saves only its activation's operand segment; nested callbacks have returned before a yield. Resume restores that segment and environment into a fresh caller-specific frame, retaining each invocation's return PC and continuation. Local catch/finally/gosub state and internal reference cells remain in the saved operand segment. Normal yield resumes with the sent value and completion mode; injected throws enter the existing exception unwinder. Delegated yield returns the iterator-result object unchanged and retains the delegation protocol's completion mode.

The finish hook wraps generator return values exactly once. The exception-frame crossing hook closes escaped generators while preserving catches inside their frame. Completed generators discard environment/stack/this links. Reentrant resume and incompatible receivers throw guest TypeError. Suspended generators preserve the actual boxed/sloppy receiver from their frame.

GC traces object→header, header→environment/stack/object/this, and every saved operand/receiver value. Before suspension allocates its operand list, collection occurs while the yielded value and full operand stack are still rooted. Allocation never performs an implicit mid-helper collection; exhaustion remains a resource-limit outcome. Both pressure fixtures must record actual collections on GPU, not merely produce correct values.

## Validation already performed

- `node experiments/quickjs-runtime/check-generators.mjs`: 110 fresh native oracle outcomes,55 raw native/Wasm programs, static WGSL identifier/interpolation checks. Atom-ID operands alone are normalized in raw comparison.
- `node experiments/quickjs-runtime/check-generator-integration.mjs`: temporary patched-module imports and 55 fully bootstrapped native/Wasm image comparisons. Live files remain untouched; existing opcode/field IDs are checked unchanged.
- Latest preview preserves 153 opcode identities and 399 existing fields.
- All55 core/delegation programs now pack; the new delegation source module implements `iterator_next`, `iterator_call`, and `iterator_check_object`. Async-only iterator opcodes stay rejected. Generated WGSL has206functions and an acyclic call graph.

GPU shader compilation, real resumption behavior, GC pressure, and interaction with the merged generic iterator implementation still require M1 Safari verification. Static checks and packed-image parity do not prove WGSL runtime correctness. Generator methods currently share the runtime's unbacked builtin-function descriptor/mutation limitations; dynamic GeneratorFunction construction and asynchronous generators are not implemented.

## Additional suspension and abrupt-completion audit

Nine independent fixtures extend the original set: return replacing a pending return during a finally yield; throw replacing a pending return; return replacing a pending throw; nested finally yields; both reentrant return and throw; defaults captured before later caller mutation; and three collections where only the saved operand stack, saved receiver, or pending return completion owns a dynamic value. Fixed expectations agree with fresh native executions for both input values. The browser enforces actual collections for all five GC fixtures.

Activation/frame allocation never invokes collection internally: `alloc` reports resource exhaustion, and dispatch collects before an instruction while arguments/callee are still on the live stack. `generatorEnter` installs its object/header links before the following instruction can collect. The only new internal collection is at the start of suspension, before popping the yielded value, with the active environment and frame still rooted. Saved-list nodes are linked before instruction exit. Resume reads saved nodes without allocating; it restores them to the live stack before detaching the header's saved-list root.

Reentrant next/return/throw detects executing state before changing the stack or generator header; the normal guest exception path handles the TypeError. Exception unwinding closes a generator only when crossing its activation boundary; catches/finally within the activation remain available. Parameter initialization executes before initial_yield, so default side effects and abrupt defaults happen during generator invocation. No new defect was found in this audit; these invariants still need confirmation by the actual WGSL GPU tests.

## Protocol-aware refresh

The refreshed recipe inserts generator frame cleanup immediately before depth decrement in the current deferred IteratorClose unwinder. Encountering a for-of marker suspends unwinding first, so the active generator remains executing while the iterator.return helper runs. Closing its frame occurs only after close completion resumes unwinding. The deferred status9 path remains owned by the protocol integration; generators add no recursive WGSL call edge.

`generator-delegation-source.js` supplies guest helper functions for QuickJS yield-star opcodes. They use the generic IteratorRecord's cached next/iterator and call next with exactly one argument, including initial undefined. Return and throw methods are retrieved dynamically with the original iterator as receiver; missing methods return a private null-prototype result pair, preserving the sent value. The compiler's existing branches implement missing-throw close, return completion, and finally behavior. Yield-star preserves the raw iterator result object, so a lazy value getter is not invoked merely to forward a yielded result.

Ten new delegation fixtures cover cached-next/argument count, absent return, return with done:false, handled throw, missing throw closing without arguments, return-getter abrupt completion/finally, done-getter error without close, nonobject results, result identity/lazy value, and retained delegation state across real GC pressure. All110 fixed native outcomes and55 native/Wasm packed comparisons pass. Host results are not GPU runtime verification.
