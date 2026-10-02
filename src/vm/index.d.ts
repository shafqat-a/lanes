export type Primitive = number | boolean | null | undefined;
export interface Program {
  readonly source: string;
  readonly registers: number;
  readonly instructions: readonly number[];
  readonly constants: readonly Primitive[];
}
export interface Result {
  backend: 'gpu' | 'cpu';
  values: Primitive[];
  statuses: Uint32Array;
  steps: Uint32Array;
  done: boolean;
}
export interface Job {
  readonly backend: 'gpu' | 'cpu';
  step(budget?: number): Promise<Result>;
  dispose(): Promise<void>;
}
export declare const VM_STATUS: Readonly<{ RUNNING: 0; DONE: 1; INVALID: 2 }>;
export declare function compileVM(source: string | ((input: any) => any)): Program;
export declare class JavaScriptVM {
  private constructor();
  static create(options?: { backend?: 'auto' | 'cpu' | 'gpu'; gpu?: GPU | null; device?: GPUDevice }): Promise<JavaScriptVM>;
  readonly backend: 'gpu' | 'cpu';
  compile(source: string | ((input: any) => any)): Program;
  start(program: Program, inputs: Primitive[] | Float64Array): Promise<Job>;
  run(program: Program, inputs: Primitive[] | Float64Array, options?: { budget?: number; maxDispatches?: number; signal?: AbortSignal }): Promise<Result>;
  dispose(): Promise<void>;
}
