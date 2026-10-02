import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/playground', { recursive: true });
await build({ entryPoints: ['src/index.js'], outfile: 'dist/lanes.js', bundle: true, format: 'esm', target: 'es2023', minify: true });
await build({ entryPoints: ['playground/app.js'], outfile: 'dist/playground/app.js', bundle: true, format: 'esm', target: 'es2023', minify: true });
for (const name of ['index.html', 'style.css']) await copyFile(`playground/${name}`, `dist/playground/${name}`);
console.error('Built browser library and playground in dist/');
