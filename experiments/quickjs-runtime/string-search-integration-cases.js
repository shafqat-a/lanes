import { stringSearchMetadata } from './string-search-metadata.js';
export const stringSearchIntegrationSources = stringSearchMetadata.flatMap(({ name }) => [
  `function f(x){return ''.${name}.name;}`,
  `function f(x){return ''.${name}.length;}`,
  `function f(x){return ''.${name}.call('abcabc','bc');}`,
  `function f(x){return ''.${name}.apply('abcabc',['bc',1]);}`,
  `function f(x){const method=''.${name}.bind('abcabc','bc');return method.name+':'+method.length+':'+method();}`,
  `function f(x){return String.prototype.${name}.call('abcabc','bc')===''.${name}.call('abcabc','bc');}`,
]);
export const stringSearchIntegrationNegativeSources = stringSearchMetadata.map(({ name }) =>
  `function f(x){return ''.${name}.call(null,'a');}`);
// Unsupported pattern semantics must escape guest catches as runtime status 6.
export const stringSearchIntegrationUnsupportedSources = [
  ...['includes', 'startsWith', 'endsWith'].map(name =>
    `function f(x){try{return 'abc'.${name}({toString(){return 'a';}});}catch(e){return 'wrong guest exception';}}`),
  'function f(x){return Object.getOwnPropertyDescriptor("".indexOf,"length").value;}',
];
