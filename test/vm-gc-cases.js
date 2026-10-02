export const gcCases = [
  ['return closure survives finally collection', 'function f(x) { function make(n) { return () => n; } function get() { try { throw x; } catch(e) { return () => e; } finally { for(let i = 0; i < 600; i++) { make(i); } } } const read = get(); return read(); }', [7]],
  ['thrown closure survives finally collection', 'function f(x) { function make(n) { return () => n; } try { try { throw make(x); } finally { for(let i = 0; i < 600; i++) { make(i); } } } catch(e) { return e(); } }', [8]],
  ['repeated calls', 'function f(x) { function add(n) { return n + 1; } for (let i = 0; i < 1200; i++) { x = add(x); } return x; }', [0, 1]],
  ['retained closure survives compaction', 'function f(x) { function make(n) { return () => ++n; } const kept = make(x); let last; for (let i = 0; i < 600; i++) { last = make(i); last(); } return kept() + kept() + last(); }', [0, 10]],
  ['cycle collection', 'function f(x) { function make(n) { const a = () => b(); const b = () => n; return a; } let last; for (let i = 0; i < 600; i++) { last = make(i); } return last(); }', [0]],
  ['loop environments collected', 'function f(x) { let first; let last; for (let i = 0; i < 600; i++) { const get = () => i; if (i === 0) { first = get; } last = get; } return first() + last(); }', [0]],
];
export async function runGCConformance(vm, signal) {
  let checked = 0, collections = 0;
  for (const [name, source, inputs] of gcCases) {
    const native = new Function(`return (${source})`)();
    const result = await vm.run(vm.compile(source), inputs, { signal, budget: 4096 });
    inputs.forEach((value, i) => {
      if (!Object.is(result.values[i], native(value))) throw new Error(`GC mismatch: ${name}, got ${result.values[i]}`);
      if (result.collections[i] < 1) throw new Error(`GC did not run: ${name}`);
      checked++; collections += result.collections[i];
    });
  }
  return { programs: gcCases.length, checked, collections };
}
