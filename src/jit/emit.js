import { binaryValue, unaryValue } from './ir.js';

export function emitWGSL(ir) {
  let serial = 0;
  const lit = value => `bitcast<i32>(${value >>> 0}u)`;
  const expr = n => {
    if (n.kind === 'literal') return lit(n.value);
    if (n.kind === 'local') return `v${n.slot}`;
    const a = expr(n.a);
    if (n.kind === 'unary') return n.op === '-' ? `bitcast<i32>(0u - bitcast<u32>(${a}))` : n.op === '~' ? `(~${a})` : `select(0i, 1i, ${a} == 0i)`;
    const b = expr(n.b), op = n.op;
    if (['+', '-', '*'].includes(op)) return `bitcast<i32>(bitcast<u32>(${a}) ${op} bitcast<u32>(${b}))`;
    if (['<<', '>>'].includes(op)) return `(${a} ${op} (bitcast<u32>(${b}) & 31u))`;
    if (['<', '<=', '>', '>=', '===', '!=='].includes(op)) return `select(0i, 1i, ${a} ${{ '===': '==', '!==': '!=' }[op] ?? op} ${b})`;
    return `(${a} ${op} ${b})`;
  };
  const stmt = (n, guard = null) => {
    switch (n.kind) {
      case 'block': return n.body.map(s => stmt(s, guard)).join('\n');
      case 'assign': { const rhs = expr(n.value); return `v${n.slot} = ${guard ? `select(v${n.slot}, ${rhs}, ${guard} != 0u)` : rhs};`; }
      case 'if': {
        const id = serial++, mask = `mask${id}`, yes = `yes${id}`, no = `no${id}`;
        return `let ${mask} = select(0u, 1u, ${expr(n.test)} != 0i);\nlet ${yes} = ${guard ?? '1u'} & ${mask};\nlet ${no} = ${guard ?? '1u'} & (1u ^ ${mask});\n${stmt(n.yes, yes)}\n${stmt(n.no, no)}`;
      }
      case 'for': {
        const id = serial++;
        return `for (var trip${id} = 0u; trip${id} < ${n.count}u; trip${id}++) {\nv${n.slot} = ${lit(n.start)} + i32(trip${id});\n${stmt(n.body, guard)}\n}`;
      }
      default: throw new Error('Invalid statement IR');
    }
  };
  return `// Lanes ${ir.version}; explicit wrapping i32 semantics.
fn guest(argument: i32) -> i32 {
var v0: i32 = argument;
${Array.from({ length: ir.slots - 1 }, (_, i) => `var v${i + 1}: i32 = 0;`).join('\n')}
${stmt(ir.body)}
return ${expr(ir.result)};
}
@group(0) @binding(0) var<storage, read> inputs: array<i32>;
@group(0) @binding(1) var<storage, read_write> outputs: array<i32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < arrayLength(&inputs)) { outputs[id.x] = guest(inputs[id.x]); }
}`;
}

// Compile IR to small CPU closures. No eval/new Function, including under strict CSP.
export function emitCPU(ir) {
  const expr = n => {
    if (n.kind === 'literal') return () => n.value;
    if (n.kind === 'local') return env => env[n.slot];
    const a = expr(n.a);
    if (n.kind === 'unary') return env => unaryValue(n.op, a(env));
    const b = expr(n.b); return env => binaryValue(n.op, a(env), b(env));
  };
  const stmt = n => {
    switch (n.kind) {
      case 'block': { const steps = n.body.map(stmt); return env => { for (const step of steps) step(env); }; }
      case 'assign': { const value = expr(n.value); return env => { env[n.slot] = value(env); }; }
      case 'if': { const test = expr(n.test), yes = stmt(n.yes), no = stmt(n.no); return env => { (test(env) ? yes : no)(env); }; }
      case 'for': { const body = stmt(n.body); return env => { for (let i = 0; i < n.count; i++) { env[n.slot] = n.start + i; body(env); } }; }
      default: throw new Error('Invalid statement IR');
    }
  };
  const body = stmt(ir.body), result = expr(ir.result);
  return inputs => {
    const output = new Int32Array(inputs.length), env = new Int32Array(ir.slots);
    for (let i = 0; i < inputs.length; i++) { env.fill(0); env[0] = inputs[i]; body(env); output[i] = result(env); }
    return output;
  };
}
