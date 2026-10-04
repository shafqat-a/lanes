// Phase 4 next wave (lead; assignments 2-5): class fields, static blocks and
// private names on top of the phase4-classes.js representation.
//
// Pinned QuickJS lowering (vendor/quickjs.c js_parse_class, emit_class_field_init):
//   Instance fields, private fields and the private-method brand live in one
//   synthetic method `<class_fields_init>` (fclosure; set_home_object; put_loc
//   <class_fields_init>), with [[HomeObject]] = prototype. Base constructors
//   call it right after check_ctor; derived constructors call it right after
//   super() initialises `this` (put_loc_check_init); default derived
//   constructors after init_ctor. It runs `this.<field> = ...` as
//     push_this ... <value> define_field atom                (public, named)
//     get_var_ref <computed_field>N <value> define_array_el  (public, computed:
//       the key was ToPropertyKey'd once by to_propkey at class definition)
//     get_var_ref #name <value> define_private_field         (private field)
//     get_loc <home> add_brand                               (private methods)
//   Static fields and static blocks form a second synthetic method with
//   [[HomeObject]] = constructor, called once (dup; fclosure; set_home_object;
//   call_method 0) after the inner class binding is initialised and before the
//   outer binding is written; each static block is an arrow-like closure called
//   with this = constructor. An abrupt completion leaves the outer binding in
//   its TDZ (ES2025 15.7.14 ClassDefinitionEvaluation steps 31-38).
//   Private names: `private_symbol "#x"` once per class evaluation, stored in a
//   compiler-synthesized local that guest code cannot name. Private methods
//   and accessors are ordinary closures in such locals (`#m`, `#a`, `#a<set>`);
//   accesses run `check_brand` against the closure's [[HomeObject]], and a
//   brand is added per instance (`add_brand this home`) and to the constructor
//   for static ones (`dup dup add_brand`). `dup null swap add_brand` (QuickJS
//   brand creation on the home object) is a no-op here: the home object node
//   id itself is the brand. Writes to a private method or getter-only accessor
//   compile to throw_error (TypeError).
//
// Representation (heap kinds 33-35 of the 32-39 wave reservation; no new value
// tags, builtin IDs, continuations or fixed nodes):
//   kind 33 private name: value=(description text image index,0,0,0). Pushed
//     as V(id,0,4,0). It flows through compiler-synthesized bindings and their
//     closure cells, generic stack shuffles (dup/swap/insert*/perm*/rot*), the
//     private opcodes below and set_name_computed (an anonymous function in a
//     private field initializer is named from the description, image[value.x]).
//     It is never a property key or a property value. Before its
//     private_symbol runs, the slot holds the TDZ marker (tag 6); flagged loads
//     (b=1) hand that marker to the private opcodes, where it names no element.
//   Private elements hang off the holder's value.y (kinds 2 ordinary/function
//     backing and 8 error objects, whose value.y was always 0). This includes
//     the fixed kind-2 intrinsic nodes (Object.prototype, Function.prototype,
//     the mapped constructors, Math, JSON), which can carry private elements
//     via a base-constructor return override; they are GC roots 1-25. Phase 3/6
//     must not reuse value.y of kinds 2/8 (e.g. for Proxy/Map/WeakMap):
//     kind 34 private field: value=field value, key=private name node id.
//     kind 35 brand: key=[[HomeObject]] node id (prototype, or the constructor's
//       kind-2 backing for static private methods).
//   They are never on the ordinary property list, so findProperty, own-keys,
//   for-in, JSON, freeze/seal and every other ordinary-key path cannot see or
//   alter them (private fields stay writable after Object.freeze; PrivateFieldAdd
//   and PrivateMethodOrAccessorAdd ignore [[Extensible]]).
//   GC: collect() marks a kind 2/8 holder's value.y chain; kind 34 marks its
//   value and its private-name node; kind 35 marks its brand home node (so a
//   collected home id can never be reused as a stale brand).
//   Objects of any other kind (arrays, arguments, wrappers, builtin functions)
//   can never hold private elements here: adding one (a base constructor that
//   returns such an object) is runtime status 6; lookups on them answer
//   correctly (absent: TypeError / false).

