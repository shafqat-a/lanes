import test from 'node:test';
import assert from 'node:assert/strict';
import { openDevice } from '../scripts/device.js';
import { directWGSL } from '../experiments/direct.js';
import { prepare } from '../experiments/runner.js';
import { cases, inputs } from './cases.js';

test('direct lowering and persistent buffers match independent oracles', async t => {
  const context = await openDevice({ timestamps: true });
  try {
    for (const [name, source, oracle] of [...cases,
      ['conditional compound assignment', 'function f(x) { if ((x & 1) === 0) { x *= 17; } return x; }', x => (x & 1) === 0 ? Math.imul(x, 17) : x],
      ['conditional assignment', 'function f(x) { if (x < 0) x = -x; return x; }', x => x < 0 ? -x | 0 : x],
    ]) {
      if (['while', 'side effects', 'evaluation order', 'compound assignment'].includes(name)) {
        assert.throws(() => directWGSL(source), /does not support/); continue;
      }
      await t.test(name, async () => {
        const runtime = await prepare(context.device, directWGSL(source), inputs);
        try {
          for (const repeats of [1, 4]) {
            const result = await runtime.run({ repeats, upload: repeats === 4 });
            assert.deepEqual(result.values, inputs.map(oracle));
            assert.ok(result.statuses.every(s => s === 1));
            if (context.device.features.has('timestamp-query')) assert.ok(result.gpuMs >= 0);
          }
        } finally { runtime.dispose(); }
      });
    }
  } finally { context.device.destroy(); }
});
