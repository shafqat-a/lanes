import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { transform } from 'esbuild';
import { parse } from 'acorn';

const root = resolve(process.env.LANES_ROOT || new URL('../..', import.meta.url).pathname);
const { compileVM } = await import(pathToFileURL(`${root}/src/vm/compiler.js`));
const checkout = resolve(process.argv[2]);
const counts = {}, examples = {}, failures = {}, compiledFunctions = [];
let files = 0, bytes = 0, functions = 0, accepted = 0;
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) { await visit(path); continue; }
    if (!entry.name.endsWith('.mts') || entry.name.endsWith('.d.mts')) continue;
    const source = await readFile(path, 'utf8');
    const { code: output } = await transform(source, { loader: 'ts', target: 'es2025', sourcefile: path });
    const ast = parse(output, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    files++; bytes += Buffer.byteLength(output);
    const nodes = [ast];
    while (nodes.length) {
      const node = nodes.pop();
      let feature = node.type;
      if (node.generator) feature = 'GeneratorFunction';
      if (node.type === 'NewExpression' && node.callee.type === 'Identifier') feature = `new ${node.callee.name}`;
      counts[feature] = (counts[feature] || 0) + 1;
      examples[feature] ||= `${relative(checkout, path)} (after type stripping, line ${node.loc.start.line})`;
      // Isolated function acceptance is diagnostic, not dependency closure or runnable-engine coverage.
      if (node.type === 'FunctionDeclaration' && node.id && node.params.length === 1 && node.params[0].type === 'Identifier') {
        functions++;
        try {
          compileVM(output.slice(node.start, node.end)); accepted++;
          compiledFunctions.push({ name: node.id.name, file: relative(checkout, path), source: output.slice(node.start, node.end) });
        }
        catch (error) { const reason = error.message.replace(/ at \d+:\d+$/, ''); failures[reason] = (failures[reason] || 0) + 1; }
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) { for (const child of value) if (child?.type) nodes.push(child); }
        else if (value?.type) nodes.push(value);
      }
    }
  }
}
await visit(`${checkout}/src`);
const selected = ['GeneratorFunction', 'YieldExpression', 'ClassDeclaration', 'ClassExpression', 'ObjectExpression', 'ArrayExpression', 'MemberExpression', 'ForOfStatement', 'ImportDeclaration', 'new Map', 'new Set', 'new WeakMap', 'new WeakSet'];
console.log(JSON.stringify({
  commit: execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  files, javascriptBytesAfterTypeStripping: bytes,
  features: Object.fromEntries(selected.map(key => [key, { count: counts[key] || 0, example: examples[key] }])),
  isolatedSingleParameterFunctions: { attempted: functions, compiled: accepted, compiledFunctions, failures },
  caveat: 'Static source inventory; no engine262 runtime execution. Isolated function compilation does not establish transitive dependency support. Counts are not a conformance percentage.',
}, null, 2));
