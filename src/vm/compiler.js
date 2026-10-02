import { parse } from 'acorn';
import { OP, MAX_REGISTERS, registerProgram } from './values.js';

/** Experimental Number VM compiler. Unsupported syntax is always an error. */
export function compileVM(source) {
  if (typeof source === 'function') source = Function.prototype.toString.call(source);
  if (typeof source !== 'string' || source.length > 32768) throw new TypeError('Expected function source of at most 32768 characters');
  const ast = parse(source, { ecmaVersion: 2025, locations: true });
  const pending = [[ast, 0]]; let nodes = 0;
  while (pending.length) {
    const [node, depth] = pending.pop();
    if (++nodes > 4096 || depth > 128) throw new RangeError('VM source complexity limit exceeded');
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) { for (const child of value) if (child?.type) pending.push([child, depth + 1]); }
      else if (value?.type) pending.push([value, depth + 1]);
    }
  }
  const fn = ast.body[0];
  if (ast.body.length !== 1 || fn?.type !== 'FunctionDeclaration' || fn.async || fn.generator ||
      fn.params.length !== 1 || fn.params[0].type !== 'Identifier')
    throw new SyntaxError('Expected one synchronous function declaration with one identifier parameter');
  const code = [], constants = [];
  let count = 1;
  const scopes = [new Map([[fn.params[0].name, { reg: 0, mutable: true }]])];
  const fail = node => { throw new SyntaxError(`GPU VM does not support ${node.type}${node.operator ? ` (${node.operator})` : ''} at ${node.loc.start.line}:${node.loc.start.column + 1}`); };
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
  const constant = value => { const r = alloc(); constants.push(value); emit(OP.CONST, r, constants.length - 1); return r; };
  const binary = (operator, a, b, node) => {
    if (operator === '>' || operator === '>=') return binary(operator === '>' ? '<' : '<=', b, a, node);
    const op = { '+': OP.ADD, '-': OP.SUB, '*': OP.MUL, '/': OP.DIV, '<': OP.LT, '<=': OP.LE,
      '===': OP.EQ, '!==': OP.NE, '&': OP.AND, '|': OP.OR, '^': OP.XOR, '<<': OP.SHL, '>>': OP.SHR, '>>>': OP.USHR }[operator];
    if (op === undefined) fail(node);
    const r = alloc(); emit(op, r, a, b); return r;
  };
  const expression = node => {
    switch (node.type) {
      case 'Literal':
        if (!['number', 'boolean'].includes(typeof node.value) && node.value !== null) fail(node);
        if (node.regex) fail(node);
        return constant(node.value);
      case 'Identifier': {
        if (!scopes.some(s => s.has(node.name))) {
          if (node.name === 'undefined') return constant(undefined);
          if (node.name === 'NaN') return constant(NaN);
          if (node.name === 'Infinity') return constant(Infinity);
        }
        const r = alloc(); emit(OP.MOVE, r, lookup(node.name).reg); return r; }
      case 'BinaryExpression': return binary(node.operator, expression(node.left), expression(node.right), node);
      case 'UnaryExpression': {
        const a = expression(node.argument);
        const op = { '-': OP.NEG, '+': OP.NUM, '!': OP.NOT, '~': OP.INV }[node.operator];
        if (op !== undefined) { const r = alloc(); emit(op, r, a); return r; }
        return fail(node);
      }
      case 'AssignmentExpression': {
        const d = target(node.left);
        if (!['=', '+=', '-=', '*=', '/='].includes(node.operator)) fail(node);
        const old = alloc(); emit(OP.MOVE, old, d);
        let a = expression(node.right);
        if (node.operator !== '=') a = binary(node.operator[0], old, a, node);
        emit(OP.MOVE, d, a);
        const result = alloc(); emit(OP.MOVE, result, d); return result;
      }
      case 'UpdateExpression': {
        if (!['++', '--'].includes(node.operator)) fail(node);
        const d = target(node.argument), old = alloc(); emit(OP.NUM, old, d);
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
          if (decl.id.type !== 'Identifier' || !decl.init || ['undefined', 'NaN', 'Infinity'].includes(decl.id.name)) fail(decl);
          // Shadowing is deliberately rejected, including references before inner declarations.
          if (scopes.some(s => s.has(decl.id.name))) throw new SyntaxError(`Duplicate/shadowed variable: ${decl.id.name}`);
          const value = expression(decl.init), reg = alloc();
          scopes.at(-1).set(decl.id.name, { reg, mutable: node.kind === 'let' });
          emit(OP.MOVE, reg, value);
        }
        break;
      case 'ExpressionStatement': expression(node.expression); break;
      case 'ReturnStatement':
        emit(OP.RET, node.argument ? expression(node.argument) : constant(undefined)); break;
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
  emit(OP.RET, constant(undefined));
  return registerProgram(Object.freeze({ source, registers: count, constants: Object.freeze(constants),
    instructions: Object.freeze(code.flat().map(x => x >>> 0)) }));
}
