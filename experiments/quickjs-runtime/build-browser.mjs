import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('.', import.meta.url));
await build({ entryPoints: [`${dir}/phase6-review-browser.js`], outfile: `${dir}/generated/phase6-review-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/phase6-review-browser.html`, `${dir}/generated/phase6-review.html`);

await build({ entryPoints: [`${dir}/strict-number-audit-browser.js`], outfile: `${dir}/generated/strict-number-audit-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/strict-number-audit-browser.html`, `${dir}/generated/strict-number-audit.html`);
await build({ entryPoints: [`${dir}/phase6-protocols/w8-conformance/browser-protocols.js`], outfile: `${dir}/generated/browser-protocols.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/browser-protocols.html`, `${dir}/generated/protocols.html`);

await build({ entryPoints: [`${dir}/phase3-bigint-comparison-browser.js`], outfile: `${dir}/generated/phase3-bigint-comparison-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/phase3-bigint-comparison-browser.html`, `${dir}/generated/phase3-bigint-comparison.html`);
await build({ entryPoints: [`${dir}/json-bigint-browser.js`], outfile: `${dir}/generated/json-bigint-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/json-bigint-browser.html`, `${dir}/generated/json-bigint.html`);
await build({ entryPoints: [`${dir}/function-source-browser.js`], outfile: `${dir}/generated/function-source-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/function-source-browser.html`, `${dir}/generated/function-source.html`);
await build({ entryPoints: [`${dir}/string-case-browser.js`], outfile: `${dir}/generated/string-case-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/string-case-browser.html`, `${dir}/generated/string-case.html`);
await build({ entryPoints: [`${dir}/json-reviver-browser.js`], outfile: `${dir}/generated/json-reviver-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/json-reviver-browser.html`, `${dir}/generated/json-reviver.html`);
await build({ entryPoints: [`${dir}/json-phase3-browser.js`], outfile: `${dir}/generated/json-phase3-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/json-phase3-browser.html`, `${dir}/generated/json-phase3.html`);
await build({ entryPoints: [`${dir}/browser.js`], outfile: `${dir}/generated/browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/browser.html`, `${dir}/generated/index.html`);

await build({ entryPoints: [`${dir}/browser-test262.js`], outfile: `${dir}/generated/browser-test262.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/browser-test262.html`, `${dir}/generated/test262.html`);
await build({ entryPoints: [`${dir}/browser-number.js`], outfile: `${dir}/generated/browser-number.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/browser-number.html`, `${dir}/generated/number.html`);

await build({ entryPoints: [`${dir}/browser-number-text.js`], outfile: `${dir}/generated/browser-number-text.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/browser-number-text.html`, `${dir}/generated/number-text.html`);

await build({ entryPoints: [`${dir}/browser-array-search.js`], outfile: `${dir}/generated/browser-array-search.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/browser-array-search.html`, `${dir}/generated/array-search.html`);

for (const name of ['array-completion', 'script-entry', 'object-operations', 'lifecycle', 'array-extended', 'language-scope', 'string-search', 'compiler-correctness', 'compiler-reference', 'property-key-conversion', 'computed-assignment', 'foundational-language', 'high-index', 'property-reference', 'number-pow', 'boxing', 'string-extract', 'boxing-reference', 'array-phase5', 'string-phase5', 'math-phase5', 'phase5-integration', 'array-copy', 'number-parse', 'json-phase5', 'secondwave-review', 'phase4', 'json-stringify', 'phase4-integration', 'array-sort', 'phase3', 'bigint-transfer', 'phase3-bigint-ops', 'phase3-bigint-bitwise', 'global-reference', 'phase3-bigint-conversion', 'property-harness', 'stdlib', 'generators', 'array-from', 'group-by', 'array-species', 'phase3-bigint-width', 'promise', 'shader-compile', 'dispatch-state-machine', 'dispatch-boundary']) {
  await build({ entryPoints: [`${dir}/browser-${name}.js`], outfile: `${dir}/generated/browser-${name}.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
  await copyFile(`${dir}/browser-${name}.html`, `${dir}/generated/${name}.html`);
}

await build({ entryPoints: [`${dir}/phase3-bigint-pow-browser.js`], outfile: `${dir}/generated/phase3-bigint-pow-browser.js`, bundle: true, format: 'esm', target: 'es2023', external: ['node:*', 'module'] });
await copyFile(`${dir}/phase3-bigint-pow-browser.html`, `${dir}/generated/phase3-bigint-pow.html`);
