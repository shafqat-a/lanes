import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
await mkdir(`${root}/generated`, { recursive: true });
await build({entryPoints: [`${root}/web-api.js`], outfile: `${root}/generated/lanes-quickjs.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module']});
await copyFile(`${root}/web-example.html`, `${root}/generated/web-example.html`);
console.log('Serve generated/ over localhost or HTTPS; open web-example.html. Keep compiler.wasm beside lanes-quickjs.js.');
