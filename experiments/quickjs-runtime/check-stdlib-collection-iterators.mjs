// Worker 5 host checks for Map/Set iterators. Test oracle only: the guest
// helper sources run against the host model of the private collection
// intrinsics (stdlib-collections-host-model.js) and are compared with native
// V8. Nothing here executes on a GPU or replaces GPU execution.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { MAP_IDS, SET_IDS, ITERATOR_IDS, STDLIB_NODES, collectionIntrinsics } from './stdlib-ids.js';
import { createCollectionHostModel, instantiateHelper } from './stdlib-collections-host-model.js';
import { collectionIteratorMethods, iteratorToStringTags, collectionIteratorIntrinsics, collectionIteratorPending } from './stdlib-collection-iterators.js';
import { collectionIteratorCases, collectionIteratorUnsupportedSources, collectionIteratorUnsupportedPostMergeExpected, collectionIteratorPostMergeCases,
  collectionIteratorResumptionSource, collectionIteratorResumptionExpected } from './stdlib-collection-iterators-cases.js';
// bootstrap.js / program.js import the parent registry, which imports every
// wave worker module. While a sibling module is still missing (parallel wave),
// packing checks are reported as integrationBlocked instead of crashing; raw
// native-vs-Wasm compiler parity still runs.
let integrationBlocked = null, privateBuiltins, attachBootstrap, bootstrapSources, packProgram, entrySource, createCompiler;
try {
  ({ privateBuiltins, attachBootstrap, bootstrapSources } = await import('./bootstrap.js'));
  ({ packProgram, entrySource } = await import('./program.js'));
  ({ createCompiler } = await import('./compiler.js'));
} catch (error) {
  const missing = error.code === 'ERR_MODULE_NOT_FOUND' && /\/(stdlib-[\w-]+\.js)'/.exec(error.message);
  if (!missing) throw error;
  integrationBlocked = `missing ${missing[1]}`;
}

let exactChecks = 0;
const same = (actual, expected, label) => { assert.ok(Object.is(actual, expected), `${label}: ${String(actual)} !== ${String(expected)}`); exactChecks++; };

// ---------------------------------------------------------------------------
// Metadata.
const defined = collectionIteratorMethods.filter(m => m.source);
const aliases = collectionIteratorMethods.filter(m => m.alias !== undefined);
assert.equal(defined.length, 7);
assert.equal(aliases.length, 3);
assert.equal(new Set(defined.map(m => m.field)).size, defined.length, 'unique FIELDS names');
assert.equal(new Set(defined.map(m => m.id)).size, defined.length, 'unique ids');
for (const m of defined) {
  assert.ok(m.id >= 2200 && m.id <= 2259, `${m.field} id range`);
  assert.equal(m.length, 0); assert.equal(m.kind, 'method');
  assert.match(m.source, new RegExp(`^function ${m.field}Bootstrap\\(\\) \\{\\n  "use strict";`));
}
for (const a of aliases) {
  const target = defined.find(m => m.id === a.alias);
  assert.ok(target, `alias ${a.alias} defined`); assert.equal(target.owner, a.owner); if (a.symbol) assert.equal(a.name, target.name, 'symbol alias records the function name');
  assert.equal(a.source, undefined); assert.equal(a.field, undefined);
}
const key = m => m.owner + '.' + (m.symbol ? '@@' + m.symbol : m.name);
assert.deepEqual(collectionIteratorMethods.map(key).sort(), ['Map.prototype.@@iterator', 'Map.prototype.entries', 'Map.prototype.keys', 'Map.prototype.values',
  'MapIterator.prototype.next', 'Set.prototype.@@iterator', 'Set.prototype.entries', 'Set.prototype.keys', 'Set.prototype.values', 'SetIterator.prototype.next']);
assert.deepEqual(Object.fromEntries(defined.map(m => [m.field, m.id])), { mapEntries: MAP_IDS.entries, mapKeys: MAP_IDS.keys, mapValues: MAP_IDS.values,
  setValues: SET_IDS.values, setEntries: SET_IDS.entries, mapIteratorNext: ITERATOR_IDS.mapNext, setIteratorNext: ITERATOR_IDS.setNext });
assert.deepEqual(iteratorToStringTags.map(t => [t.owner, t.node, t.value, t.writable, t.enumerable, t.configurable]),
  [['MapIterator.prototype', STDLIB_NODES.mapIteratorProto, 'Map Iterator', false, false, true], ['SetIterator.prototype', STDLIB_NODES.setIteratorProto, 'Set Iterator', false, false, true]]);
