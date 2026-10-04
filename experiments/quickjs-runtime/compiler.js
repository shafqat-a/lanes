import { entrySource, scriptSource, packProgram } from './program.js';
import { attachBootstrap, bootstrapSources } from './bootstrap.js';
export async function createCompiler(options) {
  const { default: create } = await import('./generated/compiler.mjs');
  const module = await create(options);
  return compilerForModule(module);
}
// Also accepts an independently built compiler module for ABI/parity checks.
export function compilerForModule(module) {
  const compileRaw = source => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [source]));
  const bootstrap = Object.fromEntries(Object.entries(bootstrapSources).map(([field, source]) => [field, compileRaw(source)]));
  return Object.freeze({ compile(source) {
    const name = entrySource(source);
    return packProgram(attachBootstrap(compileRaw(source), bootstrap), name);
  }, compileScript(source) {
    const name=scriptSource(source);
    if(typeof module._lanes_compile_script!=='function')throw new Error('Rebuild compiler: Script entry ABI is missing');
    const raw=JSON.parse(module.ccall('lanes_compile_script','string',['string'],[source]));
    if(raw.entryKind!=='script'&&!raw.error)throw new Error('Invalid Script compiler entry');
    return packProgram(attachBootstrap(raw,bootstrap),name);
  } });
}
