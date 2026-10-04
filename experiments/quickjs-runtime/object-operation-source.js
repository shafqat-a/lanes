// ES2025 Object operations. Compiled guest code only: descriptor getters and
// abrupt completions execute in the WGSL VM, including across dispatches.
// Algorithms: https://tc39.es/ecma262/2025/multipage/fundamental-objects.html
// and abstract-operations.html#sec-setintegritylevel.
export const toDescriptorSource = `function toDescriptorBootstrap(attributes) {
  "use strict";
  if (attributes === null || (typeof attributes !== "object" && typeof attributes !== "function")) throw new TypeError("Descriptor is not an object");
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
  if (("get" in desc || "set" in desc) && ("value" in desc || "writable" in desc)) throw new TypeError("Mixed property descriptor");
  return desc;
}`;
const objectCheck = `target !== null && (typeof target === "object" || typeof target === "function")`;
export const objectOperationSources = Object.freeze({
  toDescriptor: toDescriptorSource,
  defineProperties: `function definePropertiesBootstrap(target, properties) {
    "use strict";
    if (!(${objectCheck})) throw new TypeError("Target is not an object");
    const source = __lanesArrayObject(properties);
    const keys = __lanesOwnKeys(source, false);
    const descriptors = __lanesDescriptor();
    const names = __lanesDescriptor();
    let count = 0;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const own = __lanesOwnDescriptor(source, key);
      if (own !== undefined && own.enumerable) {
        const desc = __lanesToDescriptor(source[key]);
        names[count] = key;
        descriptors[count] = desc;
        count++;
      }
    }
    for (let i = 0; i < count; i++) __lanesDefineProperty(target, names[i], descriptors[i]);
    return target;
  }`,
  ...Object.fromEntries(['seal','freeze'].map(method => [method, `function ${method}Bootstrap(target) {
    "use strict";
    if (!(${objectCheck})) return target;
    // Validate the supported own-key model before changing extensibility.
    const keys = __lanesOwnKeys(target, false);
    __lanesPreventExtensions(target);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const change = __lanesDescriptor();
      change.configurable = false;
      ${method === 'freeze' ? `const own = __lanesOwnDescriptor(target, key);
      if (own === undefined) continue;
      if ("value" in own) change.writable = false;` : ''}
      __lanesDefine(target, key, change);
    }
    return target;
  }`])),
  ...Object.fromEntries(['isSealed','isFrozen'].map(method => [method, `function ${method}Bootstrap(target) {
    "use strict";
    if (!(${objectCheck})) return true;
    if (__lanesIsExtensible(target)) return false;
    const keys = __lanesOwnKeys(target, false);
    for (let i = 0; i < keys.length; i++) {
      const own = __lanesOwnDescriptor(target, keys[i]);
      if (own !== undefined && (own.configurable ${method === 'isFrozen' ? '|| ("value" in own && own.writable)' : ''})) return false;
    }
    return true;
  }`])),
});
