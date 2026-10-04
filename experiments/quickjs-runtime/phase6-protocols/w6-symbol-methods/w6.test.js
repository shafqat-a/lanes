import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PHASE3_NODES, phase3WellKnownNames } from '../../phase3-values.js';
import { createSimulator, formatComputedMethodName, formatSymbolFunctionName } from './simulate.js';
import {
  HAS_INSTANCE,
  HAS_INSTANCE_NODE,
  INSTANCEOF_OPERATOR,
  LANES_BOUND_TARGET,
  LANES_IS_BOUND,
  LANES_PROTOTYPE_INSTANCEOF,
  RESERVED_CONTINUATIONS,
  RESERVED_HEAP_KINDS,
  boundHelperWGSL,
  defineClassComputedNameFind,
  defineClassComputedNameReplace,
  defineClassMethodComputedCaseBody,
  defineMethodComputedCaseBody,
  functionPrototypeHasInstanceInit,
  hasInstanceSource,
  instanceofCaseBody,
  instanceofOperatorSource,
  prototypeGapHasInstanceLine,
  prototypeInstanceofWGSL,
  setNameComputedCaseBody,
  symbolFunctionNameWGSL,
  symbolMethodBootstrapSources,
  symbolMethodBuiltinFields,
  symbolMethodPatches,
  symbolMethodPrivateBuiltins,
} from './symbol-methods.js';

const runtimeRoot = new URL('../../', import.meta.url);

function readRuntime(name) {
  return readFileSync(new URL(name, runtimeRoot), 'utf8');
}

function typeError(fn, message) {
  assert.throws(fn, error => {
    assert.equal(error.name, 'TypeError');
    assert.equal(error.message, message);
    return true;
  });
}

function setHook(obj, value) {
  Object.defineProperty(obj, Symbol.hasInstance, { value, writable: true, configurable: true });
}

function prototypeCounter(sim, hasInstance) {
  let reads = 0;
  const target = sim.makeFunction();
  const ctor = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === 'prototype') reads++;
      if (key === Symbol.hasInstance) return hasInstance === undefined ? Reflect.get(obj, key, receiver) : hasInstance;
      return Reflect.get(obj, key, receiver);
    },
  });
  return { ctor, get reads() { return reads; } };
}

test('@@hasInstance node is the second well-known, node 32', () => {
  assert.equal(phase3WellKnownNames[1], 'hasInstance');
  assert.equal(PHASE3_NODES.wellKnownFirst + phase3WellKnownNames.indexOf('hasInstance'), 32);
  assert.equal(HAS_INSTANCE_NODE, 32);
  assert.equal(functionPrototypeHasInstanceInit, 'dataProperty(l,functionProto,0x60000000u|32u,V(1101u,0u,11u,0u),0u);');
  const shader = readRuntime('shader.js');
  assert.equal(shader.split(prototypeGapHasInstanceLine).length - 1, 0);
  assert.equal(shader.includes('dataProperty(l,functionProto,0x60000000u|${phase3HasInstanceNode}u,V(1101u,0u,11u,0u),0u);'), true);
});

test('symbol method name is [desc], absent description is empty, prefix is shared', () => {
  assert.equal(formatSymbolFunctionName('desc'), '[desc]');
  assert.equal(formatSymbolFunctionName(Symbol('desc').description), '[desc]');
  assert.equal(formatSymbolFunctionName(undefined), '');
  assert.equal(formatSymbolFunctionName(Symbol().description), '');
  assert.equal(formatSymbolFunctionName(''), '[]');
  assert.equal(formatComputedMethodName(Symbol('desc'), 'get '), 'get [desc]');
  assert.equal(formatComputedMethodName(Symbol('desc'), 'set '), 'set [desc]');
  assert.equal(formatComputedMethodName(Symbol(), 'get '), 'get ');
  assert.equal(formatComputedMethodName('foo', 'get '), 'get foo');
  assert.equal(formatComputedMethodName('foo', ''), 'foo');
  const wgsl = symbolFunctionNameWGSL({ F: { '': 7 } });
  assert.match(wgsl, /fn symbolFunctionName\(l:u32,key:u32\)->V/);
  assert.match(wgsl, /if\(desc==0u\)\{return image\[fieldKey\(7u\)\];\}/);
  assert.match(wgsl, /V\(91u,0u,0u,0u\)/);
  assert.match(wgsl, /V\(93u,0u,0u,0u\)/);
  assert.match(wgsl, /makeText\(l,mid,V\(close,1u,7u,0u\),0u,mid\.y\+1u\)/);
  assert.match(wgsl, /return keyText\(l,key\)/);
  assert.match(wgsl, /return unsignedText\(l,key&0x7fffffffu\)/);
  assert.equal(wgsl.includes('status=6u'), false);
});

