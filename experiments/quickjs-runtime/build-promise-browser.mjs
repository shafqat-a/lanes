// Builds the Promise + async M1/Safari page from the integrated preview tree
// (generator + Promise/async patches applied to copies). Output:
// generated/browser-promise.js and generated/promise.html. The page itself is
// run only by the coordinator on real WebGPU hardware.
import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writePromisePreview, root } from './promise-preview.js';

const preview = await writePromisePreview();
try {
  await build({ entryPoints: [join(preview.directory, 'browser-promise.js')], outfile: join(root, 'generated/browser-promise.js'),
    bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
  await copyFile(join(root, 'browser-promise.html'), join(root, 'generated/promise.html'));
} finally { preview.dispose(); }
console.log(JSON.stringify({ built: ['generated/browser-promise.js', 'generated/promise.html'], integratedPreview: true, gpuExecuted: false }));
