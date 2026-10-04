import { classifyTest262Outcome } from './test262-outcome.js';
import { readFile, readdir, stat } from 'node:fs/promises';
import { relative, join } from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { classifyTest262, wrapTest262, test262Variants } from './test262-property-harness.js';

// Explicit directory selection, never a filter based on whether an engine passes.
const descriptors = ['defineProperty', 'getOwnPropertyDescriptor'].map(n => `test/built-ins/Object/${n}`);
const arrays = ['push', 'pop', 'at', 'indexOf', 'includes', 'every', 'some', 'forEach', 'find', 'findIndex', 'findLast', 'findLastIndex', 'lastIndexOf', 'reduce', 'reduceRight', 'fill', 'copyWithin', 'reverse', 'shift', 'unshift'].map(n => `test/built-ins/Array/prototype/${n}`);
const conversions = [
  ...['charAt', 'charCodeAt', 'slice', 'toString', 'valueOf'].map(n => `test/built-ins/String/prototype/${n}`),
  ...['hasOwnProperty', 'propertyIsEnumerable', 'isPrototypeOf', 'toString', 'valueOf'].map(n => `test/built-ins/Object/prototype/${n}`),
  ...['create', 'getPrototypeOf', 'setPrototypeOf', 'is', 'hasOwn', 'preventExtensions', 'isExtensible'].map(n => `test/built-ins/Object/${n}`),
];
const propertyKeys = [
  ...['property-accessors', 'member-expression', 'in', 'delete'].map(n => `test/language/expressions/${n}`),
  ...['computed-property-name-topropertykey-before-value-evaluation', 'computed-property-evaluation-order',
    'accessor-name-computed-err-to-prop-key', 'computed-__proto__'].map(n => `test/language/expressions/object/${n}.js`),
];
const compoundMembers = ['compound-assignment', 'logical-assignment', 'prefix-increment', 'prefix-decrement', 'postfix-increment', 'postfix-decrement'].map(n => `test/language/expressions/${n}`);
const primitiveBoxing = [
  'test/built-ins/Boolean', 'test/built-ins/Number/prototype/valueOf',
  'test/built-ins/String/prototype/valueOf', 'test/built-ins/String/prototype/toString',
  ...[1,2,3,4].map(n => `test/built-ins/Number/S15.7.2.1_A${n}.js`),
  ...[1,2,3,4,5,6,7,8,9,10,11,12,13,16,17,18,19].map(n => `test/built-ins/String/S15.5.2.1_A1_T${n}.js`),
  'test/built-ins/String/S15.5.2.1_A2_T1.js', 'test/built-ins/String/S15.5.2.1_A2_T2.js', 'test/built-ins/String/S15.5.2.1_A3.js',
];
const stringPrototype = ['indexOf', 'lastIndexOf', 'includes', 'startsWith', 'endsWith', 'concat', 'substring', 'charAt', 'charCodeAt', 'slice'].map(n => `test/built-ins/String/prototype/${n}`);
export const test262Scopes = Object.freeze({
  descriptors, arrays, conversions, expanded: [...descriptors, ...arrays, ...conversions],
  'property-keys': propertyKeys, 'compound-members': compoundMembers,
  'primitive-boxing': primitiveBoxing, 'string-prototype': stringPrototype,
  foundational: [...new Set([...propertyKeys, ...compoundMembers, ...primitiveBoxing, ...stringPrototype])],
});
export const inventoryMethod = 'Original test bodies remain function-adapted. propertyHelper.js tests supply byte-preserved upstream sta/assert/propertyHelper harness scripts at pinned Test262 revision 7ab7fafa0003f73fc85c1b95d88094d33f7eb8bd; their harness functions remain sloppy while only the test body receives strict mode. Other includes retain the legacy adapted predicates. Script/global, async, module, negative-test and realm limitations remain explicitly classified; this is not full Test262 execution.';

export async function collectTest262Inventory(checkout, scope = 'expanded', { compiler = null } = {}) {
  const folders = test262Scopes[scope];
  if (!folders) throw new Error(`Unknown scope: ${scope}; expected ${Object.keys(test262Scopes).join(', ')}`);
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.js')) files.push(path);
    }
  }
  for (const selection of folders) {
    const path = join(checkout, selection);
    if ((await stat(path)).isDirectory()) await walk(path);
    else if (path.endsWith('.js')) files.push(path);
    else throw new Error(`Selected test path is not JavaScript: ${selection}`);
  }
  // A union may select a directory plus an explicitly selected file it contains.
  // Record each physical upstream file once, preserving all its mode variants.
  const uniqueFiles = [...new Set(files)].sort();
  const records = [], exclusionsByReason = {};
  const counts = { files: uniqueFiles.length, variants: 0, passed: 0, failed: 0, unsupported: 0, resourceLimited: 0, excludedHarness: 0, excludedHarnessVariants: 0, referenceRejected: 0, eligible: 0, compiled: 0 };
  for (const path of uniqueFiles) {
    const body = await readFile(path, 'utf8'), file = relative(checkout, path);
    const sourceHash = createHash('sha256').update(body).digest('hex');
    const classification = classifyTest262(body);
    const variants = test262Variants(body);
    counts.variants += variants.length;
    if (!classification.eligible) {
      counts.excludedHarness++;
      exclusionsByReason[classification.reason] = (exclusionsByReason[classification.reason] || 0) + 1;
      for (const variant of variants) {
        counts.excludedHarnessVariants++;
        records.push({ file, sourceHash, ...variant, status: 'excludedHarness', reason: classification.reason });
      }
      continue;
    }
    for (const { strict, variant } of variants) {
      const source = wrapTest262(body, strict), record = { file, sourceHash, strict, variant };
      try {
        if (new Script(`(${source})(0)`).runInNewContext({}, { timeout: 1000 }) !== true)
          throw new Error('Adapted native reference did not return true');
      } catch (error) {
        counts.referenceRejected++;
        records.push({ ...record, status: 'referenceRejected', reason: 'adapted-native-reference-rejected', error: String(error) });
        continue;
      }
      counts.eligible++;
      if (compiler) {
        try { compiler.compile(source); counts.compiled++; }
        catch (error) {
          const status = classifyTest262Outcome(error, 'compile');
          counts[status]++;
          records.push({ ...record, status, stage: 'compile', reason: error.message, error: error.message });
          continue;
        }
      }
      records.push({ ...record, status: compiler ? 'compiled' : 'eligible' });
    }
  }
  return { schemaVersion: 2, scope, folders, selectionPaths: folders, counts, exclusionsByReason, records, method: inventoryMethod, fullTest262: false,
    variantAccounting: 'Every selected file has explicit variant records, including harness exclusions. excludedHarness counts files; excludedHarnessVariants counts variants. Missing or malformed mode metadata has one unclassified record.' };
}
