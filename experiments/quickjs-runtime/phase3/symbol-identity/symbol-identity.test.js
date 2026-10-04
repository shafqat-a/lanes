import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIXED_NODES,
  MAX_DESCRIPTION_UNITS,
  MAX_REGISTRY_ENTRIES,
  MAX_UNIQUE_SYMBOL_ID,
  SYMBOL_CELL_KIND,
  SYMBOL_FLAG_HAS_DESCRIPTION,
  SYMBOL_FLAG_IN_REGISTRY,
  SYMBOL_NODE_CONSTRUCTOR,
  SYMBOL_NODE_PROTOTYPE,
  SYMBOL_NODE_REGISTRY,
  SYMBOL_REGISTRY_KIND,
  SYMBOL_VALUE_TAG,
  assertCallableAsConstructor,
  createSymbol,
  createSymbolRealm,
  resetSymbolRealm,
  sameValueSymbols,
  symbolDescriptiveString,
  symbolFor,
  symbolKeyFor,
  symbolPrimitiveValue,
  typeofSymbol,
} from './symbol-cell.js';
import {
  SYMBOL_BUILTIN_IDS,
  SYMBOL_BUILTIN_RANGE,
  dispatchSymbolBuiltin,
  symbolBuiltins,
  symbolConstruct,
  symbolForBuiltin,
  symbolKeyForBuiltin,
  symbolPrototypeDescription,
  symbolPrototypeToString,
  symbolPrototypeValueOf,
  symbolPrototypePropertyAttributes,
  symbolTypeofDispatch,
} from './symbol-builtins.js';

const wgsl = readFileSync(new URL('./symbol-identity.wgsl', import.meta.url), 'utf8');

function typeError(error) {
  assert.equal(error.tag, 'TypeError');
  assert.equal(error.name, 'TypeError');
  assert.equal(error.status, 4);
  assert.equal(error instanceof Error, false);
  return true;
}

function resourceLimit(error) {
  assert.equal(error.tag, 'ResourceLimit');
  assert.equal(error.name, 'ResourceLimit');
  assert.equal(error.status, 3);
  assert.equal(error instanceof Error, false);
  return true;
}

function stripSource(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '""');
}

test('constants reserve tag 17, kinds 17 and 18, and nodes 26..28', () => {
  assert.equal(SYMBOL_VALUE_TAG, 17);
  assert.equal(SYMBOL_CELL_KIND, 17);
  assert.equal(SYMBOL_REGISTRY_KIND, 18);
  assert.deepEqual(FIXED_NODES, {
    symbolConstructor: 26,
    symbolPrototype: 27,
    symbolRegistry: 28,
  });
  assert.equal(SYMBOL_NODE_CONSTRUCTOR, 26);
  assert.equal(SYMBOL_NODE_PROTOTYPE, 27);
  assert.equal(SYMBOL_NODE_REGISTRY, 28);
  assert.equal(MAX_UNIQUE_SYMBOL_ID, 0xFFFFFFFF);
  assert.equal(MAX_REGISTRY_ENTRIES, 1024);
  assert.equal(MAX_DESCRIPTION_UNITS, 256);
  assert.equal(SYMBOL_FLAG_HAS_DESCRIPTION, 1);
  assert.equal(SYMBOL_FLAG_IN_REGISTRY, 2);
  const realm = createSymbolRealm();
  assert.equal(realm.limits.maxUniqueSymbols, MAX_UNIQUE_SYMBOL_ID);
  assert.equal(realm.limits.maxRegistryEntries, MAX_REGISTRY_ENTRIES);
  assert.equal('sameValueZero' in realm, false);
});

