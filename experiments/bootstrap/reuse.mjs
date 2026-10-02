import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.LANES_ROOT || new URL('../..', import.meta.url).pathname);
const { JavaScriptVM } = await import(pathToFileURL(`${root}/src/vm/runtime.js`));
const { openDevice } = await import(pathToFileURL(`${root}/scripts/device.js`));
const audit = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const cases = [
  ['digitToNumber', [...Array.from({ length: 128 }, (_, i) => String.fromCharCode(i)), '', 'é', '😀']],
  ['abs', [-Infinity, -1e100, -1, -Number.MIN_VALUE, -0, 0, Number.MIN_VALUE, 1, 1e100, Infinity, NaN]],
  ['IsBigIntElementType', ['BigUint64', 'BigInt64', 'Uint8', 'Int32', '', 'BigUint64x']],
];
const context = await openDevice();
const vm = await JavaScriptVM.create({ backend: 'gpu', device: context.device });
const results = [];
try {
  for (const [name, inputs] of cases) {
    const matches = audit.isolatedSingleParameterFunctions.compiledFunctions.filter(f => f.name === name);
    assert.equal(matches.length, 1);
    const { source, file } = matches[0];
    const reference = Function(`return (${source})`)();
    const expected = inputs.map(value => reference(value));
    const result = await vm.run(vm.compile(source), inputs, { budget: 4096 });
    assert.equal(result.backend, 'gpu');
    result.values.forEach((value, i) => assert(Object.is(value, expected[i]), `${name}, input ${JSON.stringify(inputs[i])}`));
    // Independent check for all ASCII characters, including the non-digit gaps.
    if (name === 'digitToNumber') {
      for (let i = 0; i < 128; i++) {
        const digit = '0123456789abcdefghijklmnopqrstuvwxyz'.indexOf(inputs[i].toLowerCase());
        assert(Object.is(result.values[i], digit < 0 ? NaN : digit));
      }
    }
    results.push({ name, file, checked: inputs.length });
  }
  const info = context.adapter.info;
  console.log(JSON.stringify({
    experiment: 'Unmodified type-stripped engine262 functions executed on Lanes GPU',
    engine262Commit: audit.commit,
    adapter: { vendor: info.vendor, architecture: info.architecture, device: info.device, description: info.description },
    checked: results.reduce((sum, r) => sum + r.checked, 0), results,
    caveat: 'Three standalone helper functions, not execution of the engine262 interpreter or full built-ins.',
  }, null, 2));
} finally { await vm.dispose(); context.device.destroy(); }
