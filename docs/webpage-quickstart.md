# Run Lanes from a webpage

Use the experimental QuickJS/WGSL runtime for the implemented JavaScript subset. The normal webpage runs in the browser; source passed to `compiler.compile()` or `compileScript()` runs on the GPU after CPU compilation. It does not move your existing webpage, DOM, or arbitrary scripts to the GPU automatically.

Target: Apple M1 with Safari 26.4. Serve over **localhost or HTTPS**, not file://. Initial GPU pipeline compilation can take around 40 seconds or longer. See the [support table](ecmascript-2025.md) before choosing a workload.

## Fastest route: prebuilt webpage kit

1. Download `lanes-webpage-0.2.0-alpha.1.tar.gz` from the [GitHub prerelease](https://github.com/shafqat-a/lanes/releases/tag/v0.2.0-alpha.1).
2. Extract into an empty directory and run:

   ```sh
   python3 -m http.server 4178 --bind 127.0.0.1
   ```

3. Open `http://localhost:4178/web-example.html` in Safari and click **Run GPU example**.

Expected values: `[3, 5, 7, 9]` from four independent function invocations, and `[42]` from a Script. This kit includes `lanes-quickjs.js`, `compiler.wasm`, and the runnable HTML page. Keep the JavaScript and Wasm files in the same directory. When deploying, configure `.wasm` as `application/wasm` and use same-origin URLs.

The npm-format `lanes-webgpu` release asset contains the older numeric JIT/VM APIs; it does not export this experimental full-engine API.

## Minimal page

Place this HTML beside the kit's `lanes-quickjs.js` and `compiler.wasm`, then serve it:

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>Lanes GPU example</title>
<pre id="output">Compiling GPU pipelines…</pre>
<script type="module">
import { createCompiler, QuickJSGPU } from './lanes-quickjs.js';
const output = document.querySelector('#output');
let vm;
try {
  if (!navigator.gpu) throw new Error('WebGPU is unavailable');
  const compiler = await createCompiler();
  vm = await QuickJSGPU.create();
  const program = compiler.compile(`function transform(x) {
    const record = { value: x * 2 };
    function addOne(value) { return value + 1; }
    return addOne(record.value);
  }`);
  const result = await vm.run(program, [1, 2, 3, 4], { budget: 4096 });
  output.textContent = JSON.stringify(result.values); // [3,5,7,9]
} catch (error) {
  output.textContent = `${error.name}: ${error.message}`;
} finally {
  if (vm) await vm.dispose();
}
</script>
</html>
```

The input array selects independent lanes: each element is the entry function's input in its own invocation. Objects and closures can exist inside guest execution; the public input/output boundary is limited to supported primitives. Page variables are not captured by the source string. Use DOM APIs in the host page to display the returned values.

For repeated work, retain the compiler and runtime, compile each source once, and call `vm.run()` for subsequent batches. Call `dispose()` when finished; recreating the runtime repeatedly incurs initialization overhead.

## Run a Script

Using the same initialized compiler and runtime:

```js
const program = compiler.compileScript('const answer = 6 * 7; answer;');
const result = await vm.run(program, [undefined], { budget: 4096 });
console.log(result.values); // [42]
```

`[undefined]` requests one lane. The result is the Script completion value. Each lane/run has a fresh realm; bindings do not persist into another Script execution. Guest imports, eval, Function constructors, document and fetch are not supported.

## Build the webpage kit from source

Node.js 22+ and Emscripten **4.0.22** are required. With Emscripten activated:

```sh
git clone https://github.com/shafqat-a/lanes.git
cd lanes
npm ci
EMCC=emcc node experiments/quickjs-runtime/build.mjs --wasm
node experiments/quickjs-runtime/build-web-api.mjs
cd experiments/quickjs-runtime/generated
python3 -m http.server 4178 --bind 127.0.0.1
```

Open `http://localhost:4178/web-example.html`. Deploy `lanes-quickjs.js`, `compiler.wasm`, and your HTML together. The experimental API may change between alpha releases.

## Errors and limits

Compilation rejects unsupported syntax or features. GPU failures, execution limits, and unsupported runtime operations reject the call; they do not execute the program on CPU. The new runtime has no automatic CPU backend when WebGPU is absent. A WebGPU property alone does not guarantee an available adapter; creation errors are caught by the example.

For long work, `run()` accepts `budget` (instructions per dispatch, up to 4096), `maxDispatches`, and an AbortSignal. The lower-level `start()` / `step()` API supports explicit resumption. Current heap/string/frame limits and the full feature gaps are listed in the [release notes](releases/v0.2.0-alpha.1.md).
