// Host algorithm/reference and compiler check only, never a runtime backend.
// CPU evaluation of the guest sources is an oracle for the algorithm; the
// guest sources run on the GPU VM in production.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { privateBuiltins } from './bootstrap.js';
import { packProgram } from './program.js';
import { boxingIntrinsics, boxingFields } from './boxing-metadata.js';
import {
  boxingSources, boxingSourceIntrinsics, boxingSourceIntrinsicIds, boxingSourceLengths, boxingMessages,
} from './boxing-source.js';

const fields = ['stringCharCodeAt', 'stringCharAt', 'stringSlice', 'numberToString', 'stringConstruct', 'numberConstruct'];
const rootNames = {
  stringCharCodeAt: 'charCodeAtBootstrap', stringCharAt: 'charAtBootstrap', stringSlice: 'sliceBootstrap',
  numberToString: 'numberToStringBootstrap', stringConstruct: 'stringConstructBootstrap', numberConstruct: 'numberConstructBootstrap',
};
const signatures = {
  stringCharCodeAt: '(pos)', stringCharAt: '(pos)', stringSlice: '(start, end)',
  numberToString: '(radix)', stringConstruct: '(value)', numberConstruct: '(value)',
};
assert.ok(Object.isFrozen(boxingSources));
assert.deepEqual(Object.keys(boxingSources), fields);
assert.deepEqual(Object.keys(boxingSourceIntrinsics), fields);
for (const field of fields) assert.ok(boxingFields.includes(field), field);
for (const [name, id] of Object.entries(boxingIntrinsics)) {
  if (name in boxingSourceIntrinsicIds) assert.equal(boxingSourceIntrinsicIds[name], id, name);
}
const allIntrinsics = new Set(Object.values(boxingSourceIntrinsics).flat());
assert.deepEqual(new Set(Object.keys(boxingSourceIntrinsicIds)), allIntrinsics);
const missingPrivate = [];
for (const [name, id] of Object.entries(boxingSourceIntrinsicIds)) {
  if (privateBuiltins[name] !== id) missingPrivate.push(`${name}=${id} (bootstrap.js has ${privateBuiltins[name]})`);
}
assert.deepEqual(missingPrivate, [], `privateBuiltins in bootstrap.js lacks boxing intrinsics: ${missingPrivate.join(', ')}`);

for (const field of fields) {
  const source = boxingSources[field];
  assert.equal(typeof source, 'string');
  assert.ok(source.startsWith(`function ${rootNames[field]}${signatures[field]} {\n  "use strict";`), field);
  // Helpers must not consult guest-mutable prototype methods.
  for (const method of ['.charCodeAt(', '.charAt(', '.slice(', '.toString(', '.valueOf(', '.call(', '.apply(']) {
    assert.equal(source.includes(method), false, `${field} ${method}`);
  }
  for (const name of allIntrinsics) {
    assert.equal(source.includes(name + '('), boxingSourceIntrinsics[field].includes(name), `${field} ${name}`);
  }
}
for (const field of ['stringCharCodeAt', 'stringCharAt', 'stringSlice']) {
  const source = boxingSources[field];
  const coercible = source.indexOf('this === null || this === undefined');
  const receiver = source.indexOf('asText(this)');
  const first = source.indexOf(field === 'stringSlice' ? 'toIntegerOrInfinity(start)' : 'toIntegerOrInfinity(pos)');
  assert.ok(coercible > 0 && coercible < receiver && receiver < first, field);
  if (field === 'stringSlice') {
    const undef = source.indexOf('end === undefined');
    assert.ok(first < undef && undef < source.indexOf('toIntegerOrInfinity(end)'), field);
  }
}
{
  const source = boxingSources.numberToString;
  const thisAt = source.indexOf('__lanesThisNumber(this)');
  assert.ok(thisAt > 0 && thisAt < source.indexOf('radix === undefined') && thisAt < source.indexOf('toIntegerOrInfinity(radix)'));
}

