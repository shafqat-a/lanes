// Host checks for the phase 3 Symbol/BigInt integration. No GPU and no guest
// execution. Host BigInt is an oracle for limb results only.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCompiler } from './compiler.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
import { FIELDS, OP, entrySource, packProgram } from './program.js';
import { phase3BrowserCases } from './phase3-browser-cases.js';
import {
  PHASE3_NODES,
  packBigIntDecimal,
  packI32BigInt,
  phase3WellKnownNames,
} from './phase3-values.js';
import { readBigIntPool } from './phase3/bigint-bridge/representation.js';
import { add, compare, fromI32, fromLimbs, mul, neg, sub } from './phase3/bigint-source/limbs.js';
import { shader } from './shader.js';

const nativePath = fileURLToPath(new URL('./generated/compiler', import.meta.url));
const nativeRaw = source => JSON.parse(execFileSync(nativePath, [source], { encoding: 'utf8' }));

function toHost(value) {
  let n = 0n;
  for (let i = value.length - 1; i >= 0; i--) n = (n << 32n) + BigInt(value.limbs[i] >>> 0);
  return value.sign < 0 ? -n : n;
}

function checkOp(name, op, host, left, right) {
  const got = name === 'neg' ? op(left) : op(left, right);
  assert.equal(got.kind, undefined, name);
  assert.equal(toHost(got), host, name);
}

const samples = [0, 1, -1, 2, 99, -100, 2147483647, -2147483648];
let oracleChecks = 0;
for (const left of samples) {
  for (const right of samples) {
    const a = fromI32(left);
    const b = fromI32(right);
    checkOp('add', add, BigInt(left) + BigInt(right), a, b);
    checkOp('sub', sub, BigInt(left) - BigInt(right), a, b);
    checkOp('mul', mul, BigInt(left) * BigInt(right), a, b);
    assert.equal(compare(a, b), Math.sign(left - right) || 0, `compare ${left} ${right}`);
    oracleChecks += 4;
  }
  checkOp('neg', neg, -BigInt(left), fromI32(left));
  oracleChecks++;
}
const wide = [
  fromLimbs(1, [0, 1]),
  fromLimbs(-1, [0xffffffff, 0xffffffff]),
  fromLimbs(1, [0x80000000]),
  fromI32(1),
  fromI32(-1),
  fromI32(0),
];
const wideHost = wide.map(toHost);
for (let i = 0; i < wide.length; i++) {
  for (let j = 0; j < wide.length; j++) {
    checkOp('add-wide', add, wideHost[i] + wideHost[j], wide[i], wide[j]);
    checkOp('sub-wide', sub, wideHost[i] - wideHost[j], wide[i], wide[j]);
    checkOp('mul-wide', mul, wideHost[i] * wideHost[j], wide[i], wide[j]);
    assert.equal(compare(wide[i], wide[j]), wideHost[i] < wideHost[j] ? -1 : wideHost[i] > wideHost[j] ? 1 : 0);
    oracleChecks += 4;
  }
}
assert.equal(toHost(fromLimbs(1, [0, 1])), 4294967296n);

const poolCases = [
  [0, 0, []],
  [1, 1, [1]],
  [-1, -1, [1]],
  [2147483647, 1, [2147483647]],
  [-2147483648, -1, [2147483648]],
];
for (const [input, sign, limbs] of poolCases) {
  const image = [];
  const index = packI32BigInt(image, input);
  const read = readBigIntPool(image, index);
  assert.equal(read.sign, sign, String(input));
  assert.deepEqual(read.limbs, limbs, String(input));
  assert.equal(image[index][2] & 0xffff0000, 0x42490000);
}
const decimalImage = [];
const decimalIndex = packBigIntDecimal(decimalImage, '4294967296');
const decimal = readBigIntPool(decimalImage, decimalIndex);
assert.equal(decimal.sign, 1);
assert.deepEqual(decimal.limbs, [0, 1]);

