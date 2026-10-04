# Phase 3 conformance inventory

Live source review. Not a GPU run and not a phase 3 completion claim.
Pre-wave baseline: `experiments/bootstrap/evidence/quickjs-foundations-integration-manifest.json` (`remainingLimits` includes `Symbols/BigInt and full exotic object model`; integrated suite 1185/10665/102). Phase 4 and phase 5 Math/Number/JSON are already in the current `shader.js`, `program.js`, and `bootstrap.js` beyond that manifest. This wave may claim only the rows in "This wave may claim".

## Already integrated

### Value tags in use (`V.z`)

| Tag | Meaning | Evidence |
|---|---|---|
| 0 | number | `num` in `shader.js` |
| 1 | boolean | `boolean` in `shader.js` |
| 2 | null | `push` null packing in `packProgram` |
| 3 | undefined | `undef` in `shader.js` |
| 4 | object | `object` opcode, `objectView` |
| 5 | guest function | `closure` returns `V(id,0,5,0)` |
| 6 | uninitialized TDZ | `set_loc_uninitialized` |
| 7 | string | `makeText` |
| 9 | catch offset | `catch`; for-of marker is `V(0,1,9,0)` |
| 10 | gosub return | `gosub` / `ret` |
| 11 | native or private builtin id | `call` when `fnValue.z==11` |
| 12 | accessor callback | `getProperty` returns `z==12` then `call` |

`PHASE-4-STATUS.md` "Runtime vocabulary" matches this set. Tags 17 and 18 are not produced.

### Heap kinds in use

| Kind | Role | Evidence |
|---|---|---|
| 0 | free | `collect` |
| 1 | environment cell | `environment`, `closure` |
| 2 | ordinary object | `object` opcode; Math; JSON |
| 3 | data property | `dataProperty` |
| 4 | environment | `environment` |
| 5 | closure | `closure` |
| 6 | capture link | `closure` (`alloc` kind 6) |
| 7 | array | `arrayProto`, `array_from` |
| 8 | error | `makeError` |
| 9 | accessor | `defineAccessor` |
| 10 | string chunk | `makeText` |
| 11 | prototype slot | `getProperty` / `putProperty` `kind==11` |
| 12 | bound function | `bindFunction` |
| 13 | wrapped primitive holder | kind-16 `value.y`; boxing comment |
| 14 | arguments | `argumentsObject` |
| 15 | mapped arguments alias | `argumentsObject` mapped path |
| 16 | string/number/boolean wrapper | `WRAPPER_KIND` in `boxing-metadata.js` |

`PHASE-4-STATUS.md`: kinds 0–16 are in use. No `kind==17` through `kind==23` in `shader.js`.

### Fixed nodes

`alloc` starts at `freeHead=1` in `main`. `collect` roots `root<=25`.

| Node | Object | Kind |
|---|---|---|
| 1 | Object.prototype | 2 |
| 2 | Array.prototype | 7 |
| 3 | Function.prototype | 2 |
| 4 | Error.prototype | 2 |
| 5 | TypeError.prototype | 2 |
| 6 | ReferenceError.prototype | 2 |
| 7 | RangeError.prototype | 2 |
| 8 | SyntaxError.prototype | 2 |
| 9 | URIError.prototype | 2 |
| 10 | EvalError.prototype | 2 |
| 11 | Error constructor | 2 |
| 12 | TypeError constructor | 2 |
| 13 | ReferenceError constructor | 2 |
| 14 | RangeError constructor | 2 |
| 15 | SyntaxError constructor | 2 |
| 16 | URIError constructor | 2 |
| 17 | EvalError constructor | 2 |
| 18 | Array constructor | 2 |
| 19 | Object constructor | 2 |
| 20 | String.prototype | 16 |
| 21 | Number.prototype | 16 |
| 22 | Boolean.prototype | 16 |
| 23 | Math | 2 |
| 24 | Number constructor | 2 |
| 25 | JSON | 2 |
| 26 | String.prototype primitive holder | 13 |
| 27 | Number.prototype primitive holder | 13 |
| 28 | Boolean.prototype primitive holder | 13 |

