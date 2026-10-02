const unsupported = [
  'function f(x){return new Array(2147483648).length;}',
  'function f(x){return Array.from([x]).length;}',
  'function f(x){return Array.fromAsync([x]);}',
  'function f(x){function C(n){this.length=n;}return Array.of.call(C,x).length;}',
  'function f(x){return new Error("message",{get cause(){return x;}}).cause;}',
  'function f(x){return new Error(1.25).message;}',
  'function f(x){let arrow=()=>x;Object.defineProperty(arrow,"prototype",{get(){return Object.prototype;}});return {} instanceof arrow;}',
  'function f(x){function g(){} return g.caller;}',
  'function f(x){function g(){} return g.toString();}',
  'function f(x){function g(){return typeof this;}return g.call(1);}',
  'function f(x){function g(){}Object.defineProperty(g,"name",{get(){return "name";}});return g.bind(null).name;}',
  'function f(x){function g(){}Object.defineProperty(g,"length",{get(){return 1;}});return g.bind(null).name;}',
  'function f(x){function g(a){return a;}return g.apply(null,{get length(){return 1;},0:x});}',
  'function f(x){function g(a){return a;}return g.apply(null,{length:1,get 0(){return x;}});}',
];
export async function verifyDescriptorResumption(compiler, vm) {
  const program = compiler.compile(`function f(x) {
    let order = "";
    const target = {};
    Object.defineProperty(target, {toString() { order += "k"; return "v"; }}, {
      get enumerable() { order += "e"; return true; },
      get value() { order += "v"; return x; }
    });
    return order === "kev" && target.v === x;
  }`);
  const job = await vm.start(program, [17]);
  let dispatches = 0, result;
  try {
    do {
      result = await job.step(1);
      if (++dispatches > 2000) throw new Error('Descriptor resumption exceeded instruction bound');
    } while (!result.done);
    if (result.backend !== 'gpu' || result.values[0] !== true) throw new Error('Descriptor resumption mismatch');
    return dispatches;
  } finally { await job.dispose(); }
}
export async function verifyFailures(compiler, vm) {
  const cases = [
    ...unsupported.map(source => ({ source, inputs: [0], error: 'Unsupported' })),
    { source: 'function f(x){return x();}', inputs: [1], error: 'TypeError' },
    { source: 'function f(x){function g(){}return g.apply(null,{length:17});}', inputs: [0], error: 'Resource' },
    { source: 'function f(x){return x+1;}', inputs: ['2'], error: 'Unsupported' },
    { source: 'function f(x){return x+x;}', inputs: ['a'.repeat(129)], error: 'Resource' },
    { source: 'function f(x){return f(x);}', inputs: [0], error: 'Resource' },
  ];
  for (const { source, inputs, error } of cases) {
    let failure;
    const program = compiler.compile(source);
    try { await vm.run(program, inputs); }
    catch (caught) { failure = caught; }
    if (!failure || !failure.message.includes(error))
      throw new Error(`Expected ${error} for ${source}; got ${failure?.message || 'successful execution'}`);
  }
  const rejectedSources = [
    'function f(x){return Math.sin(x);}',
    ...['__lanesCall', '__lanesDefine', '__lanesText', '__lanesDescriptor'].map(name => `function f(x){return ${name}(x);}`),
  ];
  for (const source of rejectedSources) {
    let failure;
    try { compiler.compile(source); }
    catch (caught) { failure = caught; }
    if (!failure?.message.includes('Unsupported')) throw new Error(`Unsupported source was admitted: ${source}`);
  }
  return cases.length + rejectedSources.length;
}