test('unique symbols are not interned by description', () => {
  const realm = createSymbolRealm();
  const first = realm.createSymbol('same');
  const second = realm.createSymbol('same');
  const absent = realm.createSymbol(null);
  const empty = realm.createSymbol('');
  assert.notEqual(first, second);
  assert.notEqual(first.uniqueIdentity, second.uniqueIdentity);
  assert.equal(sameValueSymbols(first, second), false);
  assert.equal(sameValueSymbols(first, first), true);
  assert.equal(realm.symbolKeyFor(first), null);
  assert.equal(realm.symbolKeyFor(second), null);
  assert.equal(first.registryKey, null);
  assert.equal(first.description, 'same');
  assert.equal(absent.description, null);
  assert.equal(empty.description, '');
  assert.notEqual(absent, empty);
  assert.equal(absent.tag, 17);
  assert.deepEqual(realm.inspect().identities, [1, 2, 3, 4]);
  assert.equal(realm.inspect().registrySize, 0);
  assert.equal(Symbol('same') === Symbol('same'), false);
  assert.equal(Object.is(Symbol('same'), Symbol('same')), false);
  assert.equal(Symbol().description, undefined);
  assert.equal(Symbol(undefined).description, undefined);
  assert.equal(Symbol('').description, '');
  assert.equal(symbolPrototypeDescription(realm, absent), undefined);
  assert.equal(symbolPrototypeDescription(realm, empty), '');
  assert.equal(symbolPrototypeDescription(realm, first), 'same');
});

test('Symbol.for is canonical and distinct from Symbol(description)', () => {
  const realm = createSymbolRealm();
  const registered = realm.symbolFor('x');
  const again = realm.symbolFor('x');
  const concatenated = realm.symbolFor('a' + 'b');
  const sameText = realm.symbolFor('ab');
  const unique = realm.createSymbol('x');
  const other = realm.symbolFor('y');
  const empty = realm.symbolFor('');
  assert.equal(again, registered);
  assert.equal(sameValueSymbols(registered, again), true);
  assert.equal(concatenated, sameText);
  assert.notEqual(registered, unique);
  assert.equal(sameValueSymbols(registered, unique), false);
  assert.notEqual(registered, other);
  assert.equal(registered.description, 'x');
  assert.equal(registered.registryKey, 'x');
  assert.equal(realm.symbolKeyFor(registered), 'x');
  assert.equal(realm.symbolKeyFor(unique), null);
  assert.equal(realm.symbolKeyFor(empty), '');
  assert.equal(empty.description, '');
  assert.equal(realm.inspect().issued, 5);
  assert.equal(realm.symbolFor('x'), registered);
  assert.equal(realm.inspect().issued, 5);
  assert.notEqual(empty, realm.createSymbol(''));
  assert.equal(realm.inspect().issued, 6);
  assert.deepEqual(realm.inspect().registryKeys, ['', 'y', 'ab', 'x']);
  assert.equal(registered.uniqueIdentity, 1);
  assert.equal(Symbol.for('x') === Symbol.for('x'), true);
  assert.equal(Symbol.for('a' + 'b') === Symbol.for('ab'), true);
  assert.equal(Symbol.for('x') === Symbol('x'), false);
  assert.equal(Object.is(Symbol.for('x'), Symbol.for('x')), true);
  assert.equal(Object.is(Symbol.for('x'), Symbol('x')), false);
  assert.equal(Symbol.keyFor(Symbol.for('x')), 'x');
  assert.equal(Symbol.keyFor(Symbol('x')), undefined);
  assert.equal(Symbol.keyFor(Symbol.for('')), '');
  assert.equal(Symbol.keyFor(Symbol('')), undefined);
  assert.equal(Symbol.for('').description, '');
  assert.equal(Symbol.for('x') === Symbol.for('y'), false);
});

test('realms do not share identities or the registry', () => {
  const left = createSymbolRealm();
  const right = createSymbolRealm();
  const a = left.symbolFor('shared');
  const b = right.symbolFor('shared');
  assert.equal(a.uniqueIdentity, b.uniqueIdentity);
  assert.equal(sameValueSymbols(a, b), false);
  assert.notEqual(a, b);
  assert.equal(sameValueSymbols({ uniqueIdentity: a.uniqueIdentity, brand: a.brand }, a), false);
});