for (const [name, id] of Object.entries(collectionIteratorIntrinsics)) { assert.equal(collectionIntrinsics[name], id); if (privateBuiltins) assert.equal(privateBuiltins[name], id, `${name} reachable from privateBuiltins`); }
for (const m of defined) for (const name of m.source.match(/__lanes\w+/g)) assert.ok(name in collectionIteratorIntrinsics, `${m.field} uses undeclared ${name}`);
assert.ok(collectionIteratorPending.length > 0);

// ---------------------------------------------------------------------------
// Host oracle: model intrinsics + guest helpers -> mock Map/Set (same realm,
// so Object.prototype / TypeError / Array identities match the case code).
const IteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
const coreSources = {
  mapGet: 'function mapGet(key){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("Map.prototype.get");return __lanesMapGet(this,key);}',
  mapSet: 'function mapSet(key,value){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("Map.prototype.set");return __lanesMapSet(this,key,value);}',
  mapHas: 'function mapHas(key){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("Map.prototype.has");return __lanesCollectionHas(this,key);}',
  mapDelete: 'function mapDelete(key){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("Map.prototype.delete");return __lanesCollectionDelete(this,key);}',
  mapClear: 'function mapClear(){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("Map.prototype.clear");return __lanesCollectionClear(this);}',
  mapSize: 'function mapSize(){"use strict";if(__lanesCollectionBrand(this)!==1)throw new TypeError("Map.prototype.size");return __lanesCollectionSize(this);}',
  setAdd: 'function setAdd(key){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("Set.prototype.add");return __lanesSetAdd(this,key);}',
  setHas: 'function setHas(key){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("Set.prototype.has");return __lanesCollectionHas(this,key);}',
  setDelete: 'function setDelete(key){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("Set.prototype.delete");return __lanesCollectionDelete(this,key);}',
  setClear: 'function setClear(){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("Set.prototype.clear");return __lanesCollectionClear(this);}',
  setSize: 'function setSize(){"use strict";if(__lanesCollectionBrand(this)!==2)throw new TypeError("Set.prototype.size");return __lanesCollectionSize(this);}',
};
function makeMocks({ relink }) {
  const iteratorParent = relink ? IteratorPrototype : Object.prototype;
  const protos = { mapPrototype: Object.create(Object.prototype), setPrototype: Object.create(Object.prototype),
    mapIteratorPrototype: Object.create(iteratorParent), setIteratorPrototype: Object.create(iteratorParent) };
  const { intrinsics } = createCollectionHostModel(protos);
  const helper = source => instantiateHelper(source, intrinsics);
  const method = (target, name, fn, fnName = name) => {
    if (fnName !== null) Object.defineProperty(fn, 'name', { value: fnName, configurable: true });
    Object.defineProperty(target, name, { value: fn, writable: true, enumerable: false, configurable: true });
  };
  const owners = { 'Map.prototype': protos.mapPrototype, 'Set.prototype': protos.setPrototype,
    'MapIterator.prototype': protos.mapIteratorPrototype, 'SetIterator.prototype': protos.setIteratorPrototype };
  const byId = new Map();
  for (const m of defined) { const fn = helper(m.source); byId.set(m.id, fn); method(owners[m.owner], m.name, fn); }
  for (const a of aliases) Object.defineProperty(owners[a.owner], a.symbol ? Symbol[a.symbol] : a.name, { value: byId.get(a.alias), writable: true, enumerable: false, configurable: true });
  for (const t of iteratorToStringTags) Object.defineProperty(owners[t.owner], Symbol.toStringTag, { value: t.value, writable: t.writable, enumerable: t.enumerable, configurable: t.configurable });
  const core = Object.fromEntries(Object.entries(coreSources).map(([k, s]) => [k, helper(s)]));
  for (const name of ['get', 'set', 'has', 'delete', 'clear']) method(protos.mapPrototype, name, core['map' + name[0].toUpperCase() + name.slice(1)]);
  for (const name of ['add', 'has', 'delete', 'clear']) method(protos.setPrototype, name, core['set' + name[0].toUpperCase() + name.slice(1)]);
  Object.defineProperty(protos.mapPrototype, 'size', { get: core.mapSize, enumerable: false, configurable: true });
  Object.defineProperty(protos.setPrototype, 'size', { get: core.setSize, enumerable: false, configurable: true });
  Object.defineProperty(protos.mapPrototype, Symbol.toStringTag, { value: 'Map', configurable: true });
  Object.defineProperty(protos.setPrototype, Symbol.toStringTag, { value: 'Set', configurable: true });
  // Constructors: host stand-ins for helpers 2201/2221 (for-of = language protocol).
  function MockMap(iterable) {
    if (new.target === undefined) throw new TypeError('Constructor Map requires new');
    const map = intrinsics.__lanesCollectionCreate(1);
    if (iterable !== undefined && iterable !== null) for (const entry of iterable) { if (Object(entry) !== entry) throw new TypeError('entry'); map.set(entry[0], entry[1]); }
    return map;
  }
  function MockSet(iterable) {
    if (new.target === undefined) throw new TypeError('Constructor Set requires new');
    const set = intrinsics.__lanesCollectionCreate(2);
    if (iterable !== undefined && iterable !== null) for (const value of iterable) set.add(value);
    return set;
  }
  Object.defineProperty(MockMap, 'prototype', { value: protos.mapPrototype }); Object.defineProperty(MockSet, 'prototype', { value: protos.setPrototype });
  method(protos.mapPrototype, 'constructor', MockMap); method(protos.setPrototype, 'constructor', MockSet);
  Object.defineProperty(MockMap, 'name', { value: 'Map' }); Object.defineProperty(MockSet, 'name', { value: 'Set' });
  return { Map: MockMap, Set: MockSet, protos, intrinsics };
}
const today = makeMocks({ relink: false }), merged = makeMocks({ relink: true });
const runMock = (mocks, source, input) => new Script(`(function(Map,Set){"use strict";return (${source});})`).runInThisContext()(mocks.Map, mocks.Set)(input);
const runNative = (source, input) => new Script(`(${source})`).runInNewContext()(input);