const one = nativeRaw('function f(){return 1n;}');
assert.equal(one.functions[0].instructions[0].op, 'push_bigint_i32');
const packedOne = packProgram(one, 'f');
const opNames = Object.keys(OP);
assert.equal(opNames[packedOne.code[0]], 'push');
const headerIndex = packedOne.code[1];
const header = [
  packedOne.image[headerIndex * 4],
  packedOne.image[headerIndex * 4 + 1],
  packedOne.image[headerIndex * 4 + 2],
  packedOne.image[headerIndex * 4 + 3],
];
assert.equal(header[3], headerIndex);
assert.equal(header[2] & 0xffff0000, 0x42490000);
assert.equal(header[1], 1);
assert.equal(packedOne.image[header[0] * 4], 1);

const synthetic = structuredClone(one);
synthetic.functions[0].constants = [{ bigint: '4294967296' }];
synthetic.functions[0].instructions[0] = {
  pc: 0, op: 'push_const', size: 1, pop: 0, push: 1, operand: 0, bytes: [0],
};
const packedWide = packProgram(synthetic, 'f');
assert.equal(opNames[packedWide.code[0]], 'push');
const wideHeader = packedWide.code[1];
const wideWord = packedWide.image.slice(wideHeader * 4, wideHeader * 4 + 4);
assert.equal(wideWord[1], 2);
assert.equal(wideWord[2] & 3, 1);
assert.equal(packedWide.image[wideWord[0] * 4], 0);
assert.equal(packedWide.image[wideWord[0] * 4 + 1], 1);

const tooWide = nativeRaw('function f(){return 9007199254740993n;}');
assert.deepEqual(tooWide.functions[0].constants, [{ bigint: '9007199254740993' }]);
const packedLarge=packProgram(tooWide,'f');assert.ok(packedLarge.image.length>0);

for (const name of phase3WellKnownNames) {
  assert.equal(typeof FIELDS[name], 'number', name);
  assert.equal(typeof FIELDS[`Symbol.${name}`], 'number', `Symbol.${name}`);
}
assert.equal(typeof FIELDS.symbol, 'number');
assert.equal(typeof FIELDS.bigint, 'number');
assert.equal(PHASE3_NODES.lastFixed, 47);
assert.equal(PHASE3_NODES.iterator, 34);
assert.equal(PHASE3_NODES.toStringTag, 42);
assert.equal(PHASE3_NODES.reflect, 47);

assert.equal(shader.split('fn symbol_same_value').length - 1, 1);
assert.equal(shader.includes('undefinedu'), false);
assert.equal(shader.includes('ptr<function>'), false);
assert.equal(shader.includes('fn phase3SymbolKey'), true);
assert.equal(shader.includes('fn materialize_bigint'), true);
assert.equal(shader.includes('fn phase3SymbolThis'), true);
assert.equal(shader.includes('fn phase3ChainHasIterator'), true);
assert.equal(shader.includes('root=26u;root<=79u'), true);
assert.equal(shader.includes('states[l].heap[symbolCtor]=Node'),true);
assert.equal(shader.includes('0x800003edu'), true);
assert.equal(shader.includes('next_id >= 31u && next_id <= 45u'), true);
const ownCalls = [...shader.matchAll(/ownKeys\([^;\n]*\)/g)].map(match => match[0]);
assert.deepEqual(ownCalls.filter(call => !call.startsWith('ownKeys(l:u32')), [
  'ownKeys(l,original,enumerableOnly,includeSymbols)',
  'ownKeys(l,original,false,true)',
  'ownKeys(l,original,false,true)',
]);

const compiler = await createCompiler();
const boot = Object.fromEntries(Object.entries(bootstrapSources).map(([name, source]) => [name, nativeRaw(source)]));
let packedCases = 0;
for (const item of phase3BrowserCases) {
  const wasm = compiler.compile(item.source);
  const native = packProgram(attachBootstrap(nativeRaw(item.source), boot), entrySource(item.source));
  assert.deepEqual(wasm.code, native.code, item.name);
  assert.deepEqual(wasm.image, native.image, item.name);
  packedCases++;
}
const wasmTypeof = compiler.compile('function f(){return typeof 1n}');
assert.equal(opNames[wasmTypeof.code[0]], 'push');
assert.equal((wasmTypeof.image[wasmTypeof.code[1] * 4 + 2] & 0xffff0000) === 0x42490000, true);

console.log(JSON.stringify({
  gpuChecks: false,
  guestExecution: false,
  oracleChecks,
  poolCases: poolCases.length,
  packedCases,
  largeBigIntConstant: 'native-and-wasm-bridge-bigint-decimal',
}, null, 1));
