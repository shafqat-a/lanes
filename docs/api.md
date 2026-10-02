# API

## `await Lanes.create({ backend, device, gpu })`

`backend` is `auto` (default), `cpu`, or `gpu`. An explicit `device` is used without transferring ownership. Otherwise Lanes requests an adapter/device from `gpu`, defaulting to `navigator.gpu`, and owns that device.

`auto` uses GPU availability, not performance prediction. If adapter acquisition is unavailable or fails, it selects CPU and exposes the reason in `lanes.diagnostics.fallbackReason`. An explicit GPU request rejects if unavailable. Compilation/validation errors are never silently routed to CPU.

For Node with Dawn:

```js
import { create } from 'webgpu';
import { Lanes } from 'lanes-webgpu';
const gpu = create([]); // retain this object for the runtime's lifetime
const lanes = await Lanes.create({ gpu, backend: 'gpu' });
// ...
await lanes.dispose();
```

Install `webgpu` separately when using that implementation. It is a development dependency of this repository, not a native dependency forced on package consumers.

## `lanes.compile(source, { numericMode: 'i32' })`

Returns a kernel synchronously after parsing, validating, and lowering. Unsupported source throws `CompileError`; where available, its `line` and `column` are one-based source positions. Named ordinary functions are accepted as objects or source strings; arrow functions and object methods are outside this alpha.

The returned kernel exposes immutable `ir` and generated `wgsl` for inspection. Identical source/options reuse the kernel. GPU pipeline creation starts on first GPU execution. The cache key includes compiler version, explicit numeric mode, and source; caches are scoped to the runtime's GPU device. Concurrent requests share the in-flight promise. Failed pipeline promises are evicted. No cache eviction policy beyond runtime disposal exists yet.

## `await kernel.run(inputs, { backend })`

Accepts an `Int32Array`, returns a new `Int32Array`, and leaves input untouched. The optional backend overrides the runtime default for this operation. It allocates a transient batch, executes, reads the result, and releases buffers. Empty inputs return an empty array.

The CPU fallback executes prebuilt closures over typed IR and requires no dynamic host-code evaluation. Its purpose is compatible execution; it is not expected to match a native JavaScript JIT's speed.

## `await lanes.batch(inputsOrLength, { backend })`

Creates a persistent batch from a copy of typed input, or a zero-initialized batch of the supplied length. GPU allocation requires two storage buffers plus a staging buffer: 12 bytes per input, excluding implementation overhead. Length is fixed.

- `await batch.upload(inputs)` replaces the current values, copying host input before queueing the operation. Length must match.
- `await batch.run(kernel)` transforms current values. Kernels must belong to the same runtime. GPU calls submit work and leave output resident; subsequent calls consume that output.
- `await batch.read()` returns an independent host copy and waits for GPU results.
- `await batch.dispose()` prevents new operations, waits for queued host operations, and releases resources. Repeated disposal is safe.

Calls on a batch are serialized in invocation order, including uploads and reads. Different batches can operate concurrently. Compilation errors and device loss reject promises; callers must handle rejections.

## Device loss and disposal

`lanes.backend` reports the effective default backend. If an auto runtime loses its device, future host-input runs use CPU; explicit GPU runs reject. Existing GPU-resident batch contents cannot be recovered and reads/runs reject. Create a new runtime to acquire a replacement device.

`await lanes.dispose()` prevents new work, disposes batches, clears caches, and destroys an owned GPU device. A caller-supplied device is never destroyed by Lanes. `lanes.diagnostics` exposes compilation/cache-hit and dispatch counters, fallback/loss reason, and disposal state.
