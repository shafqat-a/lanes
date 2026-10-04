import { parse } from 'acorn';

// Adapted assertion predicates, not the complete upstream harness. Diagnostics
// are intentionally abbreviated; test bodies inspecting harness diagnostics are
// outside this runner's scope. SameValue must not depend on mutable Object.is.
export function wrapTest262(body, strict) {
  return `function adaptedTest(input) { ${strict ? '"use strict";' : ''}
function Test262Error(message) {
  if (!(this instanceof Test262Error)) return new Test262Error(message);
  this.message = message || "";
}
Test262Error.prototype.toString = function () { return "Test262Error: " + this.message; };
Test262Error.thrower = function (message) { throw new Test262Error(message); };
function assert(value) { if (value !== true) throw new Test262Error("assert"); }
assert._isSameValue = function (a,b) {
  if (a === b) return a !== 0 || 1/a === 1/b;
  return a !== a && b !== b;
};
assert.sameValue = function (a,b) {
  try { if (assert._isSameValue(a,b)) return; }
  catch (error) { throw new Test262Error("assert.sameValue comparison threw"); }
  throw new Test262Error("assert.sameValue");
};
assert.notSameValue = function (a,b) { if (assert._isSameValue(a,b)) throw new Test262Error("assert.notSameValue"); };
assert.throws = function (constructor, callback) {
  if (typeof callback !== "function") throw new Test262Error("assert.throws callback");
  try { callback(); }
  catch (error) {
    if (typeof error !== "object" || error === null || error.constructor !== constructor)
      throw new Test262Error("assert.throws constructor");
    return;
  }
  throw new Test262Error("assert.throws missing exception");
};
function compareArray(a,b) {
  if (b.length !== a.length) return false;
  for (var i=0; i<a.length; i++) if (!assert._isSameValue(b[i],a[i])) return false;
  return true;
}
assert.compareArray = function (a,b) {
  if (!a || (typeof a !== "object" && typeof a !== "function") ||
      !b || (typeof b !== "object" && typeof b !== "function") || !compareArray(a,b))
    throw new Test262Error("assert.compareArray");
};
${body}
return true; }`;
}

function metadataList(metadata, key) {
  const match = metadata.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!match) return [];
  const inline = match[1].trim();
  if (inline.startsWith('[') && inline.endsWith(']'))
    return inline.slice(1, -1).split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
  if (inline) throw new Error(`Unsupported ${key} metadata syntax`);
  const tail = metadata.slice(match.index + match[0].length);
  const lines = tail.split('\n').slice(1), values = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) break;
    const item = line.match(/^\s+-\s+(?:([\w.$-]+)|'([\w.$-]+)'|"([\w.$-]+)")\s*$/);
    if (!item) throw new Error(`Unsupported ${key} metadata syntax`);
    values.push(item[1] ?? item[2] ?? item[3]);
  }
  if (!values.length) throw new Error(`Unsupported ${key} metadata syntax`);
  return values;
}

export function classifyTest262(body) {
  const metadata = body.match(/\/\*---([\s\S]*?)---\*\//)?.[1];
  const excluded = reason => ({ eligible: false, reason });
  if (!metadata) return excluded('missing-metadata');
  let flags, includes;
  try { flags = metadataList(metadata, 'flags'); includes = metadataList(metadata, 'includes'); }
  catch (error) { return excluded(error.message); }
  if (flags.includes('onlyStrict') && flags.includes('noStrict')) return excluded('conflicting-strict-flags');
  if (/^negative:/m.test(metadata)) return excluded('negative-test-requires-script-harness');
  const unsupportedFlag = flags.find(flag => !['onlyStrict', 'noStrict', 'generated'].includes(flag));
  if (unsupportedFlag) return excluded(`unsupported-flag:${unsupportedFlag}`);
  const unsupportedInclude = includes.find(name => name !== 'compareArray.js');
  if (unsupportedInclude) return excluded(`unsupported-include:${unsupportedInclude}`);
  let ast;
  try { ast = parse(body, { ecmaVersion: 2025 }); }
  catch (error) { return excluded(`script-parse:${error.message}`); }
  const allowed = new Set(['sameValue', 'notSameValue', 'throws', 'compareArray', '_isSameValue']);
  const pending = [[ast, 0]];
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (node.type === 'ThisExpression' && depth === 0) return excluded('top-level-this-requires-script-semantics');
    if (node.type === 'Identifier' && node.name === 'arguments' && depth === 0) return excluded('top-level-arguments-requires-script-semantics');
    if (node.type === 'Identifier' && node.name.startsWith('$')) return excluded(`unsupported-host-helper:${node.name}`);
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'assert') {
      const name = node.computed ? node.property.value : node.property.name;
      if (!allowed.has(name)) return excluded(`unsupported-assert:${name ?? 'computed'}`);
    }
    if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && node.object.name === 'compareArray')
      return excluded('unsupported-compareArray-diagnostics');
    const next = depth + Number(node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration');
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) if (child?.type) pending.push([child, next]); }
      else if (value?.type) pending.push([value, next]);
    }
  }
  return { eligible: true, modes: flags.includes('onlyStrict') ? [true] : flags.includes('noStrict') ? [false] : [false, true], includes };
}

// Keep exclusion accounting separate from eligibility: unsupported includes or
// host hooks still have the strict/sloppy variants specified by upstream flags.
export function test262Variants(body) {
  const metadata = body.match(/\/\*---([\s\S]*?)---\*\//)?.[1];
  if (!metadata) return [{ variant: 'unclassified', strict: null }];
  let flags;
  try { flags = metadataList(metadata, 'flags'); }
  catch { return [{ variant: 'unclassified', strict: null }]; }
  if (flags.includes('module')) return [{ variant: 'module', strict: true }];
  if (flags.includes('raw')) return [{ variant: 'raw', strict: null }];
  if (flags.includes('onlyStrict') && flags.includes('noStrict')) return [{ variant: 'unclassified', strict: null }];
  const modes = flags.includes('onlyStrict') ? [true] : flags.includes('noStrict') ? [false] : [false, true];
  return modes.map(strict => ({ variant: strict ? 'strict' : 'sloppy', strict }));
}
