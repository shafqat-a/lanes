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
