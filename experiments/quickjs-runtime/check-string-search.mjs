// Host algorithm/reference and compiler check only, never a runtime backend.
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attachBootstrap, bootstrapSources, privateBuiltins } from './bootstrap.js';
import { entrySource, packProgram } from './program.js';
import {
  stringSearchSources, stringSearchIntrinsics, stringSearchIndirectIntrinsics,
  stringSearchMethodLengths, stringSearchMessages, stringSearchGaps,
} from './string-search-source.js';
import {
  stringSearchCases, stringSearchResumptionSource, stringSearchResumptionExpected,
  stringSearchNegativeSources,
} from './string-search-cases.js';

const names = ['indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith'];
assert.deepEqual(Object.keys(stringSearchSources), names);
assert.deepEqual(Object.keys(stringSearchMethodLengths), names);
for (const [name, id] of Object.entries(stringSearchIntrinsics)) assert.equal(privateBuiltins[name], id);
for (const [name, id] of Object.entries(stringSearchIndirectIntrinsics)) assert.equal(privateBuiltins[name], id);
assert.equal(privateBuiltins.__lanesToText, 134);
for (const name of names) {
  const source = stringSearchSources[name];
  assert.equal(typeof source, 'string');
  assert.equal(source.startsWith(`function ${name}Bootstrap(searchString, position) {`), true, name);
  assert.equal(source.includes('"use strict";'), true, name);
  assert.equal(source.includes('__lanesCharCodeAt('), true, name);
  // String.prototype.charCodeAt is guest-mutable; helpers must not consult it.
  assert.equal(source.includes('.charCodeAt('), false, name);
  assert.equal(source.includes('__lanesToText'), false, name);
  assert.equal(source.includes('.indexOf('), false, name);
  assert.equal(source.includes('.lastIndexOf('), false, name);
  assert.equal(source.includes('.includes('), false, name);
  assert.equal(source.includes('.startsWith('), false, name);
  assert.equal(source.includes('.endsWith('), false, name);
  assert.equal(source.includes('codePointAt'), false, name);
  assert.equal(source.includes(stringSearchMessages.pattern), name === 'includes' || name === 'startsWith' || name === 'endsWith', name);
  const receiverAt = source.indexOf('asText(this)');
  const searchAt = source.indexOf('asText(searchString)');
  assert.ok(receiverAt > 0 && receiverAt < searchAt, name);
  if (name === 'indexOf' || name === 'includes' || name === 'startsWith') {
    assert.ok(searchAt < source.indexOf('toIntegerOrInfinity(position)'), name);
  }
  if (name === 'lastIndexOf') {
    assert.ok(searchAt < source.indexOf('asNumber(position)'), name);
    assert.equal(source.includes('number !== number ? Infinity : truncate(number)'), true);
  }
  if (name === 'endsWith') {
    const undefinedAt = source.indexOf('position === undefined');
    assert.ok(searchAt < undefinedAt && undefinedAt < source.lastIndexOf('toIntegerOrInfinity(position)'), name);
  }
  if (name === 'includes' || name === 'startsWith' || name === 'endsWith') {
    assert.ok(source.indexOf(stringSearchMessages.pattern) < searchAt, name);
  }
}

