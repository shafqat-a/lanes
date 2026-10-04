# QuickJS compiler correctness patches (local vendor modification)

`vendor/quickjs.c` is pinned to QuickJS revision `535a7c250ff4a577ec36c3e103daab6dadeea650`
(`bridge.c`, `program.js` `REVISION`). This note documents two **local patches
to the compiler front end** on that upstream base. They are
not upstream. Each patched site has a `LANES:` comment. Only host compilation changes. Production guest code
still runs only on the GPU, and no shader, program-packing or opcode-table change was needed.
Every opcode the patch emits (`get_loc_check`, `get_var_ref_check`, `drop`, `close_loc`, `goto`)
is already in `program.js` `OP`.

## Bug 1: const assignment before initialization gave TypeError

Spec: an assignment to a `const` calls SetMutableBinding. If the binding is not yet initialized,
that throws **ReferenceError**. Only an initialized immutable binding throws TypeError.

Before: `resolve_scope_var` turned every write to a const (`scope_put_var` / `scope_make_ref`)
into `throw_error <name>, JS_THROW_VAR_RO`, which is a TypeError, with no TDZ check.
`function f(x){try{k=x;}catch(e){...}const k=1;}` therefore reported a TypeError.

Patch (`resolve_scope_var`):
- **Local lexical const** (found in the scope chain, or through the strict function-name path):
  emit `get_loc_check idx; drop` before `throw_error`. In TDZ, `get_loc_check` raises
  ReferenceError. After initialization it falls through to the TypeError.
- **Captured lexical const** (an outer function's binding): the parent-scope loop no longer
  throws early for lexical consts. Resolution reaches `has_idx`, which captures the binding as
  a closure var and emits `get_var_ref_check idx; drop` before `throw_error`. Non-lexical consts
  (function-expression names) keep the old path. They are always initialized.
- The RHS is still evaluated before the check, as the spec requires (case
  `const-tdz-rhs-side-effect-first`).
- Compound assignment and update (`k+=x`, `k++`) were already correct because they read `k`
  first with `get_loc_check`. They are controls.

## Bug 2: `continue` in `for(let …)` skipped the per-iteration copy

Spec: CreatePerIterationEnvironment runs before each update, whether the body completes normally
or with `continue`. Closures from each iteration keep their own binding.

Before: the `TOK_FOR` emitter set the break entry's continue target to `label_cont` (the update
code, relocated after the body, or the test when there is no update). The end-of-body
`close_scopes` (which becomes `close_loc` for captured head bindings) sat before that label.
`emit_break` only closes the scopes nested inside the loop head scope (`top->scope_level`). So a
`continue` iteration never detached its cell, and its closures shared the binding with later
iterations (upstream comment: "XXX: check continue case").

Patch (`TOK_FOR` in `js_parse_statement`): a new `label_close` is emitted immediately before the
end-of-body `close_scopes`. It is the break entry's continue target in every loop form,
including the no-update form, which no longer overwrites `break_entry.label_cont`. `continue`
now runs close → update → test, the same path as normal completion. This also covers:
- labeled `continue L` from inner loops/blocks (`emit_break` closes the inner scopes, then
  jumps to the outer `label_close`);
- `continue` through `finally` (`gosub` to the finally block, then `label_close`);
- `for(let…;…;)` with no update, `for(let…;;…)` with no test, and both together.

The OPTIMIZE increment relocation is unaffected. `label_close` is allocated after `label_cont`
and placed after `pos_body`, so the relocation loop skips it. `for-in`/`for-of` were already
correct, because their break entry's `scope_level` is outside the loop scope. They have
native-only control cases, since Lanes rejects these loops.

## Checks

`check-compiler-correctness.mjs` with `compiler-correctness-cases.js` (37 cases: 17 const-TDZ,
20 loop). It builds into a private temp directory (`.compiler-correctness-build-*`, removed on
exit unless `--keep`). It never reads or writes `generated/`.

```sh
node check-compiler-correctness.mjs --emcc=/path/to/emcc \
  [--baseline=/path/to/unpatched/quickjs.c]
```

`EMCC` is also honoured, and `--emcc=` takes precedence. Emscripten 4.0.22 was used.

Per case:
1. The V8 host oracle confirms the fixed `expected` value. Input sensitivity: the result for
   `input+1` differs. Loop cases also recompute `sharedWouldGive` (all loop heads rewritten to
   `var`), which must differ from `expected` unless the case is a control.
2. **Native QuickJS reference:** a QuickJS interpreter built from `vendor/` runs the bytecode
   from the patched compiler, for `input` and `input+1`. It must agree with the oracle.