test('descriptive strings match the host and do not JSON-escape', () => {
  const realm = createSymbolRealm();
  const samples = ['desc', 'a)b', 'quote"', 'slash\\', '\n', '\t', '😀', '\uD800', 'A', 'a'];
  for (const sample of samples) {
    const unique = realm.createSymbol(sample);
    const registered = realm.symbolFor('k:' + sample);
    assert.equal(symbolDescriptiveString(unique), 'Symbol(' + sample + ')');
    assert.equal(symbolDescriptiveString(registered), 'Symbol(k:' + sample + ')');
    assert.equal(Symbol(sample).toString(), 'Symbol(' + sample + ')');
    assert.equal(Symbol.for('k:' + sample).toString(), 'Symbol(k:' + sample + ')');
    assert.equal(symbolPrototypeToString(realm, unique), Symbol(sample).toString());
    assert.equal(JSON.stringify(sample) === sample || symbolDescriptiveString(unique).includes(sample), true);
  }
  assert.equal(symbolDescriptiveString(realm.createSymbol(null)), 'Symbol()');
  assert.equal(symbolDescriptiveString(realm.createSymbol('')), 'Symbol()');
  assert.equal(symbolDescriptiveString(realm.symbolFor('')), 'Symbol()');
  assert.equal(Symbol().toString(), 'Symbol()');
  assert.equal(Symbol('').toString(), 'Symbol()');
  assert.equal(Symbol.for('').toString(), 'Symbol()');
  const quoted = 'a"b\\c';
  assert.notEqual(JSON.stringify(quoted), quoted);
  assert.equal(symbolDescriptiveString(realm.createSymbol(quoted)), 'Symbol(' + quoted + ')');
  assert.equal(Symbol(quoted).toString(), 'Symbol(' + quoted + ')');
});

test('typeof, valueOf and the primitive hook agree with the host on symbols', () => {
  const realm = createSymbolRealm();
  const cell = symbolConstruct(realm, 'q', undefined);
  const host = Symbol('q');
  assert.equal(typeofSymbol(cell), 'symbol');
  assert.equal(symbolTypeofDispatch(SYMBOL_VALUE_TAG), 'symbol');
  assert.equal(typeof host, 'symbol');
  assert.equal(symbolPrototypeValueOf(realm, cell), cell);
  assert.equal(host.valueOf(), host);
  assert.equal(symbolPrimitiveValue(cell), cell);
  assert.equal(host[Symbol.toPrimitive]('default'), host);
  assert.equal(symbolPrototypeDescription(realm, cell), host.description);
  assert.equal(symbolPrototypeToString(realm, cell), host.toString());
  assert.equal(cell.tag, 17);
  assert.throws(() => symbolTypeofDispatch(0), error => error.tag === 'Unsupported' && error.status === 6);
  assert.throws(() => symbolTypeofDispatch(7), error => error.tag === 'Unsupported' && error.status === 6);
  assert.throws(() => typeofSymbol({ tag: 17 }), typeError);
});

test('keyFor, toString, valueOf and description reject non-symbols', () => {
  const realm = createSymbolRealm();
  const values = [0, 1, true, false, null, undefined, 'x', '', {}, [], Object(true), 0n];
  for (const value of values) {
    assert.throws(() => Symbol.keyFor(value), TypeError);
    assert.throws(() => symbolKeyFor(value), typeError);
    assert.throws(() => symbolKeyForBuiltin(realm, value), typeError);
    assert.throws(() => Symbol.prototype.toString.call(value), TypeError);
    assert.throws(() => symbolPrototypeToString(realm, value), typeError);
    assert.throws(() => Symbol.prototype.valueOf.call(value), TypeError);
    assert.throws(() => symbolPrototypeValueOf(realm, value), typeError);
    assert.throws(() => Object.getOwnPropertyDescriptor(Symbol.prototype, 'description').get.call(value), TypeError);
    assert.throws(() => symbolPrototypeDescription(realm, value), typeError);
    assert.equal(sameValueSymbols(value, value), false);
  }
  assert.throws(() => Symbol.prototype.toString.call(Symbol.prototype), TypeError);
  assert.throws(() => symbolPrototypeToString(realm, Symbol.prototype), typeError);
});

test('constructor call is not new, and new Symbol is a TypeError', () => {
  const realm = createSymbolRealm();
  let hostMessage = '';
  assert.throws(() => new Symbol('nope'), error => {
    assert.ok(error instanceof TypeError);
    hostMessage = error.message;
    return true;
  });
  assert.match(hostMessage, /not a constructor/);
  assert.throws(() => new Symbol(), TypeError);
  assert.throws(() => realm.assertCallableAsConstructor(), error => {
    assert.equal(error.message, 'Symbol is not a constructor');
    return typeError(error);
  });
  assert.throws(() => symbolConstruct(realm, 'nope', {}), error => {
    assert.equal(error.message, 'Symbol is not a constructor');
    return typeError(error);
  });
  assert.throws(() => symbolConstruct(realm, 'nope', null), typeError);
  assert.throws(() => dispatchSymbolBuiltin(realm, 1000, { argument: 'nope', newTarget: {} }), typeError);
  const created = symbolConstruct(realm, undefined, undefined);
  assert.equal(created.description, null);
  assert.equal(symbolConstruct(realm, 'ok', undefined).description, 'ok');
  assert.equal(Symbol().description, undefined);
  assert.equal(Symbol(undefined).description, undefined);
  assert.equal(Symbol('ok').description, 'ok');
  // Direct createSymbol does not treat a missing conversion as absent.
  assert.throws(() => realm.createSymbol(undefined), typeError);
});

