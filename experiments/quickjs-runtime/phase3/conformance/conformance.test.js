import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { BOUNDARIES, ENGINE_HAS_BIGINT, ENGINE_HAS_SYMBOL } from './boundaries.js';
import { HARNESS_INPUT, PROGRAMS } from './programs.js';
import { writeFocusPage } from './browser-page.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..', '..');

function citationOk(notes) {
  const file = String(notes).match(/file=(experiments\/quickjs-runtime\/[\w./-]+)/);
  const ident = String(notes).match(/ident=([A-Za-z_][A-Za-z0-9_]*)/);
  if (!file || !ident) return false;
  const path = join(root, file[1]);
  if (!existsSync(path)) return false;
  return readFileSync(path, 'utf8').includes(ident[1]);
}

function jsonSafe(value) {
  const encoded = JSON.stringify(value);
  if (encoded === undefined) return false;
  return JSON.stringify(JSON.parse(encoded)) === encoded;
}

test('boundary feature strings are unique and statuses are closed', () => {
  const features = BOUNDARIES.map(entry => entry.feature);
  assert.equal(new Set(features).size, features.length);
  for (const entry of BOUNDARIES) {
    assert.equal(typeof entry.feature, 'string');
    assert.ok(entry.feature.length > 0);
    assert.ok(['supported', 'unsupported', 'resource-limit', 'type-error'].includes(entry.status), entry.feature);
    assert.equal(typeof entry.notes, 'string');
  }
});

test('symbol and bigint features are not supported without a live citation', () => {
  assert.equal(citationOk('file=experiments/quickjs-runtime/shader.js ident=objectMethod'), true);
  assert.equal(citationOk('file=experiments/quickjs-runtime/shader.js ident=notARealSymbolNameZZZ'), false);
  assert.equal(citationOk('target of phase3 wave, not yet in core'), false);
  for (const entry of BOUNDARIES) {
    if (!/symbol|bigint/i.test(entry.feature)) continue;
    if (entry.status !== 'supported') continue;
    assert.equal(citationOk(entry.notes), true, entry.feature);
  }
  if (ENGINE_HAS_SYMBOL || ENGINE_HAS_BIGINT) {
    const cited = BOUNDARIES.filter(entry => /symbol|bigint/i.test(entry.feature) && entry.status === 'supported' && citationOk(entry.notes));
    assert.ok(cited.length > 0);
  }
});

test('program ids are unique and expects are JSON-safe', () => {
  const ids = PROGRAMS.map(program => program.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(HARNESS_INPUT, 0);
  for (const program of PROGRAMS) {
    assert.equal(typeof program.source, 'string');
    const ast = parse(program.source, { ecmaVersion: 2025 });
    assert.equal(ast.body.length, 1, program.id);
    assert.equal(ast.body[0].type, 'FunctionDeclaration', program.id);
    assert.equal(typeof program.ready, 'boolean');
    assert.ok(['value', 'typeof', 'throws', 'unsupported', 'resource-limit'].includes(program.expect.kind), program.id);
    assert.equal(jsonSafe(program.expect), true, program.id);
    if (program.expect.kind === 'value' || program.expect.kind === 'typeof') assert.equal(jsonSafe(program.expect.value), true, program.id);
    if (program.expect.kind === 'throws') assert.ok(program.expect.name === 'TypeError' || program.expect.name === 'SyntaxError');
  }
});

test('ready programs do not use Symbol or BigInt unless the engine flags say so', () => {
  for (const program of PROGRAMS) {
    if (program.ready !== true) continue;
    if (!ENGINE_HAS_SYMBOL) assert.equal(/Symbol\s*\(/.test(program.source), false, program.id);
    if (!ENGINE_HAS_BIGINT) {
      assert.equal(/\bBigInt\b/.test(program.source), false, program.id);
      assert.equal(/\b1n\b/.test(program.source), false, program.id);
    }
  }
});

test('Math and JSON toString sentinels exist', () => {
  const ready = PROGRAMS.filter(program => program.ready === true);
  const math = ready.find(program => program.source.includes('toString') && program.source.includes('Math') && program.expect.kind === 'value' && program.expect.value === '[object Math]');
  const json = ready.find(program => program.source.includes('toString') && program.source.includes('JSON') && program.expect.kind === 'value' && program.expect.value === '[object JSON]');
  assert.ok(math);
  assert.ok(json);
  const add = ready.find(program => program.id === 'sentinel-integer-add');
  assert.equal(add.expect.value, HARNESS_INPUT + 1);
});

test('focus page calls the GPU harness and is not a CPU interpreter', () => {
  const written = writeFocusPage();
  assert.equal(written.wroteHtml, true);
  const html = readFileSync(written.outPath, 'utf8');
  assert.match(html, /id="status"/);
  assert.match(html, /id="report"/);
  assert.match(html, /QuickJSGPU/);
  assert.match(html, /createCompiler/);
  assert.match(html, /HARNESS_INPUT/);
  assert.equal(html.includes('contentWindow'), false);
  assert.equal(html.includes('new Function'), false);
  assert.equal(html.includes('node:vm'), false);
  assert.equal(/\beval\s*\(/.test(html), false);
});
