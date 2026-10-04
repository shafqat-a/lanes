// Phase 4 worker 3: object spread in literals, object rest in destructuring
// (declarations, assignments, parameters) and ordinary object destructuring.
//
// QuickJS lowering (vendor/quickjs.c, pinned revision):
//   - `{...e}` (js_parse_object_literal): object; <e>; null; copy_data_properties
//     mask=2|1<<2|0<<5 (target sp[-3], source sp[-2], excluded sp[-1] = null);
//     drop; drop.
//   - every object binding/assignment pattern (js_parse_destructuring_element)
//     starts with to_object (ToObject throwing TypeError for null/undefined; a
//     primitive becomes its wrapper). With a rest element the excluded list is a
//     fresh ordinary object (`object; swap`) whose OWN keys are the names already
//     destructured: named keys are added by define_field <name> null, computed
//     keys by to_propkey (ToPropertyKey exactly once); perm3; null;
//     define_array_el; perm3. The rest element itself emits object (target);
//     copy_data_properties mask=0|(d+1)<<2|(d+2)<<5 where d is the lvalue depth
//     (0 binding/variable, 1 `o.p`, 2 `o[k]`), then the ordinary lvalue store.
// The opcode leaves the stack unchanged; its operands stay owned by the caller.
//
// CopyDataProperties (ES2025 7.3.25) runs as a strict guest helper so getters
// run in key order on the GPU VM and abrupt completions propagate normally.
// Pinned QuickJS deviates in two places that this runtime does NOT copy:
//   * JS_CopyDataProperties returns early for any non-object source, so
//     `{..."ab"}` is `{}` in QuickJS; ES2025 applies ToObject (string indices).
//   * it filters with JS_GPN_ENUM_ONLY at key-collection time; ES2025 re-reads
//     [[GetOwnProperty]] per key, so a key deleted (or made non-enumerable) by
//     an earlier getter is skipped instead of being copied as undefined.
// Lead integration: no program.js import (program.js -> phase4-registry.js ->
// this module would be an import cycle); WGSL receives { L } lazily.

export const objectSpreadPrivateBuiltins = Object.freeze({
  // [[OwnPropertyKeys]] choke point (shared, owner worker 3). WGSL primitive:
  // today string keys only (array indices ascending, then creation order),
  // which is exact while the runtime has no symbol keys. Phase 3 must append
  // symbol keys in creation order after the string keys (ES2025 10.1.11.1).
  __lanesOwnPropertyKeys: 1240,
  // CopyDataProperties(target, source, excludedObject|null): guest helper
  // field `copyDataProperties`; only reached from the copy_data_properties op.
  __lanesCopyDataProperties: 1241,
});
// IDs 1242-1269 remain reserved for worker 3.

// Private builtin id -> bootstrap helper FIELDS name (call() field dispatch).
export const objectSpreadBuiltinFields = Object.freeze({ 1241: 'copyDataProperties' });

// Appended to program.js OP (new indices only). Stack effects as in
// vendor/quickjs-opcode.h: DEF(copy_data_properties, 2, 3, 3, u8) and
// DEF(to_object, 1, 1, 1, none).
export const objectSpreadOpcodes = Object.freeze([
  Object.freeze({ name: 'copy_data_properties', pop: 3, push: 3, format: 'u8', note: 'stack unchanged; operand mask selects target/source/excluded' }),
  Object.freeze({ name: 'to_object', pop: 1, push: 1, format: 'none', note: 'ToObject in place; TypeError for null/undefined' }),
  // Emitted for `{[k]: o[j]} = s` (computed key, depth-2 lvalue). Pure stack
  // shuffle a b c d -> c d a b; may also be appended by another worker (dedupe).
  Object.freeze({ name: 'swap2', pop: 4, push: 4, format: 'none', note: 'a b c d -> c d a b' }),
]);

// The u8 mask: bits 0-1 target, 2-4 source, 5-7 excluded, each an offset k
// meaning stack[sp-1-k]. packProgram passes the bridge operand (the mask byte)
// through unchanged as `a`; `b` stays 0. This validates the mask.
export function lowerObjectSpread(op, operand) {
  if (op === 'to_object' || op === 'swap2') return { a: 0, b: 0 };
  if (op !== 'copy_data_properties') throw new Error(`not an object-spread op: ${op}`);
  if (!Number.isInteger(operand) || operand < 0 || operand > 255) throw new SyntaxError('Invalid copy_data_properties mask');
  const target = operand & 3, source = (operand >> 2) & 7, excluded = (operand >> 5) & 7;
  if (target === source || target === excluded || source === excluded) throw new SyntaxError('Invalid copy_data_properties mask');
  return { a: operand, b: 0 };
}
export const objectSpreadProgramLowering = Object.freeze({
  copy_data_properties: Object.freeze({ operand: 'u8 mask (raw bridge operand) -> a; b=0', decode: 'target=a&3, source=(a>>2)&7, excluded=(a>>5)&7; value = stack[sp-1-offset]', lower: lowerObjectSpread }),
  to_object: Object.freeze({ operand: 'none -> a=0, b=0', lower: lowerObjectSpread }),
  swap2: Object.freeze({ operand: 'none -> a=0, b=0', lower: lowerObjectSpread }),
});