test('case bodies name symbol keys and do not status-6 them', () => {
  for (const body of [defineMethodComputedCaseBody, defineClassMethodComputedCaseBody]) {
    assert.equal(body.includes('phase3SymbolKey'), false);
    assert.equal(body.includes('status=6u'), false);
    assert.match(body, /symbolFunctionName\(l,key\)/);
    assert.match(body, /if\(arg!=0u\)\{let prefix=image\[ins\.z\];name=makeText\(l,prefix,name,0u,prefix\.y\+name\.y\);\}/);
  }
  assert.match(defineMethodComputedCaseBody, /putProperty\(l,obj,key,fnValue,true\)/);
  assert.match(defineClassMethodComputedCaseBody, /classDefineMethod\(l,obj,key,fnValue,arg\)/);
  const named = setNameComputedCaseBody;
  assert.ok(named.indexOf('kind==33u') < named.indexOf('symbolFunctionName'));
  assert.match(named, /image\[states\[l\]\.heap\[named\.x\]\.value\.x\]/);
  assert.equal(named.includes('phase3SymbolKey'), false);
  assert.equal(named.includes('status=6u'), false);
  assert.match(named, /keyOf\(l,named\)/);
  assert.equal(defineClassComputedNameReplace.includes('phase3SymbolKey'), false);
  assert.match(defineClassComputedNameReplace, /name=symbolFunctionName\(l,key\)/);
  assert.match(instanceofCaseBody, /push\(l,V\(2490u,0u,11u,0u\)\);push\(l,value\);push\(l,constructor\);call\(l,2u,false,false\)/);
  const shader = readRuntime('shader.js');
  const classes = readRuntime('phase4-classes.js');
  for (const patch of symbolMethodPatches) {
    const source = patch.file.endsWith('shader.js') ? shader : classes;
    assert.equal(source.split(patch.find).length - 1, 0, patch.id);
    assert.equal(source.includes(patch.replace), true, patch.id);
  }
  assert.equal(classes.split(defineClassComputedNameFind).length - 1, 0);
  assert.equal(classes.includes(defineClassComputedNameReplace), true);
});

test('sync helpers are the prototype walk and one-level bound unwrap', () => {
  assert.match(boundHelperWGSL, /value\.z==5u&&states\[l\]\.heap\[value\.x\]\.kind==12u/);
  assert.match(boundHelperWGSL, /return V\(bound\.value\.x,0u,bound\.value\.z,0u\)/);
  const walk = prototypeInstanceofWGSL({ F: { prototype: 4 }, L: { heap: 2048 } });
  assert.match(walk, /fn lanesPrototypeInstanceof/);
  assert.ok(!walk.includes("getProperty("));
  assert.match(walk, /2048u/);
  assert.equal(walk.includes('hasInstance'), false);
  assert.equal(walk.includes('0x60000000'), false);
  assert.match(walk, /if\(value\.z!=4u&&value\.z!=5u&&value\.z!=11u\)\{return boolean\(false\);\}/);
  assert.match(walk, /if\(prototype\.z!=4u\)\{states\[l\]\.status=4u;return undef\(\);\}/);
  assert.equal(symbolMethodBuiltinFields[LANES_IS_BOUND], undefined);
  assert.equal(symbolMethodBuiltinFields[LANES_BOUND_TARGET], undefined);
  assert.equal(symbolMethodBuiltinFields[LANES_PROTOTYPE_INSTANCEOF], undefined);
  assert.equal(symbolMethodBuiltinFields[INSTANCEOF_OPERATOR], 'instanceofOperator');
  assert.equal(symbolMethodBuiltinFields[HAS_INSTANCE], 'hasInstance');
  assert.equal(symbolMethodPrivateBuiltins.__lanesInstanceofOperator, 2490);
  assert.equal(symbolMethodPrivateBuiltins.__lanesHasInstance, 1101);
  assert.equal(symbolMethodBootstrapSources.instanceofOperator, instanceofOperatorSource);
  assert.equal(symbolMethodBootstrapSources.hasInstance, hasInstanceSource);
  assert.deepEqual(RESERVED_CONTINUATIONS, [86, 87]);
  assert.deepEqual(RESERVED_HEAP_KINDS, [53]);
});

