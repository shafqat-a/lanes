import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('.', import.meta.url));
await build({ entryPoints: [`${dir}/browser.js`], outfile: `${dir}/generated/browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/browser.html`, `${dir}/generated/index.html`);

await build({ entryPoints: [`${dir}/browser-test262.js`], outfile: `${dir}/generated/browser-test262.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/browser-test262.html`, `${dir}/generated/test262.html`);