// ---------------------------------------------------------------------------
// Host stand-ins for the private intrinsics.
function objectLike(value) {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}
const hostCall = Function.prototype.call.bind(Function.prototype.call);
function lanesPrimitive(value, stringHint) {
  if (!objectLike(value)) return value;
  for (const key of stringHint ? ['toString', 'valueOf'] : ['valueOf', 'toString']) {
    const method = value[key];
    if (typeof method === 'function') {
      const result = hostCall(method, value);
      if (!objectLike(result)) return result;
    }
  }
  throw new TypeError('Cannot convert object to primitive value');
}
// Host-only stand-in: production status 6 is not a catchable guest exception.
function lanesUnsupported(message) {
  const error = new Error(message); error.name = 'UnsupportedOperation'; throw error;
}
function lanesText(value) {
  assert.equal(objectLike(value), false, '__lanesText expects a primitive');
  if (typeof value === 'symbol') throw new TypeError('Cannot convert a Symbol value to a string');
  if (typeof value === 'bigint') return lanesUnsupported('BigInt to string is unsupported');
  return String(value);
}
function lanesNumber(value) {
  const primitive = lanesPrimitive(value, false);
  if (typeof primitive === 'symbol') throw new TypeError('Cannot convert a Symbol value to a number');
  if (typeof primitive === 'bigint') throw new TypeError('Cannot convert a BigInt value to a number');
  return Number(primitive);
}
function lanesToText(value) {
  return lanesText(lanesPrimitive(value, true));
}
function integerArgument(n) {
  assert.equal(typeof n, 'number');
  assert.ok(Number.isInteger(n) || n === Infinity || n === -Infinity, `integer argument ${n}`);
  assert.equal(Object.is(n, -0), false, 'truncate never yields -0');
}
const hostCharCode = String.prototype.charCodeAt;
const hostSubstring = String.prototype.substring;
const intrinsicCalls = { charCodeAt: 0, charAt: 0, slice: 0, wrap: 0, thisNumber: 0 };
function lanesCharCodeAt(text, n) {
  assert.equal(typeof text, 'string'); integerArgument(n); intrinsicCalls.charCodeAt++;
  return n < 0 || n >= text.length ? NaN : hostCall(hostCharCode, text, n);
}
function lanesCharAt(text, n) {
  assert.equal(typeof text, 'string'); integerArgument(n); intrinsicCalls.charAt++;
  return n < 0 || n >= text.length ? '' : hostCall(hostSubstring, text, n, n + 1);
}
function lanesSlice(text, from, to) {
  assert.equal(typeof text, 'string'); integerArgument(from); intrinsicCalls.slice++;
  if (to !== undefined) integerArgument(to);
  const len = text.length;
  const clip = n => n < 0 ? Math.max(len + n, 0) : Math.min(n, len);
  const a = clip(from), b = to === undefined ? len : clip(to);
  return a < b ? hostCall(hostSubstring, text, a, b) : '';
}
function lanesWrap(value) {
  assert.ok(typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean', '__lanesWrap expects a primitive');
  intrinsicCalls.wrap++;
  return Object(value);
}
const hostNumberValueOf = Number.prototype.valueOf;
function lanesThisNumber(value) {
  intrinsicCalls.thisNumber++;
  if (typeof value === 'number') return value;
  if (value instanceof Number) return hostCall(hostNumberValueOf, value);
  throw new TypeError('Number.prototype.toString requires that \'this\' be a Number');
}
const standIns = {
  __lanesPrimitive: lanesPrimitive, __lanesUnsupported: lanesUnsupported, __lanesText: lanesText,
  __lanesNumber: lanesNumber, __lanesToText: lanesToText, __lanesThisNumber: lanesThisNumber,
  __lanesCharCodeAt: lanesCharCodeAt, __lanesCharAt: lanesCharAt, __lanesSlice: lanesSlice, __lanesWrap: lanesWrap,
};
const factories = Object.fromEntries(fields.map(field => {
  // Only the intrinsics a field declares are in scope; any other reference fails.
  const params = boxingSourceIntrinsics[field];
  return [field, new Function(...params, `return (${boxingSources[field]});`)(...params.map(name => standIns[name]))];
}));
for (const field of fields) assert.equal(factories[field].length, boxingSourceLengths[field], field);

const natives = {
  stringCharCodeAt: String.prototype.charCodeAt,
  stringCharAt: String.prototype.charAt,
  stringSlice: String.prototype.slice,
  numberToString: Number.prototype.toString,
};

function outcome(run) {
  try {
    return { threw: false, value: run() };
  } catch (error) {
    return { threw: true, name: objectLike(error) ? error.name : typeof error, message: objectLike(error) ? error.message : undefined };
  }
}
const describe = value => {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'symbol' || typeof value === 'bigint') return String(value) + (typeof value === 'bigint' ? 'n' : '');
  if (Object.is(value, -0)) return '-0';
  if (objectLike(value)) return value.label || Object.prototype.toString.call(value);
  return String(value);
};
let checks = 0;
const counts = {};
function same(field, receiver, args, label) {
  const where = label || `${field} ${describe(receiver)} (${args.map(describe).join(', ')})`;
  const expected = outcome(() => natives[field].apply(receiver, args));
  const actual = outcome(() => factories[field].apply(receiver, args));
  assert.equal(actual.threw, expected.threw, where);
  if (expected.threw) {
    assert.equal(actual.name, expected.name, where);
    if (expected.name !== 'TypeError') assert.equal(actual.message, expected.message, where);
  } else {
    assert.ok(Object.is(actual.value, expected.value), `${where}: ${describe(actual.value)} vs ${describe(expected.value)}`);
  }
  counts[field] = (counts[field] || 0) + 1;
  checks++;
}
const labelled = (label, object) => Object.defineProperty(object, 'label', { value: label, enumerable: false });
class Thrown extends Error { constructor(message) { super(message); this.name = 'Thrown'; } }