function objectLike(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
function lanesPrimitive(value, stringHint) {
  if (!objectLike(value)) return value;
  let method = stringHint ? value.toString : value.valueOf;
  if (typeof method === 'function') {
    const result = method.call(value);
    if (!objectLike(result)) return result;
  }
  method = stringHint ? value.valueOf : value.toString;
  if (typeof method === 'function') {
    const result = method.call(value);
    if (!objectLike(result)) return result;
  }
  throw new TypeError('Cannot convert object to primitive value');
}
function lanesText(value) {
  if (typeof value === 'symbol' || typeof value === 'bigint') throw new TypeError('Unsupported primitive text');
  if (objectLike(value)) throw new TypeError('Unsupported object text');
  return String(value);
}
function lanesNumber(value) {
  if (typeof value === 'symbol' || typeof value === 'bigint') throw new TypeError('Unsupported primitive number');
  if (objectLike(value)) throw new TypeError('Unsupported object number');
  return Number(value);
}

// Host-only stand-in: production status 6 is not a catchable guest exception.
function lanesUnsupported(message) {
  const error = new Error(message); error.name = 'UnsupportedOperation'; throw error;
}
// Host stand-in for the native code-unit read. It captures the host method so a
// guest reassignment of String.prototype.charCodeAt cannot reach it.
const hostCharCodeAt = String.prototype.charCodeAt;
function lanesCharCodeAt(text, index) {
  assert.equal(typeof text, 'string');
  return hostCharCodeAt.call(text, index);
}
const originals = Object.fromEntries(names.map(name => [name, String.prototype[name]]));
const factories = Object.fromEntries(names.map(name => [name, new Function(
  '__lanesPrimitive', '__lanesText', '__lanesNumber', '__lanesUnsupported', '__lanesCharCodeAt', `return (${stringSearchSources[name]});`,
)(lanesPrimitive, lanesText, lanesNumber, lanesUnsupported, lanesCharCodeAt)]));
for (const name of names) assert.equal(factories[name].length, 2, name);

function outcome(run) {
  try {
    return { threw: false, value: run() };
  } catch (error) {
    return {
      threw: true,
      name: error !== null && typeof error === 'object' ? error.name : undefined,
      message: error !== null && typeof error === 'object' ? error.message : undefined,
      value: error,
    };
  }
}
let checks = 0;
function same(name, receiver, args, label) {
  const expected = outcome(() => originals[name].apply(receiver, args));
  const actual = outcome(() => factories[name].apply(receiver, args));
  const where = label || `${name} ${args.map(arg => typeof arg === 'string' ? JSON.stringify(arg) : String(arg)).join(', ')}`;
  assert.equal(actual.threw, expected.threw, where);
  if (expected.threw) assert.equal(actual.name, expected.name, where);
  else assert.equal(actual.value, expected.value, where);
  checks++;
}

const texts = ['', 'a', 'abc', 'aaaa', 'abca', 'abcbc', 'a\uD83D\uDE00b', '\uD83D\uDE00\uD83D\uDE00', '\uDE00\uD83D', '\u0000', '\uFFFF', '\u00e9', 'e\u0301', 'NaN', 'Infinity', '-Infinity', 'true', '1.25'];
const patterns = ['', 'a', 'aa', 'bc', 'b', 'c', 'abc', 'aaaaa', '\uD83D', '\uDE00', '\uD83D\uDE00', '\uDE00\uD83D', '\u0000', '\uFFFF', '\u00e9', 'e\u0301', 'z'];
const positions = [undefined, null, NaN, Infinity, -Infinity, 0, -0, 1, -1, 2, 1.9, 0.9, 2.8, -1.2, -0.4, 100, -100, '', '2', ' 2 ', '0x2', '0b11', 'foo', true, false, 1.0000000000000002];
for (const name of names) {
  for (const text of texts) {
    for (const pattern of patterns) {
      same(name, text, [pattern]);
      for (const position of positions) same(name, text, [pattern, position]);
    }
  }
}
for (const name of names) {
  for (const receiver of [0, -0, 1.25, 10, NaN, Infinity, -Infinity, true, false]) {
    same(name, receiver, [String(receiver)]);
    same(name, 'prefix' + String(receiver), [receiver, 0]);
  }
  same(name, null, ['a']);
  same(name, undefined, ['a', 1]);
  const error = outcome(() => factories[name].call(null, 'a'));
  assert.equal(error.threw && error.message, `String.prototype.${name} called on null or undefined`);
  checks++;
}

const order = [];
const reset = () => { order.length = 0; };
const receiver = { toString() { order.push('t'); return 'abca'; }, valueOf() { order.push('T'); return 'xxxx'; } };
const search = { toString() { order.push('s'); return 'bc'; }, valueOf() { order.push('S'); return 'no'; } };
const pos = { valueOf() { order.push('p'); return 1.9; }, toString() { order.push('P'); return '0'; } };
reset();
assert.equal(factories.indexOf.call(receiver, search, pos), 1);
assert.deepEqual(order, ['t', 's', 'p']);
checks++;
reset();
assert.equal(factories.lastIndexOf.call(receiver, 'a', { valueOf() { order.push('l'); return NaN; }, toString() { order.push('L'); return '0'; } }), 3);
assert.deepEqual(order, ['t', 'l']);
checks++;
reset();
let conversions = 0;
const once = { valueOf() { conversions++; return 2.2; }, toString() { conversions += 10; return '0'; } };
assert.equal(factories.lastIndexOf.call('abcd', 'c', once), 2);
assert.equal(factories.indexOf.call('abcd', 'c', once), 2);
assert.equal(conversions, 2);
checks++;

let poison = 0;
assert.equal(factories.endsWith.call('abc', 'c'), true);
assert.equal(factories.endsWith.call('abc', 'c', undefined), true);
assert.equal(factories.endsWith.call('abc', 'c', { valueOf() { poison++; return 0; } }), false);
assert.equal(poison, 1);
checks += 3;

// Objects are not silently treated as non-RegExp values. @@match is not read.
for (const name of ['includes', 'startsWith', 'endsWith']) {
  let seen = '';
  const plain = { toString() { seen += 's'; return 'a'; }, valueOf() { seen += 'v'; return 'b'; } };
  const position = { valueOf() { seen += 'p'; return 0; } };
  const rejected = outcome(() => factories[name].call({ toString() { seen += 't'; return 'abc'; } }, plain, position));
  assert.equal(rejected.threw, true, name);
  assert.equal(rejected.name, 'UnsupportedOperation', name);
  assert.equal(rejected.message, stringSearchMessages.pattern, name);
  assert.equal(seen, 't', name);
  const nativePlain = outcome(() => originals[name].call('abc', plain));
  assert.equal(nativePlain.threw, false, name);
  // Native ToString's the object and searches for "a". The guest rejected it first.
  assert.equal(nativePlain.value, originals[name].call('abc', 'a'), name);
  let matchReads = 0;
  const marked = {};
  Object.defineProperty(marked, Symbol.match, { get() { matchReads++; return false; } });
  assert.equal(outcome(() => factories[name].call('abc', marked)).message, stringSearchMessages.pattern);
  assert.equal(matchReads, 0, name);
  originals[name].call('abc', marked);
  assert.equal(matchReads, 1, name);
  const expression = /a/;
  const nativePattern = outcome(() => originals[name].call('abc', expression));
  const guestPattern = outcome(() => factories[name].call('abc', expression));
  assert.equal(nativePattern.threw && guestPattern.threw, true, name);
  assert.equal(guestPattern.message, stringSearchMessages.pattern, name);
  checks += 4;
}
assert.equal(factories.indexOf.call(new String('abc'), new String('b')), 1);
assert.throws(() => factories.includes.call('abc', new String('b')), error => error.message === stringSearchMessages.pattern);
checks += 2;

const symbol = Symbol('s');
for (const name of names) {
  const asReceiver = outcome(() => factories[name].call(symbol, 's'));
  const asSearch = outcome(() => factories[name].call('abc', symbol));
  const nativeReceiver = outcome(() => originals[name].call(symbol, 's'));
  const nativeSearch = outcome(() => originals[name].call('abc', symbol));
  assert.equal(asReceiver.message, stringSearchMessages.symbolString, name);
  assert.equal(nativeReceiver.message, stringSearchMessages.symbolString, name);
  // A symbol is not an object, so IsRegExp does not apply. ToString rejects it.
  assert.equal(asSearch.message, stringSearchMessages.symbolString, name);
  assert.equal(nativeSearch.message, stringSearchMessages.symbolString, name);
  let positionReads = 0;
  assert.throws(() => factories[name].call('abc', symbol, { valueOf() { positionReads++; return 0; } }));
  assert.equal(positionReads, 0, name);
  const asPosition = outcome(() => factories[name].call('abc', 'a', symbol));
  const nativePosition = outcome(() => originals[name].call('abc', 'a', symbol));
  assert.equal(asPosition.message, stringSearchMessages.symbolNumber, name);
  assert.equal(nativePosition.message, stringSearchMessages.symbolNumber, name);
  checks += 3;
}

for (const name of names) {
  const bigintReceiver = outcome(() => factories[name].call(10n, '1'));
  const nativeReceiver = outcome(() => originals[name].call(10n, '1'));
  assert.equal(bigintReceiver.message, stringSearchMessages.bigintString, name);
  assert.equal(bigintReceiver.name, 'UnsupportedOperation', name);
  // The spec formats a bigint receiver. This helper rejects that conversion.
  assert.equal(nativeReceiver.threw, false, name);
  // A bigint search is a primitive, so the @@match guard does not apply either.
  assert.equal(outcome(() => factories[name].call('10', 10n)).message, stringSearchMessages.bigintString, name);
  if (name === 'indexOf' || name === 'lastIndexOf') assert.equal(originals[name].call('10', 10n), 0);
  const asPosition = outcome(() => factories[name].call('abc', 'a', 1n));
  const nativePosition = outcome(() => originals[name].call('abc', 'a', 1n));
  assert.equal(asPosition.message, stringSearchMessages.bigintNumber, name);
  assert.equal(nativePosition.message, stringSearchMessages.bigintNumber, name);
  const fromPrimitive = outcome(() => factories.indexOf.call({ toString() { return 2n; }, valueOf() { return 'no'; } }, '2'));
  assert.equal(fromPrimitive.message, stringSearchMessages.bigintString);
  assert.equal(originals.indexOf.call({ toString() { return 2n; }, valueOf() { return 'no'; } }, '2'), 0);
  checks += 4;
}

const fake = { toString() { return '/a/'; }, valueOf() { return 'no'; } };
assert.equal(factories.indexOf.call('x/a/y', fake), 1);
assert.equal(originals.indexOf.call('x/a/y', fake), 1);
assert.equal(factories.lastIndexOf.call('x/a/y', /a/), originals.lastIndexOf.call('x/a/y', /a/));
checks += 3;

let seed = 0x5ab12fed;
const rand = () => seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
const alphabet = ['a', 'b', 'c', '\uD83D', '\uDE00', '😀', '\u0000', '\u0301', '\u00e9'];
const randString = () => {
  let text = '';
  const size = rand() % 10;
  for (let i = 0; i < size; i++) text += alphabet[rand() % alphabet.length];
  return text;
};
for (let i = 0; i < 200; i++) {
  const text = randString();
  const pattern = randString();
  const mode = rand() % 8;
  let position;
  if (mode === 0) position = undefined;
  else if (mode === 1) position = null;
  else if (mode === 2) position = NaN;
  else if (mode === 3) position = Infinity;
  else if (mode === 4) position = -Infinity;
  else if (mode === 5) position = (rand() % 20) - 8 + (rand() % 10) / 10;
  else if (mode === 6) {
    const chosen = (rand() % 12) - 4;
    position = { valueOf() { return chosen; }, toString() { return '999'; } };
  }
  else position = String((rand() % 15) - 5);
  const textValue = i % 3 === 0 ? { toString() { return text; }, valueOf() { return 'WRONG-VALUE'; } } : text;
  for (const name of names) {
    const patternValue = (name === 'indexOf' || name === 'lastIndexOf') && i % 4 === 0
      ? { toString() { return pattern; }, valueOf() { return 'NO'; } }
      : pattern;
    same(name, textValue, [patternValue, position], `fuzz ${i} ${name}`);
  }
}
for (let i = 0; i < 30; i++) {
  const digit = String(rand() % 6);
  const number = rand() % 40;
  const position = { valueOf() { return {}; }, toString() { return digit; } };
  const text = { toString() { return number; }, valueOf() { return 'WRONG-VALUE'; } };
  same('indexOf', text, [randString(), position], `fallback ${i} indexOf`);
  same('lastIndexOf', randString(), [randString(), position], `fallback ${i} lastIndexOf`);
  same('endsWith', text, ['', position], `fallback ${i} endsWith`);
}

const saved = new Map(names.map(name => [name, String.prototype[name]]));
try {
  for (const name of names) String.prototype[name] = factories[name];
  assert.equal('abc'.indexOf('b'), 1);
  assert.equal(Object.is(''.indexOf('', -0.2), 0), true);
  assert.equal('aaaa'.lastIndexOf('aa'), 2);
  assert.equal('abca'.startsWith('bc', 1.9), true);
  assert.equal('abca'.endsWith('a'), true);
  assert.equal('abca'.endsWith('c', NaN), false);
  assert.equal('a\uD83D\uDE00b'.includes('\uDE00'), true);
  assert.equal('abc'.includes(''), true);
  checks += 8;
} finally {
  for (const [name, method] of saved) String.prototype[name] = method;
}
for (const name of names) assert.equal(String.prototype[name], saved.get(name));
const savedCharCodeAt = String.prototype.charCodeAt;
try {
  String.prototype.charCodeAt = () => { throw new Error('helpers must not read String.prototype.charCodeAt'); };
  assert.equal(factories.indexOf.call('abcabc', 'ca'), 2);
  assert.equal(factories.endsWith.call('abc', 'bc'), true);
  checks += 2;
} finally {
  String.prototype.charCodeAt = savedCharCodeAt;
}

const intrinsicSource = `const __lanesHostCharCodeAt = String.prototype.charCodeAt;
function __lanesCharCodeAt(text, index) { return __lanesHostCharCodeAt.call(text, index); }
function __lanesUnsupported(message) { const error = new Error(message); error.name = 'UnsupportedOperation'; throw error; }
function __lanesPrimitive(value, stringHint) {
  function objectLike(v) { return v !== null && (typeof v === "object" || typeof v === "function"); }
  if (!objectLike(value)) return value;
  let method = stringHint ? value.toString : value.valueOf;
  if (typeof method === "function") {
    const result = method.call(value);
    if (!objectLike(result)) return result;
  }
  method = stringHint ? value.valueOf : value.toString;
  if (typeof method === "function") {
    const result = method.call(value);
    if (!objectLike(result)) return result;
  }
  throw new TypeError("Cannot convert object to primitive value");
}
function __lanesText(value) {
  if (typeof value === "symbol" || typeof value === "bigint") throw new TypeError("Unsupported primitive text");
  if (value !== null && (typeof value === "object" || typeof value === "function")) throw new TypeError("Unsupported object text");
  return String(value);
}
function __lanesNumber(value) {
  if (typeof value === "symbol" || typeof value === "bigint") throw new TypeError("Unsupported primitive number");
  if (value !== null && (typeof value === "object" || typeof value === "function")) throw new TypeError("Unsupported object number");
  return Number(value);
}
${names.map(name => `String.prototype[${JSON.stringify(name)}] = (${stringSearchSources[name]});`).join('\n')}
`;
function call(source, input, prelude) {
  try {
    return { threw: false, value: new Script(`${prelude || ''}(${source})(${input})`).runInNewContext({}, { timeout: 1000 }) };
  } catch (error) {
    const value = error !== null && typeof error === 'object' && error.name === 'TypeError' ? 'TypeError' : error;
    return { threw: true, value };
  }
}
const programs = [...stringSearchCases, stringSearchResumptionSource];
const inputs = [0, 1, -1, 17];
for (const source of programs) {
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, intrinsicSource);
    assert.equal(actual.threw, false, source);
    assert.equal(expected.threw, false, source);
    const kind = actual.value === null ? 'null' : typeof actual.value;
    assert.ok(kind === 'number' || kind === 'string' || kind === 'boolean', source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}
assert.equal(call(stringSearchResumptionSource, 17).value, stringSearchResumptionExpected);
for (const source of stringSearchNegativeSources) {
  for (const input of inputs) {
    const expected = call(source, input);
    const actual = call(source, input, intrinsicSource);
    assert.equal(expected.threw, true, source);
    assert.equal(actual.threw, true, source);
    assert.equal(actual.value, expected.value, source);
    checks++;
  }
}

const { default: createWasm } = await import('./generated/compiler.mjs');
const wasm = await createWasm();
const wasmRaw = source => JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [source]));
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const wasmBoot = Object.fromEntries(Object.entries(bootstrapSources).map(([key, source]) => [key, wasmRaw(source)]));
const nativeBoot = Object.fromEntries(Object.entries(bootstrapSources).map(([key, source]) => [key, nativeRaw(source)]));
const allowedGlobals = new Set([...Object.keys(stringSearchIntrinsics), 'TypeError', 'Infinity', '-Infinity', 'undefined']);
for (const source of [...programs, ...stringSearchNegativeSources]) {
  const native = packProgram(attachBootstrap(nativeRaw(source), nativeBoot), entrySource(source));
  const compiled = packProgram(attachBootstrap(wasmRaw(source), wasmBoot), entrySource(source));
  assert.deepEqual(compiled.code, native.code, source);
  assert.deepEqual(compiled.image, native.image, source);
}
for (const [name, source] of Object.entries(stringSearchSources)) {
  const nativeHelper = nativeRaw(source);
  const wasmHelper = wasmRaw(source);
  assert.equal(nativeHelper.error, undefined, name);
  assert.equal(wasmHelper.functions[0].name, `${name}Bootstrap`);
  assert.equal(wasmHelper.functions[0].length, 2, name);
  const rootRefs = new Set();
  for (const fn of wasmHelper.functions) {
    assert.equal(fn.strict, 1, fn.name);
    assert.equal(fn.kind, 0, fn.name);
    for (const ref of fn.refs) {
      if (ref.type >= 3) {
        assert.ok(allowedGlobals.has(ref.name), `${name} ${fn.name} global ${ref.name}`);
        if (fn === wasmHelper.functions[0]) rootRefs.add(ref.name);
      }
    }
  }
  for (const intrinsic of Object.keys(stringSearchIntrinsics)) assert.ok(rootRefs.has(intrinsic), `${name} ${intrinsic}`);
  assert.equal(rootRefs.has('__lanesToText'), false, name);
  // The root has not assigned FIELDS slots yet. Stamp the same intrinsic-root
  // bit attachBootstrap will set, and pack the helper as its own program.
  const stamp = raw => ({ ...raw, functions: raw.functions.map((fn, index) => index === 0 ? { ...fn, intrinsicRoot: true } : fn) });
  const native = packProgram(stamp(nativeHelper), `${name}Bootstrap`);
  const compiled = packProgram(stamp(wasmHelper), `${name}Bootstrap`);
  assert.deepEqual(compiled.code, native.code, name);
  assert.deepEqual(compiled.image, native.image, name);
}

console.log(JSON.stringify({
  helpers: names,
  directIntrinsics: stringSearchIntrinsics,
  indirectIntrinsics: stringSearchIndirectIntrinsics,
  numberTextField: 'numberText',
  unusedFusedToText: '__lanesToText',
  specLengths: stringSearchMethodLengths,
  compiledLength: 2,
  stringOps: ['length', '__lanesCharCodeAt'],
  programs: programs.length,
  negativePrograms: stringSearchNegativeSources.length,
  hostAlgorithmChecks: checks,
  nativeWasmAgreement: true,
  patternSearch: 'objects exit with unsupported runtime completion before ToString; @@match is not read',
  gaps: stringSearchGaps,
  gpuChecks: false,
  resumptionExpected: stringSearchResumptionExpected,
}, null, 2));