Nodes 23, 24, and 25 are the Math / Number / JSON objects named by the wave budget. `objectView` maps builtin 122 to node 24. Capture type 6 points at 23 and 25, not at 24.

### Capture type 6

| `spec.x` | Meaning | Site |
|---|---|---|
| 0 | local cell | `closure` |
| 1 | argument cell | `closure` |
| 2 | outer `var` cell | `closure` |
| 3 | root self-name | `packProgram` `add([3, ref.index, 0, 0])` |
| 4 | builtin id, tag 11 | `closure` `spec.x==4`; Number is `add([4, 122, 0, 0])` |
| 5 | immutable global literal | `closure` `spec.x==5`; `NaN` / `Infinity` / `undefined` |
| 6 | fixed heap object, tag 4 | `closure` `spec.x==6` |

Type 6 sites in `packProgram`: `Math` is `add([6, 23, 0, 0])`, `JSON` is `add([6, 25, 0, 0])`.

### Phase 4 builtin ids 1200..1399

| Id | Symbol | Where |
|---|---|---|
| 1210 | `__lanesSpreadAppend` | `phase4-spread.js` `spreadPrivateBuiltins` |
| 1240 | `__lanesOwnPropertyKeys` | `phase4-object-spread.js`; WGSL calls `ownKeys` |
| 1241 | `__lanesCopyDataProperties` | `phase4-object-spread.js` field `copyDataProperties` |
| 1270 | `__lanesIteratorOpen` | `ITERATOR_OPEN` in `phase4-iteration.js` |
| 1271 | `__lanesIteratorStep` | `ITERATOR_STEP` |
| 1272 | `__lanesIteratorClose` | `ITERATOR_CLOSE` |
| 1273 | `__lanesIterationKind` | `ITERATION_KIND`; WGSL `iterationKind` |
| 1274 | iterator `next` placeholder | `ITERATOR_NEXT_PLACEHOLDER` |
| 1350 | `__lanesForInStart` | `phase4-for-in.js` |
| 1351 | `__lanesForInNext` | `phase4-for-in.js` |
| 1352 | `__lanesForInOwn` | `forInObjectMethodWGSL` |
| 1353 | `__lanesForInKeys` | `forInKeys` |
| 1354 | `__lanesGetPrototypeOf` | `forInPrivateBuiltins` in `phase4-for-in.js` |

1200–1209, 1211–1239, 1242–1269, 1275–1309, 1310–1349, 1355–1399 are not assigned in the phase 4 modules above. `PHASE-4-STATUS.md` still reserves them. Template lowering reuses builtin 134 (`toText`), outside 1200..1399.

### Phase 5 ids confirmed in the linked metadata

Imported by `shader.js` `phase5Methods` and installed from `bootstrap.js` / `program.js`.

| Ids | Methods |
|---|---|
| 1400–1404 | Array `join`, `toString`, `map`, `filter`, `slice` |
| 1500–1509 | String `at`, `codePointAt`, `repeat`, `padStart`, `padEnd`, `trim`, `trimStart`, `trimEnd`, `isWellFormed`, `toWellFormed` |
| 1506, 1507 | also `trimLeft`, `trimRight` (same function objects) |
| 1600–1603 | `Number.isFinite`, `isNaN`, `isInteger`, `isSafeInteger` |
| 1610–1618 | `Math.abs`, `sign`, `floor`, `ceil`, `trunc`, `round`, `min`, `max`, `pow` |
| 1700–1702 | `toReversed`, `toSpliced`, `with` |
| 1740 | `JSON.parse` |
| 1770 | `__lanesCodeUnit` |
| 1780, 1781 | `Number.parseInt`, `Number.parseFloat` (global captures type 4) |

`json-stringify-metadata.js` names 1820–1822 but `bootstrap.js` does not import it. README still lists `JSON.stringify` as pending.

### Temporary toStringTag bridge

WGSL function `objectMethod`, builtin id 155 (`__lanesObjectToString` in `bootstrap.js` `privateBuiltins`). `Object.prototype.toString` is objectBuiltins index 5, id `150+5`.