const receivers = [
  '', 'a', 'abc', 'hello world', 'a😀b', '😀', '\uDE00\uD83D', '\u0000', '￿', 'é',
  0, -0, NaN, 1.5, -1.5, 1e21, 1e-7, 123, -42, Infinity, -Infinity, 2 ** 53,
  true, false, null, undefined,
  new String('wrapped'), new String(''), new Number(-0), new Number(3.25), new Boolean(false), new Boolean(true),
  labelled('toString obj', { toString() { return 'objtext'; } }),
  labelled('valueOf obj', { valueOf() { return 42; } }),
  labelled('toString object -> valueOf', { toString() { return {}; }, valueOf() { return 'fallback'; } }),
  labelled('toString throws', { toString() { throw new Thrown('receiver'); } }),
  labelled('no primitive', { toString() { return {}; }, valueOf() { return {}; } }),
  labelled('null prototype', Object.create(null)),
  labelled('array', [1, 2, 3]),
  labelled('function', function sample() { return 1; }),
];
const positions = [
  undefined, NaN, -0, 0, 0.5, -0.5, -1, 1, 2, 3, 1.9, -1.9, 1e10, -1e10, Infinity, -Infinity,
  '1', '-1', '', ' 2 ', '0x1', 'x', true, false, null,
  labelled('valueOf 1', { valueOf() { return 1; } }),
  labelled('valueOf object -> toString', { valueOf() { return {}; }, toString() { return '2'; } }),
  labelled('valueOf throws', { valueOf() { throw new Thrown('position'); } }),
  labelled('wrapper 2', new Number(2)),
  labelled('wrapper "1"', new String('1')),
  labelled('array [1]', [1]),
];

for (const field of ['stringCharCodeAt', 'stringCharAt']) {
  for (const receiver of receivers) {
    same(field, receiver, []);
    for (const position of positions) same(field, receiver, [position]);
  }
}
for (const receiver of receivers) {
  same('stringSlice', receiver, []);
  for (const start of positions) {
    same('stringSlice', receiver, [start]);
    for (const end of positions) same('stringSlice', receiver, [start, end]);
  }
}
const symbol = Symbol('s');
for (const field of ['stringCharCodeAt', 'stringCharAt', 'stringSlice']) {
  same(field, symbol, [0]);
  same(field, 'abc', [symbol]);
  same(field, 'abc', [1n]);
  assert.equal(outcome(() => factories[field].call(symbol, 0)).message, boxingMessages.symbolString);
  // The spec formats a bigint receiver; the guest exits unsupported.
  const big = outcome(() => factories[field].call(10n, 0));
  assert.equal(big.name, 'UnsupportedOperation', field);
  assert.equal(outcome(() => natives[field].call(10n, 0)).threw, false, field);
  const nullish = outcome(() => factories[field].call(null, 0));
  assert.equal(nullish.message, `String.prototype.${field === 'stringCharCodeAt' ? 'charCodeAt' : field === 'stringCharAt' ? 'charAt' : 'slice'} called on null or undefined`);
  checks += 3;
}

