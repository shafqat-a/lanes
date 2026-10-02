// Experimental structured source lowering. Not a public compiler or an untrusted-code sandbox.
import { parse } from 'acorn';
import { compile } from '../src/compiler.js';

export function directWGSL(source, { predicateAssignments = true } = {}) {
  compile(source, { numericMode: 'i32' }); // Reuse the subset's lexical/feature validation.
  const fn = parse(source, { ecmaVersion: 2024 }).body[0];
  const scopes = [new Map([[fn.params[0].name, 'argument']])];
  let serial = 0;
  const fail = node => { throw new SyntaxError(`Direct experiment does not support ${node.type}`); };
  const lookup = name => {
    for (const scope of scopes.toReversed()) if (scope.has(name)) return scope.get(name);
    throw new SyntaxError(`Unknown variable: ${name}`);
  };
  const binary = (op, a, b) => {
    if (['+', '-', '*'].includes(op)) return `bitcast<i32>(bitcast<u32>(${a}) ${op} bitcast<u32>(${b}))`;
    if (['<<', '>>'].includes(op)) return `(${a} ${op} (bitcast<u32>(${b}) & 31u))`;
    if (['<', '<=', '>', '>=', '===', '!=='].includes(op))
      return `select(0i, 1i, ${a} ${{ '===': '==', '!==': '!=' }[op] ?? op} ${b})`;
    return `(${a} ${op} ${b})`;
  };
  // Expressions here must have no mutation: WGSL evaluation order is not a JS guarantee.
  const expr = n => {
    switch (n.type) {
      case 'Literal': return `${n.value}i`;
      case 'Identifier': return lookup(n.name);
      case 'BinaryExpression': return binary(n.operator, expr(n.left), expr(n.right));
      case 'UnaryExpression':
        if (n.operator === '-' && n.argument.type === 'Literal' && n.argument.value === 2147483648)
          return 'bitcast<i32>(2147483648u)';
        if (n.operator === '-') return binary('-', '0i', expr(n.argument));
        if (n.operator === '~') return `(~${expr(n.argument)})`;
        if (n.operator === '!') return `select(0i, 1i, ${expr(n.argument)} == 0i)`;
        return fail(n);
      default: return fail(n);
    }
  };
  const mutation = n => {
    if (n.type === 'UpdateExpression') {
      const name = lookup(n.argument.name);
      return `${name} = ${binary(n.operator === '++' ? '+' : '-', name, '1i')};`;
    }
    if (n.type === 'AssignmentExpression') {
      const name = lookup(n.left.name), right = expr(n.right);
      return `${name} = ${n.operator === '=' ? right : binary(n.operator[0], name, right)};`;
    }
    return fail(n);
  };
  const block = n => stmt(n.type === 'BlockStatement' ? n : { type: 'BlockStatement', body: [n] });
  const stmt = n => {
    switch (n.type) {
      case 'BlockStatement': {
        scopes.push(new Map());
        const text = n.body.map(stmt).join('\n'); scopes.pop(); return `{\n${text}\n}`;
      }
      case 'VariableDeclaration': return n.declarations.map(d => {
        const value = expr(d.init), name = `v${serial++}`;
        scopes.at(-1).set(d.id.name, name);
        return `${n.kind === 'const' ? 'let' : 'var'} ${name}: i32 = ${value};`;
      }).join('\n');
      case 'ExpressionStatement': return mutation(n.expression);
      case 'ReturnStatement': return `return ${expr(n.argument)};`;
      case 'IfStatement': {
        const child = n.consequent.type === 'BlockStatement' && n.consequent.body.length === 1
          ? n.consequent.body[0] : n.consequent;
        const assignment = child.type === 'ExpressionStatement' ? child.expression : null;
        if (predicateAssignments && !n.alternate && assignment?.type === 'AssignmentExpression') {
          // Both candidate values are pure i32 expressions with no trapping operations.
          // Eager selection preserves the subset's observable behavior.
          const name = lookup(assignment.left.name), right = expr(assignment.right);
          const value = assignment.operator === '=' ? right : binary(assignment.operator[0], name, right);
          return `${name} = select(${name}, ${value}, ${expr(n.test)} != 0i);`;
        }
        return `if (${expr(n.test)} != 0i) ${block(n.consequent)}${n.alternate ? ` else ${block(n.alternate)}` : ''}`;
      }
      case 'ForStatement': {
        // Only the bounded, initialized for loops used by this experiment.
        if (!n.init || n.init.type !== 'VariableDeclaration' || !n.test || !n.update) fail(n);
        scopes.push(new Map());
        const init = stmt(n.init), test = expr(n.test), update = mutation(n.update), body = stmt(n.body);
        scopes.pop();
        return `{ ${init}\n loop { if (${test} == 0i) { break; } ${body}\n ${update} } }`;
      }
      case 'EmptyStatement': return '';
      default: return fail(n);
    }
  };
  const body = stmt(fn.body);
  return `
fn guest(arg: i32) -> i32 { var argument = arg; ${body} }
@group(0) @binding(0) var<storage, read> inputs: array<i32>;
@group(0) @binding(1) var<storage, read_write> output: array<vec2<i32>>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x >= arrayLength(&inputs)) { return; }
  output[id.x] = vec2<i32>(guest(inputs[id.x]), 1);
}`;
}
