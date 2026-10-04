# w6 symbol methods and instanceof

Parent applies these edits. This directory does not modify `shader.js`,
`phase4-classes.js`, BigInt division, `Function.prototype.toString`, or strict
global-reference timing.

Continuations **86** and **87** are reserved and **unused**. Guest calls are
the continuations: `instanceof` suspends in `call`, and a custom hook or a
bound-target re-entry suspends on the same GPU call stack. No `finish()`
tail code is added. Heap kind **53** is reserved and **unused**.

## Symbol computed names

`define_method_computed` and `set_name_computed` currently `status = 6` on
`phase3SymbolKey`. That rejection goes away for method definitions and
function names. `symbolFunctionName(l, key)` (`symbolFunctionNameWGSL`) returns
a tag-7 string:

- Symbol cell is heap kind 17. `value.y == 0` means the description is absent
  and the name is the empty-string image (`image[fieldKey(F[''])]`).
- Otherwise `value.y` is a kind-10 head and the name is `"[" + description + "]"`,
  built with `makeText`. A present empty description is `"[]"`, not `""`.
- The opcode still does `makeText(prefix, name)` when `arg != 0` (`"get "` /
  `"set "` images). String keys take that same concatenation.
- Non-symbol keys use `keyText` / `unsignedText`, the same split as `keyName`.
- `keyOf` is unchanged, so a BigInt key is still status 6. `to_propkey` is
  unchanged (symbols already pass through before `keyName`).
- `set_name_computed` still names a kind-33 private name from
  `image[heap[name].value.x]` and does not run `keyOf` on it.

`define_class_method_computed` has the same symbol status-6. Its replacement
body is `defineClassMethodComputedCaseBody`. `define_class` with the computed
bit (`ins.z & 2`) peeks the key and calls `keyName`, which status-6s symbols.
`defineClassComputedNameReplace` calls `symbolFunctionName` and does not pop
the key. `phase4-class-elements.js` does not status-6 symbol keys.

`symbolMethodPatches` holds the exact current source as `find`. Each `find`
occurs once.

Splice `symbolMethodWGSL({ F, L })` after `unsignedText` / `keyName` and before
`main`. Do not change `keyName` itself; `to_propkey` and string `ownKeys` still
call it.

## instanceof

The opcode stops calling `instanceOf` (that function still status-6s a hook;
leave it uncalled). `instanceofCaseBody` pops the constructor then the value,
pushes builtin **2490** and those two arguments, and `call(l, 2u, false, false)`.

| id | name | where |
| --- | --- | --- |
| 2490 | `__lanesInstanceofOperator` / field `instanceofOperator` | guest `instanceofOperatorBootstrap(value, ctor)` |
| 1101 | `__lanesHasInstance` / field `hasInstance` | guest `hasInstanceBootstrap`; `this` is the constructor |
| 2491 | `__lanesIsBound` | WGSL `lanesIsBound`: tag 5 and heap kind 12 |
| 2492 | `__lanesBoundTarget` | WGSL `lanesBoundTarget`: `V(bound.value.x, 0u, bound.value.z, 0u)` |
| 2493 | `__lanesPrototypeInstanceof` | WGSL `lanesPrototypeInstanceof`: prototype walk only |

2491–2493 are `symbolMethodObjectMethodWGSL` inside `objectMethod`. They are
not guest-field redirects. 2490 and 1101 are `symbolMethodBuiltinFields`:
`call()` must redirect them to the bootstrap closures. New FIELDS name:
`instanceofOperator` only. `hasInstance` already exists as the phase-3
property-name field; storing the helper uses that slot's `.y` and leaves `.x`
as the text. Do not append a second `hasInstance` name.

Operator (`instanceofOperatorSource`):

1. `null` or not object/function → `TypeError("Right-hand side of instanceof is not an object")`.
2. `method = ctor[Symbol.hasInstance]`. Inherited getters run. A throw from
   that Get propagates unchanged.
3. If `method` is not null/undefined and not builtin 1101: a non-function
   throws `TypeError("Symbol.hasInstance is not a function")` and the
   prototype walk does not run; otherwise `!!__lanesCall(method, ctor, value)`.
   The 1101 check is the intrinsic value, not a second read of
   `Function.prototype[@@hasInstance]`, so a replacement of that property is
   still called.
4. Otherwise ordinary: a non-function throws
   `TypeError("Right-hand side of instanceof is not callable")`. A bound
   function returns `__lanesInstanceofOperator(value, __lanesBoundTarget(ctor))`
   (2490 again: one unwrap per call, then the target hook). Else
   `__lanesPrototypeInstanceof(value, ctor)`.

`hasInstanceBootstrap` is OrdinaryHasInstance. A non-callable `this` throws the
not-callable TypeError. A bound `this` re-enters 2490 on the target, so the
target's hook runs. Otherwise it is only the prototype walk, which does not
consult `@@hasInstance`.

`lanesPrototypeInstanceof` is the current `instanceOf` tail after the hook scan
and the bound unwrap: non-object value returns false before `Get` of
`"prototype"`; a non-object prototype is status 4; an accessor or builtin
prototype value stays status 6. It does not read `@@hasInstance`.

## Init (parent applies)

On `Function.prototype` (node 3, the `functionProto` local), after the
`functionKeys` loop:

```
dataProperty(l,functionProto,0x60000000u|32u,V(1101u,0u,11u,0u),4u);
```

Flags 4: configurable, not writable, not enumerable. Delete this `prototypeGap`
line or a missing property still status-6s:

```
  if(id==3u&&key==(0x60000000u|${phase3HasInstanceNode}u)){return true;}
```

`phase3HasInstanceNode` is `31 + indexOf('hasInstance')`, which is 32.

Register `symbolMethodBootstrapSources`, `symbolMethodPrivateBuiltins`, and
`symbolMethodBuiltinFields` the same way as the phase-4 maps. `to_propkey`
stays as it is.