3. **Native and Wasm compiler parity:** the bridges built from `bridge.c` emit raw bytecode that
   matches with atom-id bytes normalized, since those ids are runtime-local. The atom strings
   are compared. Admission is the same and matches the recorded status. Packed `code`/`image`
   are identical. Packing uses `packProgram(attachBootstrap(...))`, as `createCompiler()` in
   `compiler.js` does, but against this private Wasm module.
4. **Bytecode invariant:** every `throw_error JS_THROW_VAR_RO` in every function is preceded by
   `get_loc_check|get_var_ref_check; drop`. The non-lexical function-name case is the exception
   and must stay unchecked.

With `--baseline`, the script also builds the unpatched compiler and interpreter and asserts:
- every `regression: true` case (26) fails there;
- every function source in the other `*-cases.js` fixtures and the bootstrap sources (1,304)
  compiles to identical bytecode, except sources containing `const` or `continue`.

The coordinator rerun in `quickjs-compiler-correctness-host.json` verifies
37 fixed host expectations, 74 native QuickJS executions, 37 normalized raw
compiler comparisons, 35 admitted packed-program comparisons and two identical
expected compiler rejections. All 26 designated regressions fail before the
patch and pass afterward. Of 1,304 other fixture/bootstrap sources, 1,299 have
unchanged bytecode, none are skipped, and five changed:
- the language-scope `const-assign-typeerror` and its main-corpus wrapper;
- the language-scope `const-assign-before-init-referenceerror`;
- the language-scope `for-let-continue-per-iteration`;
- one `const a=x; a=3` source in `cases.js`.

The const-after-init sources now carry a `get_loc_check; drop`, which passes at runtime.

## M1/Safari qualification

`quickjs-safari-compiler-correctness.json` records 46 passing GPU programs /
94 values, including both original defect reproductions and two resumptions:
137 single-instruction dispatches for captured const TDZ, 333 for loop captures.
Two for-in/for-of controls remain expected compiler rejections. The independent
review corpus exercises throwing RHS precedence, logical-assignment short
circuits, loop clause omissions, labels, finally mutations and capture boundaries.

The prior 1,124-program GPU baseline predates these compiler patches. Comparing
packed output identified two changed main-corpus programs; both pass all nine
main inputs (18 additional values) under the patched compiler. This is delta
verification, not a claim that the whole main suite was rerun after the patch.

The native QuickJS interpreter in the host checker **does execute guest test
programs** as a semantic oracle. `nativeReferenceExecution` is separate from
production execution: it is neither a GPU pass nor a CPU fallback. The worker
and coordinator each verified 37 cases, 74 native interpreter executions and
37 normalized raw compiler comparisons (35 packed, two expected rejections);
26 designated regressions fail before the patch and pass afterward.

The corrected language audit passes 52 programs with zero failures and two
explicitly unsupported computed-key cases. Test262 compiler-delta checks cover
all 6,732 eligible variants: 5,644 packed outputs remain identical and 1,088
variants retain the same compiler rejection, with zero changed outcomes. These
checks preserve earlier GPU evidence without claiming a fresh Test262 GPU rerun.
See `quickjs-safari-language-scope-corrected.json` and
`quickjs-test262-compiler-delta.json`.

### Safari reference discrepancy

Only `review-captured-const-tdz-throwing-rhs-wins` permits a native Safari oracle
difference, recorded for both inputs in the focused GPU report. Safari returns
`wrong`; a separate native diagnostic confirms an early ReferenceError without
invoking the RHS. Lanes returns the normative `captured:7` and `captured:8`.

[ES2025 assignment evaluation](https://tc39.es/ecma262/2025/multipage/ecmascript-language-expressions.html#sec-assignment-operators-runtime-semantics-evaluation)
resolves the identifier reference, evaluates the RHS, and only then calls
PutValue. A thrown RHS prevents the later binding assignment and its TDZ check.
[SetMutableBinding](https://tc39.es/ecma262/2025/multipage/executable-code-and-execution-contexts.html#sec-declarative-environment-records-setmutablebinding-n-v-s)
checks initialization before rejecting an initialized immutable binding.
The explicit oracle exception preserves this ordering; unrelated mismatches
still fail. See `quickjs-safari-compiler-reference.json` for the native diagnostic.

## Remaining limitations

- **Global/script-level `const` is not patched.** Writes there go through `put_var` and the
  runtime's global-variable checks, and Lanes rejects global references anyway.
- **TDZ checks are not elided.** Every lexical const write now carries one extra
  `get_loc_check`/`get_var_ref_check` + `drop`, even when the binding is provably initialized,
  and capturing a const from a closure write now allocates a closure var. These writes always
  throw, so the cost only appears on the error path and in code size.
- `with`/`eval` variable-object paths are unchanged (Lanes rejects them).
