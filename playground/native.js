// Demo-only native baseline. Only compiler-validated IR becomes executable code;
// user source is never evaluated. The library's CPU fallback still uses no eval.
export function nativeFunction(ir) {
  const expression = n => {
    if (n.kind === 'literal') return String(n.value);
    if (n.kind === 'local') return `v${n.slot}`;
    const a = expression(n.a);
    if (n.kind === 'unary') return `((${n.op}(${a})) | 0)`;
    const b = expression(n.b);
    return n.op === '*' ? `Math.imul(${a}, ${b})` : `((${a} ${n.op} ${b}) | 0)`;
  };
  let serial = 0;
  const statement = n => {
    switch (n.kind) {
      case 'block': return n.body.map(statement).join('\n');
      case 'assign': return `v${n.slot} = ${expression(n.value)};`;
      case 'if': return `if (${expression(n.test)}) { ${statement(n.yes)} } else { ${statement(n.no)} }`;
      case 'for': {
        const i = `i${serial++}`;
        return `for (let ${i} = 0; ${i} < ${n.count}; ${i}++) { v${n.slot} = ${n.start} + ${i}; ${statement(n.body)} }`;
      }
      default: throw new Error('Invalid IR statement');
    }
  };
  return new Function('v0', `"use strict"; ${Array.from({ length: ir.slots - 1 }, (_, i) => `let v${i + 1} = 0;`).join('\n')}
    ${statement(ir.body)} return ${expression(ir.result)};`);
}