test('ToString of registry keys and descriptions is not approximated', () => {
  const realm = createSymbolRealm();
  assert.throws(() => symbolConstruct(realm, null, undefined), typeError);
  assert.throws(() => realm.symbolFor(1), typeError);
  assert.throws(() => realm.symbolFor(Object('a')), typeError);
  assert.equal(Symbol(null).description, 'null');
  assert.equal(Symbol.for(1).description, '1');
  assert.equal(Symbol.keyFor(Symbol.for(1)), '1');
  assert.equal(realm.inspect().registrySize, 0);
  assert.equal(realm.inspect().issued, 0);
});

test('ids stay stable when later symbols and a failed overflow run', () => {
  const realm = createSymbolRealm({ maxRegistryEntries: 2, maxUniqueSymbols: 3 });
  const registered = realm.symbolFor('stable');
  const id = registered.uniqueIdentity;
  const unique = realm.createSymbol('stable');
  realm.symbolFor('other');
  assert.deepEqual(realm.inspect().identities, [1, 2, 3]);
  assert.equal(realm.symbolFor('stable'), registered);
  assert.equal(registered.uniqueIdentity, id);
  assert.equal(unique.uniqueIdentity, 2);
  assert.notEqual(unique.uniqueIdentity, id);
  assert.deepEqual(realm.inspect().registryKeys, ['other', 'stable']);
  const before = realm.inspect();
  assert.throws(() => realm.symbolFor('overflow'), resourceLimit);
  assert.equal(realm.inspect().issued, before.issued);
  assert.equal(realm.inspect().nextIdentity, before.nextIdentity);
  assert.deepEqual(realm.inspect().identities, before.identities);
  assert.deepEqual(realm.inspect().registryKeys, before.registryKeys);
  assert.equal(realm.symbolFor('stable').uniqueIdentity, 1);
  assert.throws(() => realm.createSymbol('last'), resourceLimit);
  assert.equal(realm.symbolKeyFor(unique), null);
  assert.equal(realm.symbolKeyFor(registered), 'stable');
});

test('registry and identity overflow do not wrap', () => {
  const registry = createSymbolRealm({ maxRegistryEntries: 1, maxUniqueSymbols: 4 });
  registry.symbolFor('only');
  assert.throws(() => registry.symbolFor('next'), resourceLimit);
  assert.equal(registry.inspect().issued, 1);
  assert.equal(registry.inspect().registrySize, 1);
  assert.equal(registry.symbolFor('only').uniqueIdentity, 1);

  const emptyRegistry = createSymbolRealm({ maxRegistryEntries: 0, maxUniqueSymbols: 3 });
  assert.throws(() => emptyRegistry.symbolFor('a'), resourceLimit);
  assert.equal(emptyRegistry.inspect().issued, 0);
  assert.equal(emptyRegistry.createSymbol('a').uniqueIdentity, 1);

  const identities = createSymbolRealm({ maxUniqueSymbols: 2, maxRegistryEntries: 8 });
  const first = identities.createSymbol(null);
  identities.createSymbol('');
  assert.throws(() => identities.createSymbol('z'), resourceLimit);
  assert.throws(() => identities.symbolFor('z'), resourceLimit);
  assert.deepEqual(identities.inspect().identities, [1, 2]);
  assert.equal(identities.inspect().nextIdentity, 3);
  assert.equal(first.uniqueIdentity, 1);
  assert.equal(identities.symbolKeyFor(first), null);
  assert.equal(identities.inspect().registrySize, 0);

  const edge = createSymbolRealm({
    initialNextId: 0xFFFFFFFF,
    maxUniqueSymbols: 0xFFFFFFFF,
    maxRegistryEntries: 2,
  });
  const last = edge.createSymbol('edge');
  assert.equal(last.uniqueIdentity, 0xFFFFFFFF);
  assert.equal(edge.inspect().nextIdentity, 0);
  assert.throws(() => edge.createSymbol('more'), resourceLimit);
  assert.throws(() => edge.symbolFor('k'), resourceLimit);
  assert.equal(edge.inspect().issued, 1);
  assert.equal(edge.inspect().registrySize, 0);
  assert.equal(last.uniqueIdentity, 0xFFFFFFFF);

  const exhausted = createSymbolRealm({ initialNextId: 0, maxUniqueSymbols: 4 });
  assert.throws(() => exhausted.createSymbol(null), resourceLimit);
  assert.equal(exhausted.inspect().issued, 0);
  assert.throws(() => createSymbolRealm({ maxRegistryEntries: 1025 }), RangeError);
  assert.throws(() => createSymbolRealm({ maxUniqueSymbols: 0 }), RangeError);
  assert.throws(() => createSymbolRealm({ initialNextId: -1 }), RangeError);
  assert.throws(() => createSymbolRealm({ initialNextId: 1.5 }), RangeError);
});

