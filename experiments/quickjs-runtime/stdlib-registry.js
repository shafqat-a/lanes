import { arraySpeciesSources, arraySpeciesIntrinsics, arraySpeciesPrivateMetadata, speciesGetterMethods } from './array-species-source.js';
import { groupByMethods, groupByIntrinsics } from './group-by-source.js';
// Standard-library wave registry (parent-owned). Worker modules contribute
// data (method metadata + strict guest helper sources); program.js,
// bootstrap.js and shader.js consume it only through these exports.
// FIELDS names are appended after every existing name (append-only).
import { STDLIB_NODES as N, MAP_IDS, SET_IDS, SYMBOL_KEY } from './stdlib-ids.js';
import { collectionWGSLFunctions, collectionMarkWGSL, collectionObjectMethodWGSL } from './stdlib-collections-core.js';
import { mapCoreMethods, mapConstructSource, mapCorePending } from './stdlib-map-core.js';
import { mapExtraMethods, mapExtraPending } from './stdlib-map-extra.js';
import { setCoreMethods, setConstructSource, setCorePending } from './stdlib-set-core.js';
import { setExtraMethods, setExtraPending } from './stdlib-set-extra.js';
import { collectionIteratorMethods, iteratorToStringTags, collectionIteratorPending } from './stdlib-collection-iterators.js';
import * as reflectModule from './stdlib-reflect.js';
import * as numericModule from './stdlib-numeric.js';

const reflectMethods = reflectModule.reflectMethods, numericMethods = numericModule.numericMethods;

export const OWNER_NODES = Object.freeze({
  'Object': 19, 'Array': 18,
  'Map': N.mapCtor, 'Map.prototype': N.mapProto, 'Set': N.setCtor, 'Set.prototype': N.setProto,
  'MapIterator.prototype': N.mapIteratorProto, 'SetIterator.prototype': N.setIteratorProto,
  'Reflect': 47, 'Math': 23, 'Number': 24, 'Number.prototype': 21,
});

// Installation order is module order (ES2025 leaves built-in property creation
// order implementation-defined; conformance marks order-sensitive cases).
export const stdlibMethods = Object.freeze([
  ...groupByMethods, ...speciesGetterMethods,
  ...mapCoreMethods, ...mapExtraMethods, ...setCoreMethods, ...setExtraMethods,
  ...collectionIteratorMethods, ...reflectMethods, ...numericMethods,
].map(m => Object.freeze({ ...m })));

export const stdlibConstructors = Object.freeze([
  Object.freeze({ id: MAP_IDS.construct, field: 'mapConstruct', source: mapConstructSource }),
  Object.freeze({ id: SET_IDS.construct, field: 'setConstruct', source: setConstructSource }),
]);

// Validation: ids unique among implementations, owners known, fields unique.
{
  const ids = new Set(), fields = new Set();
  for (const m of stdlibMethods) {
    if (m.owner !== 'global' && !(m.owner in OWNER_NODES)) throw new Error(`stdlib: unknown owner ${m.owner}`);
    if (m.alias !== undefined) { if (!stdlibMethods.some(x => x.id === m.alias && x.alias === undefined)) throw new Error(`stdlib: alias ${m.alias} has no implementation`); continue; }
    if (!(m.id >= 2200 && m.id <= 2399)) throw new Error(`stdlib: id ${m.id} outside 2200..2399`);
    if (ids.has(m.id)) throw new Error(`stdlib: duplicate id ${m.id}`);
    if (fields.has(m.field)) throw new Error(`stdlib: duplicate field ${m.field}`);
    if (typeof m.source !== 'string') throw new Error(`stdlib: ${m.field} lacks source`);
    ids.add(m.id); fields.add(m.field);
  }
}

const implemented = stdlibMethods.filter(m => m.alias === undefined);
const functionName = m => m.kind === 'getter' ? `get ${m.name}` : (m.functionName ?? m.name);

// {id, name (FIELDS key of the function name), length, field} — the same shape
// as shader.js phase5Methods (name/length metadata + call dispatch).
export const stdlibFunctionMetadata = Object.freeze([arraySpeciesPrivateMetadata,...implemented.map(m => Object.freeze({ id: m.id, name: functionName(m), length: m.length, field: m.field }))]);

export const stdlibBootstrapSources = Object.freeze({
  ...arraySpeciesSources,
  ...Object.fromEntries(implemented.map(m => [m.field, m.source])),
  ...Object.fromEntries(stdlibConstructors.map(c => [c.field, c.source])),
});

// New WGSL intrinsics contributed by worker modules (names -> ids), if any.
// (The numeric module is guest-only: it contributes no new WGSL intrinsics.)
export const stdlibNewIntrinsics = Object.freeze({ ...arraySpeciesIntrinsics, ...groupByIntrinsics, ...reflectModule.reflectNewIntrinsics });
const workerWGSL = [reflectModule.reflectWGSL];

export const stdlibGlobals = Object.freeze([
  { name: 'Map', builtin: MAP_IDS.ctor }, { name: 'Set', builtin: SET_IDS.ctor },
  ...implemented.filter(m => m.owner === 'global').map(m => ({ name: m.name, builtin: m.id })),
]);