// Number.prototype.toString. Radix 10 / undefined compare directly; in-range
// radices other than 10 must reach the unsupported stand-in.
const numberReceivers = [
  0, -0, NaN, 1.5, -1.5, 1e21, 1e-7, 123, -42, Infinity, -Infinity, 2 ** 53, 0.1, 5e-324, Number.MAX_VALUE,
  new Number(-0), new Number(3.25), new Number(NaN),
  '1', '', true, false, null, undefined, new String('1'), new Boolean(true),
  labelled('valueOf obj', { valueOf() { return 1; } }), labelled('null prototype', Object.create(null)),
];
const radices = [
  undefined, 10, 10.5, 10.99, '10', ' 10 ', new Number(10), labelled('valueOf 10', { valueOf() { return 10; } }),
  1, 0, -0, -1, 37, 37.5, 1.99, NaN, 'x', null, false, true, Infinity, -Infinity, 1e10,
  labelled('valueOf throws', { valueOf() { throw new Thrown('radix'); } }),
];
const otherRadices = [2, 2.9, 8, 16, 36, 36.9, '16', labelled('valueOf 2', { valueOf() { return 2; } })];
let unsupportedRadix = 0;
for (const receiver of numberReceivers) {
  same('numberToString', receiver, []);
  for (const radix of radices) same('numberToString', receiver, [radix]);
  for (const radix of otherRadices) {
    const expected = outcome(() => natives.numberToString.call(receiver, radix));
    const actual = outcome(() => factories.numberToString.call(receiver, radix));
    const where = `numberToString ${describe(receiver)} radix ${describe(radix)}`;
    if (expected.threw) {
      assert.equal(expected.name, 'TypeError', where);
      assert.equal(actual.name, 'TypeError', where);
    } else {
      assert.equal(typeof expected.value, 'string', where);
      assert.equal(actual.name, 'UnsupportedOperation', where);
      assert.equal(actual.message, boxingMessages.radixUnsupported, where);
      unsupportedRadix++;
    }
    checks++;
  }
}
same('numberToString', 1, [symbol]);
same('numberToString', 1, [1n]);
same('numberToString', symbol, [10]);
same('numberToString', 1n, []);
assert.equal(outcome(() => factories.numberToString.call(1, 0)).message, outcome(() => natives.numberToString.call(1, 0)).message);
checks++;

// Constructors: compare typeof, prototype, and the wrapped primitive.
function sameConstruct(field, Native, args, label) {
  const where = label || `${field} (${args.map(describe).join(', ')})`;
  const valueOf = Native.prototype.valueOf;
  const expected = outcome(() => { const v = new Native(...args); return [typeof v, Object.getPrototypeOf(v), hostCall(valueOf, v)]; });
  const actual = outcome(() => { const v = factories[field](...args); return [typeof v, Object.getPrototypeOf(v), hostCall(valueOf, v)]; });
  assert.equal(actual.threw, expected.threw, where);
  if (expected.threw) assert.equal(actual.name, expected.name, where);
  else {
    assert.equal(actual.value[0], expected.value[0], where);
    assert.equal(actual.value[1], expected.value[1], where);
    assert.ok(Object.is(actual.value[2], expected.value[2]), `${where}: ${describe(actual.value[2])} vs ${describe(expected.value[2])}`);
  }
  counts[field] = (counts[field] || 0) + 1;
  checks++;
}
const constructValues = [...new Set([...receivers, ...positions, ...numberReceivers, ...radices])];
for (const [field, Native] of [['stringConstruct', String], ['numberConstruct', Number]]) {
  sameConstruct(field, Native, []);
  sameConstruct(field, Native, [undefined]);
  sameConstruct(field, Native, [undefined, 'extra']);
  for (const value of constructValues) sameConstruct(field, Native, [value]);
  for (const text of ['0x10', '0b11', '0o7', '  12  ', '1e3', '-0', 'Infinity', '-Infinity', '1_0', '12px', '\n']) sameConstruct(field, Native, [text]);
}
// Known divergences: SymbolDescriptiveString and BigInt-to-Number.
const knownDivergences = [];
{
  // SymbolDescriptiveString applies only when NewTarget is undefined (String
  // called as a function); new String(symbol) throws, so construct agrees.
  sameConstruct('stringConstruct', String, [symbol]);
  assert.equal(String(symbol), 'Symbol(s)');
  const nativeBig = outcome(() => new Number(10n).valueOf());
  const guestBig = outcome(() => factories.numberConstruct(10n));
  assert.equal(nativeBig.value, 10);
  assert.equal(guestBig.name, 'TypeError');
  knownDivergences.push('new Number(10n): native 10, guest TypeError (Number constructor BigInt branch not implemented)');
  const nativeBigText = outcome(() => new String(10n).valueOf());
  const guestBigText = outcome(() => factories.stringConstruct(10n));
  assert.equal(nativeBigText.value, '10');
  assert.equal(guestBigText.name, 'UnsupportedOperation');
  knownDivergences.push('new String(10n) and bigint receivers: native decimal text, guest unsupported completion');
  checks += 3;
}