test('descriptive output shares the 256-unit guest string limit', () => {
  const realm = createSymbolRealm();
  const fit = 'a'.repeat(248);
  assert.equal(symbolDescriptiveString(realm.createSymbol(fit)), 'Symbol(' + fit + ')');
  assert.equal(symbolDescriptiveString(realm.createSymbol(fit)).length, 256);
  assert.equal(Symbol(fit).toString(), 'Symbol(' + fit + ')');
  const over = 'b'.repeat(249);
  const cell = realm.createSymbol(over);
  assert.equal(cell.description, over);
  assert.equal(symbolPrototypeDescription(realm, cell), over);
  assert.throws(() => symbolDescriptiveString(cell), resourceLimit);
  assert.equal(Symbol(over).toString(), 'Symbol(' + over + ')');
  const max = 'c'.repeat(256);
  const stored = realm.symbolFor(max);
  assert.equal(realm.symbolKeyFor(stored), max);
  assert.equal(stored.uniqueIdentity > 0, true);
  assert.throws(() => symbolDescriptiveString(stored), resourceLimit);
  assert.throws(() => realm.createSymbol('d'.repeat(257)), resourceLimit);
  assert.throws(() => realm.symbolFor('e'.repeat(257)), resourceLimit);
});

test('module-level registry follows resetSymbolRealm', () => {
  resetSymbolRealm();
  const unique = createSymbol('m');
  const registered = symbolFor('m');
  assert.equal(symbolKeyFor(unique), null);
  assert.equal(symbolKeyFor(registered), 'm');
  assert.equal(symbolFor('m'), registered);
  assert.equal(typeofSymbol(unique), 'symbol');
  assert.equal(symbolDescriptiveString(unique), 'Symbol(m)');
  assert.equal(symbolPrimitiveValue(registered), registered);
  assert.throws(assertCallableAsConstructor, error => error.message === 'Symbol is not a constructor' && typeError(error));
  const fresh = resetSymbolRealm();
  assert.equal(fresh.inspect().issued, 0);
  assert.notEqual(fresh.symbolFor('m'), registered);
});

