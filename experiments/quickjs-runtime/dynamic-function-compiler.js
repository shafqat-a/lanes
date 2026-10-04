import { parse } from 'acorn';

// This module parses/compiles only. It never calls a guest function or evals it.
// The artifact is not a runnable program: publication requires append-only GPU
// relocation and global-environment closure creation by the runtime.
const artifacts = new WeakSet();
function freezeTree(value) { if(value && typeof value==='object' && !Object.isFrozen(value)){for(const child of Object.values(value))freezeTree(child);Object.freeze(value);}return value; }
export class DynamicCompilationUnsupported extends Error {}
export const dynamicFunctionLimits = Object.freeze({ parameters: 16, stringUnits: 256, totalUnits: 4352 });

export function functionConstructorSource(parameters, body, limits = dynamicFunctionLimits) {
  if (!Array.isArray(parameters) || parameters.some(p => typeof p !== 'string') || typeof body !== 'string')
    throw new TypeError('Dynamic Function arguments must already be GPU-coerced strings');
  if (parameters.length > limits.parameters || [...parameters, body].some(s => s.length > limits.stringUnits) ||
      [...parameters, body].reduce((n,s) => n+s.length, 0) > limits.totalUnits)
    throw new RangeError('Dynamic Function source capacity exceeded');
  const params = parameters.join(',');
  const expression = (p,b) => `(function(${p}\n){\n${b}\n})`;
  const parseFunction = source => {
    const ast = parse(source, { ecmaVersion: 2025 });
    const fn = ast.body[0]?.expression;
    if (ast.body.length !== 1 || ast.body[0].type !== 'ExpressionStatement' || fn?.type !== 'FunctionExpression' || fn.id)
      throw new SyntaxError('Invalid dynamic Function parameter/body boundary');
    return fn;
  };
  // Separate parsing is required: a comment/brace in the parameter list must
  // never absorb the body delimiter or inject a second function/program.
  parseFunction(expression(params, ''));
  parseFunction(expression('', body));
  const compileSource = expression(params, body);
  parseFunction(compileSource); // strict directives + non-simple parameters
  // ccall's UTF-8/C-string ABI cannot faithfully transport these code units.
  // Reject explicitly until a length-delimited UTF-16 compiler entry exists.
  if (/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(compileSource))
    throw new DynamicCompilationUnsupported('Dynamic Function compiler transport requires scalar Unicode without NUL');
  return Object.freeze({ compileSource, functionSource: `function anonymous(${params}\n) {\n${body}\n}` });
}

export function createFunctionCompilerFromRaw(compileRaw) {
  if (typeof compileRaw !== 'function') throw new TypeError('Expected compile-only QuickJS adapter');
  return Object.freeze({ compileFunction(parameters, body) {
    const source = functionConstructorSource(parameters, body);
    const raw = compileRaw(source.compileSource);
    if (!raw || typeof raw !== 'object') throw new TypeError('Invalid compiler response');
    if (raw.error) {
      if (/^SyntaxError:/.test(raw.error)) throw new SyntaxError(raw.error);
      throw new Error(`Dynamic compile service failed: ${raw.error}`);
    }
    const fn = raw.functions?.[0];
    if (!fn || fn.kind !== 0 || fn.name !== '' || fn.refs.some(ref => ref.type !== 3))
      throw new DynamicCompilationUnsupported('Dynamic function must have only global external references');
    // This is an anonymous expression, deliberately not a named declaration:
    // `anonymous` has no private self binding and resolves through the realm.
    fn.name = 'anonymous'; fn.source = source.functionSource;
    fn.dynamicGlobalRoot = true;
    raw.entryKind = 'dynamic-function';
    freezeTree(raw);
    const artifact = Object.freeze({ kind: 'dynamic-function', raw, source: source.functionSource,
      lexicalEnvironment: 'global', inheritCallerStrictness: false, executableOnHost: false });
    artifacts.add(artifact);
    return artifact;
  } });
}

export async function createFunctionCompiler(options) {
  const { default: create } = await import('./generated/compiler.mjs');
  const module = await create(options);
  return createFunctionCompilerFromRaw(source => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [source])));
}

export function checkDynamicFunctionArtifact(artifact) {
  if (!artifacts.has(artifact)) throw new TypeError('Expected trusted dynamic function compilation artifact');
}
