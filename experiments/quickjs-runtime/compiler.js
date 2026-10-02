import { entrySource, packProgram } from './program.js';
import { attachBootstrap, descriptorSource } from './bootstrap.js';
export async function createCompiler(options) {
  const { default: create } = await import('./generated/compiler.mjs');
  const module = await create(options);
  const compileRaw = source => JSON.parse(module.ccall('lanes_compile', 'string', ['string'], [source]));
  const bootstrap = compileRaw(descriptorSource);
  return Object.freeze({ compile(source) {
    const name = entrySource(source);
    return packProgram(attachBootstrap(compileRaw(source), bootstrap), name);
  } });
}