export const classElementOpcodes = Object.freeze([
  Object.freeze({ name: 'private_symbol', pop: 0, push: 1, note: '-> new private name; a=text(description)' }),
  Object.freeze({ name: 'get_private_field', pop: 2, push: 1, note: 'obj name -> value; TypeError if absent or obj is not an object' }),
  Object.freeze({ name: 'put_private_field', pop: 3, push: 0, note: 'obj value name -> ; TypeError if absent' }),
  Object.freeze({ name: 'define_private_field', pop: 3, push: 1, note: 'obj name value -> obj; TypeError if present (PrivateFieldAdd)' }),
  Object.freeze({ name: 'add_brand', pop: 2, push: 0, note: 'obj home -> ; no-op for a non-object obj; TypeError if the brand is present (PrivateMethodOrAccessorAdd)' }),
  Object.freeze({ name: 'check_brand', pop: 2, push: 2, note: 'obj fn -> obj fn; TypeError unless obj carries fn.[[HomeObject]] brand' }),
  Object.freeze({ name: 'private_in', pop: 2, push: 1, note: 'obj (name | method closure) -> bool; TypeError if obj is not an object' }),
]);
export const classElementOpcodeNames = Object.freeze(classElementOpcodes.map(item => item.name));

// packProgram hook (runs inside classProgramLowering).
export function classElementLowering(op, instruction, { text }) {
  if (op === 'private_symbol') {
    if (typeof instruction.operand !== 'string' || !instruction.operand.startsWith('#')) throw new SyntaxError('Invalid private_symbol operand');
    return { op, a: text(instruction.operand), b: 0 };
  }
  if (classElementOpcodeNames.includes(op)) return { op, a: 0, b: 0 };
  return null;
}

// Class syntax that stays compiler-rejected. Everything else in ES2025 class
// bodies (public/private, instance/static fields, computed field names, static
// blocks, private methods/accessors, static private methods, `#x in o`) is
// admitted and must execute exactly.
export function classElementRejectNode(node) {
  if (node.type === 'MethodDefinition' && node.value && node.value.async && node.value.generator)
    return 'Unsupported async generator class method';
  // Field initializers that are async/generator functions are ordinary values
  // of a different function kind; packProgram rejects their kind separately.
  return null;
}

// QuickJS reads private element slots with unchecked get_loc/get_var_ref. A
// slot is still in its TDZ when the read runs before the element definition
// (a computed key of the same class). The generic get case would turn a TDZ
// cell into a guest ReferenceError before privateNameOrAbsent / privateBrand
// see it, so packProgram flags such loads (b=1) and the get case pushes the
// TDZ cell for the private opcode to answer (TypeError / false). Relies on the
// vendor fix that makes setter-only `#x in o` load the `#x<set>` slot.
export const privateSlotConsumers = Object.freeze(['private_in', 'get_private_field', 'put_private_field', 'check_brand']);
export function privateSlotLoad(instructions, index) {
  const next = instructions.slice(index + 1, index + 4).map(i => i.op);
  // obj value <load #x<set>> swap rot3r check_brand: private setter write.
  return privateSlotConsumers.includes(next[0]) || (next[0] === 'swap' && next[1] === 'rot3r' && next[2] === 'check_brand');
}