assert.ok(collectionIteratorCases.length >= 35, 'at least 35 value cases');
assert.equal(new Set([...collectionIteratorCases, ...collectionIteratorPostMergeCases].map(c => c.feature)).size, collectionIteratorCases.length + collectionIteratorPostMergeCases.length);
let caseChecks = 0;
for (const item of collectionIteratorCases) {
  assert.match(item.source, /^function f\(x\)\{/); assert.ok(item.expected === null || typeof item.expected !== 'object');
  same(runNative(item.source, item.input), item.expected, 'native ' + item.feature);
  same(runMock(today, item.source, item.input), item.expected, 'helpers ' + item.feature);
  caseChecks++;
}
same(runNative(collectionIteratorResumptionSource, 3), collectionIteratorResumptionExpected, 'native resumption');
same(runMock(today, collectionIteratorResumptionSource, 3), collectionIteratorResumptionExpected, 'helpers resumption');
// Post-merge cases: model the handoff (nodes 70/71 relinked to %IteratorPrototype%,
// V8 GetIterator standing in for Grok's protocol). With today's prototypes the
// iterator objects are not iterable, matching the Unsupported guard boundary.
let postMergeChecks = 0;
for (const item of collectionIteratorPostMergeCases) {
  assert.equal(item.requiresGenericIteration, true);
  same(runNative(item.source, item.input), item.expected, 'native ' + item.feature);
  same(runMock(merged, item.source, item.input), item.expected, 'helpers+relink ' + item.feature);
  postMergeChecks++;
}
assert.throws(() => runMock(today, 'function f(x){const m=new Map();m.set(1,x);for(const k of m.keys()){}return 1;}', 3), TypeError, 'today: iterator objects lack @@iterator');
let unsupportedNative = 0;
assert.equal(collectionIteratorUnsupportedPostMergeExpected.length, collectionIteratorUnsupportedSources.length);
collectionIteratorUnsupportedSources.forEach((source, i) => {
  assert.match(source, /^function f\(x\)\{/);
  assert.match(source, /for\(const|\.\.\.|const \[|Array\.from|new (Map|Set)\([ms]\)/, 'uses an iterable-protocol form');
  same(runNative(source, 3), collectionIteratorUnsupportedPostMergeExpected[i], 'native post-merge unsupported ' + i);
  same(runMock(merged, source, 3), collectionIteratorUnsupportedPostMergeExpected[i], 'helpers+relink post-merge unsupported ' + i);
  unsupportedNative++;
});

// Randomized differential: interleaved mutations and iterator steps.
let randomOps = 0;
{
  let seed = 0x5eed1234; const rnd = n => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) % n; };
  const keys = [0, -0, 1, 2, '1', 'a', NaN, true, null, undefined];
  const fmt = r => { assert.deepEqual(Object.keys(r), ['value', 'done']); return r; };
  for (let trial = 0; trial < 1500; trial++) {
    const isMap = trial % 2 === 0;
    const native = isMap ? new globalThis.Map() : new globalThis.Set(), mock = isMap ? new today.Map() : new today.Set();
    const its = [];
    for (let op = 0; op < 80; op++) {
      const k = keys[rnd(keys.length)], choice = rnd(10);
      if (choice < 3) { if (isMap) { const v = rnd(100); native.set(k, v); mock.set(k, v); } else { native.add(k); mock.add(k); } }
      else if (choice < 5) same(mock.delete(k), native.delete(k), 'delete');
      else if (choice === 5 && rnd(4) === 0) { native.clear(); mock.clear(); }
      else if (choice === 6 && its.length < 4) { const kind = ['keys', 'values', 'entries'][rnd(3)]; its.push([native[kind](), mock[kind](), kind]); }
      else if (its.length) {
        const [n, m, kind] = its[rnd(its.length)]; const a = fmt(m.next()), b = n.next();
        same(a.done, b.done, 'done');
        if (kind === 'entries' && !a.done) { assert.ok(Array.isArray(a.value)); assert.equal(a.value.length, 2); same(a.value[0], b.value[0], 'entry key'); same(a.value[1], b.value[1], 'entry value'); }
        else same(a.value, b.value, 'value');
      }
      same(mock.size, native.size, 'size');
      randomOps++;
    }
  }
}

// ---------------------------------------------------------------------------
// Compiler parity: native vs Wasm compile, intrinsic root, packProgram.
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const compileNative = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const { default: create } = await import('./generated/compiler.mjs'); const wasm = await create();
let helperParity = 0, helperRawParity = 0;
for (const m of defined) {
  const native = compileNative(m.source), raw = JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [m.source]));
  assert.ok(!native.error && !raw.error, m.field);
  // Raw bytes may differ in atom indices (separate atom tables); packProgram
  // resolves atoms, so parity is asserted on the packed program below.
  assert.deepEqual(raw.functions.map(f => f.instructions.map(i => i.op)), native.functions.map(f => f.instructions.map(i => i.op)), `${m.field} opcode parity`); helperRawParity++;
  if (integrationBlocked) continue;
  for (const code of [raw, native]) code.functions[0].intrinsicRoot = true;
  const a = packProgram(raw, entrySource(m.source)), b = packProgram(native, entrySource(m.source));
  assert.deepEqual(a.code, b.code); assert.deepEqual(a.image, b.image); helperParity++;
}

