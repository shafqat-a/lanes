// Host stand-in for the guest instanceof operator and SetFunctionName symbol
// formatting. The guest sources run in a vm realm. Bound functions are branded
// here; the shader test is lanesIsBound (tag 5, heap kind 12).
import vm from 'node:vm';
import {
  hasInstanceSource,
  instanceofOperatorSource,
} from './symbol-methods.js';

// Absent description (null/undefined, including Symbol().description) is "".
// A present description, including "", is "[" + description + "]".
export function formatSymbolFunctionName(description) {
  if (description == null) return '';
  return '[' + description + ']';
}

// prefix is the opcode image ("get " / "set ") or "" when arg is 0.
// String keys are concatenated the same way; they are not bracketed.
export function formatComputedMethodName(key, prefix = '') {
  const base = typeof key === 'symbol' ? formatSymbolFunctionName(key.description) : String(key);
  return prefix + base;
}

export function createSimulator() {
  const boundTargets = new WeakMap();
  const trace = { walks: 0, intrinsicCalls: 0 };
  const context = vm.createContext({
    TypeError,
    Symbol,
    __lanesCall(fn, thisArg, ...args) {
      return fn.call(thisArg, ...args);
    },
    __lanesIsBound(value) {
      return typeof value === 'function' && boundTargets.has(value);
    },
    __lanesBoundTarget(value) {
      if (typeof value !== 'function' || !boundTargets.has(value)) {
        const error = new TypeError('Right-hand side of instanceof is not callable');
        error.status = 4;
        throw error;
      }
      return boundTargets.get(value);
    },
    __lanesPrototypeInstanceof(value, prototype) {
      if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
      if (prototype === null || (typeof prototype !== 'object' && typeof prototype !== 'function')) {
        const error = new TypeError('Function has non-object prototype');
        error.status = 4;
        throw error;
      }
      trace.walks++;
      let current = Object.getPrototypeOf(value);
      while (current !== null) {
        if (current === prototype) return true;
        current = Object.getPrototypeOf(current);
      }
      return false;
    },
    __lanesHasInstance: undefined,
    __lanesInstanceofOperator: undefined,
  });
  vm.runInContext(`${instanceofOperatorSource}\n${hasInstanceSource}\nglobalThis.instanceofOperatorBootstrap = instanceofOperatorBootstrap;\nglobalThis.hasInstanceBootstrap = hasInstanceBootstrap;\n`, context);
  const rawHasInstance = context.hasInstanceBootstrap;
  function intrinsic(value) {
    trace.intrinsicCalls++;
    return rawHasInstance.call(this, value);
  }
  context.__lanesHasInstance = intrinsic;
  context.__lanesInstanceofOperator = (value, ctor) => context.instanceofOperatorBootstrap(value, ctor);
  // Host Function.prototype[@@hasInstance] is not configurable. Constructors
  // created here use this object as [[Prototype]] so the installed intrinsic
  // is the one the operator compares against.
  const functionProto = Object.create(null);
  Object.defineProperty(functionProto, Symbol.hasInstance, {
    value: intrinsic,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  return {
    get walks() { return trace.walks; },
    get intrinsicCalls() { return trace.intrinsicCalls; },
    resetTrace() { trace.walks = 0; trace.intrinsicCalls = 0; },
    makeFunction() {
      const fn = vm.runInContext('(function(){})', context);
      Object.setPrototypeOf(fn, functionProto);
      return fn;
    },
    bind(target) {
      const bound = vm.runInContext('(function(){})', context);
      Object.setPrototypeOf(bound, Object.getPrototypeOf(target));
      boundTargets.set(bound, target);
      return bound;
    },
    instanceof(value, ctor) {
      return context.instanceofOperatorBootstrap(value, ctor);
    },
    callHasInstance(ctor, value) {
      return context.hasInstanceBootstrap.call(ctor, value);
    },
    intrinsic,
    // Replacement of Function.prototype[@@hasInstance]. The identity compared
    // by the operator stays builtin 1101 (the original intrinsic).
    replaceIntrinsic(fn) {
      Object.defineProperty(functionProto, Symbol.hasInstance, {
        value: fn,
        writable: false,
        enumerable: false,
        configurable: true,
      });
    },
  };
}
