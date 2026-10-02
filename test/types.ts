import { Lanes, type Kernel, type ProgramIR } from 'lanes-webgpu';
const lanes = await Lanes.create({ backend: 'cpu' });
const kernel: Kernel = lanes.compile(function transform(x) { return x + 1; }, { numericMode: 'i32' });
const ir: ProgramIR = kernel.ir;
const output: Int32Array = await kernel.run(new Int32Array([1]));
const batch = await lanes.batch(output);
await batch.run(kernel); await batch.dispose(); await lanes.dispose();
void ir;
// @ts-expect-error Explicit numeric semantics are mandatory.
lanes.compile('function f(x) { return x; }');
// @ts-expect-error Number arrays are not accepted as typed inputs.
kernel.run([1, 2]);

// The experimental VM is a separate API with ordinary Number semantics.
import { JavaScriptVM, type Primitive } from 'lanes-webgpu/experimental/vm';
const vm = await JavaScriptVM.create({ backend: 'cpu' });
const vp = vm.compile('function f(x) { return x + 0.1; }');
const vr = await vm.run(vp, [0, true, null, undefined]);
const vv: Primitive | undefined = vr.values[0];
void vv;
const vj = await vm.start(vp, new Float64Array([1]));
await vj.step(16);
await vj.dispose();
await vm.dispose();
