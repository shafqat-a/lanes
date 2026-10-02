import { lower } from '../src/jit/ir.js';
import { nativeFunction } from './native.js';
let kernel;
self.onmessage = ({ data }) => {
  try {
    if (data.source !== undefined) {
      kernel = nativeFunction(lower(data.source, { numericMode: 'i32' }));
      // Warm the engine before reporting steady-state native execution.
      let value = 1;
      for (let i = 0; i < 2048; i++) value = kernel(value);
      self.postMessage({ ready: true });
    } else {
      const start = performance.now();
      const output = data.input.map(kernel);
      const ms = performance.now() - start;
      self.postMessage({ output, ms }, [output.buffer]);
    }
  } catch (error) { self.postMessage({ error: error.message }); }
};
