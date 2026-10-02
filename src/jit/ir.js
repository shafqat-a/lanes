import { parse } from 'acorn';
export const COMPILER_VERSION = '0.1.0-alpha.1';
export const LIMITS = Object.freeze({ sourceBytes: 32768, nodes: 4096, locals: 256, loopIterations: 4096, work: 100000 });
export class CompileError extends SyntaxError {
  constructor(message, node) {
    const location = node?.loc?.start;
    super(location ? `${message} (${location.line}:${location.column + 1})` : message);
    this.name = 'CompileError'; this.line = location?.line; this.column = location ? location.column + 1 : undefined;
  }
}
export function binaryValue(op, a, b) {
  switch (op) {
    case '+': return (a + b) | 0; case '-': return (a - b) | 0; case '*': return Math.imul(a, b);
    case '&': return a & b; case '|': return a | b; case '^': return a ^ b;
    case '<<': return a << b; case '>>': return a >> b;
    case '<': return +(a < b); case '<=': return +(a <= b); case '>': return +(a > b); case '>=': return +(a >= b);
    case '===': return +(a === b); case '!==': return +(a !== b);
    default: throw new Error(`Invalid IR operator: ${op}`);
  }
}
export function unaryValue(op, a) {
  switch (op) { case '-': return -a | 0; case '~': return ~a; case '!': return +!a; default: throw new Error('Invalid unary IR'); }
}
function freeze(value) { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; }
export function sourceText(source) {
  if (typeof source === 'function') source = Function.prototype.toString.call(source);
  if (typeof source !== 'string') throw new TypeError('Expected function source or a function');
  return source;
}
export function lower(source, { numericMode } = {}) {
  if (numericMode !== 'i32') throw new TypeError('Explicit numericMode: "i32" is required');
  source = sourceText(source);
  if (new TextEncoder().encode(source).length > LIMITS.sourceBytes) throw new CompileError('Source is too large');
  let ast;
  try { ast = parse(source, { ecmaVersion: 2024, locations: true }); }
  catch (error) { throw new CompileError(error.message); }
  const fn = ast.body[0];
  if (ast.body.length !== 1 || fn?.type !== 'FunctionDeclaration' || fn.async || fn.generator ||
    fn.params.length !== 1 || fn.params[0].type !== 'Identifier')
    throw new CompileError('Use one named synchronous function with one identifier parameter', fn);
  const fail = (message, node) => { throw new CompileError(message, node); };
  let slots = 1, nodes = 0, cost = 0, multiplier = 1;
  const scopes = [new Map([[fn.params[0].name, { slot: 0, mutable: true }]])];
  const visit = n => { if (++nodes > LIMITS.nodes) fail('Program has too many nodes', n); cost += multiplier; if (cost > LIMITS.work) fail('Static work limit exceeded', n); };
  const lookup = n => {
    if (n.type !== 'Identifier') fail('Expected a local identifier', n);
    for (const scope of scopes.toReversed()) if (scope.has(n.name)) return scope.get(n.name);
    return fail(`Unknown or uninitialized variable: ${n.name}`, n);
  };
  const bind = (n, mutable, induction = false) => {
    if (n.type !== 'Identifier') fail('Destructuring is unsupported', n);
    if (scopes.some(s => s.has(n.name))) fail(`Shadowing or duplicate binding: ${n.name}`, n);
    if (slots >= LIMITS.locals) fail('Too many local variables', n);
    const binding = { slot: slots++, mutable, induction }; scopes.at(-1).set(n.name, binding); return binding.slot;
  };
  const literal = value => ({ kind: 'literal', type: 'i32', value });
  const bin = (op, a, b) => a.kind === 'literal' && b.kind === 'literal' ? literal(binaryValue(op, a.value, b.value)) : { kind: 'binary', type: 'i32', op, a, b };
  const expr = n => {
    visit(n);
    switch (n.type) {
      case 'Literal':
        if (typeof n.value !== 'number' || !Number.isInteger(n.value) || n.value < 0 || n.value > 2147483647) fail('Expected an i32 integer literal', n);
        return literal(n.value);
      case 'Identifier': return { kind: 'local', type: 'i32', slot: lookup(n).slot };
      case 'BinaryExpression': {
        if (!['+', '-', '*', '&', '|', '^', '<<', '>>', '<', '<=', '>', '>=', '===', '!=='].includes(n.operator)) fail(`Unsupported operator: ${n.operator}`, n);
        return bin(n.operator, expr(n.left), expr(n.right));
      }
      case 'UnaryExpression': {
        if (!['-', '~', '!'].includes(n.operator)) fail(`Unsupported unary operator: ${n.operator}`, n);
        if (n.operator === '-' && n.argument.type === 'Literal' && n.argument.value === 2147483648) return literal(-2147483648);
        const a = expr(n.argument); return a.kind === 'literal' ? literal(unaryValue(n.operator, a.value)) : { kind: 'unary', type: 'i32', op: n.operator, a };
      }
      default: return fail(`Unsupported expression: ${n.type}. Expressions must be pure`, n);
    }
  };
  const assignment = n => {
    if (!['AssignmentExpression', 'UpdateExpression'].includes(n.type)) fail('Expected an assignment or update statement', n);
    const b = lookup(n.type === 'AssignmentExpression' ? n.left : n.argument);
    if (!b.mutable || b.induction) fail('Cannot assign to a const or loop induction variable', n);
    const current = { kind: 'local', type: 'i32', slot: b.slot };
    if (n.type === 'UpdateExpression') return { kind: 'assign', slot: b.slot, value: bin(n.operator === '++' ? '+' : '-', current, literal(1)) };
    if (!['=', '+=', '-=', '*=', '&=', '|=', '^='].includes(n.operator)) fail('Unsupported assignment operator', n);
    const rhs = expr(n.right);
    return { kind: 'assign', slot: b.slot, value: n.operator === '=' ? rhs : bin(n.operator[0], current, rhs) };
  };
  const stmt = n => {
    visit(n);
    switch (n.type) {
      case 'BlockStatement': {
        scopes.push(new Map()); const body = n.body.map(stmt); scopes.pop(); return { kind: 'block', body };
      }
      case 'VariableDeclaration': {
        if (!['let', 'const'].includes(n.kind)) fail('Use initialized let or const declarations', n);
        return { kind: 'block', body: n.declarations.map(d => {
          if (!d.init) fail('Local variables need an initializer', d);
          // Reject shadowing before lowering the initializer (no accidental access to an outer binding).
          if (d.id.type === 'Identifier' && scopes.some(s => s.has(d.id.name))) fail('Shadowing is unsupported', d);
          const value = expr(d.init), slot = bind(d.id, n.kind === 'let'); return { kind: 'assign', slot, value };
        }) };
      }
      case 'ExpressionStatement': return assignment(n.expression);
      case 'IfStatement': return { kind: 'if', test: expr(n.test), yes: stmt(n.consequent), no: n.alternate ? stmt(n.alternate) : { kind: 'block', body: [] } };
      case 'ForStatement': {
        const declaration = n.init;
        if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'let' || declaration.declarations.length !== 1)
          fail('Loop must start with for (let i = INTEGER; i < INTEGER; i++)', n);
        const d = declaration.declarations[0];
        if (d.id.type !== 'Identifier' || !d.init) fail('Invalid loop initializer', n);
        const start = expr(d.init);
        if (start.kind !== 'literal') fail('Loop start must be constant', d.init);
        if (n.test?.type !== 'BinaryExpression' || !['<', '<='].includes(n.test.operator) || n.test.left.type !== 'Identifier' || n.test.left.name !== d.id.name)
          fail('Loop condition must compare its index with a constant using < or <=', n);
        const end = expr(n.test.right);
        if (end.kind !== 'literal') fail('Loop bound must be constant', n.test);
        if (n.update?.type !== 'UpdateExpression' || n.update.operator !== '++' || n.update.argument.type !== 'Identifier' || n.update.argument.name !== d.id.name)
          fail('Loop must increment its own index with ++', n);
        const count = Math.max(0, end.value - start.value + (n.test.operator === '<=' ? 1 : 0));
        if (count > LIMITS.loopIterations || start.value + count > 2147483647) fail('Loop bound is too large or wraps i32', n);
        scopes.push(new Map()); const slot = bind(d.id, false, true);
        const previous = multiplier; multiplier *= Math.max(1, count);
        if (multiplier > LIMITS.work) fail('Nested loops exceed the work limit', n);
        const body = stmt(n.body); multiplier = previous; scopes.pop();
        return { kind: 'for', slot, start: start.value, count, body };
      }
      case 'EmptyStatement': return { kind: 'block', body: [] };
      default: return fail(`Unsupported statement: ${n.type}. Use one final top-level return`, n);
    }
  };
  const bodyNodes = fn.body.body;
  const last = bodyNodes.at(-1);
  if (last?.type !== 'ReturnStatement' || !last.argument) fail('Function needs one final top-level return value', fn.body);
  scopes.push(new Map());
  const body = { kind: 'block', body: bodyNodes.slice(0, -1).map(stmt) };
  const result = expr(last.argument);
  return freeze({ version: COMPILER_VERSION, numericMode, type: 'i32 -> i32', slots, staticWork: cost, body, result });
}