export const classElementWGSLFunctions = ({ L }) => `
// Phase 4 next wave: private names (kind 33) and private elements (kinds 34
// field, 35 brand) chained from a kind 2/8 holder's value.y.
const PRIVATE_NO_STORAGE: u32 = 0xffffffffu;
fn privateName(l:u32,v:V)->u32 {
  if(v.z!=4u||states[l].heap[v.x].kind!=33u){states[l].status=2u;return 0u;}
  return v.x;
}
// A private-name slot read before its private_symbol ran (only possible from a
// computed key of the same class body, directly or through a closure it calls;
// static elements run after every element is defined) still holds the TDZ
// marker (tag 6), forwarded by a b=1 load (privateSlotLoad). No object can carry that name yet: key 0 matches no element, so
// get/put throw TypeError and private_in answers false (PrivateElementFind
// returns empty).
fn privateNameOrAbsent(l:u32,v:V)->u32 {
  if(v.z==6u){return 0u;}
  return privateName(l,v);
}
// 0: not an object (TypeError); PRIVATE_NO_STORAGE: an object that can never
// hold private elements; otherwise the holder node.
fn privateHolder(l:u32,v:V)->u32 {
  if(v.z!=4u&&v.z!=5u&&v.z!=11u){return 0u;}
  let obj=objectView(l,v);
  if(obj.z!=4u){return PRIVATE_NO_STORAGE;}
  let kind=states[l].heap[obj.x].kind;
  if(kind==2u||kind==8u){return obj.x;}
  return PRIVATE_NO_STORAGE;
}
fn privateFind(l:u32,holder:u32,key:u32,kind:u32)->u32 {
  if(holder==0u||holder==PRIVATE_NO_STORAGE||key==0u){return 0u;}
  var id=states[l].heap[holder].value.y;
  for(var i=0u;i<${L.heap}u&&id!=0u;i++){
    if(states[l].heap[id].kind==kind&&states[l].heap[id].key==key){return id;}
    id=states[l].heap[id].next;
  }
  return 0u;
}
fn privateAdd(l:u32,holder:u32,kind:u32,key:u32,value:V) {
  if(holder==PRIVATE_NO_STORAGE){states[l].status=6u;return;}
  if(privateFind(l,holder,key,kind)!=0u){states[l].status=4u;return;}
  let id=alloc(l,kind,value,key,states[l].heap[holder].value.y);
  if(states[l].status==0u){states[l].heap[holder].value.y=id;}
}
// Brand of a private method/accessor closure: its [[HomeObject]] node.
fn privateBrand(l:u32,fnValue:V)->u32 {
  if(fnValue.z!=5u||states[l].heap[fnValue.x].kind!=5u){states[l].status=4u;return 0u;}
  let home=states[l].heap[fnValue.x].value.z;
  if(home==0u){states[l].status=4u;}
  return home;
}
// CreateDataPropertyOrThrow for define_field / define_array_el (class fields
// and object/array literals). Existing configurable properties become
// writable/enumerable/configurable data; non-configurable ones throw.
fn defineOwnData(l:u32,original:V,key:u32,value:V) {
  if(!functionKey(l,original,key)){return;}
  let obj=objectView(l,original);
  if(obj.z!=4u){states[l].status=6u;return;}
  if(ownGap(l,obj.x,key)){return;}
  let kind=states[l].heap[obj.x].kind;
  // An Array's length is non-configurable, so CreateDataPropertyOrThrow(array,
  // "length", v) always rejects (ES2025 10.1.6.3 via 10.4.2.1) -> TypeError.
  if(kind==7u&&lengthKey(l,key)){states[l].status=4u;return;}
  if(stringOwn(l,obj.x,key)!=0u){states[l].status=4u;return;}
  let property=findProperty(l,obj.x,key);
  if(property!=0u){
    let node=states[l].heap[property];
    // Mapped arguments element (kind 15): the defined descriptor is writable,
    // so the mapping stays and the value is written through (ES2025 10.4.4.2).
    if(node.kind==15u){if((node.marked&8u)==0u){states[l].status=4u;return;}states[l].heap[node.value.x].value=value;states[l].heap[property].marked=14u;return;}
    if(node.kind!=3u&&node.kind!=9u){states[l].status=6u;return;}
    if((node.marked&8u)==0u){states[l].status=4u;return;}
    states[l].heap[property].kind=3u;states[l].heap[property].value=value;states[l].heap[property].marked=14u;
    return;
  }
  let ignored=putProperty(l,original,key,value,true);
}
`;

