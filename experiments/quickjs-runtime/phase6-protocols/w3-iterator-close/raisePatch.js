// Replacement for shader.js `fn raise`. Paste this string into the shader
// template (the `${L.stack...}` placeholders must be interpolated there, not
// here). Continuation 80 is a finish() arm, not a call inside raise: WGSL
// has no recursion, and raise must not call raise.
import { CLOSE_THROW_ID, CONTINUATION_CLOSE_THROW, CONTINUATION_CLOSE_THROW_RESERVED } from './index.js';

const STACK_SCAN = '${L.stack+L.frames}';
const STACK_LIM = '${L.stack}';

export { CONTINUATION_CLOSE_THROW, CONTINUATION_CLOSE_THROW_RESERVED };

// Full function. The extra branch is the tag-9 y==1 arm; the tail-40 arm and
// the epilogue are required with it (locals, loop condition, suspend).
export const raiseIteratorCloseWGSL = `fn raise(l:u32,error:V) {
  // suspendClose stops the scan. Heap kind 50 is unused: the error is frame.receiver.
  var depth=states[l].depth;var sp=states[l].sp;var found=false;var destination=0u;var suspendClose=false;var closeRecordIndex=0u;
  for(var i=0u;i<${STACK_SCAN}u && !found && !suspendClose && (sp>states[l].frames[depth].base || depth>0u);i++) {
    if(sp>states[l].frames[depth].base) {
      sp--;let value=states[l].stack[sp];
      // Iterator marker V(0,1,9,0). After this decrement, sp is the marker slot,
      // next is stack[sp-1], record is stack[sp-2] (for_of_start order).
      if(value.z==9u&&value.y==1u){
        if(sp>=states[l].frames[depth].base+2u){
          let record=states[l].stack[sp-2u];
          // Tag 3 (undefined): normal exhaustion or a step throw already cleared
          // the slot. Ignore the marker and keep scanning. Any other non-object
          // is not a live record. Tag 4 suspends and closes.
          if(record.z==4u){suspendClose=true;closeRecordIndex=sp-2u;}
        }
      }else{found=value.z==9u&&value.y==0u;destination=value.x;}
    }else{
      // Frame pop runs only once this frame's operands are exhausted, and it
      // runs before the parent frame's operands (the marker below a step call).
      // Tail 40 is for_of_next's step frame. js_for_of_next stores undefined
      // over the record when next throws, so return must not run. The error
      // argument is not the frame receiver (that receiver is the record index).
      if(states[l].frames[depth].tail==40u){
        let recordIndex=states[l].frames[depth].receiver.x;
        if(recordIndex<sp){states[l].stack[recordIndex]=undef();}
      }
      depth--;
    }
  }
  states[l].depth=depth;states[l].sp=sp;states[l].env=states[l].frames[depth].env;
  if(suspendClose){
    let record=states[l].stack[closeRecordIndex];
    if(states[l].sp+3u>${STACK_LIM}u){states[l].status=3u;}
    else{
      // 2440 returns the original error. Do not call 1272: its return value is
      // undefined, and continuation 80 re-raises \`returned\`.
      push(l,V(${CLOSE_THROW_ID}u,0u,11u,0u));push(l,record);push(l,error);
      let callDepth=states[l].depth;call(l,2u,false,false);
      if(states[l].status==0u){
        if(states[l].depth>callDepth){
          states[l].frames[states[l].depth].tail=${CONTINUATION_CLOSE_THROW}u;
          states[l].frames[states[l].depth].receiver=error;
        }else{let ignored=pop(l);states[l].result=error;states[l].status=7u;}
      }
    }
  }else if(found){states[l].pc=destination;states[l].status=0u;push(l,error);}
  else{states[l].result=error;states[l].status=7u;}
}`;

// Insert in finish() immediately before \`else if(!omitResult)\`.
// \`returned\` is the helper result (the original error). Not \`constructed\`.
export const continuationCloseThrowWGSL = `else if(continuation==${CONTINUATION_CLOSE_THROW}u){raise(l,returned);}`;

export const NOTES = `Splice shader.js:
1. Replace fn raise (the function before fn truncatePositive) with raiseIteratorCloseWGSL.
   The string still contains \${L.stack+L.frames} and \${L.stack}; it must be pasted
   inside shader.js's template literal so those interpolate. Do not eval them here.
2. In finish(), before else if(!omitResult), insert continuationCloseThrowWGSL.
   Continuation ${CONTINUATION_CLOSE_THROW_RESERVED} is reserved and has no arm.
3. Register ${CLOSE_THROW_ID} as guest __lanesIteratorCloseThrow (iteratorCloseThrowSource).
   Replace the phase-4 iteratorClose source with iteratorCloseSource. Leave opcode
   iterator_close calling builtin 1272. Throw-unwind must call ${CLOSE_THROW_ID}, not 1272.

Stack (for_of_start after the open continuation returns; slot = the index saved
before the three pushes):
  stack[slot+0] record (tag 4 while live, tag 3 undefined when exhausted)
  stack[slot+1] next placeholder V(1274,0,11,0)
  stack[slot+2] marker V(0,1,9,0)
  sp = slot+3
raise consumes the marker with sp--, so the marker slot is sp, next is sp-1,
record is sp-2. The close call's frame.base is that marker slot: record and next
stay below sp for the whole helper call.

Body throw (no step frame): record is still tag 4. The y==1 arm suspends, pushes
(${CLOSE_THROW_ID}, record, error), sets the new frame tail to ${CONTINUATION_CLOSE_THROW} and
frame.receiver to the error, and does not keep scanning. Continuation
${CONTINUATION_CLOSE_THROW} is finish() → raise(l, returned), a later invocation, not a
recursive call. The resumed raise pops next then the record, then any outer catch.

Step throw (frame.tail == 40): call() set the step frame base to slot+3, above the
marker, and receiver to V(slot,0,0,0) (a raw index, not the error). throw pops the
thrown value and calls raise; it does not call finish, so continuation 40 does not
run and cannot replace the error with a step result. raise scans the helper's
operands first; with no leftover temps sp == frame.base, so the next action is the
frame pop. That pop clears stack[receiver.x] to undefined (js_for_of_next), then
decrements depth, then scans the parent. The marker at slot+2 is the first parent
operand. The record is now tag 3, so the marker is ignored and the original error
keeps unwinding. return is not called. The callee and argument slots sit at and
above the step base and are not scanned.

GC: markValue already traces every frame.receiver, and collect walks the stack for
i < sp. The error is rooted as the close frame's receiver (primitives need no root).
The record stays on the stack under the call (index < frame.base == sp) until
continuation ${CONTINUATION_CLOSE_THROW} re-enters raise and pops it. Kind 50 is unused; do not
allocate a close-state node. The argument cells also hold copies until finish pops
the close frame, which happens before continuation ${CONTINUATION_CLOSE_THROW} runs; the error
then lives in finish's \`returned\` local and raise's parameter (no GC mid-instruction).

Kind 1/2 records are still tag 4, so a body throw still calls ${CLOSE_THROW_ID}. The guest
no-op clears record.object and returns the original error. A sync 2440 (depth did
not increase) is a registration failure: the original error is published as status 7
instead of a native status 6. Stack overflow stays status 3.`;