// Case bodies for shader.js `cases(name, body)`; `l`, `arg` as in main().
export const objectSpreadWGSLCases = ({ L: LIMITS }) => ({
  swap2: `let d=pop(l);let c=pop(l);let b=pop(l);let a=pop(l);if(states[l].status!=0u){break;}push(l,c);push(l,d);push(l,a);push(l,b);`,
  to_object: `let obj=toObject(l,peek(l));if(states[l].status==0u){states[l].stack[states[l].sp-1u]=obj;}`,
  copy_data_properties: `let deepest=max(arg&3u,max((arg>>2u)&7u,(arg>>5u)&7u));
        if(states[l].sp<=states[l].frames[states[l].depth].base+deepest){states[l].status=2u;break;}
        if(states[l].sp+4u>${LIMITS.stack}u){states[l].status=3u;break;}
        let targetValue=states[l].stack[states[l].sp-1u-(arg&3u)];
        let source=states[l].stack[states[l].sp-1u-((arg>>2u)&7u)];
        let excluded=states[l].stack[states[l].sp-1u-((arg>>5u)&7u)];
        push(l,V(${objectSpreadPrivateBuiltins.__lanesCopyDataProperties}u,0u,11u,0u));push(l,targetValue);push(l,source);push(l,excluded);
        let depth=states[l].depth;call(l,3u,false,false);
        if(states[l].status==0u){if(states[l].depth>depth){states[l].frames[states[l].depth].tail=2u;}else{let ignored=pop(l);}}`,
});

// objectMethod() line for the shared own-keys primitive (insert next to the
// existing `id==140u||id==710u||id==716u` dispatch).
export const objectSpreadObjectMethodWGSL = `if(id==${objectSpreadPrivateBuiltins.__lanesOwnPropertyKeys}u){return ownKeys(l,original,false,true);}`;
// call() z==11 field dispatch line (next to the other `field=` mappings).
export const objectSpreadCallFieldWGSL = F => Object.entries(objectSpreadBuiltinFields)
  .map(([id, field]) => `if(fnValue.x==${id}u){field=${F[field]}u;}`).join('\n    ');

// ES2025 7.3.25 CopyDataProperties. `excluded` is null (spread) or the
// QuickJS exclusion object whose own keys are the already-destructured names
// (already ToPropertyKey'd); an own-key test, never `in`, so inherited
// Object.prototype names are not excluded. CreateDataPropertyOrThrow uses a
// null-prototype descriptor through [[DefineOwnProperty]], so no setter on the
// target or Object.prototype (including __proto__) runs.
export const copyDataPropertiesSource = `function copyDataPropertiesBootstrap(target, source, excluded) {
  "use strict";
  if (source === null || source === undefined) return target;
  const from = __lanesToObject(source);
  const keys = __lanesOwnPropertyKeys(from);
  const count = keys.length;
  for (let i = 0; i < count; i++) {
    const key = keys[i];
    if (excluded !== null && __lanesOwnHas(excluded, key)) continue;
    const own = __lanesOwnDescriptor(from, key);
    if (own !== undefined && own.enumerable) {
      const value = from[key];
      const desc = __lanesDescriptor();
      desc.value = value;
      desc.writable = true;
      desc.enumerable = true;
      desc.configurable = true;
      __lanesDefine(target, key, desc);
    }
  }
  return target;
}`;

export const objectSpreadBootstrapSources = Object.freeze({ copyDataProperties: copyDataPropertiesSource });
// FIELDS names to append in program.js (each new).
export const objectSpreadFields = Object.freeze(Object.keys(objectSpreadBootstrapSources));

export const objectSpreadNotes = Object.freeze([
  'Object destructuring of any form is rejected today: every object pattern emits to_object, which is not in OP.',
  'Spread/rest need to_object and copy_data_properties; assignment patterns with a computed key and a computed member target (`{[k]: o[j]} = s`) also emit swap2. All other emitted ops for the cases are existing OP entries (asserted by the check script).',
  'Depth-3 lvalues (rot4l/rot5l: super/with references) are not produced by any admitted form and stay rejected.',
  'Symbol keys: none exist yet. __lanesOwnPropertyKeys (1240) is the single choke point; Phase 3 appends symbol keys after string keys and the helper then copies enumerable symbol-keyed properties unchanged (the exclusion test already compares keys, not strings).',
  'Proxy sources do not exist in the runtime; ownKeys() rejects unsupported exotic shapes (native function objects, sloppy functions, wrapper prototypes) with status 6.',
  'QuickJS deviations not reproduced (ES2025 semantics win): non-object spread sources are ToObject-ed (strings copy indices); enumerability is re-checked per key after earlier getters.',
]);
