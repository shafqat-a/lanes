import { parse } from 'acorn';
import { privateBuiltins } from './bootstrap.js';
export const REVISION = '535a7c250ff4a577ec36c3e103daab6dadeea650';
export const OP = Object.freeze(Object.fromEntries([
  'push', 'closure', 'object', 'drop', 'dup', 'dup1', 'dup2', 'swap', 'nip', 'insert2', 'insert3', 'perm3', 'rot3l', 'rot3r',
  'get_arg', 'put_arg', 'set_arg', 'get_loc', 'put_loc', 'set_loc', 'set_loc_uninitialized', 'get_loc_check', 'put_loc_check', 'set_loc_check', 'put_loc_check_init',
  'get_var_ref', 'put_var_ref', 'set_var_ref', 'get_var_ref_check', 'put_var_ref_check', 'put_var_ref_check_init',
  'get_field', 'get_field2', 'put_field', 'define_field', 'get_array_el', 'get_array_el2', 'put_array_el',
  'call', 'tail_call', 'call_method', 'tail_call_method', 'return', 'return_undef', 'push_this',
  'add', 'sub', 'mul', 'div', 'mod', 'neg', 'plus', 'inc', 'dec', 'post_inc', 'post_dec', 'inc_loc', 'dec_loc', 'add_loc',
  'lt', 'lte', 'gt', 'gte', 'strict_eq', 'strict_neq', 'eq', 'neq', 'and', 'or', 'xor', 'shl', 'sar', 'shr', 'not', 'lnot',
  'goto', 'if_true', 'if_false', 'nop', 'throw', 'array_from', 'get_length', 'is_undefined', 'is_null', 'is_undefined_or_null',
  'close_loc', 'set_proto', 'catch', 'gosub', 'ret', 'nip_catch', 'throw_error', 'nip1',
  'define_getter', 'define_setter',
  'delete', 'in', 'typeof', 'typeof_is_function', 'typeof_is_undefined', 'set_name', 'set_name_computed', 'to_propkey', 'define_array_el', 'define_method_computed', 'call_constructor', 'instanceof', 'special_object',
].map((name, i) => [name, i])));
export const LIMITS = Object.freeze({ frames: 32, stack: 256, heap: 2048, args: 16, locals: 64, refs: 64 });
const objectBuiltins = ['constructor','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','toLocaleString','toString','valueOf','__proto__','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__'];
const arrayBuiltins = ['at','concat','copyWithin','entries','every','fill','filter','find','findIndex','findLast','findLastIndex','flat','flatMap','forEach','includes','indexOf','join','keys','lastIndexOf','map','pop','push','reduce','reduceRight','reverse','shift','slice','some','sort','splice','toReversed','toSorted','toSpliced','unshift','values','with','toString','toLocaleString'];
export const FIELDS = Object.freeze(Object.fromEntries(['prototype','defineProperty','getOwnPropertyDescriptor','create','getPrototypeOf','setPrototypeOf','is','hasOwn','preventExtensions','isExtensible','value','writable','get','set','enumerable','configurable','length','name','Object','__proto__','constructor','call','apply','bind','toString','caller','arguments','[object Undefined]','[object Null]','[object Boolean]','[object Number]','[object String]','[object Object]','[object Array]','[object Function]','[object Error]','','Function','bound ','Error','TypeError','ReferenceError','RangeError','SyntaxError','URIError','EvalError','message','cause',': ','true','false','null','undefined','NaN','Infinity','-Infinity','-','Invalid operation','Invalid reference','Invalid array length','Array','isArray','of','from','fromAsync','callee','[object Arguments]'].map((n,i)=>[n,i])));
const valid = new WeakSet();
export function checkProgram(program) { if (!valid.has(program)) throw new TypeError('Expected a compiled QuickJS GPU program'); }
export function numberWords(n, tag = 0) {
  const a = new Uint32Array(4); new DataView(a.buffer).setFloat64(0, n, true); a[2] = tag; return [...a];
}
export function entrySource(source) {
  if (typeof source !== 'string' || source.length > 1000000) throw new TypeError('Expected function source, at most 1 MB');
  const ast = parse(source, { ecmaVersion: 2025 });
  const fn = ast.body[0];
  if (ast.body.length !== 1 || fn.type !== 'FunctionDeclaration' || !fn.id || fn.async || fn.generator)
    throw new SyntaxError('Expected one synchronous named function declaration');
  return fn.id.name;
}
export function packProgram(raw, name) {
  if (raw.error) throw new SyntaxError(raw.error);
  if (raw.format !== 1 || raw.quickjs !== REVISION) throw new Error('QuickJS bridge revision mismatch');
  const functions = raw.functions, image = functions.flatMap(() => [[0, 0, 0, 0], [0, 0, 0, 0]]), code = [], strings = new Map();
  const add = value => { image.push(value); return image.length - 1; };
  const text = value => {
    if (value.length > 256) throw new RangeError('GPU string limit: 256 UTF-16 code units');
    if (strings.has(value)) return strings.get(value);
    const offset = image.length;
    for (let i = 0; i < value.length; i++) add([value.charCodeAt(i), 0, 0, 0]);
    const index = add([offset, value.length, 7, image.length]); strings.set(value, index); return index;
  };
  const typeNames = ['number', 'boolean', 'object', 'undefined', 'function', 'string'].map(text);
  const builtins = [...objectBuiltins.map((s,i) => [text(s), 1, i===0?100:150+i, 0]), ...arrayBuiltins.map((s,i) => [text(s), 2, 300+i, 0])];
  const fieldKeys = Object.keys(FIELDS).map(s=>text(s));
  const typeTable = add(typeNames.slice(0, 4)); add([...typeNames.slice(4), builtins.length, 0]);
  builtins.forEach(add);
  image[typeTable+1][3]=image.length;fieldKeys.forEach(k=>add([k,0,0,0]));
  if (raw.descriptorBootstrap !== undefined) image[image[typeTable+1][3]+FIELDS.defineProperty][1]=raw.descriptorBootstrap+1;
  const entry = []; let count = 0;
  for (const fn of functions) { entry.push(count); count += fn.instructions.length; }
  for (const [f, fn] of functions.entries()) {
    if (fn.args > LIMITS.args || fn.locals > LIMITS.locals || fn.refs.length > LIMITS.refs || fn.stack > LIMITS.stack || fn.kind !== 0)
      throw new RangeError('QuickJS function exceeds GPU limits or uses a generator/async kind');
    const refOffset = image.length;
    const root = f === 0 || fn.intrinsicRoot === true;
    for (const ref of fn.refs) {
      if(root && ref.name===(f===0?name:fn.name)){add([3,ref.index,0,0]);continue;}
      if(fn.intrinsicRoot && Object.hasOwn(privateBuiltins,ref.name)){add([4,privateBuiltins[ref.name],0,0]);continue;}
      const errorType = ['Error','TypeError','ReferenceError','RangeError','SyntaxError','URIError','EvalError'].indexOf(ref.name);
      if(root && errorType>=0){add([4,600+errorType,0,0]);continue;}
      if(root && ref.name==='Array'){add([4,200,0,0]);continue;}
      if(root && ref.name==='Function'){add([4,500,0,0]);continue;}
      if(root && ref.name==='Object'){add([4,100,0,0]);continue;}
      if(root && ['NaN','Infinity','undefined'].includes(ref.name)) {
        const value=ref.name==='undefined'?[0,0x7ff80000,3,0]:numberWords(ref.name==='NaN'?NaN:Infinity);
        // A literal global is stored directly in the capture specification.
        add([5,value[0],value[1],value[2]]);continue;
      }
      if (ref.type > 2 && !(!root && ref.type === 3)) throw new SyntaxError(`Unsupported global or module reference: ${ref.name}`);
      add([!root && ref.type === 3 ? 2 : ref.type, ref.index, 0, 0]);
    }
    if (fn.hasPrototype !== 0 && fn.hasPrototype !== 1) throw new Error('Rebuild the compiler bridge: function prototype metadata is missing');
    image[f * 2] = [entry[f], fn.args, fn.locals, fn.refs.length | (fn.hasPrototype << 16)];
    if (typeof fn.name !== 'string') throw new Error('Rebuild the compiler bridge: function name metadata is missing');
    image[f * 2 + 1] = [refOffset, fn.strict, fn.length, text(fn.name)];
    const constants = fn.constants.map(c => {
      if ('function' in c) return { function: c.function };
      if (c.number) return { literal: add([...c.number, 0, 0]) };
      if ('string' in c) return { literal: text(c.string) };
      throw new SyntaxError('Unsupported QuickJS constant type');
    });
    const positions = new Map(fn.instructions.map((i, j) => [i.pc, entry[f] + j]));
    for (const instruction of fn.instructions) {
      let { op, operand: a } = instruction, b = 0;
      if (op === 'get_var' || op === 'get_var_undef') op = 'get_var_ref';
      if (op === 'put_var') op = 'put_var_ref';
      if (op === 'get_length') { op = 'get_field'; a = 'length'; }
      if (/^(get_loc|put_loc|set_loc)8$/.test(op)) op = op.slice(0, -1);
      const suffix = /^(get_loc|put_loc|set_loc|get_arg|put_arg|set_arg|get_var_ref|put_var_ref|set_var_ref|call)([0-3])$/.exec(op);
      if (suffix) { op = suffix[1]; a = Number(suffix[2]); }
      if (op === 'push_minus1' || /^push_[0-7]$/.test(op)) { a = add(numberWords(op === 'push_minus1' ? -1 : Number(op.slice(5)))); op = 'push'; }
      if (['push_i8', 'push_i16', 'push_i32'].includes(op)) { a = add(numberWords(a)); op = 'push'; }
      if (['push_const', 'push_const8'].includes(op)) { a = constants[a]?.literal; op = 'push'; }
      if (['fclosure', 'fclosure8'].includes(op)) { a = constants[a]?.function; op = 'closure'; }
      if (['undefined', 'null', 'push_true', 'push_false'].includes(op)) {
        a = add(op === 'undefined' ? [0, 0x7ff80000, 3, 0] : op === 'null' ? [0, 0, 2, 0] : numberWords(op === 'push_true' ? 1 : 0, 1)); op = 'push';
      }
      if (op === 'push_atom_value') { a = text(a); op = 'push'; }
      if (op === 'push_empty_string') { a = text(''); op = 'push'; }
      if (['get_field', 'get_field2', 'put_field', 'define_field', 'set_name'].includes(op)) a = text(a);
      if (op === 'define_method') {
        const kind = instruction.bytes[5] & 3;
        if (kind > 2) throw new SyntaxError('Invalid method kind');
        b = text((kind === 1 ? 'get ' : kind === 2 ? 'set ' : '') + a);
        a = text(a); op = ['define_field', 'define_getter', 'define_setter'][kind];
      }
      if (op === 'define_method_computed') {
        const kind = a & 3;
        if (kind > 2) throw new SyntaxError('Invalid computed method kind');
        b = kind ? text(kind === 1 ? 'get ' : 'set ') : 0;
        a = kind;
      }
      // Home-object access remains unsupported; this does not alter stack shape.
      if (['set_home_object', 'nop'].includes(op)) { op = 'nop'; a = 0; }
      if (op === 'throw_error') { a = instruction.bytes[5]; }
      if (/^(if_true|if_false|goto)(8|16)?$/.test(op)) {
        op = op.replace(/8|16/g, ''); a = positions.get(a);
        if (a === undefined) throw new SyntaxError('Invalid QuickJS branch target');
      }
      if (op === 'catch' || op === 'gosub') {
        a = positions.get(a); if (a === undefined) throw new SyntaxError('Invalid QuickJS exception target');
      }
      if (op === 'special_object' && a !== 0 && a !== 1 && a !== 2) throw new SyntaxError(`Unsupported QuickJS special object: ${a}`);
      if (!(op in OP)) throw new SyntaxError(`Unsupported QuickJS instruction: ${op}`);
      if (!Number.isInteger(a)) throw new SyntaxError(`Invalid operand for ${op}`);
      code.push([OP[op], a >>> 0, b, f]);
    }
  }
  const program = Object.freeze({ code: new Uint32Array(code.flat()), image: new Uint32Array(image.flat()), raw, name, functions: functions.length, typeTable });
  valid.add(program); return program;
}