export const stdlibToStringTags = Object.freeze([
  { owner: 'Map.prototype', value: 'Map' }, { owner: 'Set.prototype', value: 'Set' }, ...iteratorToStringTags,
]);

export const stdlibFieldNames = Object.freeze([...new Set([
  ...Object.keys(arraySpeciesSources),
  'Map', 'Set', 'groupBy', 'species',
  ...stdlibMethods.flatMap(m => [m.name, functionName(m), m.field].filter(x => typeof x === 'string')),
  ...stdlibConstructors.map(c => c.field),
  ...stdlibToStringTags.map(t => t.value),
  ...stdlibGlobals.map(g => g.name),
])]);

export const stdlibPending = Object.freeze({
  map: [...mapCorePending, ...mapExtraPending, 'subclass construction (NewTarget != Map)'],
  set: [...setCorePending, ...setExtraPending, 'subclass construction (NewTarget != Set)'],
  iterators: [...collectionIteratorPending],
  reflect: [...(reflectModule.reflectPending ?? [])],
  numeric: [...(numericModule.numericPending ?? [])],
});

// Implemented names per owner (used to shrink prototypeGap lists).
export const stdlibImplementedNames = owner => implemented.filter(m => m.owner === owner && !m.symbol).map(m => m.name);

// -------------------------------------------------------------------- WGSL --
export const stdlibWGSLFunctions = context => collectionWGSLFunctions(context) + workerWGSL.map(w => w.functions ?? '').join('\n');
export const stdlibMarkWGSL = collectionMarkWGSL;
export const stdlibObjectMethodWGSL = () => [collectionObjectMethodWGSL, ...workerWGSL.map(w => w.objectMethod ?? '')].join('\n  ');

const symbolKey = name => { if (!(name in SYMBOL_KEY)) throw new Error(`stdlib: unsupported symbol key ${name}`); return SYMBOL_KEY[name]; };

// main() init: fixed nodes 66..71 in place, then properties in spec order.
export const stdlibInitWGSL = ({ F }) => {
  const key = name => { if (!(name in F)) throw new Error(`stdlib: FIELDS lacks ${name}`); return `fieldKey(${F[name]}u)`; };
  const lines = [];
  const object = (node, proto) => lines.push(`states[l].heap[${node}u]=Node(V(${proto}u,0u,0u,1u),0u,0u,2u,0u);`);
  object(N.mapCtor, 3); object(N.mapProto, 1); object(N.setCtor, 3); object(N.setProto, 1);
  object(N.mapIteratorProto, 77); object(N.setIteratorProto, 77);
  const data = (node, k, value, flags) => lines.push(`dataProperty(l,${node}u,${k},${value},${flags}u);`);
  for (const [ctor, proto, name, id] of [[N.mapCtor, N.mapProto, 'Map', MAP_IDS.ctor], [N.setCtor, N.setProto, 'Set', SET_IDS.ctor]]) {
    data(ctor, key('length'), 'num(fromUnsigned(0u))', 4);
    data(ctor, key('name'), `image[${key(name)}]`, 4);
    data(ctor, key('prototype'), `V(${proto}u,0u,4u,0u)`, 0);
    data(proto, key('constructor'), `V(${id}u,0u,11u,0u)`, 5);
  }
  for (const m of stdlibMethods) {
    if (m.owner === 'global') continue;
    const node = OWNER_NODES[m.owner], id = m.alias ?? m.id;
    const k = m.symbol ? `${symbolKey(m.symbol)}u` : key(m.name);
    if (m.kind === 'getter') {
      lines.push(`{let accessor=alloc(l,9u,V(${(0x80000000 | id) >>> 0}u,0u,0u,0u),${k},states[l].heap[${node}u].next);states[l].heap[accessor].marked=8u;states[l].heap[${node}u].next=accessor;}`);
    } else data(node, k, `V(${id}u,0u,11u,0u)`, 5);
    // A method installed under a name may also be exposed under a symbol (e.g. entries / @@iterator).
    if (m.alsoSymbol) data(node, `${symbolKey(m.alsoSymbol)}u`, `V(${id}u,0u,11u,0u)`, 5);
  }
  for (const tag of stdlibToStringTags) data(OWNER_NODES[tag.owner], `${SYMBOL_KEY.toStringTag}u`, `image[${key(tag.value)}]`, 4);
  return lines.join('\n    ');
};

// Constructor routing: `new Map(...)` / `new Set(...)` call the construct helper.
export const stdlibConstructWGSL = `if(callee.x==${MAP_IDS.ctor}u||callee.x==${SET_IDS.ctor}u){constructorId=callee.x+1u;}`;
// Calling Map()/Set() without new: TypeError (ES2025 24.1.1.1 step 1).
export const stdlibCallWithoutNewWGSL = `if(id==${MAP_IDS.ctor}u||id==${SET_IDS.ctor}u){states[l].status=4u;return undef();}`;
export const stdlibObjectView = [[MAP_IDS.ctor, N.mapCtor], [SET_IDS.ctor, N.setCtor]];
