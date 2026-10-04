import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
mkdirSync(`${root}/generated`, { recursive: true });
const wasm = process.argv.includes('--wasm');
const compiler = wasm ? (process.env.EMCC || 'emcc') : (process.env.CC || 'cc');
const args = ['-O2', '-D_GNU_SOURCE', '-DCONFIG_VERSION="lanes-pinned"', '-I', `${root}/vendor`, `${root}/bridge.c`,
  ...['dtoa', 'libregexp', 'libunicode', 'cutils'].map(n => `${root}/vendor/${n}.c`)];
if (wasm) args.push('-sMODULARIZE=1', '-sEXPORT_ES6=1', '-sENVIRONMENT=web,node', '-sALLOW_MEMORY_GROWTH=1', '-sSTACK_SIZE=1048576',
  '-sEXPORTED_FUNCTIONS=["_lanes_compile","_lanes_compile_script"]', '-sEXPORTED_RUNTIME_METHODS=["ccall"]', '-o', `${root}/generated/compiler.mjs`);
else args.push('-lm', '-lpthread', '-o', `${root}/generated/compiler`);
execFileSync(compiler, args, { stdio: 'inherit' });
