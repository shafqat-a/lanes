export const controlCases = [
  ['finally continue overrides return', 'function f(x) { for(let i = 0; i < 3; i++) { try { return 7; } finally { continue; } } return 9; }', [0]],
  ['finally resolves outer binding', 'function f(x) { let y = x; function g() { try { let y = 99; return y; } finally { y++; } } const r = g(); return r + y; }', [0, 5]],
  ['switch fallthrough and default', 'function f(x) { let y = 0; switch(x) { case 0: y += 1; default: y += 2; case 2: y += 4; } return y; }', [0, 1, 2]],
  ['switch evaluates labels until match', 'function f(x) { let i = 0; switch(x) { case ++i: return i; default: return i + 10; case ++i: return i; } }', [0, 1, 2]],
  ['switch break versus loop continue', 'function f(x) { let y = 0; for(let i = 0; i < 4; i++) { switch(i) { case 0: continue; case 1: y += 2; break; default: y += 3; } y += 10; } return y; }', [0]],
  ['switch lexical TDZ', 'function f(x) { try { switch(x) { case 0: let y = 3; return y; default: return y; } } catch(e) { return 9; } }', [0, 1]],
  ['nullish preserves falsey values', 'function f(x) { return x ?? 17; }', [0, -0, false, NaN, null, undefined]],
  ['logical assignments', 'function f(x) { let y = x; y ??= 7; y &&= 3; y ||= 2; return y; }', [0, 1, false, null, undefined]],
  ['logical const no assignment', 'function f(x) { const y = 1; y ||= x(); y ??= x(); return y; }', [0]],
  ['logical const assignment throws', 'function f(x) { const y = 0; try { y ||= 1; } catch(e) { return 9; } return 0; }', [0]],
  ['compound bitwise and remainder', 'function f(x) { let y = x; y <<= 2; y |= 1; y %= 3; return y; }', [0, 1, 2, -1]],
  ['void and sequence effects', 'function f(x) { let y = 0; const result = (y++, void (y++)); return result === undefined && y === 2; }', [0]],
  ['loose primitive equality', 'function f(x) { return (null == undefined) && (false == 0) && (true == 1) && !(null == 0); }', [0]],
  ['closure loose equality', 'function f(x) { const g = () => 1; return g == g && g != null && g != undefined; }', [0]],
  ['catch invalid call', 'function f(x) { try { return x(); } catch(e) { return !!e && e === e; } }', [0, null, undefined]],
  ['catch TDZ across call', 'function f(x) { const get = () => y; try { return get(); } catch(e) { return 42; } let y = x; }', [0]],
  ['catch const assignment', 'function f(x) { const y = 1; try { y = x; } catch(e) { return y + 10; } }', [0]],
  ['finally on implicit exception', 'function f(x) { let y = 0; try { try { x(); } finally { y = 20; } } catch(e) { return y + 1; } }', [0]],
  ['named expression binding ignores assignment', 'function f(x) { const g = function inner() { inner = 0; return !!inner; }; return g(); }', [0]],
  ['cross-call throw', 'function f(x) { function g(n) { if (n > 0) { return g(n - 1); } throw 41; } try { g(x); return 0; } catch (error) { return error + 1; } }', [0, 1, 10]],
  ['catch binding closure', 'function f(x) { let get; try { throw x; } catch (e) { get = () => e; e += 1; } return get(); }', [0, 1]],
  ['nested rethrow', 'function f(x) { try { try { throw x; } catch (e) { throw e + 2; } } catch (e) { return e + 3; } }', [0, -1]],
  ['return clears handler', 'function f(x) { function g() { try { return 1; } catch (e) { return 9; } } try { g(); throw x; } catch (e) { return e; } }', [0, 5]],
  ['break and continue unwind', 'function f(x) { let sum = 0; for (let i = 0; i < 10; i++) { { let y = i; try { if (i < 3) { continue; } if (i === 7) { break; } sum += y; } catch(e) { sum = 999; } } } return sum; }', [0]],
  ['do while continue', 'function f(x) { let i = 0; let sum = 0; do { i++; if (i < 3) { continue; } sum += i; } while (i < 5); return sum; }', [0]],
  ['finally normal', 'function f(x) { let y = x; try { y += 2; } finally { y *= 3; } return y; }', [0, 1]],
  ['finally return snapshot', 'function f(x) { let y = x; try { return y; } finally { y = 42; } }', [0, 1]],
  ['finally return override', 'function f(x) { try { return x; } finally { return x + 10; } }', [0, 1]],
  ['finally throw override', 'function f(x) { function g() { try { return x; } finally { throw 33; } } try { return g(); } catch(e) { return e; } }', [0]],
  ['finally catches throw from callee', 'function f(x) { let y = 0; function g() { throw 2; } try { try { g(); } finally { y = 10; } } catch (e) { return y + e; } }', [0]],
  ['finally skips own catch', 'function f(x) { let y = 0; try { try { return x; } catch(e) { y = 100; } finally { throw 3; } } catch (e) { return y + e; } }', [0]],
  ['finally nested return', 'function f(x) { let y = 0; function g() { try { try { return x; } finally { y += 2; } } finally { y *= 3; } } const r = g(); return r + y; }', [0, 1]],
  ['finally break continue', 'function f(x) { let sum = 0; for (let i = 0; i < 5; i++) { try { if (i === 1) { continue; } if (i === 3) { break; } sum += i; } finally { sum += 10; } } return sum; }', [0]],
  ['finally outer loop remains active', 'function f(x) { let y = 0; try { for (let i = 0; i < 5; i++) { if (i === 2) { break; } y++; } y += 10; } finally { y *= 2; } return y; }', [0]],
  ['finally lexical environment', 'function f(x) { let y = x; try { let y = 99; return y; } finally { y += 1; } }', [0]],
  ['finally catch return', 'function f(x) { let y = 0; function g() { try { throw x; } catch (e) { return e; } finally { y = 5; } } const r = g(); return r + y; }', [0, 1]],
];
export async function runControlConformance(vm, signal) {
  let checked = 0;
  for (const [name, source, inputs] of controlCases) {
    const native = new Function(`return (${source})`)();
    const result = await vm.run(vm.compile(source), inputs, { signal, budget: 11 });
    inputs.forEach((value, i) => { if (!Object.is(result.values[i], native(value))) throw new Error(`Control mismatch: ${name}, expected ${native(value)}, got ${result.values[i]}`); checked++; });
  }
  return { programs: controlCases.length, checked };
}
