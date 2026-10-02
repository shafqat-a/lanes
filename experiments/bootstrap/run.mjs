import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Run against a snapshot to avoid interference with ongoing engine development.
const root = resolve(process.env.LANES_ROOT || new URL('../..', import.meta.url).pathname);
const { JavaScriptVM } = await import(pathToFileURL(`${root}/src/vm/runtime.js`));
const { openDevice } = await import(pathToFileURL(`${root}/scripts/device.js`));
const sources = [
  'function f(x) { return x + 7; }',
  'function f(x) { return x * 3 + 1; }',
  'function f(x) { return -(x - 2); }',
  'function f(x) { return x * x + 3 * x + 7; }',
  'function f(x) { return x / 5; }',
  'function f(x) { return x + 17; }',
  'function f(x) { return x - 100; }',
  'function f(x) { return (x + 4) * (x - 6); }',
  'function f(x) { return x * 0; }',
];
const probe = process.argv[2];
if (!probe) throw new Error('Usage: node run.mjs /absolute/path/to/probe OR --fixtures fixtures.json');
const fixtures = probe === '--fixtures' ? JSON.parse(readFileSync(process.argv[3], 'utf8'))
  : sources.map(source => ({ source, ...JSON.parse(execFileSync(probe, [source], { encoding: 'utf8' })) }));
assert.deepEqual(fixtures.map(f => f.source), sources);
const opcodes = Object.fromEntries(fixtures.flatMap(f => f.instructions.map(i => [i.name, i.opcode])));
const supported = new Set(['get_arg0', 'push_i8', 'add', 'sub', 'mul', 'div', 'neg', 'return', ...Array.from({ length: 8 }, (_, i) => `push_${i}`)]);

function interpreter(fixture) {
  assert(fixture.stackSize <= 3 && fixture.locals === 0 && fixture.constants === 0);
  assert(fixture.bytes.length <= 256);
  for (const instruction of fixture.instructions) assert(supported.has(instruction.name), `Unsupported opcode: ${instruction.name}`);
  // The bytes below are QuickJS output, unchanged. No source-to-source arithmetic translation.
  return `function execute(x) {
    const code = ${JSON.stringify(String.fromCharCode(...fixture.bytes))};
    let pc = 0, a = 0, b = 0, c = 0;
    function push(value) { c = b; b = a; a = value; }
    function binary(op) {
      if (op === ${opcodes.add}) a = b + a;
      else if (op === ${opcodes.sub}) a = b - a;
      else if (op === ${opcodes.mul}) a = b * a;
      else if (op === ${opcodes.div}) a = b / a;
      else throw 99;
      b = c; c = 0;
    }
    while (pc < code.length) {
      const op = code.charCodeAt(pc++);
      if (op === ${opcodes.get_arg0}) push(x);
      else if (op >= ${opcodes.push_0} && op <= ${opcodes.push_7}) push(op - ${opcodes.push_0});
      else if (op === ${opcodes.push_i8}) push((code.charCodeAt(pc++) << 24) >> 24);
      else if (op === ${opcodes.neg}) a = -a;
      else if (op === ${opcodes.return}) return a;
      else binary(op);
    }
    throw 98;
  }`;
}

const inputs = [-Infinity, -1e100, -100, -17, -1, -Number.MIN_VALUE, -0, 0, Number.MIN_VALUE, 0.1, 1, 2, 7, 100, 1e100, Infinity, NaN];
const context = await openDevice(); // Mandatory GPU: unavailable hardware fails the experiment.
const gpu = await JavaScriptVM.create({ backend: 'gpu', device: context.device });
const cpu = await JavaScriptVM.create({ backend: 'cpu' });
const results = [];
try {
  for (const fixture of fixtures) {
    const source = interpreter(fixture);
    const expected = inputs.map(Function(`return (${fixture.source})`)());
    const row = { source: fixture.source, bytes: fixture.bytes, instructions: fixture.instructions, stackSize: fixture.stackSize };
    for (const [name, vm] of [['cpu', cpu], ['gpu', gpu]]) {
      const program = vm.compile(source);
      const start = performance.now();
      const result = await vm.run(program, inputs, { budget: 4096 });
      assert.equal(result.backend, name);
      result.values.forEach((value, i) => assert(Object.is(value, expected[i]), `${name}: ${fixture.source}, input ${inputs[i]}: ${value} != ${expected[i]}`));
      row[name] = { checked: result.values.length, coldWallMs: performance.now() - start, maxSteps: Math.max(...result.steps) };
    }
    results.push(row);
  }
  const info = context.adapter.info;
  console.log(JSON.stringify({
    experiment: 'QuickJS bytecode interpreted inside Lanes; GPU required',
    adapter: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description },
    programs: results.length, checksPerBackend: results.length * inputs.length,
    includesNaNInfinitySignedZeroAndSubnormals: true,
    limitations: ['numeric opcodes only', 'stack depth <= 3', 'no locals, objects, closures, branches, constant pool or calls in QuickJS guest', 'timings include compilation and are not a benchmark', 'not a QuickJS runtime port or full conformance test'],
    results,
  }, null, 2));
} finally { await cpu.dispose(); await gpu.dispose(); context.device.destroy(); }
