# Upstream propertyHelper harness extension

This extension supplies the actual upstream `propertyHelper.js`, rather than admitting the include name without definitions. The loader is integrated into all four inventory/export runners. Historical reports are retained. The new full inventory admits 33,611 files / 65,209 variants and retains 19,986 harness-blocked files; admission is not GPU conformance. Directed M1 verification is pending.

## Provenance and source preservation

Pinned Test262 repository: https://github.com/tc39/test262

Revision: `7ab7fafa0003f73fc85c1b95d88094d33f7eb8bd`.

`test262-upstream-harness-sources.js` embeds byte-preserved `sta.js`, `assert.js`, `compareArray.js`, and `propertyHelper.js` Git blobs. `test262-upstream-harness-manifest.json` records each original path, Git blob identity, SHA-256 digest, and byte length. The upstream BSD copyright/conditions/disclaimer are retained in `test262-upstream-harness-LICENSE.txt`; original copyright headers are also retained in every source string. No helper algorithm or diagnostic text is rewritten.

`sta.js` supplies Test262Error; `assert.js` supplies assertion predicates, diagnostics, and compareArray. The pinned compareArray.js is an upstream compatibility include. Property helpers capture their primordial functions exactly as upstream specifies. All verifyProperty, callable/accessor, primordial, and deprecated helper definitions are supplied.

The executed original test body remains verbatim. For propertyHelper tests only, the wrapper contains the upstream sloppy harness scripts and invokes a nested test function with the requested strict directive. This prevents strict tests from accidentally changing the strictness of the separately loaded harness scripts. Tests without propertyHelper retain the existing legacy wrapper and assertions.

This is still function-adapted execution, not a Script or full Test262 runner. The existing conservative classifier continues excluding negative/script-dependent tests, async/module/raw flags, host/realm hooks, top-level this/arguments, and unsupported includes. Unknown includes cannot be loaded through paths. Only include metadata is normalized for reusing the legacy classifier, then original include names are restored in the admission result. Neither executed source nor harness bytes are transformed. `test262Variants` is unchanged, so excluded files retain variant records.

## Integration

`propertyHarnessIntegrationPatch(originalFiles)` returns guarded patched source strings for:

- `test262-inventory.js`
- `test262-adapted.mjs`
- `export-test262-browser.mjs`
- `inventory-test262-full.mjs`

The patch routes their imports through `test262-property-harness.js` and updates the inventory method description. It never writes files. Apply only once all four consumers can change together, so native inventory and browser-export sources use the identical wrapper. Existing tests that currently expect propertyHelper itself to be excluded must be updated to a genuinely unsupported include; do not remove exclusion accounting assertions.

Rerun full inventory after integration. The previous 4,568 first-blocked propertyHelper files are candidates, not an automatic count of newly executable or passing tests: subsequent includes, execution contexts, compiler support, and resource limits remain individually reportable. Preserve all old evidence as historical. Add the pinned revision and source manifest to exported evidence provenance. Native success and compiler admission do not count as GPU conformance.

## Validation

- `node --test experiments/quickjs-runtime/test262-property-harness.test.mjs`: 35 tests pass, including 30 native helper scenarios across strict/sloppy modes, manifest integrity, verbatim source checks, dependency completeness, and explicit exclusion/variant behavior.
- `node experiments/quickjs-runtime/check-property-harness-upstream.mjs`: deterministic first 20 propertyHelper-using Object.defineProperty files from pinned Git objects; all 40 variants pass fresh native execution, 38 pack in the real Wasm compiler, and 2 remain compiler-blocked by the existing Date global gap. All records are retained. No pass-based sample selection.
- Basic descriptor verification packs with the full upstream harness in both modes (approximately 107,000 image words); this is compiler admission only, not GPU performance or semantic evidence.

Local reports: `/tmp/lanes-property-harness-tests.log` and `/tmp/lanes-property-harness-upstream.json`.
