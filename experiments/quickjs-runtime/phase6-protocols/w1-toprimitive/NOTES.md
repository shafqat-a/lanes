# W1 ToPrimitive

`primitiveSource` replaces `experiments/quickjs-runtime/comparison-source.js` `primitiveSource`. The guest function remains `primitiveBootstrap(value, stringHint)`.

## Continuations

`continuations` is `[72, 73, 74, 75]`. These ids are reserved and unused. Do not install handlers for them.

Property gets and `__lanesCall` already suspend at instruction boundaries. `__lanesCall` is the existing private call builtin, id 113, invoked as `__lanesCall(fn, thisArg, ...args)`. The guest call stack is the resumption mechanism, so this algorithm adds no continuation state.

## Hint contract

Existing callers pass `true`, `false`, or omit the second argument. Ordinary order for those three cases is unchanged.

| second argument | `@@toPrimitive` hint | ordinary order |
| --- | --- | --- |
| omitted or `undefined` | `"default"` | `valueOf`, then `toString` |
| `false` | `"number"` | `valueOf`, then `toString` |
| `true` | `"string"` | `toString`, then `valueOf` |

A present hook is a real `value[Symbol.toPrimitive]` get, then `__lanesCall(exotic, value, hint)`. It is not reported with `__lanesUnsupported`. A non-callable hook throws `TypeError("Cannot convert object to primitive value")` and does not call `valueOf` or `toString`. An object or function result from the hook throws that same `TypeError` and does not fall through. Getter and call abrupt completions propagate unchanged.

`Symbol` resolves because this bootstrap is an intrinsic root (`program.js` captures `Symbol` as builtin 1000). `Symbol.toPrimitive` is a data property of the Symbol constructor. Nested helpers do not reference `Symbol` or `__lanes*`.

`simulate.js` exports `simulateToPrimitive(value, preferred)` for host tests. `preferred` is `"default"`, `"number"`, or `"string"`. It is not part of the guest program.
