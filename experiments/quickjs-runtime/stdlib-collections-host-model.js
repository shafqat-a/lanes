// TEST ORACLE ONLY. A host model of the private collection intrinsics in
// stdlib-ids.js (collectionIntrinsics) so guest helper sources can be executed
// by Node for differential checks. It is never used by runtime.js and never
// replaces GPU execution. It mirrors the WGSL storage contract: an append-only
// entry chain with tombstones, SameValueZero lookup, −0 key normalization, and
// iterators that hold the last visited entry.
const BRAND = Symbol('lanesCollectionBrand');
const ITER = Symbol('lanesCollectionIterator');

function sameValueZero(a, b) { return a === b || (a !== a && b !== b); }

export function createCollectionHostModel({ mapPrototype = Object.prototype, setPrototype = Object.prototype, mapIteratorPrototype = Object.prototype, setIteratorPrototype = Object.prototype } = {}) {
  const store = new WeakMap(); // object -> {brand, first, last, live}
  const iterators = new WeakMap(); // iterator -> {collection|null, current|null, kind, brand}
  const internal = (c, label) => {
    const data = store.get(Object(c) === c ? c : {});
    if (!data) throw new Error(`internal error (status 2): ${label} without collection brand`);
    return data;
  };
  const find = (data, key) => { for (let e = data.first; e; e = e.next) if (!e.deleted && sameValueZero(e.key, key)) return e; return null; };
  const append = (data, key, value) => {
    const entry = { key: Object.is(key, -0) ? 0 : key, value, next: null, deleted: false };
    if (data.last) data.last.next = entry; else data.first = entry;
    data.last = entry; data.live++; return entry;
  };
  const prototypes = { mapPrototype, setPrototype, mapIteratorPrototype, setIteratorPrototype };
  const intrinsics = {
    __lanesCollectionCreate(brand) {
      if (brand !== 1 && brand !== 2) throw new Error('internal error (status 2): bad brand');
      const o = Object.create(brand === 1 ? prototypes.mapPrototype : prototypes.setPrototype);
      store.set(o, { brand, first: null, last: null, live: 0 }); return o;
    },
    __lanesCollectionBrand(value) { return (Object(value) === value && store.get(value)?.brand) || 0; },
    __lanesCollectionHas(c, key) { return find(internal(c, 'has'), key) !== null; },
    __lanesMapGet(c, key) { const data = internal(c, 'get'); if (data.brand !== 1) throw new Error('internal error'); const e = find(data, key); return e ? e.value : undefined; },
    __lanesMapSet(c, key, value) { const data = internal(c, 'set'); if (data.brand !== 1) throw new Error('internal error'); const e = find(data, key); if (e) e.value = value; else append(data, key, value); return c; },
    __lanesSetAdd(c, key) { const data = internal(c, 'add'); if (data.brand !== 2) throw new Error('internal error'); if (!find(data, key)) append(data, key, undefined); return c; },
    __lanesCollectionDelete(c, key) { const data = internal(c, 'delete'); const e = find(data, key); if (!e) return false; e.deleted = true; e.key = e.value = undefined; data.live--; return true; },
    __lanesCollectionClear(c) { const data = internal(c, 'clear'); for (let e = data.first; e; e = e.next) if (!e.deleted) { e.deleted = true; e.key = e.value = undefined; } data.live = 0; return undefined; },
    __lanesCollectionSize(c) { return internal(c, 'size').live; },
    __lanesCollectionIterator(c, kind) {
      const data = internal(c, 'iterator');
      const it = Object.create(data.brand === 1 ? prototypes.mapIteratorPrototype : prototypes.setIteratorPrototype);
      iterators.set(it, { data, current: null, kind, brand: data.brand, exhausted: false }); return it;
    },
    __lanesCollectionStep(it) {
      const s = iterators.get(it); if (!s) throw new Error('internal error (status 2): step');
      if (s.exhausted) return false;
      let e = s.current ? s.current.next : s.data.first;
      while (e && e.deleted) e = e.next;
      if (!e) { s.exhausted = true; s.data = null; return false; }
      s.current = e; return true;
    },
    __lanesCollectionIterKey(it) { return iterators.get(it).current.key; },
    __lanesCollectionIterValue(it) { const s = iterators.get(it); return s.brand === 1 ? s.current.value : s.current.key; },
    __lanesCollectionIterBrand(value) { return (Object(value) === value && iterators.get(value)?.brand) || 0; },
    __lanesCollectionIterKind(it) { return iterators.get(it).kind; },
  };
  return { intrinsics, prototypes, BRAND, ITER };
}

// Instantiate a guest helper source with host bindings (oracle use only).
export function instantiateHelper(source, bindings) {
  return Function(...Object.keys(bindings), `"use strict";return (${source});`)(...Object.values(bindings));
}
