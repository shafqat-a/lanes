# Dynamic Function compilation: implemented service, GPU integration pending

The new service performs real QuickJS compile-only work; it never executes guest
JavaScript on the CPU. `createFunctionCompiler().compileFunction(parameters, body)`
returns a trusted, deeply frozen **unlinked** raw artifact. This is not public
`Function` support. Existing GPU Function constructor rejection stays in place.

Implemented contracts:

- Input strings have already undergone guest ToString, left to right, on GPU.
  There is no host coercion. Zero arguments means empty body; with arguments,
  the last is body and earlier strings are comma-joined parameters.
- Parameter grammar, body grammar, and their combination are parsed separately;
  strict directives and default/rest parameter errors remain SyntaxErrors.
- The compiler sees an unnamed function expression. The exported root receives
  name `anonymous` and the mandated source spelling afterward. `anonymous` in
  the body remains a global reference, never a private self binding.
- No inherited caller strictness or lexical capture. Nested functions may
  capture locals belonging to this dynamic root normally.
- Current capacity: 16 parameter strings, 256 UTF-16 units per string, 4352 total.
  NUL and unpaired surrogates are explicit Unsupported transport cases until
  the compiler has a length-delimited UTF-16 interface. These are not disguised
  as guest SyntaxErrors.

## Request ABI proposal (not yet installed in shader)

An owned Uint32 snapshot contains eight header words followed by length-prefixed
UTF-16 strings: `[magic=0x4c444643, version=1, requestId, lane, kind=1,
parameterCount, totalWords, reserved=0]`. Parameter strings precede the body.
Each string occupies `[unitCount, ...UTF16Units]`. Request ids are nonzero and
must never repeat within a lane/job. A service admits at most 256 requests.

`DynamicCompileService.request(words,{signal})` returns a response with matching
lane/id and completion `compiled`, `syntax-error`, `resource-limit`, or
`unsupported`. Malformed packets, duplicate ids, compiler infrastructure errors,
and cancellation reject the host operation, not a catchable guest exception.
Disposal/abort interrupts queued and active callers; an in-flight compilation
must settle before the next compiler entry, and late results are never published.

## Required integration before any support claim

1. Reserve the initial image's function-table prefix before every live pointer
   is created. `planDynamicAppend` checks append-only function/code/image spans;
   `validateDynamicAppendPayload` copies buffers and checks new function-header
   addresses. Neither function is a linker or certifies instruction relocations.
2. Add a trusted packer using those spans. It must relocate every function id,
   code address, string/source/constant/ref address, closure specification and
   field lookup, while reusing immutable existing builtin tables. Preserve all
   old code/image bytes and ids. `dynamicGlobalRoot` must bypass the existing
   entry-name self binding and entry-function global installation.
3. Dynamic global resolution must include the realm's **global lexical** record,
   not just GLOBAL_OBJECT properties. The initial Script work currently keeps
   lexical cells in its root captures; expose/retain those cells to dynamic
   functions without importing caller-local scope. Until then dynamic functions
   in such script realms must remain explicitly Unsupported.
4. GPU coercion and suspension need retained roots for argument strings and the
   pending continuation. No default parameters/body run during compilation.
   Resume installs the closure in the original realm and creates ordinary
   function prototype/name/length metadata. Guest SyntaxError is raised at this
   continuation; resource/status failures never replay CPU execution.
5. Runtime publication must write code/image/function-table data before a
   matching response record is made visible, then recreate bindings if buffers
   grow. A failed/aborted partial upload terminates the job; do not resume stale
   responses. All lanes retain their budgets, heaps, job queue and suspended
   frames. Pending protocol state must survive all three GPU pipelines.

No production runtime, shader, bootstrap, program packer, or compiler bridge was
changed by this increment. Host tests include native/Wasm actual compile parity,
metadata, grammar separation, global capture shape, cancellation/disposal races,
malformed packets and append bounds. GPU roundtrip qualification is still pending.