The bridge walks the prototype chain and returns `[object Math]` when `tagCurrent==23` and `[object JSON]` when `tagCurrent==25`. The comment in `objectMethod` says Symbol integration must replace this bridge. No `Symbol.toStringTag` lookup exists.

## This wave may claim

| Resource | Range | Current source |
|---|---|---|
| Value tag | 17 Symbol | absent |
| Value tag | 18 BigInt | absent |
| Heap kinds | 17..23 | absent. Limb storage for this wave is kind 19 |
| Fixed nodes | 26 upward | 26..28 already hold wrapper primitives. Later init `alloc`s also occupy ids. Not free |
| Builtin ids | 1000..1199 only | no assignment found |

Nothing else (new tags, kinds 24+, ids outside 1000..1199, continuations) is in this wave's budget.

## Must not be touched

| Area | Range | What is already live |
|---|---|---|
| Phase 4 heap kinds | 24..31 | reserved; iteration notes say 24–25 unused |
| Phase 4 continuations | 40..55 | 40 step, 41 open, 50 for-in next are live. 42–49 and 51–55 reserved |
| Phase 4 builtin ids | 1200..1399 | see the table above |
| Phase 5 builtin ids | 1400..1819 | see the phase 5 table. Unused numbers in the range stay reserved |
| Other wave builtin ids | 2000..2199 | not present; still reserved |
| Other wave heap kinds | 32..39 | not present; still reserved |
| Other wave continuations | 56..71 | not present; still reserved |
| Software binary64 | `numberWGSL` from `src/vm/number.js`, used by `shader.js` | live arithmetic |
| Exception identity | status 4/5/8 become `makeError` then `raise`; status 7 is the uncaught guest exception. Prototypes are nodes 4–10 | `runtime.js` `decode` names |
| Existing GC roots | `collect` marks nodes 1..25, env, result, frames, stack, and the current kind arms in `mark` / `markValue` | do not drop or renumber |
| Instruction resumption | `finish` tails 1–7 plus phase 4 tails 40, 41, 50 | `finish` comment lists 2 setter, 3 constructor, 4/5 postfix, 6 local store, 7 converted key |

`markValue` roots only tags 4, 5, and heap strings (tag 7, `w==0`). That set is an existing root rule.

## Symbol target boundary

Baseline for every row is `absent` (no Symbol values, no symbol keys, `keyOf` returns status 6).

| Behavior | Target |
|---|---|
| Identity (`Symbol(s) !== Symbol(s)`, `Symbol.for` registry identity) | implement |
| `new Symbol` throws TypeError | implement |
| `Symbol.for` / `Symbol.keyFor` | implement |
| `typeof` is `"symbol"` | implement |
| `.description` | implement |
| Property keys | implement |
| Enumeration order: integer indices, strings, then symbols | implement |
| `Object.getOwnPropertySymbols` | implement |
| `Reflect.ownKeys` includes symbols | implement |
| Object spread copies enumerable symbol keys | implement |
| `for-in` excludes symbols | implement |
| `Symbol.iterator` | implement |
| `Symbol.toPrimitive` | implement |
| `Symbol.toStringTag` (replaces the `objectMethod` id 155 bridge) | implement |
| ToPrimitive symbol hook | implement |
| `iterationKind` returns 0 when `@@iterator` is overridden | implement |
| `Symbol.asyncIterator` | explicit unsupported |
| `Symbol.hasInstance` | explicit unsupported |
| `Symbol.isConcatSpreadable` | explicit unsupported |
| `Symbol.match` | explicit unsupported |
| `Symbol.matchAll` | explicit unsupported |
| `Symbol.replace` | explicit unsupported |
| `Symbol.search` | explicit unsupported |
| `Symbol.species` | explicit unsupported |
| `Symbol.split` | explicit unsupported |
| `Symbol.unscopables` | explicit unsupported |
| `Symbol.dispose` | explicit unsupported |
| `Symbol.asyncDispose` | explicit unsupported |

## BigInt target boundary

