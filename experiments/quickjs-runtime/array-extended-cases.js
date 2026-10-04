import { arrayReduceCases, arrayReduceNegativeSources, arrayReduceResumptionSource, arrayReduceResumptionExpected } from './array-reduce-cases.js';
import { arrayMutationCases, arrayMutationNegativeSources, arrayMutationResumptionSource, arrayMutationResumptionExpected } from './array-mutation-cases.js';
import { arrayShiftCases, arrayShiftNegativeSources, arrayShiftResumptionSource, arrayShiftResumptionExpected } from './array-shift-cases.js';

export const arrayExtendedSources = [...arrayReduceCases, ...arrayMutationCases, ...arrayShiftCases];
// Each group starts with exactly seven TypeError cases; the remaining cases
// throw the input primitive. Catch inside the guest so host exception reporting
// cannot turn an unsupported runtime operation into an expected TypeError pass.
export const arrayExtendedNegativeSources = [arrayReduceNegativeSources, arrayMutationNegativeSources, arrayShiftNegativeSources]
  .flatMap(group => group.map((source, index) => `function check(x) {
    try { (${source})(x); }
    catch (error) { return ${index < 7 ? 'error instanceof TypeError' : 'Object.is(error, x)'}; }
    return false;
  }`));
export const arrayExtendedResumptions = [
  { name: 'reduce', source: arrayReduceResumptionSource, expected: arrayReduceResumptionExpected },
  { name: 'mutation', source: arrayMutationResumptionSource, expected: arrayMutationResumptionExpected },
  { name: 'shift', source: arrayShiftResumptionSource, expected: arrayShiftResumptionExpected },
];
