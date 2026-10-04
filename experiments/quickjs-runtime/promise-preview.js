// Host-only: materialize the Promise + async integrated tree in a private
// sibling directory (experiments/.promise-preview-*) so relative imports such
// as ../../src/vm/number.js keep resolving. The live tree is never written.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promiseIntegrationPatch, PROMISE_INTEGRATION_FILES } from './promise-integration-patch.js';

export const root = fileURLToPath(new URL('.', import.meta.url));

export async function writePromisePreview() {
  const original = Object.fromEntries(PROMISE_INTEGRATION_FILES.map(n => [n, readFileSync(join(root, n), 'utf8')]));
  const patched = await promiseIntegrationPatch(original);
  const directory = mkdtempSync(join(root, '..', '.promise-preview-'));
  try {
    for (const name of readdirSync(root)) if (/\.(m?js|html)$/.test(name)) writeFileSync(join(directory, name), readFileSync(join(root, name)));
    for (const name of ['generated', 'vendor', 'phase6-protocols', 'phase3']) symlinkSync(join(root, name), join(directory, name));
    for (const name of PROMISE_INTEGRATION_FILES) writeFileSync(join(directory, name), patched[name]);
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
  return { directory, patched, dispose: () => rmSync(directory, { recursive: true, force: true }) };
}
