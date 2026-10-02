import { parse } from 'acorn';
import { OP, MAX_REGISTERS, MAX_ARGUMENTS, MAX_STRING, registerProgram } from './values.js';

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
  const root = ast.body[0];
  if (ast.body.length !== 1 || root?.type !== 'FunctionDeclaration' || root.params.length !== 1 || !root.id)
    throw new SyntaxError('Expected one named function declaration with one identifier parameter');
  const fail = node => { throw new SyntaxError(`GPU VM does not support ${node.type}${node.operator ? ` (${node.operator})` : ''} at ${node.loc.start.line}:${node.loc.start.column + 1}`); };
  const validateFunction = fn => {
    if (fn.async || fn.generator || fn.params.length > MAX_ARGUMENTS || fn.params.some(p => p.type !== 'Identifier')) fail(fn);
  };
  validateFunction(root);
  const code = [], constants = [], functions = [], patches = [];
  let scopes = [], loops = [], finalizers = [], tryDepth = 0, count = 1, maxRegisters = 1, calls = false, strings = false, strictMode = false;
  const alloc = () => {
    if (count >= MAX_REGISTERS) throw new RangeError(`Function exceeds ${MAX_REGISTERS} registers`);
    maxRegisters = Math.max(maxRegisters, count + 1); return count++;
  };
  const emit = (op, d = 0, a = 0, b = 0) => { code.push([op, d, a, b]); return code.length - 1; };
  const constant = value => {
    if (typeof value === 'string') { strings = true; if (value.length > MAX_STRING) throw new RangeError('VM string length limit exceeded'); }
    const r = alloc(); constants.push(value); emit(OP.CONST, r, constants.length - 1); return r;
  };
  const declare = (scope, id, mutable) => {
    if (id.type !== 'Identifier' || id.name === 'arguments' || scope.has(id.name)) fail(id);
    const binding = { slot: scope.size, mutable }; scope.set(id.name, binding); return binding;
  };
  const lookup = name => {
    for (let i = scopes.length - 1; i >= 0; i--) if (scopes[i].has(name)) return { ...scopes[i].get(name), depth: scopes.length - i - 1 };
    return null;
  };
  const target = node => {
    if (node.type !== 'Identifier') fail(node);
    const binding = lookup(node.name);
    if (!binding) throw new SyntaxError(`Unknown variable: ${node.name}`);
    return binding;
  };
  const load = binding => { const r = alloc(); emit(OP.LOAD, r, binding.depth, binding.slot); return r; };
  const store = (binding, value, initialize = false) => {
    if (!initialize && binding.mutable === 'silent') return;
    return emit(initialize ? OP.INIT : binding.mutable === false ? OP.CONSTSTORE : OP.STORE, value, binding.depth, binding.slot);
  };
  const isStrict = node => strictMode || (node.body.type === 'BlockStatement' && node.body.body.some(s => s.directive === 'use strict'));
  const queueFunction = (node, outer) => { validateFunction(node); const index = functions.length; functions.push({ node, outer: outer.slice(), entry: 0, strict: isStrict(node) }); return index; };
  const closure = node => {
    // A named expression has a private immutable self binding, distinct from declarations.
    const named = node.type === 'FunctionExpression' && node.id;
    if (named) { const scope = new Map(); declare(scope, node.id, isStrict(node) ? false : 'silent'); scopes.push(scope); emit(OP.ENTER, 1); }
    const id = queueFunction(node, scopes), r = alloc(); patches.push([emit(OP.CLOSURE, r), id]);
    if (named) { store({ depth: 0, slot: 0 }, r, true); emit(OP.LEAVE); scopes.pop(); }
    return r;
  };
  const binary = (operator, a, b, node) => {
    if (operator === '>' || operator === '>=') return binary(operator === '>' ? '<' : '<=', b, a, node);
    const op = { '+': OP.ADD, '-': OP.SUB, '*': OP.MUL, '/': OP.DIV, '%': OP.MOD, '<': OP.LT, '<=': OP.LE, '==': OP.LOOSEQ, '!=': OP.LOOSENE,
      '===': OP.EQ, '!==': OP.NE, '&': OP.AND, '|': OP.OR, '^': OP.XOR, '<<': OP.SHL, '>>': OP.SHR, '>>>': OP.USHR }[operator];
    if (op === undefined) fail(node);
    const r = alloc(); emit(op, r, a, b); return r;
  };
  const expression = node => {
    switch (node.type) {
      case 'Literal':
        if (!['number', 'boolean', 'string'].includes(typeof node.value) && node.value !== null) fail(node);
        if (node.regex) fail(node); return constant(node.value);
      case 'Identifier': {
        if (node.name === 'arguments') fail(node);
        const binding = lookup(node.name);
        if (binding) return load(binding);
        if (node.name === 'undefined') return constant(undefined);
        if (node.name === 'NaN') return constant(NaN);
        if (node.name === 'Infinity') return constant(Infinity);
        throw new SyntaxError(`Unknown variable: ${node.name}`);
      }
      case 'FunctionExpression': case 'ArrowFunctionExpression': return closure(node);
      case 'CallExpression': {
        if (node.optional || node.arguments.length > MAX_ARGUMENTS || node.arguments.some(a => a.type === 'SpreadElement')) fail(node);
        const property = node.callee.type === 'MemberExpression' && (node.callee.computed ? node.callee.property.value : node.callee.property.name);
        if (['charAt', 'charCodeAt'].includes(property)) {
          strings = true; const receiver = expression(node.callee.object); emit(OP.STRINGCHECK, receiver);
          const args = node.arguments.map(expression), index = args.length ? args[0] : constant(undefined), result = alloc();
          emit(property === 'charAt' ? OP.CHARAT : OP.CHARCODE, result, receiver, index); return result;
        }
        calls = true;
        const callee = expression(node.callee), args = node.arguments.map(expression);
        const start = count;
        for (const argument of args) emit(OP.MOVE, alloc(), argument);
        const result = alloc(); emit(OP.CALL, result, callee, start | (args.length << 16)); return result;
      }
      case 'MemberExpression': {
        if (node.optional) fail(node);
        const object = expression(node.object), result = alloc(); strings = true;
        if ((!node.computed && node.property.name === 'length') || (node.computed && node.property.type === 'Literal' && node.property.value === 'length')) emit(OP.LENGTH, result, object);
        else if (node.computed) emit(OP.INDEX, result, object, expression(node.property));
        else fail(node);
        return result;
      }
      case 'BinaryExpression': return binary(node.operator, expression(node.left), expression(node.right), node);
      case 'UnaryExpression': {
        if (node.operator === 'void') { expression(node.argument); return constant(undefined); }
        const a = expression(node.argument), op = { '-': OP.NEG, '+': OP.NUM, '!': OP.NOT, '~': OP.INV }[node.operator];
        if (op === undefined) fail(node);
        const r = alloc(); emit(op, r, a); return r;
      }
      case 'AssignmentExpression': {
        const binding = target(node.left);
        if (['&&=', '||=', '??='].includes(node.operator)) {
          const r = load(binding); let end;
          if (node.operator === '||=') { const right = emit(OP.JZ, r); end = emit(OP.JMP); code[right][2] = code.length; }
          else end = emit(node.operator === '??=' ? OP.JNN : OP.JZ, r);
          const value = expression(node.right); store(binding, value); emit(OP.MOVE, r, value); code[end][2] = code.length; return r;
        }
        if (!['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>='].includes(node.operator)) fail(node);
        const old = node.operator === '=' ? null : load(binding);
        let value = expression(node.right);
        if (old !== null) value = binary(node.operator.slice(0, -1), old, value, node);
        store(binding, value); return value;
      }
      case 'UpdateExpression': {
        const binding = target(node.argument), original = load(binding), old = alloc(); emit(OP.NUM, old, original);
        const value = binary(node.operator === '++' ? '+' : '-', old, constant(1), node);
        store(binding, value); return node.prefix ? value : old;
      }
      case 'ConditionalExpression': {
        const r = alloc(), branch = emit(OP.JZ, expression(node.test));
        emit(OP.MOVE, r, expression(node.consequent)); const end = emit(OP.JMP);
        code[branch][2] = code.length; emit(OP.MOVE, r, expression(node.alternate)); code[end][2] = code.length; return r;
      }
      case 'LogicalExpression': {
        if (!['&&', '||', '??'].includes(node.operator)) fail(node);
        const r = alloc(); emit(OP.MOVE, r, expression(node.left));
        if (node.operator === '&&' || node.operator === '??') { const end = emit(node.operator === '??' ? OP.JNN : OP.JZ, r); emit(OP.MOVE, r, expression(node.right)); code[end][2] = code.length; }
        else { const right = emit(OP.JZ, r), end = emit(OP.JMP); code[right][2] = code.length; emit(OP.MOVE, r, expression(node.right)); code[end][2] = code.length; }
        return r;
      }
      case 'SequenceExpression': { let value; for (const child of node.expressions) value = expression(child); return value; }
      default: return fail(node);
    }
  };
  const scan = (body, scope, allowFunctions) => {
    for (const node of body) {
      if (node.type === 'VariableDeclaration') {
        if (!['let', 'const'].includes(node.kind)) fail(node);
        for (const decl of node.declarations) declare(scope, decl.id, node.kind === 'let');
      } else if (node.type === 'FunctionDeclaration') {
        if (!allowFunctions) fail(node); // Annex B block-function semantics are not implemented.
        declare(scope, node.id, true);
      }
    }
  };
  const hoist = body => { for (const node of body) if (node.type === 'FunctionDeclaration') store(lookup(node.id.name), closure(node), true); };
  const containsFunction = node => {
    if (['FunctionExpression', 'FunctionDeclaration', 'ArrowFunctionExpression'].includes(node.type)) return true;
    return Object.values(node).some(v => Array.isArray(v) ? v.some(n => n?.type && containsFunction(n)) : v?.type && containsFunction(v));
  };
  const cleanup = (shouldExit, finish) => {
    const saved = { scopes, loops, finalizers, tryDepth };
    finalizers = finalizers.slice();
    while (finalizers.length && shouldExit(finalizers.at(-1))) {
      const entry = finalizers.pop();
      for (let i = scopes.length; i > entry.scopes.length; i--) emit(OP.LEAVE);
      for (let i = tryDepth; i > entry.tryDepth; i--) emit(OP.ENDTRY);
      scopes = entry.scopes.slice(); loops = entry.loops.slice(); tryDepth = entry.tryDepth;
      statement(entry.node);
    }
    finish();
    ({ scopes, loops, finalizers, tryDepth } = saved);
  };
  const statement = node => {
    switch (node.type) {
      case 'BlockStatement': {
        const scope = new Map(); scan(node.body, scope, false);
        if (scope.size) { scopes.push(scope); emit(OP.ENTER, scope.size); }
        for (const child of node.body) statement(child);
        if (scope.size) { emit(OP.LEAVE); scopes.pop(); } break;
      }
      case 'FunctionDeclaration': break; // Already initialized in the function prologue.
      case 'VariableDeclaration':
        for (const decl of node.declarations) store(lookup(decl.id.name), decl.init ? expression(decl.init) : constant(undefined), true);
        break;
      case 'ExpressionStatement': expression(node.expression); break;
      case 'ReturnStatement': {
        const value = node.argument ? expression(node.argument) : constant(undefined);
        cleanup(() => true, () => emit(OP.RET, value)); break;
      }
      case 'IfStatement': {
        const branch = emit(OP.JZ, expression(node.test)); statement(node.consequent); const end = emit(OP.JMP);
        code[branch][2] = code.length; if (node.alternate) statement(node.alternate); code[end][2] = code.length; break;
      }
      case 'WhileStatement': {
        const loop = { breaks: [], continues: [], scopes: scopes.length, tryDepth, continuable: true }; loops.push(loop);
        const start = code.length, end = emit(OP.JZ, expression(node.test)); statement(node.body);
        for (const at of loop.continues) code[at][2] = start;
        emit(OP.JMP, 0, start); code[end][2] = code.length;
        for (const at of loop.breaks) code[at][2] = code.length;
        loops.pop(); break;
      }
      case 'ForStatement': {
        const scope = new Map(); if (node.init?.type === 'VariableDeclaration') scan([node.init], scope, false);
        if (scope.size) { scopes.push(scope); emit(OP.ENTER, scope.size); }
        if (node.init) node.init.type === 'VariableDeclaration' ? statement(node.init) : expression(node.init);
        const clone = scope.size && node.init.kind === 'let' && containsFunction(node);
        if (clone) emit(OP.CLONE);
        const loop = { breaks: [], continues: [], scopes: scopes.length, tryDepth, continuable: true }; loops.push(loop);
        const start = code.length, end = node.test ? emit(OP.JZ, expression(node.test)) : null;
        statement(node.body); for (const at of loop.continues) code[at][2] = code.length;
        if (clone) emit(OP.CLONE); if (node.update) expression(node.update); emit(OP.JMP, 0, start);
        if (end !== null) code[end][2] = code.length;
        for (const at of loop.breaks) code[at][2] = code.length;
        loops.pop();
        if (scope.size) { emit(OP.LEAVE); scopes.pop(); } break;
      }
      case 'DoWhileStatement': {
        const loop = { breaks: [], continues: [], scopes: scopes.length, tryDepth, continuable: true }; loops.push(loop);
        const start = code.length; statement(node.body);
        for (const at of loop.continues) code[at][2] = code.length;
        const end = emit(OP.JZ, expression(node.test)); emit(OP.JMP, 0, start); code[end][2] = code.length;
        for (const at of loop.breaks) code[at][2] = code.length;
        loops.pop(); break;
      }
      case 'BreakStatement': case 'ContinueStatement': {
        if (node.label || !loops.length) fail(node);
        const loop = node.type === 'BreakStatement' ? loops.at(-1) : loops.toReversed().find(item => item.continuable);
        if (!loop) fail(node);
        cleanup(entry => entry.tryDepth >= loop.tryDepth, () => {
          for (let i = scopes.length; i > loop.scopes; i--) emit(OP.LEAVE);
          for (let i = tryDepth; i > loop.tryDepth; i--) emit(OP.ENDTRY);
          loop[node.type === 'BreakStatement' ? 'breaks' : 'continues'].push(emit(OP.JMP));
        }); break;
      }
      case 'ThrowStatement': emit(OP.THROW, expression(node.argument)); break;
      case 'SwitchStatement': {
        const value = expression(node.discriminant), scope = new Map(); scan(node.cases.flatMap(item => item.consequent), scope, false);
        if (scope.size) { scopes.push(scope); emit(OP.ENTER, scope.size); }
        const context = { breaks: [], continues: [], scopes: scopes.length, tryDepth, continuable: false }; loops.push(context);
        const jumps = [], entries = []; let defaultIndex = -1;
        node.cases.forEach((item, index) => {
          if (!item.test) { defaultIndex = index; return; }
          const test = binary('===', value, expression(item.test), item.test), next = emit(OP.JZ, test);
          jumps.push([emit(OP.JMP), index]); code[next][2] = code.length;
        });
        const fallback = emit(OP.JMP);
        node.cases.forEach((item, index) => { entries[index] = code.length; item.consequent.forEach(statement); });
        for (const [at, index] of jumps) code[at][2] = entries[index];
        code[fallback][2] = defaultIndex < 0 ? code.length : entries[defaultIndex];
        for (const at of context.breaks) code[at][2] = code.length;
        loops.pop(); if (scope.size) { emit(OP.LEAVE); scopes.pop(); } break;
      }
      case 'TryStatement': {
        if (node.finalizer) {
          const thrown = alloc(), handler = emit(OP.TRY, thrown);
          const entry = { node: node.finalizer, scopes: scopes.slice(), loops: loops.slice(), tryDepth };
          finalizers.push(entry); tryDepth++;
          if (node.handler) statement({ ...node, finalizer: null }); else statement(node.block);
          tryDepth--; finalizers.pop(); emit(OP.ENDTRY);
          statement(node.finalizer); const end = emit(OP.JMP);
          code[handler][2] = code.length; statement(node.finalizer); emit(OP.THROW, thrown);
          code[end][2] = code.length; break;
        }
        if (!node.handler) fail(node);
        const value = alloc(), handler = emit(OP.TRY, value); tryDepth++; statement(node.block); tryDepth--;
        emit(OP.ENDTRY); const end = emit(OP.JMP); code[handler][2] = code.length;
        if (node.handler.param) {
          const scope = new Map(); declare(scope, node.handler.param, true); scopes.push(scope); emit(OP.ENTER, 1);
          store({ depth: 0, slot: 0 }, value, true);
        }
        statement(node.handler.body);
        if (node.handler.param) { emit(OP.LEAVE); scopes.pop(); }
        code[end][2] = code.length; break;
      }
      case 'EmptyStatement': break;
      default: fail(node);
    }
  };
  // Bootstrap a self binding so the root function can recurse on GPU too.
  const outer = new Map(); declare(outer, root.id, true); scopes = [outer]; emit(OP.ENTER, 1);
  const rootId = queueFunction(root, scopes), self = alloc(); patches.push([emit(OP.CLOSURE, self), rootId]);
  store({ depth: 0, slot: 0 }, self, true); const jump = emit(OP.JMP);
  for (let index = 0; index < functions.length; index++) {
    const fn = functions[index], node = fn.node; fn.entry = code.length; strictMode = fn.strict;
    scopes = fn.outer.slice(); loops = []; finalizers = []; tryDepth = 0; count = Math.max(1, node.params.length); maxRegisters = Math.max(maxRegisters, count);
    const scope = new Map(); for (const parameter of node.params) declare(scope, parameter, true);
    const body = node.body.type === 'BlockStatement' ? node.body.body : [{ type: 'ReturnStatement', argument: node.body }];
    scan(body, scope, true); scopes.push(scope); emit(OP.ENTER, scope.size, 0, node.params.length);
    node.params.forEach((p, i) => store(lookup(p.name), i, true)); hoist(body);
    for (const child of body) statement(child);
    emit(OP.RET, constant(undefined));
  }
  code[jump][2] = functions[0].entry;
  for (const [at, id] of patches) code[at][2] = functions[id].entry;
  return registerProgram(Object.freeze({ source, registers: maxRegisters, functions: functions.length, calls, strings,
    constants: Object.freeze(constants), instructions: Object.freeze(code.flat().map(x => x >>> 0)) }));
}