test('inherited @@hasInstance is called with the constructor as this and the value as the argument', () => {
  const sim = createSimulator();
  const ctor = sim.makeFunction();
  const parent = {};
  const value = { tag: 'value' };
  let seen = null;
  function hook(argument) {
    seen = { self: this, argument };
    return true;
  }
  Object.defineProperty(parent, Symbol.hasInstance, { value: hook, configurable: true });
  Object.setPrototypeOf(parent, Object.getPrototypeOf(ctor));
  Object.setPrototypeOf(ctor, parent);
  assert.equal(sim.instanceof(value, ctor), true);
  assert.equal(seen.self, ctor);
  assert.equal(seen.argument, value);
  assert.equal(sim.walks, 0);
  assert.equal(sim.intrinsicCalls, 0);
});

test('own @@hasInstance beats an inherited hook', () => {
  const sim = createSimulator();
  const ctor = sim.makeFunction();
  const parent = {};
  let inherited = 0;
  let own = 0;
  Object.defineProperty(parent, Symbol.hasInstance, {
    value(argument) { inherited++; return argument === 'inherited'; },
    configurable: true,
  });
  Object.setPrototypeOf(parent, Object.getPrototypeOf(ctor));
  Object.setPrototypeOf(ctor, parent);
  setHook(ctor, function(argument) { own++; return argument === 'own'; });
  assert.equal(sim.instanceof('own', ctor), true);
  assert.equal(sim.instanceof('inherited', ctor), false);
  assert.equal(own, 2);
  assert.equal(inherited, 0);
  assert.equal(sim.walks, 0);
});

test('a non-function @@hasInstance throws and the ordinary walk does not run', () => {
  const sim = createSimulator();
  const counted = prototypeCounter(sim, 1);
  typeError(() => sim.instanceof({}, counted.ctor), 'Symbol.hasInstance is not a function');
  assert.equal(counted.reads, 0);
  assert.equal(sim.walks, 0);
  const parent = {};
  const error = new Error('getter');
  Object.defineProperty(parent, Symbol.hasInstance, { get() { throw error; } });
  const other = sim.makeFunction();
  Object.setPrototypeOf(parent, Object.getPrototypeOf(other));
  Object.setPrototypeOf(other, parent);
  assert.throws(() => sim.instanceof({}, other), thrown => thrown === error);
  assert.equal(sim.walks, 0);
  setHook(other, null);
  sim.resetTrace();
  assert.equal(sim.instanceof(Object.create(other.prototype), other), true);
  assert.equal(sim.walks, 1);
});

