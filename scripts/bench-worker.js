import { parentPort } from 'node:worker_threads';
import { workloads } from './workloads.js';
parentPort.on('message', ({ name, input }) => {
  try { const output = input.map(workloads.find(w => w.name === name).native); parentPort.postMessage({ output }, [output.buffer]); }
  catch (error) { parentPort.postMessage({ error: error.message }); }
});
