import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { classifyTest262, wrapTest262 } from './test262-harness.js';

const fixture = (body, metadata = '') => `/*---\ndescription: Harness regression\n${metadata}\n---*/\n${body}`;
const evaluate = (body, strict = false) => new Script(`(${wrapTest262(body, strict)})(0)`).runInNewContext({}, { timeout: 1000 });

test('callable assert accepts only true, not truthy values', () => {
  for (const strict of [false, true]) {
    assert.equal(evaluate('assert(true);', strict), true);
    for (const expression of ['false', '1', '"yes"', '{}', 'undefined'])
      assert.throws(() => evaluate(`assert(${expression});`, strict));
  }
});

test('SameValue distinguishes signed zero and handles NaN without Object.is', () => {
  assert.equal(evaluate('Object.is = function(){return false;}; assert.sameValue(NaN,NaN); assert.notSameValue(0,-0);'), true);
  assert.throws(() => evaluate('assert.sameValue(0,-0);'));
  assert.throws(() => evaluate('assert.notSameValue(NaN,NaN);'));
});

test('sameValue wraps a throwing comparison helper in Test262Error', () => {
  assert.equal(evaluate(`assert._isSameValue = function(){throw new TypeError();};
    assert.throws(Test262Error, function(){assert.sameValue(1,1);});`), true);
});

test('throws requires exact constructor, thrown object and a callable callback', () => {
  assert.equal(evaluate('assert.throws(TypeError, function(){throw new TypeError();});'), true);
  assert.equal(evaluate('assert.throws(Test262Error, function(){assert(false);});'), true);
  assert.equal(evaluate('assert.throws(Test262Error, Test262Error.thrower);'), true);
  for (const body of [
    'assert.throws(Error, function(){throw new TypeError();});',
    'assert.throws(TypeError, function(){return new TypeError();});',
    'assert.throws(TypeError, function(){throw "TypeError";});',
    'assert.throws(TypeError, function(){throw null;});',
    'assert.throws(TypeError, function(){throw TypeError;});',
    'assert.throws(TypeError, null);',
    'function A(){} function B(){} assert.throws(A,function(){throw new B();});',
  ]) assert.throws(() => evaluate(body));
});

test('compareArray has SameValue element semantics and accepts array-like objects', () => {
  assert.equal(evaluate('assert.compareArray([NaN,-0],[NaN,-0]); assert(compareArray({0:3,length:1},[3]));'), true);
  for (const body of ['assert.compareArray([0],[-0]);', 'assert.compareArray([], [1]);', 'assert.compareArray("a", "a");'])
    assert.throws(() => evaluate(body));
  // Upstream compares b.length before a.length, and b[i] before a[i].
  assert.equal(evaluate(`var order = "";
    var a = {get length(){order += "a"; return 1;}, get 0(){order += "x"; return 1;}};
    var b = {get length(){order += "b"; return 1;}, get 0(){order += "y"; return 1;}};
    assert(compareArray(a,b)); assert.sameValue(order,"baayxa");`), true);
});

test('classifier admits synchronous assertions, compareArray and multiline strict flags', () => {
  const result = classifyTest262(fixture('assert.throws(TypeError, function(){throw new TypeError();});', 'flags:\n  - onlyStrict\nincludes:\n  - compareArray.js'));
  assert.deepEqual(result, { eligible: true, modes: [true], includes: ['compareArray.js'] });
  assert.deepEqual(classifyTest262(fixture('assert(true);', 'flags: [noStrict]')).modes, [false]);
  assert.deepEqual(classifyTest262(fixture('assert(true);')).modes, [false, true]);
  assert.equal(classifyTest262(fixture('// includes: fake.js\nassert(true);')).eligible, true);
  assert.equal(classifyTest262(fixture('assert(true);', 'includes:\n  - "propertyHelper.js"')).reason, 'unsupported-include:propertyHelper.js');
  assert.equal(classifyTest262(fixture('assert(true);', 'includes:\n  unexpected: data')).eligible, false);
});

test('classifier explicitly excludes unsupported harness and execution contexts', () => {
  const cases = [
    ['assert(true);', 'flags:\n  - async', 'unsupported-flag:async'],
    ['assert(true);', 'flags: [module]', 'unsupported-flag:module'],
    ['assert(true);', 'flags: [raw]', 'unsupported-flag:raw'],
    ['assert(true);', 'negative:\n  phase: parse\n  type: SyntaxError', 'negative-test-requires-script-harness'],
    ['assert(true);', 'includes: [propertyHelper.js]', 'unsupported-include:propertyHelper.js'],
    ['assert.unknown(true);', '', 'unsupported-assert:unknown'],
    ['assert[key](true);', '', 'unsupported-assert:computed'],
    ['compareArray.format([]);', '', 'unsupported-compareArray-diagnostics'],
    ['$DONE();', '', 'unsupported-host-helper:$DONE'],
    ['this.x;', '', 'top-level-this-requires-script-semantics'],
    ['(() => this)();', '', 'top-level-this-requires-script-semantics'],
    ['arguments;', '', 'top-level-arguments-requires-script-semantics'],
  ];
  for (const [body, metadata, reason] of cases) assert.deepEqual(classifyTest262(fixture(body, metadata)), { eligible: false, reason });
  assert.equal(classifyTest262(fixture('function f(){return this;} f();')).eligible, true);
  assert.equal(classifyTest262(fixture('const f = () => () => this;')).eligible, false);
  assert.equal(classifyTest262(fixture('function f(){ return () => this; }')).eligible, true);
  assert.equal(classifyTest262(fixture('const f = () => function(){return this;};')).eligible, true);
  assert.equal(classifyTest262(fixture('const f = () => () => arguments;')).eligible, false);
});

test('each native oracle uses a fresh realm', () => {
  assert.equal(evaluate('Object.prototype.polluted = 1;'), true);
  assert.equal(evaluate('assert.sameValue(({}).polluted, undefined);'), true);
});