// Case sources: QuickJS must compile every source; packing waits for the
// parent registry to wire the Map/Set globals (integrationPending).
const allSources = [...collectionIteratorCases.map(c => c.source), collectionIteratorResumptionSource, ...collectionIteratorUnsupportedSources, ...collectionIteratorPostMergeCases.map(c => c.source)];
let nativeCompiled = 0, integrationPending = false, integratedPrograms = 0, pendingPrograms = 0;
for (const source of allSources) { const raw = compileNative(source); assert.ok(!raw.error, raw.error); nativeCompiled++; }
const compiler = integrationBlocked ? null : await createCompiler();
const isPending = error => /Unsupported global or module reference: (Map|Set)\b/.test(error.message);
let bootstraps = null;
for (const source of integrationBlocked ? [] : allSources) {
  let actual;
  try { actual = compiler.compile(source); } catch (error) { if (!isPending(error)) throw error; integrationPending = true; pendingPrograms++; continue; }
  bootstraps ??= Object.fromEntries(Object.entries(bootstrapSources).map(([field, s]) => [field, compileNative(s)]));
  const expected = packProgram(attachBootstrap(compileNative(source), bootstraps), entrySource(source));
  assert.deepEqual(actual.code, expected.code); assert.deepEqual(actual.image, expected.image); integratedPrograms++;
}

console.log(JSON.stringify({ exactChecks, caseChecks, valueCases: collectionIteratorCases.length, postMergeChecks, unsupportedSources: unsupportedNative,
  randomOps, helperRawParity, helperParity, nativeCompiled, integratedPrograms, pendingPrograms, integrationPending, integrationBlocked, gpuChecks: false }));
