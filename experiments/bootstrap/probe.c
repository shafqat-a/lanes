/* Experiment only: depends on the pinned QuickJS private bytecode layout.
 * Compile with the QuickJS source directory on the include path. */
#define DUMP_BYTECODE 0
#include "quickjs.c"

int main(int argc, char **argv) {
    if (argc != 2) return 2;
    JSRuntime *rt = JS_NewRuntime();
    JSContext *ctx = JS_NewContext(rt);
    /* Compile only. Neither the script nor the guest function executes here. */
    JSValue script = JS_Eval(ctx, argv[1], strlen(argv[1]), "probe.js",
                            JS_EVAL_TYPE_GLOBAL | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(script)) {
        JSValue err = JS_GetException(ctx);
        const char *message = JS_ToCString(ctx, err);
        fprintf(stderr, "%s\n", message);
        JS_FreeCString(ctx, message); JS_FreeValue(ctx, err);
        JS_FreeContext(ctx); JS_FreeRuntime(rt); return 1;
    }
    JSFunctionBytecode *outer = JS_VALUE_GET_PTR(script), *fn = NULL;
    for (int i = 0; i < outer->cpool_count; i++) {
        if (JS_VALUE_GET_TAG(outer->cpool[i]) == JS_TAG_FUNCTION_BYTECODE) {
            fn = JS_VALUE_GET_PTR(outer->cpool[i]); break;
        }
    }
    if (!fn) { fprintf(stderr, "No function bytecode\n"); return 1; }
    printf("{\"stackSize\":%d,\"locals\":%d,\"constants\":%d,\"bytes\":[",
           fn->stack_size, fn->var_count, fn->cpool_count);
    for (int i = 0; i < fn->byte_code_len; i++)
        printf("%s%u", i ? "," : "", fn->byte_code_buf[i]);
    printf("],\"instructions\":[");
    for (int pc = 0; pc < fn->byte_code_len;) {
        int op = fn->byte_code_buf[pc];
        const JSOpCode *info = &short_opcode_info(op);
        printf("%s{\"pc\":%d,\"opcode\":%d,\"name\":\"%s\",\"size\":%d}",
               pc ? "," : "", pc, op, info->name, info->size);
        pc += info->size;
    }
    puts("]}");
    JS_FreeValue(ctx, script); JS_FreeContext(ctx); JS_FreeRuntime(rt);
    return 0;
}
