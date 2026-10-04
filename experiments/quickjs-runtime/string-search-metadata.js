// ES2025 String.prototype search methods. Builtin arity excludes optional
// position even though the implementation's guest helper has two parameters.
export const stringSearchMetadata = Object.freeze([
  'indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith',
].map((name, index) => Object.freeze({
  name, id: 800 + index, length: 1,
  field: 'string' + name[0].toUpperCase() + name.slice(1),
})));
