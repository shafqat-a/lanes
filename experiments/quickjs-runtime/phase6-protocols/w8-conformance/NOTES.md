# Protocol conformance cases

Sources are `function f() { ... }`. The host reads a string or a number. `throws` means the guest catches the exception and returns the sentinel in `expected`. It is not an unsupported gap. `unsupported` is only the four known gaps.

| id | outcome | expected | behavior |
|---|---|---|---|
| prim-hint-default | value | `default` | `@@toPrimitive` hint on `o + 0` |
| prim-hint-number-string | value | `number,string:7:s` | `Number(o)` hint `number`, `String(o)` hint `string` |
| prim-getter-throw | throws | `getter` | throwing `@@toPrimitive` getter; message `boom` |
| prim-returns-object | throws | `nonprimitive` | exotic method returns an object; TypeError |
| prim-noncallable | throws | `0` | non-callable `@@toPrimitive` does not call `valueOf` |
| prim-ordinary-order | value | `valueOf,toString:z1` | default hint calls `valueOf` then `toString` |
| iter-custom-for-of | value | `ab` | custom iterator `for-of` |
| iter-open-order | value | `get-iter,call-iter,get-next,get-done,get-value` | open and first result getter order; return before a second `next` |
| iter-next-noncallable | throws | `next` | non-callable `next` is a TypeError |
| close-break-return | value | `return` | `break` calls `return` |
| close-throw-original | throws | `return:original` | `return` runs and throws; the original message wins |
| iter-destructure-rest | value | `10,30,40:50` | `[a, , c, ...rest]` on a custom iterator |
| spread-arr-values | value | `1,2` | `[...[1, 2]].join(',')` through array values |
| str-surrogate | value | `3` | `[...'a\\uD83D\\uDE00b'].length` (one code point for the pair) |
| arr-iterator-override | value | `1:X1X2` | `for-of` uses an own `Array.prototype[@@iterator]` |
| prim-computed-method-key | value | `yes` | computed `{[Symbol.toPrimitive](hint){return 'k'+hint}}` used as a key (`kstring`) |
| name-symbol-method | value | `callable` | method is callable; `.name` may be `[Symbol.iterator]`. A missing or throwing `.name` still returns `callable`. A different non-empty name returns `bad-name` |
| inst-custom-both | value | `true,false` | own `@@hasInstance` returns true for `1` and false for `2` |
| inst-inherited | value | `true,false` | `@@hasInstance` on a prototype between the function and `Function.prototype` |
| inst-ordinary | value | `true,false` | ordinary `instanceof` uses the function's `prototype` |
| inst-bound | value | `true,true,false` | bound `instanceof` uses the target prototype; the bound function's `prototype` is `undefined` |
| iter-gc-chain | value | `4320` | 30 chains of 8 linked nodes with temporaries inside `for-of`. Smoke source: the iterator and record must stay reachable. Not a proof that a collection ran |
| iter-resumption-next | value | `42` | `next` getter calls user function `user(41)` before returning the method |

## Known gaps (outcome `unsupported`)

| id | spec result recorded in `expected` |
|---|---|
| gap-symbol-match | `'custom'` from `String.prototype.match` calling `@@match` |
| gap-symbol-species | `'1:2,3'` from `Array.prototype.map` consulting `constructor[@@species]` |
| gap-json-stringify-symbol | `'undefined'` (`typeof JSON.stringify(Symbol('z'))`) |
| gap-bigint-tostring-decimal | `'255'` from `(255n).toString(10)` |

No other id uses outcome `unsupported`.