// Conversion order. Each object logs its toString/valueOf calls.
function logger(log, name, kind) {
  const object = {};
  object.toString = () => { log.push(`${name}.toString`); if (kind === 'throwString') throw new Thrown(name); return kind === 'objectString' ? {} : '1'; };
  object.valueOf = () => { log.push(`${name}.valueOf`); if (kind === 'throwValue') throw new Thrown(name); return kind === 'objectValue' ? {} : 2; };
  return labelled(`${name}:${kind}`, object);
}
const kinds = ['plain', 'objectString', 'objectValue', 'throwString', 'throwValue'];
function sameOrder(field, makeReceiver, makeArgs, run) {
  const nativeLog = [], guestLog = [];
  const expected = outcome(() => run(natives[field] || null, makeReceiver(nativeLog), makeArgs(nativeLog), true));
  const actual = outcome(() => run(factories[field], makeReceiver(guestLog), makeArgs(guestLog), false));
  const where = `${field} order ${makeReceiver([]) && describe(makeReceiver([]))} (${makeArgs([]).map(describe).join(', ')})`;
  assert.deepEqual(guestLog, nativeLog, where);
  // A logged radix of 2 is in range but not 10: the guest exits unsupported
  // after the same conversions native performed.
  if (field === 'numberToString' && actual.name === 'UnsupportedOperation' && !expected.threw) {
    assert.equal(typeof expected.value, 'string', where);
    checks++;
    return nativeLog.length;
  }
  assert.equal(actual.threw, expected.threw, where);
  if (expected.threw) assert.equal(actual.name, expected.name, where);
  else if (actual.value === null || typeof actual.value !== 'object') assert.ok(Object.is(actual.value, expected.value), where);
  checks++;
  return nativeLog.length;
}
let orderChecks = 0;
const apply = (fn, receiver, args) => fn.apply(receiver, args);
for (const field of ['stringCharCodeAt', 'stringCharAt', 'stringSlice', 'numberToString']) {
  const receiverMakers = [
    ...kinds.map(kind => log => logger(log, 'r', kind)),
    () => 'abc', () => 12.5, () => null, () => new Number(7),
  ];
  for (const makeReceiver of receiverMakers) {
    for (const a of [...kinds, undefined]) {
      const ends = field === 'stringSlice' ? [...kinds, undefined, 'absent'] : ['absent'];
      for (const b of ends) {
        const makeArgs = log => {
          const args = [a === undefined ? undefined : logger(log, 'a', a)];
          if (b !== 'absent') args.push(b === undefined ? undefined : logger(log, 'b', b));
          return args;
        };
        sameOrder(field, makeReceiver, makeArgs, apply);
        orderChecks++;
      }
    }
  }
}
for (const [field, Native] of [['stringConstruct', String], ['numberConstruct', Number]]) {
  for (const kind of kinds) {
    sameOrder(field, () => undefined, log => [logger(log, 'v', kind)], (fn, receiver, args, native) => {
      const v = native ? new Native(...args) : fn(...args);
      return hostCall(Native.prototype.valueOf, v);
    });
    orderChecks++;
  }
}