test('builtin table uses 1000..1006 and matches host length and attributes', () => {
  assert.deepEqual(symbolBuiltins.map(entry => entry.id), [1000, 1001, 1002, 1003, 1004, 1005, 1006]);
  assert.deepEqual(symbolBuiltins.map(entry => entry.name), ['Symbol', 'for', 'keyFor', 'toString', 'valueOf', 'description', 'typeof']);
  assert.deepEqual(symbolBuiltins.map(entry => entry.wgslHookName), [
    'symbol_construct', 'symbol_for', 'symbol_key_for', 'symbol_prototype_to_string',
    'symbol_prototype_value_of', 'symbol_prototype_description', 'symbol_typeof',
  ]);
  for (const entry of symbolBuiltins) {
    assert.equal(entry.id >= SYMBOL_BUILTIN_RANGE.min && entry.id <= SYMBOL_BUILTIN_RANGE.max, true);
    for (const key of ['id', 'name', 'length', 'arity', 'attributes', 'wgslHookName', 'specNote']) {
      assert.notEqual(entry[key], undefined);
      assert.notEqual(entry[key], '');
    }
    assert.equal(entry.attributes.enumerable, false);
  }
  const byName = Object.fromEntries(symbolBuiltins.map(entry => [entry.name, entry]));
  assert.equal(byName.Symbol.length, Symbol.length);
  assert.equal(byName.for.length, Symbol.for.length);
  assert.equal(byName.keyFor.length, Symbol.keyFor.length);
  assert.equal(byName.toString.length, Symbol.prototype.toString.length);
  assert.equal(byName.valueOf.length, Symbol.prototype.valueOf.length);
  assert.equal(byName.description.length, 0);
  assert.equal(byName.Symbol.arity, 1);
  assert.equal(byName.for.arity, 1);
  assert.equal(byName.keyFor.arity, 1);
  assert.equal(byName.description.attributes.accessor, true);
  assert.equal(byName.description.attributes.writable, false);
  assert.equal(byName.description.attributes.configurable, true);
  assert.equal(byName.description.attributes.setter, null);
  assert.equal(byName.description.attributes.dataPropertyFlags, 4);
  assert.equal(byName.for.attributes.writable, true);
  assert.equal(byName.for.attributes.configurable, true);
  assert.equal(byName.for.attributes.dataPropertyFlags, 5);
  assert.equal(byName.typeof.attributes.accessor, false);
  assert.equal(SYMBOL_BUILTIN_IDS.construct, 1000);
  assert.equal(SYMBOL_BUILTIN_IDS.typeof, 1006);
  const hostFor = Object.getOwnPropertyDescriptor(Symbol, 'for');
  const hostKeyFor = Object.getOwnPropertyDescriptor(Symbol, 'keyFor');
  const hostToString = Object.getOwnPropertyDescriptor(Symbol.prototype, 'toString');
  const hostValueOf = Object.getOwnPropertyDescriptor(Symbol.prototype, 'valueOf');
  const hostDescription = Object.getOwnPropertyDescriptor(Symbol.prototype, 'description');
  const hostPrototype = Object.getOwnPropertyDescriptor(Symbol, 'prototype');
  for (const [host, entry] of [[hostFor, byName.for], [hostKeyFor, byName.keyFor], [hostToString, byName.toString], [hostValueOf, byName.valueOf]]) {
    assert.equal(entry.attributes.writable, host.writable);
    assert.equal(entry.attributes.enumerable, host.enumerable);
    assert.equal(entry.attributes.configurable, host.configurable);
  }
  assert.equal(typeof hostDescription.get, 'function');
  assert.equal(hostDescription.set, undefined);
  assert.equal(byName.description.attributes.enumerable, hostDescription.enumerable);
  assert.equal(byName.description.attributes.configurable, hostDescription.configurable);
  assert.equal(symbolPrototypePropertyAttributes.writable, hostPrototype.writable);
  assert.equal(symbolPrototypePropertyAttributes.enumerable, hostPrototype.enumerable);
  assert.equal(symbolPrototypePropertyAttributes.configurable, hostPrototype.configurable);
  assert.equal(symbolPrototypePropertyAttributes.dataPropertyFlags, 0);
  assert.equal(symbolBuiltins.some(entry => entry.name === 'iterator' || entry.name === 'toStringTag' || entry.name === 'toPrimitive'), false);
  assert.equal(Symbol.prototype[Symbol.toStringTag], 'Symbol');
  const realm = createSymbolRealm();
  const cell = dispatchSymbolBuiltin(realm, 1000, { argument: 'd', newTarget: undefined });
  assert.equal(dispatchSymbolBuiltin(realm, 1001, { argument: 'd' }), realm.symbolFor('d'));
  assert.equal(dispatchSymbolBuiltin(realm, 1002, { argument: cell }), null);
  assert.equal(dispatchSymbolBuiltin(realm, 1002, { argument: realm.symbolFor('d') }), 'd');
  assert.equal(dispatchSymbolBuiltin(realm, 1003, { receiver: cell }), 'Symbol(d)');
  assert.equal(dispatchSymbolBuiltin(realm, 1004, { receiver: cell }), cell);
  assert.equal(dispatchSymbolBuiltin(realm, 1005, { receiver: cell }), 'd');
  assert.equal(dispatchSymbolBuiltin(realm, 1005, { receiver: symbolConstruct(realm, undefined, undefined) }), undefined);
  assert.equal(dispatchSymbolBuiltin(realm, 1006, { tag: 17 }), 'symbol');
  assert.throws(() => dispatchSymbolBuiltin(realm, 1007, {}), error => error.tag === 'Unsupported' && error.status === 6);
  assert.throws(() => dispatchSymbolBuiltin(null, 1000, {}), error => error.tag === 'Unsupported');
});