export const classElementWGSLCases = () => ({
  private_symbol: `let id=alloc(l,33u,V(arg,0u,0u,0u),0u,0u);if(states[l].status==0u){push(l,V(id,0u,4u,0u));}`,
  get_private_field: `let name=pop(l);let objValue=pop(l);let key=privateNameOrAbsent(l,name);if(states[l].status!=0u){break;}
        let found=privateFind(l,privateHolder(l,objValue),key,34u);
        if(found==0u){states[l].status=4u;break;}
        push(l,states[l].heap[found].value);`,
  put_private_field: `let name=pop(l);let value=pop(l);let objValue=pop(l);let key=privateNameOrAbsent(l,name);if(states[l].status!=0u){break;}
        let found=privateFind(l,privateHolder(l,objValue),key,34u);
        if(found==0u){states[l].status=4u;break;}
        states[l].heap[found].value=value;`,
  define_private_field: `let value=pop(l);let name=pop(l);let objValue=peek(l);let key=privateName(l,name);if(states[l].status!=0u){break;}
        let holder=privateHolder(l,objValue);if(holder==0u){states[l].status=4u;break;}
        privateAdd(l,holder,34u,key,value);`,
  add_brand: `let home=pop(l);let objValue=pop(l);let homeView=objectView(l,home);
        if(homeView.z!=4u){states[l].status=2u;break;}
        let holder=privateHolder(l,objValue);if(holder==0u){break;}
        privateAdd(l,holder,35u,homeView.x,undef());`,
  check_brand: `if(states[l].sp<2u){states[l].status=2u;break;}
        let brand=privateBrand(l,peek(l));if(states[l].status!=0u){break;}
        let holder=privateHolder(l,states[l].stack[states[l].sp-2u]);
        if(holder==0u||privateFind(l,holder,brand,35u)==0u){states[l].status=4u;}`,
  private_in: `let name=pop(l);let objValue=pop(l);let holder=privateHolder(l,objValue);
        if(holder==0u){states[l].status=4u;break;}
        var found=0u;
        if(name.z==5u){let brand=privateBrand(l,name);if(states[l].status!=0u){break;}found=privateFind(l,holder,brand,35u);}
        else{let key=privateNameOrAbsent(l,name);if(states[l].status!=0u){break;}found=privateFind(l,holder,key,34u);}
        push(l,boolean(found!=0u));`,
});

// Exact lead edits applied in this wave (recorded for review; already applied).
export const classElementShaderEdits = Object.freeze([
  { id: 'collect-private-elements', file: 'shader.js', why: 'GC: kind 2/8 holder value.y chain; kind 34 value + name; kind 35 brand home' },
  { id: 'define-field-create-data-property', file: 'shader.js', why: 'define_field / define_array_el use defineOwnData (CreateDataPropertyOrThrow)' },
]);

export const classElementNotes = Object.freeze({
  reservations: 'heap kinds 33 (private name), 34 (private field), 35 (brand). Builtin IDs 2020-2109 and continuations 58-65 reserved for assignments 2-5 remain unused.',
  symbolHooks: 'None required: private names are not Symbols (ES2025 6.2.12 Private Names). Phase 3 must keep tag-17 Symbol values out of the kind 33 path (privateName() rejects every non-kind-33 value with status 2; the private get/put/in opcodes go through privateNameOrAbsent, which additionally maps the TDZ marker (tag 6) to "no element"; tag-17 Symbols still give status 2).',
  gaps: [
    'Private elements on objects that are not ordinary/function/error objects (arrays, arguments, primitive wrappers, built-in functions other than the mapped constructors) added through a base-constructor return override: runtime status 6.',
    'Static public fields named "caller" or "arguments" on class constructors: runtime status 6 (functionKey legacy-property boundary).',
    'Class fields named "length" on an Array receiver (return override): status 6.',
    'Async/generator methods and async/generator field initializer values: compiler-rejected (Phase 6).',
    'Function.prototype.toString of classes/methods: not implemented.',
  ],
});