test('the intrinsic @@hasInstance uses the prototype walk and is not called', () => {
  const sim = createSimulator();
  const proto = {};
  let reads = 0;
  const target = sim.makeFunction();
  target.prototype = proto;
  const ctor = new Proxy(target, {
    get(obj, key, receiver) {
      if (key === 'prototype') reads++;
      return Reflect.get(obj, key, receiver);
    },
  });
  assert.equal(sim.instanceof(1, ctor), false);
  assert.equal(reads, 0);
  assert.equal(sim.walks, 0);
  assert.equal(sim.intrinsicCalls, 0);
  const child = Object.create(proto);
  assert.equal(sim.instanceof(child, ctor), true);
  assert.equal(sim.instanceof({}, ctor), false);
  assert.equal(sim.walks, 2);
  assert.equal(sim.intrinsicCalls, 0);
  assert.equal(reads, 2);
  const value = Object.create(proto);
  Object.defineProperty(value, Symbol.hasInstance, { get() { throw new Error('value hook'); } });
  assert.equal(sim.instanceof(value, ctor), true);
});

test('a bound function with the intrinsic consults the target hook', () => {
  const sim = createSimulator();
  const target = sim.makeFunction();
  const sentinel = {};
  let seen = null;
  setHook(target, function(argument) {
    seen = { self: this, argument };
    return argument === sentinel;
  });
  const bound = sim.bind(target);
  const rebound = sim.bind(bound);
  assert.equal(sim.instanceof(sentinel, bound), true);
  assert.equal(seen.self, target);
  assert.equal(seen.argument, sentinel);
  assert.equal(sim.intrinsicCalls, 0);
  assert.equal(sim.walks, 0);
  seen = null;
  assert.equal(sim.instanceof(sentinel, rebound), true);
  assert.equal(seen.self, target);
  seen = null;
  assert.equal(sim.callHasInstance(bound, sentinel), true);
  assert.equal(seen.self, target);
  // Direct 1101 re-enters the operator. The target hook runs; 1101 is not called as a method.
  assert.equal(sim.intrinsicCalls, 0);
  const plain = {};
  assert.equal(sim.instanceof(plain, target), false);
  let own = 0;
  setHook(bound, function() { own++; return false; });
  seen = null;
  assert.equal(sim.instanceof(sentinel, bound), false);
  assert.equal(own, 1);
  assert.equal(seen, null);
});

test('custom hook results are ToBoolean, and a non-object or non-callable rhs throws', () => {
  const sim = createSimulator();
  const ctor = sim.makeFunction();
  setHook(ctor, function() { return 0; });
  assert.equal(sim.instanceof({}, ctor), false);
  setHook(ctor, function() { return {}; });
  assert.equal(sim.instanceof({}, ctor), true);
  setHook(ctor, function() { return ''; });
  assert.equal(sim.instanceof({}, ctor), false);
  typeError(() => sim.instanceof(1, null), 'Right-hand side of instanceof is not an object');
  typeError(() => sim.instanceof(1, undefined), 'Right-hand side of instanceof is not an object');
  typeError(() => sim.instanceof(1, 5), 'Right-hand side of instanceof is not an object');
  typeError(() => sim.instanceof(1, {}), 'Right-hand side of instanceof is not callable');
  assert.equal(sim.walks, 0);
  const protoCtor = sim.makeFunction();
  protoCtor.prototype = null;
  typeError(() => sim.instanceof({}, protoCtor), 'Function has non-object prototype');
});

test('replacing Function.prototype[@@hasInstance] still invokes that replacement', () => {
  const sim = createSimulator();
  const ctor = sim.makeFunction();
  let seen = null;
  sim.replaceIntrinsic(function(argument) {
    seen = { self: this, argument };
    return true;
  });
  assert.equal(sim.instanceof('v', ctor), true);
  assert.equal(seen.self, ctor);
  assert.equal(seen.argument, 'v');
  assert.equal(sim.walks, 0);
  assert.equal(sim.intrinsicCalls, 0);
});

test('OrdinaryHasInstance ignores an own hook unless the constructor is bound', () => {
  const sim = createSimulator();
  const ctor = sim.makeFunction();
  const obj = Object.create(ctor.prototype);
  let hooks = 0;
  setHook(ctor, function() { hooks++; return false; });
  assert.equal(sim.instanceof(obj, ctor), false);
  assert.equal(hooks, 1);
  assert.equal(sim.callHasInstance(ctor, obj), true);
  assert.equal(hooks, 1);
  assert.ok(sim.walks >= 1);
});