test('wgsl fragment has bounded guest-memory hooks and the integration gap list', () => {
  assert.match(wgsl, /INTEGRATION_GAPS/);
  assert.match(wgsl, /struct SymbolCell \{\s*id: u32,\s*desc: u32,\s*registry_key: u32,\s*flags: u32,/);
  assert.equal(wgsl.includes('@compute'), false);
  assert.equal(/\bwhile\s*\(/.test(wgsl), false);
  const loops = [...wgsl.matchAll(/\bfor\s*\(([^;]*;[^;]*;[^)]*)\)/g)];
  assert.ok(loops.length >= 4);
  for (const loop of loops) assert.match(loop[1], /</);
  assert.match(wgsl, new RegExp(`SYMBOL_VALUE_TAG: u32 = ${SYMBOL_VALUE_TAG}u`));
  assert.match(wgsl, new RegExp(`SYMBOL_CELL_KIND: u32 = ${SYMBOL_CELL_KIND}u`));
  assert.match(wgsl, new RegExp(`SYMBOL_REGISTRY_KIND: u32 = ${SYMBOL_REGISTRY_KIND}u`));
  assert.match(wgsl, new RegExp(`SYMBOL_NODE_CONSTRUCTOR: u32 = ${SYMBOL_NODE_CONSTRUCTOR}u`));
  assert.match(wgsl, new RegExp(`SYMBOL_NODE_PROTOTYPE: u32 = ${SYMBOL_NODE_PROTOTYPE}u`));
  assert.match(wgsl, new RegExp(`SYMBOL_NODE_REGISTRY: u32 = ${SYMBOL_NODE_REGISTRY}u`));
  assert.match(wgsl, new RegExp(`SYMBOL_MAX_REGISTRY_ENTRIES: u32 = ${MAX_REGISTRY_ENTRIES}u`));
  assert.match(wgsl, /SYMBOL_FLAG_HAS_DESCRIPTION: u32 = 1u/);
  assert.match(wgsl, /SYMBOL_FLAG_IN_REGISTRY: u32 = 2u/);
  assert.match(wgsl, /case 0u: \{ return 83u; \}[\s\S]*case 5u: \{ return 108u; \}[\s\S]*default: \{ return 40u; \}/);
  assert.match(wgsl, /V\(115u, 121u, 109u, 98u\)/);
  assert.match(wgsl, /V\(111u, 108u, 0u, 0u\)/);
  for (const entry of symbolBuiltins) {
    assert.match(wgsl, new RegExp(`fn ${entry.wgslHookName}\\s*\\(`));
  }
  assert.match(wgsl, /fn symbol_primitive_value\s*\(/);
  assert.match(wgsl, /fn symbol_same_value\s*\(/);
  assert.match(wgsl, /fn symbol_fixed_node\s*\(/);
  assert.match(wgsl, /fn symbol_init_registry_fields\s*\(/);
  assert.match(wgsl, /fn symbol_mark_value\s*\(/);
  assert.match(wgsl, /fn symbol_mark_cell\s*\(/);
  const parts = wgsl.split(/\nfn /).slice(1);
  assert.ok(parts.length >= 15);
  for (const part of parts) {
    const name = /^([a-z0-9_]+)/.exec(part)[1];
    const body = part.slice(part.indexOf('{'));
    assert.equal(body.includes(name + '('), false, name);
  }
});

test('implementation files do not call the host Symbol constructor', () => {
  for (const name of ['symbol-cell.js', 'symbol-builtins.js', 'symbol-identity.wgsl']) {
    const source = stripSource(readFileSync(new URL('./' + name, import.meta.url), 'utf8'));
    assert.equal(/\bSymbol\s*\(/.test(source), false, name);
    assert.equal(source.includes('globalThis'), false, name);
  }
});
