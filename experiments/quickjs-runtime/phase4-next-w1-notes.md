# Phase 4 next wave, worker 1: tagged templates (continuation)

Host-only work. No GPU run, no WGSL compilation, no CPU replay. The previous
wave's lowering (bridge `tagged-template-v1` constant export, `push_template`
opcode, per-site [[TemplateMap]] registry, String.raw guest helper id 2000) was
already integrated by the lead; this pass remaps the registry to fixed node 64,
extends fixtures/boundaries, and fixes the check scripts.

## Implemented / changed (owned files only)

- `phase4-templates.js`
  - `TEMPLATE_REGISTRY_NODE` is now imported from the lead's
    `phase4-fixed-nodes.js` (= 64) and re-exported; module load fails loudly if
    it is not a rooted phase-4 fixed node (64..79, in `PHASE4_FIXED_ROOTS`).
    WGSL emits `const TEMPLATE_REGISTRY: u32 = 64u;`.
  - Shader patch descriptors updated to the lead's fixed-node layout:
    `init-template-registry` now anchors on
    `if(jsonObject!=${FIXED_INIT_LAST}u){states[l].status=2u;}` and writes node
    64 in place (`states[l].heap[TEMPLATE_REGISTRY]=Node(V(0u),0u,0u,32u,0u);`),
    never via `alloc()`. The old `collect-template-root` patch
    (`mark(l,TEMPLATE_REGISTRY);`) is dropped: rooting is
    `PHASE4_FIXED_ROOTS` -> `mark(l,64u);` in lead code. Remaining shader
    patches: `collect-template-entry` (kind 32 marks value.x), and the three
    String.raw patches. All 15 patches are detected as "applied" in the current
    tree.
  - Header comment, notes and gaps updated (node 64, no "first allocation after
    jsonObject" assumption, optional-chain early errors, dynamic code).
- `phase4-template-tagged-cases.js`: +5 value cases (`tag-getter-throws-skips-substitutions`,
  `recursive-same-site-identity`, `class-field-initializer-site`,
  `default-parameter-site`, `tag-returns-template-object-not-copied`), +1
  unsupported (status 6) case `function-constructor-template-site`, new export
  `taggedTemplateEarlyErrorCases` (6: `o?.t\`\``, `t?.\`\``, `o?.a.b\`\``,
  `g?.()\`\``, untagged `\unicode`, untagged `\01`).
- `check-phase4-templates.mjs`: builds under `.w1-build/templates-*`; asserts
  node 64 == `phase4-fixed-nodes.js`, `const TEMPLATE_REGISTRY: u32 = 64u;`,
  free list skips 26..79 before any `alloc()` (`heap[25u].next=80u`, freeCount
  excludes 54 reserved), in-place init exactly once after the 1..25 layout
  check, no legacy `let templateRegistry=alloc(`, collect marks `64u` and kind-32
  entries, sweep skips 26..79; shader-snippet resolution handles
  `${FIXED_*}`/`${TEMPLATE_REGISTRY_NODE}` interpolations; new early-error
  section (V8 `new Script` SyntaxError, native QuickJS SyntaxError, packProgram
  SyntaxError).
- `check-template-lowering.mjs`: builds under `.w1-build/lowering-*` (was
  `.phase4-build-w1-*`).

`bridge.c`: verified that `phase4-patches/w1-tagged-template-bridge.diff` is
already applied in this snapshot (`template_constant`, features
`["template-to-string","tagged-template-v1"]`); `git apply --check -R -p0`
succeeds. No bridge/vendor change needed; no Wasm rebuild needed by this pass.

## Commands and results

| Command | Result |
|---|---|
| `node experiments/quickjs-runtime/check-phase4-templates.mjs --keep` | pass. lead files + bridge: all `applied`. cases 54, TypeError cases 12, throw cases 2; V8 oracle 70, input sensitivity 66, native QuickJS 136 runs agree; 72 admitted programs pack, 59 rejected by the base (pre-template) program.js, 64 tagged sites == 64 descriptors matching acorn cooked/raw; 4 unsupported (status 6) admitted; 2 limit (pack RangeError); 2 rejected; 6 early errors (QuickJS messages: "template literal cannot appear in an optional chain" x3, "expecting field name", "malformed escape sequence in string literal" x2). Corpus: 2,346 sources, 2,337 raw-identical, 2,305 base-admitted all bit-identical with lowering-only and same user opcodes with full; 9 newly admitted (all contain tagged templates/String.raw). |
| `node experiments/quickjs-runtime/check-template-lowering.mjs` | pass: 29 cases, V8 29 / native 58 agree, 54 `to_string`, 4 tagged sources now admitted |
| `node experiments/quickjs-runtime/check-phase4-wgsl-lint.mjs` | `{"wgslLint":"passed","fragments":40,...,"compiledByWGSL":false}` |
| `node experiments/quickjs-runtime/check-phase4-suite.mjs --brief` | FAILS before running, not caused by w1: `ReferenceError: taggedTemplateCases is not defined` at `phase4-suite.js:59` (missing import, see below) |

## Proposed shared-file edits (lead)

1. `phase4-suite.js` (missing import; the suite currently cannot load). After
   line 16 (`import { templateCases, ... } from './template-cases.js';`) add:
   ```js
   import { taggedTemplateCases, taggedTemplateTypeErrorCases, taggedTemplateThrowCases, taggedTemplateUnsupportedCases, taggedTemplateLimitCases, taggedTemplateRejectedCases } from './phase4-template-tagged-cases.js';
   ```
   Then regenerate/confirm `phase4-suite-expected.js` if needed: the n-template
   groups gain 5 value records and 1 unsupported record
   (`function-constructor-template-site`, status 6, normative `'a4'`).
2. Optional (`phase4-suite.js`): early errors have no runtime value; if the
   suite gets a parse-time-rejection kind, add
   `['n-template', 'template', 'rejected', taggedTemplateEarlyErrorCases]`
   (items carry only `feature`/`source`; rejection is a SyntaxError from the
   compiler). Otherwise leave them to `check-phase4-templates.mjs`.
3. `phase4-regression-cases.js` `phase4ExplicitUnsupportedCases` entries
   `unsupported-tagged-template` / `unsupported-string-raw` are now admitted
   (V8 `'a,b|1'`, `'a\\n2'`, native agrees); move them to value records if the
   `w8 unsupported` group asserts rejection/status 6.
4. shader.js / program.js / phase4-registry.js / bridge.c: nothing further. The
   lead's fixed-node layout already matches the updated patch descriptors
   (verified by the check). Keep `PHASE4_FIXED_ROOTS` containing 64.

## Remaining explicit boundaries

- GPU execution of all n-template records is pending (M1/Safari); WGSL never
  compiled here.
- Optional-chain tagged templates and NotEscapeSequence in untagged templates:
  early SyntaxError (normative; all three paths agree).
- `eval` tag / `Symbol` uses: compiler-rejected (unsupported global). Phase 3
  hook: template objects are plain kind-7 arrays with `Array.prototype`, so
  `@@iterator` and `Symbol`-keyed lookups need only Phase 3's `keyOf` symbol
  keys; no template-specific change.
- Function-constructor bodies: runtime status 6 (builtin 500). Cross-realm /
  per-realm [[TemplateMap]] sharing does not exist (one realm per GPU run).
- Reflective queries of `String.raw` as an own property of `String`
  (`getOwnPropertyDescriptor`, `in`): status 6 (no String backing object).
- Sloppy tags reading `this`: status 6 until the global object (node 65) lands.
- >16 template strings per site, template strings >256 UTF-16 units: pack-time
  RangeError. One `push_template` allocates at most 2*16+3 nodes (< 192 GC
  headroom). Reserving nodes 26..79 reduces the usable heap by 54 nodes (2,048
  total); programs near the heap limit can now hit status 3 sooner.
