import { arrayBuiltinLengths } from './array-builtin-metadata.js';
export const arrayBuiltinMetadataSources = Object.keys(arrayBuiltinLengths).flatMap(name => [
  `function f(x){return Array.prototype.${name}.name;}`,
  `function f(x){return Array.prototype.${name}.length;}`,
]);
// Unbacked native identities intentionally reject descriptor/mutation access.
export const arrayBuiltinMetadataUnsupportedSources = [
  'function f(x){return Object.getOwnPropertyDescriptor(Array.prototype.reduce,"length").value;}',
  'function f(x){Object.defineProperty(Array.prototype.fill,"name",{value:"changed"});return Array.prototype.fill.name;}',
];