// Reassigning the public prototype methods must not affect the helpers.
const savedProto = {
  charCodeAt: String.prototype.charCodeAt, charAt: String.prototype.charAt, slice: String.prototype.slice,
  substring: String.prototype.substring, numberToString: Number.prototype.toString,
};
try {
  const poison = () => { throw new Error('helper consulted a public prototype method'); };
  String.prototype.charCodeAt = poison; String.prototype.charAt = poison; String.prototype.slice = poison;
  String.prototype.substring = poison;
  assert.equal(factories.stringCharCodeAt.call('abc', 1), 98);
  assert.equal(factories.stringCharAt.call('abc', 1), 'b');
  assert.equal(factories.stringSlice.call('abcdef', -3, -1), 'de');
  Number.prototype.toString = poison;
  assert.equal(factories.numberToString.call(12.5), '12.5');
  assert.equal(factories.numberToString.call(new Number(4), 10), '4');
  checks += 5;
} finally {
  String.prototype.charCodeAt = savedProto.charCodeAt; String.prototype.charAt = savedProto.charAt;
  String.prototype.slice = savedProto.slice; String.prototype.substring = savedProto.substring;
  Number.prototype.toString = savedProto.numberToString;
}

// ---------------------------------------------------------------------------
// Native vs Wasm compiler parity, strictness, and globals.
const { default: createWasm } = await import('./generated/compiler.mjs');
const wasm = await createWasm();
const wasmRaw = source => JSON.parse(wasm.ccall('lanes_compile', 'string', ['string'], [source]));
const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));
const baseGlobals = ['TypeError', 'RangeError', 'undefined', 'Infinity', 'NaN'];
const packed = {};
for (const field of fields) {
  const source = boxingSources[field];
  const nativeHelper = nativeRaw(source);
  const wasmHelper = wasmRaw(source);
  assert.equal(nativeHelper.error, undefined, field);
  assert.equal(wasmHelper.error, undefined, field);
  // Raw atom numbers differ between the native and Wasm builds; compare the
  // function metadata here and the packed code/image below.
  const shape = raw => raw.functions.map(({ name, args, length, locals, stack, strict, kind, refs }) => ({ name, args, length, locals, stack, strict, kind, refs }));
  assert.deepEqual(shape(wasmHelper), shape(nativeHelper), field);
  const root = wasmHelper.functions[0];
  assert.equal(root.name, rootNames[field]);
  assert.equal(root.length, boxingSourceLengths[field], field);
  const allowed = new Set([...baseGlobals, ...boxingSourceIntrinsics[field]]);
  const referenced = new Set();
  for (const fn of wasmHelper.functions) {
    assert.equal(fn.strict, 1, `${field} ${fn.name}`);
    assert.equal(fn.kind, 0, `${field} ${fn.name}`);
    for (const ref of fn.refs) {
      if (ref.type >= 3) {
        assert.ok(allowed.has(ref.name), `${field} ${fn.name} global ${ref.name}`);
        referenced.add(ref.name);
      }
    }
  }
  for (const name of boxingSourceIntrinsics[field]) assert.ok(referenced.has(name), `${field} ${name}`);
  // The root has not assigned FIELDS slots yet. Stamp the same intrinsic-root
  // bit attachBootstrap will set, and pack the helper as its own program.
  const stamp = raw => ({ ...raw, functions: raw.functions.map((fn, index) => index === 0 ? { ...fn, intrinsicRoot: true } : fn) });
  const native = packProgram(stamp(nativeHelper), rootNames[field]);
  const compiled = packProgram(stamp(wasmHelper), rootNames[field]);
  assert.deepEqual(compiled.code, native.code, field);
  assert.deepEqual(compiled.image, native.image, field);
  packed[field] = { functions: wasmHelper.functions.length, code: native.code.length, image: native.image.length };
}

console.log(JSON.stringify({
  fields,
  intrinsics: boxingSourceIntrinsics,
  intrinsicIds: boxingSourceIntrinsicIds,
  lengths: boxingSourceLengths,
  hostAlgorithmChecks: checks,
  perField: counts,
  orderChecks,
  unsupportedRadixChecks: unsupportedRadix,
  intrinsicCalls,
  knownDivergences,
  packed,
  nativeWasmAgreement: true,
  gpuChecks: false,
}, null, 2));
