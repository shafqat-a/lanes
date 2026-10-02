// Adapted from engine262 a600354c2954300d62d108bf9ed3459a8e4a289b:
// src/intrinsics/Object.mts (Object_defineProperty),
// src/abstract-ops/spec-types.mts (ToPropertyDescriptor), and
// src/abstract-ops/type-conversion.mts (OrdinaryToPrimitive).
// Copyright (c) 2018 engine262 Contributors. See engine262-LICENSE.txt.
// This source is compiled, never evaluated by the host. QuickJS bytecode runs
// through the GPU VM, including getter calls and abrupt completions.
// Symbols and complete numeric-to-string conversion remain unsupported.
export const descriptorSource = `function definePropertyBootstrap(target, key, attributes) {
  "use strict";
  function object(value) {
    return value !== null && (typeof value === "object" || typeof value === "function");
  }
  function propertyKey(value) {
    if (object(value)) {
      let method = value.toString;
      if (typeof method === "function") {
        const result = __lanesCall(method, value);
        if (!object(result)) return __lanesText(result);
      }
      method = value.valueOf;
      if (typeof method === "function") {
        const result = __lanesCall(method, value);
        if (!object(result)) return __lanesText(result);
      }
      throw new TypeError("Cannot convert object to primitive value");
    }
    return __lanesText(value);
  }
  if (!object(target)) throw new TypeError("Target is not an object");
  const name = propertyKey(key);
  if (!object(attributes)) throw new TypeError("Descriptor is not an object");
  const desc = __lanesDescriptor();
  if ("enumerable" in attributes) desc.enumerable = !!attributes.enumerable;
  if ("configurable" in attributes) desc.configurable = !!attributes.configurable;
  if ("value" in attributes) desc.value = attributes.value;
  if ("writable" in attributes) desc.writable = !!attributes.writable;
  if ("get" in attributes) {
    const getter = attributes.get;
    if (getter !== undefined && typeof getter !== "function") throw new TypeError("Invalid getter");
    desc.get = getter;
  }
  if ("set" in attributes) {
    const setter = attributes.set;
    if (setter !== undefined && typeof setter !== "function") throw new TypeError("Invalid setter");
    desc.set = setter;
  }
  if (("get" in desc || "set" in desc) && ("value" in desc || "writable" in desc)) {
    throw new TypeError("Mixed property descriptor");
  }
  return __lanesDefine(target, name, desc);
}`;

export const privateBuiltins = Object.freeze({
  __lanesDefine: 110, __lanesText: 111, __lanesDescriptor: 112, __lanesCall: 113,
});

export function attachBootstrap(raw, bootstrap) {
  if (raw.error) throw new SyntaxError(raw.error);
  if (bootstrap.error) throw new SyntaxError(bootstrap.error);
  if (raw.format !== bootstrap.format || raw.quickjs !== bootstrap.quickjs) throw new Error('Bootstrap compiler revision mismatch');
  const offset = raw.functions.length;
  const helpers = bootstrap.functions.map((fn, index) => ({
    ...fn, intrinsicRoot: index === 0, hasPrototype: 0,
    constants: fn.constants.map(c => 'function' in c ? { ...c, function: c.function + offset } : c),
  }));
  return { ...raw, functions: [...raw.functions, ...helpers], descriptorBootstrap: offset };
}
