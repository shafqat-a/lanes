export {
  ARRAY_ENTRIES_ID,
  ARRAY_ITERATOR_KIND,
  ARRAY_ITERATOR_NEXT_ID,
  ARRAY_ITERATOR_PROTOTYPE,
  ARRAY_ITERATOR_SLOT,
  ARRAY_KEYS_ID,
  ARRAY_VALUES_ID,
  CREATE_ARRAY_ITERATOR_ID,
  CREATE_STRING_ITERATOR_ID,
  HEAP_KIND_ARRAY_ITERATOR,
  HEAP_KIND_STRING_ITERATOR,
  ITERATOR_IDENTITY_ID,
  ITERATOR_PROTOTYPE,
  OBJECT_PROTOTYPE,
  STRING_ITERATOR_ID,
  STRING_ITERATOR_NEXT_ID,
  STRING_ITERATOR_PROTOTYPE,
  fixedNodes,
  iteratorBuiltinFields,
  iteratorPrivateBuiltins,
  prototypeProperties,
  referencedBuiltins,
  unusedHeapKinds,
} from "./ids.js";

export {
  arrayIteratorMethodSources,
  iteratorBootstrapSources,
  sources,
} from "./sources.js";

export {
  iteratorMarkText,
  iteratorMarkWGSL,
  iteratorObjectMethodText,
  iteratorObjectMethodWGSL,
  iteratorWgslFunctionText,
  iteratorWgslFunctions,
} from "./wgsl.js";

export {
  arrayIteratorNext,
  createArrayIterator,
  createStringIterator,
  iteratorIdentity,
  next,
  readCodePoint,
  stringIteratorNext,
  stringIteratorTake,
  toLength,
} from "./simulate.js";
