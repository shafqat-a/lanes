export type Backend = 'auto' | 'cpu' | 'gpu';
export interface CompileOptions { numericMode: 'i32' }
export type ExpressionIR = Readonly<
  { kind: 'literal'; type: 'i32'; value: number } |
  { kind: 'local'; type: 'i32'; slot: number } |
  { kind: 'unary'; type: 'i32'; op: string; a: ExpressionIR } |
  { kind: 'binary'; type: 'i32'; op: string; a: ExpressionIR; b: ExpressionIR }
>;
export type StatementIR = Readonly<
  { kind: 'block'; body: readonly StatementIR[] } |
  { kind: 'assign'; slot: number; value: ExpressionIR } |
  { kind: 'if'; test: ExpressionIR; yes: StatementIR; no: StatementIR } |
  { kind: 'for'; slot: number; start: number; count: number; body: StatementIR }
>;
export interface ProgramIR {
  readonly version: string;
  readonly numericMode: 'i32';
  readonly type: 'i32 -> i32';
  readonly slots: number;
  readonly staticWork: number;
  readonly body: StatementIR;
  readonly result: ExpressionIR;
}
export interface Kernel {
  readonly wgsl: string;
  readonly ir: ProgramIR;
  run(inputs: Int32Array, options?: { backend?: Backend }): Promise<Int32Array>;
}
export interface Batch {
  readonly length: number;
  readonly backend: 'cpu' | 'gpu';
  upload(inputs: Int32Array): Promise<Batch>;
  /** Submit a transform. GPU output stays resident; use read() to await and retrieve it. */
  run(kernel: Kernel): Promise<Batch>;
  read(): Promise<Int32Array>;
  dispose(): Promise<void>;
}
export interface Diagnostics {
  readonly pipelineCompilations: number;
  readonly pipelineCacheHits: number;
  readonly cpuDispatches: number;
  readonly gpuDispatches: number;
  readonly fallbackReason: string | null;
  readonly disposed: boolean;
}
export class Lanes {
  private constructor();
  static create(options?: { backend?: Backend; device?: GPUDevice; gpu?: GPU }): Promise<Lanes>;
  readonly backend: 'cpu' | 'gpu';
  readonly diagnostics: Diagnostics;
  compile(source: string | ((x: number) => number), options: CompileOptions): Kernel;
  batch(inputs: Int32Array | number, options?: { backend?: Backend }): Promise<Batch>;
  dispose(): Promise<void>;
}
export class CompileError extends SyntaxError { readonly line?: number; readonly column?: number }
export const COMPILER_VERSION: string;
/** Legacy bytecode research API; supports a different subset from Lanes.compile(). */
export interface BytecodeProgram { readonly numericMode: 'i32'; readonly registers: number; readonly instructions: readonly number[] }
export interface ExecutionResult { values: Int32Array; statuses: Uint32Array }
export function compile(source: string, options: CompileOptions): BytecodeProgram;
export function runCPU(program: BytecodeProgram, inputs: Int32Array, options?: { budget?: number }): ExecutionResult;
export function createGPU(device: GPUDevice): Promise<{ run(program: BytecodeProgram, inputs: Int32Array, options?: { budget?: number }): Promise<ExecutionResult> }>;
export const STATUS: Readonly<{ DONE: 1; BUDGET: 2; INVALID: 3 }>;
