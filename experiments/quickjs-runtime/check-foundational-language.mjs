import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { foundationalLanguageCases } from './foundational-language-cases.js';
const features = new Set(), countsByArea = {};
for (const fixture of foundationalLanguageCases) {
  const { feature, area, priority, source, input, expected } = fixture;
  assert.ok(!features.has(feature), `Duplicate feature: ${feature}`); features.add(feature);
  assert.ok(['property-keys', 'compound-members', 'primitive-boxing', 'string-prototype'].includes(area), feature);
  assert.ok(priority === 1 || priority === 2, feature);
  const run = input => new Script(`(${source})(input)`).runInNewContext({input}, {timeout:1000});
  assert.equal(run(input), expected, feature);
  assert.notEqual(run(input + 1), expected, `${feature}: expected value must depend on input`);
  countsByArea[area] = (countsByArea[area] ?? 0) + 1;
}
console.log(JSON.stringify({ nativeReferenceExecution: true, gpuChecks: false, fixedExpectations: features.size,
  inputSensitivityChecks: features.size, countsByArea }));
