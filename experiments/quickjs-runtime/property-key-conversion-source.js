// ES2025 ToPropertyKey, for currently representable primitive values and
// OrdinaryToPrimitive(string). Symbol/BigInt and @@toPrimitive remain explicit
// gaps. Conversion executes as guest bytecode, including getters/callbacks.
// https://tc39.es/ecma262/2025/multipage/abstract-operations.html#sec-topropertykey
export const propertyKeySource = `function propertyKeyBootstrap(value) {
  "use strict";
  const primitive = __lanesPrimitive(value, true);
  if (typeof primitive === "symbol") return primitive;
  
  return __lanesText(primitive);
}`;
export const propertyKeyOperationSources = Object.freeze({
  toPropertyKey: propertyKeySource,
  propertyReadReference: `function propertyReadReferenceBootstrap(object, key) {
    "use strict";
    return object[key];
  }`,
  propertyOwnDescriptor: `function propertyOwnDescriptorBootstrap(target, key) {
    "use strict";
    const object = __lanesToObject(target);
    return __lanesOwnDescriptor(object, __lanesToPropertyKey(key));
  }`,
  propertyHasOwn: `function propertyHasOwnBootstrap(target, key) {
    "use strict";
    const object = __lanesToObject(target);
    return __lanesOwnHas(object, __lanesToPropertyKey(key));
  }`,
  propertyHasOwnMethod: `function propertyHasOwnMethodBootstrap(key) {
    "use strict";
    const object = __lanesToObject(this);
    return __lanesOwnHas(object, __lanesToPropertyKey(key));
  }`,
  propertyEnumerableMethod: `function propertyEnumerableMethodBootstrap(key) {
    "use strict";
    const object = __lanesToObject(this);
    const desc = __lanesOwnDescriptor(object, __lanesToPropertyKey(key));
    return desc !== undefined && desc.enumerable;
  }`,
});
export const propertyKeyMethodFields = Object.freeze({
  900: 'toPropertyKey', 903: 'propertyReadReference', 102: 'propertyOwnDescriptor', 107: 'propertyHasOwn',
  151: 'propertyHasOwnMethod', 153: 'propertyEnumerableMethod',
});
