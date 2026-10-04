const names = ['getOwnPropertyNames','defineProperties','seal','freeze','isSealed','isFrozen','keys'];
export const objectStaticDescriptorSources = names.flatMap(name=>[
  `function f(x) { const d=Object.getOwnPropertyDescriptor(Object,"${name}");return d.writable&&!d.enumerable&&d.configurable&&typeof d.value==="function"&&d.value===Object.${name}; }`,
  `function f(x) { const method=Object.${name};Object.${name}=x;let ok=Object.${name}===x;delete Object.${name};return ok&&Object.${name}===undefined&&typeof method==="function"; }`,
  `function f(x) { return Object.${name}.name==="${name}"&&Object.${name}.length===${name==='defineProperties'?2:1}; }`,
]);