| Behavior | Baseline | Target |
|---|---|---|
| Tag 18 | absent | implement |
| Limb heap kind 19 | absent | implement |
| Add, sub, mul, neg, same-type compare | absent | implement |
| Literal packing | absent (`packProgram` number/string constants only) | implement |
| `typeof` is `"bigint"` | absent | implement |
| Strict equality with a number is false | absent | implement |
| `MAX_LIMBS` resource-limit | absent | implement as resource-limit, not wrap |
| Division | absent | explicit unsupported (not proven; do not fake) |
| Bitwise | absent | explicit unsupported (do not fake with ToInt32) |
| Mixed relational comparison | absent | explicit unsupported TypeError (do not call helper 130) |
| `ToBigInt(number)` | absent | explicit unsupported (do not fake) |
| `ToBigInt(string)` | absent | explicit unsupported (do not fake) |
| `JSON.stringify` of a bigint | absent | explicit TypeError once stringify exists; do not emit a digit string. Not in core |
| BigInt wrapper objects | absent | explicit unsupported (do not reuse kind 16) |

## Integration risks

| Risk | Evidence | If ignored |
|---|---|---|
| Id collision outside 1000..1199 | Phase 4 ids above; phase 5 ids 1400–1781; boxing 920–934; string search 800+; object statics 710–716; `__lanesToPropertyKey` 900. `call` resolves phase 5 ids by `phase5Methods` before `objectMethod`. `objectMethod` then does `if(id>=150) status=6` | An id outside 1000..1199 overwrites a live helper, or a new id with no arm before that fallback is status 6 |
| Nodes 23..25 clobber | Math 23, Number constructor 24 (`objectView` builtin 122), JSON 25. Captures type 6 use 23 and 25. Roots are `root<=25` | Inserting an `alloc` before those three renumbers Math/Number/JSON and breaks captures and the tag bridge |
| Nodes 26..28 are not free | Next three `alloc`s are kind-13 holders for String/Number/Boolean.prototype. They are not in the root loop; kind 16 marks `value.y` | Treating 26 as the first Symbol/BigInt node overwrites a wrapper holder. Extending `root<=25` edits an existing GC root |
| Integer-index sort | `arrayIndex`: bit `0x80000000` is an index; otherwise canonical decimal. `ownKeys` and `forInKeys` selection-sort those indexes and `unsignedText` them | A symbol key that uses that bit, or that `keyName` can print, is emitted as a decimal string and sorted with indexes |
| Temporary toStringTag | `objectMethod` id 155 hardcodes nodes 23 and 25 | Another hardcoded node does not implement `Symbol.toStringTag` and will miss `Object.create` chains once real tags exist. Replace the bridge |
| Spread / for-in symbol handling | `copyDataPropertiesBootstrap` copies whatever `__lanesOwnPropertyKeys` (1240) returns. `forInKeys` always `keyName`s non-index keys. `forInNextBootstrap` rejects `typeof key !== "string"` only after that stringification | Enumerable symbols never spread. for-in can enumerate a stringified symbol instead of skipping it |
| `iterationKind` ignores overrides | `iterationKind` returns 1 or 2 from kind and prototype nodes 2 and 20 only. Comment says the phase 3 hook is still open. `spreadAppend` trusts kind 1/2 | `Array.prototype[Symbol.iterator] = ...` still takes the intrinsic fast path |
| Tag 18 hits number coercion | `add` / relational / bitwise opcodes send `z>=4` to helpers 132 / 130 / 128 (`addition`, `relational`, `binaryNumber`) before `binary` | A bigint would be ToNumber'd or compared as a number. Mixed `<` must be TypeError, not a number result |
| `typeof` default | `typeof` index 2 is `"object"` unless tag is 0, 1, 3, 5, 11, or 7 | Tags 17 and 18 would report `"object"` until the opcode gains arms |
| Pending stringify id 1820 | `json-stringify-metadata.js` only. Not in `bootstrap.js` | Do not occupy 1820 or edit that sibling file. Do not pretend `JSON.stringify(1n)` already throws TypeError |
