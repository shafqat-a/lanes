# Phase 3 conformance contract

This package is an inventory and a semantic contract. It does not declare phase 3 complete. No GPU run was performed. Guest source was not executed on the host.

## Verified in current source

- Value tags 0–7, 9–12 are the tags `shader.js` actually constructs. Tags 17 and 18 are absent.
- Heap kinds 0–16 are in use. Kinds 17–23 are not referenced.
- Fixed nodes 23, 24, and 25 are Math, the Number constructor, and JSON. `packProgram` capture type 6 is `add([6, 23, 0, 0])` for Math and `add([6, 25, 0, 0])` for JSON. Number is capture type 4, builtin 122, viewed as node 24.
- `collect` roots nodes 1 through 25. Nodes 26–28 are the kind-13 primitive holders for the wrapper prototypes.
- Phase 4 ids that are wired: 1210, 1240, 1241, 1270–1274, 1350–1354. `iterationKind` and `ownKeys` are the symbol choke points named in those modules.
- Phase 5 ids wired through `phase5Methods` / `bootstrap.js`: 1400–1404, 1500–1509, 1600–1603, 1610–1618, 1700–1702, 1740, 1770, 1780, 1781.
- `objectMethod` id 155 (`__lanesObjectToString`) is the temporary `@@toStringTag` bridge. It returns `[object Math]` for node 23 and `[object JSON]` for node 25.
- Integer `+` on numbers goes through `binary` / `plus`. `Array.isArray` is builtin 201 and checks heap kind 7.
- Foundations manifest `experiments/bootstrap/evidence/quickjs-foundations-integration-manifest.json` still lists Symbols/BigInt under `remainingLimits`. Later phase 4 and phase 5 Math/Number/JSON code is in the tree; Symbol and BigInt values are not.

`boundaries.js` marks only those four non-symbol behaviors `supported`, each with `file=` / `ident=` pointing at `shader.js`. `ENGINE_HAS_SYMBOL` and `ENGINE_HAS_BIGINT` are false.

## Refused to mark supported

Every Symbol guest operation and every BigInt guest operation. In particular:

- No `typeof` result of `"symbol"` or `"bigint"`.
- No `1n === 1` result of false (no bigint values exist, so that spec result is not a current pass).
- No division, bitwise ops, mixed relational comparison, `ToBigInt`, BigInt wrapper objects, or `MAX_LIMBS` failure. Those are `unsupported` in `boundaries.js`, not `resource-limit` or `type-error`, because the engine does not produce that outcome today.
- `JSON.stringify(1n)` is not marked `type-error`. `JSON.parse` is id 1740. Stringify metadata 1820 is not imported by `bootstrap.js`.
- Well-known symbols other than `iterator`, `toPrimitive`, and `toStringTag` are explicit unsupported targets, not claimed implementations.
- `programs.js` uses `expect.kind: "unsupported"` and `ready: false` for every Symbol or BigInt case. No `ready: true` program contains `Symbol(`, `BigInt`, or `1n`.

## Harness

Template found:

- `experiments/quickjs-runtime/browser-math-phase5.html` (shell: `status`, `report`, module script)
- `experiments/quickjs-runtime/browser-math-phase5.js` (`createCompiler`, `QuickJSGPU.create`, `vm.run`)

`browser-page.js` writes `phase3-focus.html`. The page imports `../../compiler.js`, `../../runtime.js`, and `./programs.js`, runs `QuickJSGPU`, and compares harness errors to `expect`. It does not use `contentWindow`, `new Function`, `eval`, or `node:vm`. `ready: false` rows that stay unsupported are reported as `boundary`, not as semantic passes. A value result on those rows is a failure.

`build-browser.mjs` was not modified. This page is not in its copy list. Loading it in Safari needs the same esbuild bundle treatment as `browser-math-phase5.js`, because `program.js` imports `acorn`. A raw browser module import will not resolve that package.

## Tests

Command:

```sh
node --test experiments/quickjs-runtime/phase3/conformance/conformance.test.js
```

Result: 6 passed, 0 failed. The focus-page module also parses (`node --check` on the extracted script).

## Risks for the parent integrator

- Do not place new builtins outside 1000..1199. `objectMethod` treats `id>=150` as unsupported unless an earlier arm matches, and `call` already maps phase 5 ids onto guest fields.
- Do not retarget nodes 23–25. Do not treat node 26 as free; it is the String.prototype primitive holder. Nodes 27 and 28 are the Number and Boolean holders. Growing `root<=25` changes an existing GC root.
- `arrayIndex` treats bit `0x80000000` as an integer index. `ownKeys` and `forInKeys` then print that index with `unsignedText`. A symbol key in that encoding becomes a decimal string.
- `forInNextBootstrap` rejects non-string keys only after `forInKeys` has already stringified them. Spread copies the array from `__lanesOwnPropertyKeys` (1240) and will not see symbols until `ownKeys` appends them.
- `iterationKind` does not read `@@iterator`. Overriding `Symbol.iterator` still takes the intrinsic array or string path.
- Opcodes send `z>=4` to numeric helpers 128, 130, and 132 before `binary`. Tag 18 would be coerced unless those gates change. Mixed relational comparison must throw, not return a number.
- `typeof` reports `"object"` for any tag other than 0, 1, 3, 5, 11, and 7.
- Leave software binary64, exception nodes 4–10, `finish` tails 1–7 / 40 / 41 / 50, phase 4 ids 1200..1399, phase 5 ids 1400..1819, and the other-wave ranges 2000..2199 / kinds 32..39 / continuations 56..71 alone.
- Do not edit `json-stringify-metadata.js` (ids 1820–1822). It is not this wave's file and it is not integrated.
