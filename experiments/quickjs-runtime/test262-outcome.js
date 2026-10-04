// Only engine-owned, anchored diagnostics are classified as capability/resource
// boundaries. Guest TypeError/assertions, device errors and unknown failures must
// remain failures. A resource limit is NOT evidence of semantic correctness:
// execution exhaustion can also conceal a nonterminating implementation bug.
export function classifyTest262Outcome(error, stage) {
  const message = typeof error === 'string' ? error : error?.message;
  if (typeof message !== 'string') return 'failed';
  if (message === 'GPU string limit: 256 UTF-16 code units' && ['compile', 'runtime'].includes(stage)) return 'resourceLimited';
  if (stage === 'runtime') {
    if (message === 'Execution limit; use start()/step() to resume' ||
        message === 'Program/batch exceeds GPU buffer limits' ||
        /^Resource limit in lane \d+, instruction -?\d+; no CPU fallback$/.test(message)) return 'resourceLimited';
    if (/^Unsupported runtime operation in lane \d+, instruction -?\d+; no CPU fallback$/.test(message)) return 'unsupported';
  }
  if (stage === 'compile' && (
    /^Unsupported QuickJS instruction: [a-z0-9_]+$/.test(message) ||
    /^Unsupported global or module reference: .+$/.test(message) ||
    /^Unsupported QuickJS special object: \d+$/.test(message) ||
    message === 'Unsupported QuickJS constant type' ||
    // This compiler message conflates a capacity check with async/generator
    // feature rejection, so it cannot safely be called resource-only.
    message === 'QuickJS function exceeds GPU limits or uses a generator/async kind'
  )) return 'unsupported';
  return 'failed';
}
