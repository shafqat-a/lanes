import { parse } from 'acorn';
import { OP, MAX_REGISTERS, registerProgram } from './bytecode.js';

/** Compile the experimental i32 subset. This mode is NOT ECMAScript Number arithmetic. */
export function compile(source, { numericMode } = {}) {
  if (numericMode !== 'i32') throw new TypeError('Explicit numericMode: "i32" is required');
  const ast = parse(source, { ecmaVersion: 2024 });
  const fn = ast.body[0];
  if (ast.body.length !== 1 || fn?.type !== 'FunctionDeclaration' || fn.async || fn.generator ||
      fn.params.length !== 1 || fn.params[0].type !== 'Identifier')
    throw new SyntaxError('Expected one synchronous function declaration with one identifier parameter');
  const code = [];
  let count = 1;
  const scopes = [new Map([[fn.params[0].name, { reg: 0, mutable: true }]])];
  const fail = node => { throw new SyntaxError(`Unsupported ${node.type} at offset ${node.start}`); };
  const alloc = () => {
    if (count === MAX_REGISTERS) throw new RangeError(`Program exceeds ${MAX_REGISTERS} registers`);
    return count++;
  };
  const emit = (op, d = 0, a = 0, b = 0) => { code.push([op, d, a, b]); return code.length - 1; };
  const lookup = name => {
    for (const scope of scopes.toReversed()) if (scope.has(name)) return scope.get(name);
    throw new SyntaxError(`Unknown or uninitialized variable: ${name}`);
  };
  const target = node => {
    if (node.type !== 'Identifier') fail(node);
    const binding = lookup(node.name);
    if (!binding.mutable) throw new SyntaxError(`Cannot assign to const ${node.name}`);
    return binding.reg;
  };
  const constant = value => { const r = alloc(); emit(OP.CONST, r, value); return r; };
  const binary = (operator, a, b, node) => {
    if (operator === '>' || operator === '>=') return binary(operator === '>' ? '<' : '<=', b, a, node);
    const op = { '+': OP.ADD, '-': OP.SUB, '*': OP.MUL, '<': OP.LT, '<=': OP.LE,
      '===': OP.EQ, '!==': OP.NE, '&': OP.AND, '|': OP.OR, '^': OP.XOR, '<<': OP.SHL, '>>': OP.SHR }[operator];
    if (op === undefined) fail(node);
    const r = alloc(); emit(op, r, a, b); return r;
  };
  const expression = node => {
    switch (node.type) {
      case 'Literal':
        if (typeof node.value !== 'number' || !Number.isInteger(node.value) || node.value < 0 || node.value > 2147483647) fail(node);
        return constant(node.value);
      case 'Identifier': { const r = alloc(); emit(OP.MOVE, r, lookup(node.name).reg); return r; }
      case 'BinaryExpression': return binary(node.operator, expression(node.left), expression(node.right), node);
      case 'UnaryExpression': {
        if (node.operator === '-' && node.argument.type === 'Literal' && node.argument.value === 2147483648)
          return constant(-2147483648);
        const a = expression(node.argument);
        if (node.operator === '-') return binary('-', constant(0), a, node);
        if (node.operator === '~') return binary('^', a, constant(-1), node);
        if (node.operator === '!') return binary('===', a, constant(0), node);
        return fail(node);
      }
      case 'AssignmentExpression': {
        const d = target(node.left);
        if (!['=', '+=', '-=', '*='].includes(node.operator)) fail(node);
        const old = alloc(); emit(OP.MOVE, old, d);
        let a = expression(node.right);
        if (node.operator !== '=') a = binary(node.operator[0], old, a, node);
        emit(OP.MOVE, d, a);
        const result = alloc(); emit(OP.MOVE, result, d); return result;
      }
      case 'UpdateExpression': {
        if (!['++', '--'].includes(node.operator)) fail(node);
        const d = target(node.argument), old = alloc(); emit(OP.MOVE, old, d);
        const value = binary(node.operator === '++' ? '+' : '-', old, constant(1), node);
        emit(OP.MOVE, d, value); return node.prefix ? value : old;
      }
      default: return fail(node);
    }
  };
  const statement = node => {
    switch (node.type) {
      case 'BlockStatement':
        scopes.push(new Map());
        for (const child of node.body) statement(child);
        scopes.pop(); break;
      case 'VariableDeclaration':
        if (!['let', 'const'].includes(node.kind)) fail(node);
        for (const decl of node.declarations) {
          if (decl.id.type !== 'Identifier' || !decl.init) fail(decl);
          // Shadowing is deliberately rejected, including references before inner declarations.
          if (scopes.some(s => s.has(decl.id.name))) throw new SyntaxError(`Duplicate/shadowed variable: ${decl.id.name}`);
          const value = expression(decl.init), reg = alloc();
          scopes.at(-1).set(decl.id.name, { reg, mutable: node.kind === 'let' });
          emit(OP.MOVE, reg, value);
        }
        break;
      case 'ExpressionStatement': expression(node.expression); break;
      case 'ReturnStatement':
        if (!node.argument) fail(node);
        emit(OP.RET, expression(node.argument)); break;
      case 'IfStatement': {
        const branch = emit(OP.JZ, expression(node.test));
        statement(node.consequent);
        const end = emit(OP.JMP);
        code[branch][2] = code.length;
        if (node.alternate) statement(node.alternate);
        code[end][2] = code.length; break;
      }
      case 'WhileStatement': {
        const start = code.length, exit = emit(OP.JZ, expression(node.test));
        statement(node.body); emit(OP.JMP, 0, start); code[exit][2] = code.length; break;
      }
      case 'ForStatement': {
        scopes.push(new Map());
        if (node.init) node.init.type === 'VariableDeclaration' ? statement(node.init) : expression(node.init);
        const start = code.length;
        const exit = node.test ? emit(OP.JZ, expression(node.test)) : null;
        statement(node.body);
        if (node.update) expression(node.update);
        emit(OP.JMP, 0, start);
        if (exit !== null) code[exit][2] = code.length;
        scopes.pop(); break;
      }
      case 'EmptyStatement': break;
      default: fail(node);
    }
  };
  statement(fn.body);
  // Falling off the function is invalid: this prototype has no undefined value.
  emit(0xffffffff);
  return registerProgram(Object.freeze({ numericMode, registers: count,
    instructions: Object.freeze(code.flat().map(x => x >>> 0)) }));
}
