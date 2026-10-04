import {evaluateJSONReviver} from './json-reviver-test-support.js';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {jsonReviverReviewCases,jsonReviverReviewVersionCases} from './json-reviver-review-cases.js';
for(const c of [...jsonReviverReviewCases,...jsonReviverReviewVersionCases])assert.equal(evaluateJSONReviver(c.source,c.input,true),c.expected,`helper ${c.feature}`);
let ordinary=0;const nativeReferenceDifferences=[];
for(const c of jsonReviverReviewCases){assert.equal(new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:2000}),c.expected,c.feature);ordinary++;}
for(const c of jsonReviverReviewVersionCases){const value=new Script(`(${c.source})(${c.input})`).runInNewContext({},{timeout:2000});if(value!==c.expected){assert.equal(value,c.allowedNativeExpected,c.feature);nativeReferenceDifferences.push({feature:c.feature,native:value,es2025:c.expected,reason:c.nativeReferenceDifference});}}
console.log(JSON.stringify({fixedNativeExpectations:ordinary,helperExpectations:jsonReviverReviewCases.length+jsonReviverReviewVersionCases.length,normativeVersionFixtures:jsonReviverReviewVersionCases.length,nativeReferenceDifferences,gpuChecks:false}));
