/* Compiler-only bridge. QuickJS internals are pinned; no guest JS executes. */
#define DUMP_BYTECODE 0
#include "quickjs.c"
#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif
#define REVISION "535a7c250ff4a577ec36c3e103daab6dadeea650"
#define MAX_FUNCTIONS 512
static DynBuf output;
static JSFunctionBytecode *functions[MAX_FUNCTIONS];
static int function_count;
static int add_function(JSFunctionBytecode *b) {
    for (int i = 0; i < function_count; i++) if (functions[i] == b) return i;
    if (function_count == MAX_FUNCTIONS) return -1;
    functions[function_count] = b; return function_count++;
}
static void json_string(JSContext *ctx, JSValueConst value) {
    JSString *s = JS_VALUE_GET_STRING(value);
    dbuf_putc(&output, '"');
    for (int i = 0; i < s->len; i++) {
        unsigned c = s->is_wide_char ? s->u.str16[i] : s->u.str8[i];
        dbuf_printf(&output, "\\u%04x", c);
    }
    dbuf_putc(&output, '"');
}
static void atom(JSContext *ctx, JSAtom a) {
    JSValue v = JS_AtomToString(ctx, a); json_string(ctx, v); JS_FreeValue(ctx, v);
}
static void number_value(JSContext *ctx, JSValueConst v) {
    double d; uint64_t bits; JS_ToFloat64(ctx, &d, v); memcpy(&bits, &d, 8);
    dbuf_printf(&output, "{\"number\":[%u,%u]}", (unsigned)bits, (unsigned)(bits >> 32));
}
EMSCRIPTEN_KEEPALIVE const char *lanes_compile(const char *source) {
    dbuf_free(&output); dbuf_init(&output); function_count = 0;
    JSRuntime *rt = JS_NewRuntime();
    if (!rt) return "{\"error\":\"Runtime allocation failed\"}";
    JS_SetMemoryLimit(rt, 64 * 1024 * 1024); JS_SetMaxStackSize(rt, 512 * 1024);
    JSContext *ctx = JS_NewContext(rt);
    if (!ctx) { JS_FreeRuntime(rt); return "{\"error\":\"Context allocation failed\"}"; }
    JSValue compiled = JS_Eval(ctx, source, strlen(source), "lanes.js", JS_EVAL_TYPE_GLOBAL | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(compiled)) {
        JSValue error = JS_GetException(ctx), message = JS_ToString(ctx, error);
        dbuf_putstr(&output, "{\"error\":"); json_string(ctx, message); dbuf_putc(&output, '}');
        JS_FreeValue(ctx, message); JS_FreeValue(ctx, error); goto done;
    }
    JSFunctionBytecode *outer = JS_VALUE_GET_PTR(compiled);
    for (int i = 0; i < outer->cpool_count; i++) {
        if (JS_VALUE_GET_TAG(outer->cpool[i]) == JS_TAG_FUNCTION_BYTECODE) {
            add_function(JS_VALUE_GET_PTR(outer->cpool[i])); break;
        }
    }
    if (!function_count) { dbuf_putstr(&output, "{\"error\":\"Expected a function\"}"); goto done; }
    for (int i = 0; i < function_count; i++) {
        JSFunctionBytecode *b = functions[i];
        for (int k = 0; k < b->cpool_count; k++)
            if (JS_VALUE_GET_TAG(b->cpool[k]) == JS_TAG_FUNCTION_BYTECODE && add_function(JS_VALUE_GET_PTR(b->cpool[k])) < 0) {
                dbuf_putstr(&output, "{\"error\":\"Function limit exceeded\"}"); goto done;
            }
    }
    dbuf_printf(&output, "{\"format\":1,\"quickjs\":\"%s\",\"functions\":[", REVISION);
    for (int f = 0; f < function_count; f++) {
        JSFunctionBytecode *b = functions[f];
        dbuf_printf(&output, "%s{\"name\":", f ? "," : "");
        atom(ctx, b->func_name ? b->func_name : JS_ATOM_empty_string);
        dbuf_printf(&output, ",\"args\":%u,\"length\":%u,\"hasPrototype\":%u,\"locals\":%u,\"stack\":%u,\"strict\":%u,\"kind\":%u,\"refs\":[",
            b->arg_count, b->defined_arg_count, b->has_prototype, b->var_count, b->stack_size, !!(b->js_mode & JS_MODE_STRICT), b->func_kind);
        for (int i = 0; i < b->closure_var_count; i++) {
            JSClosureVar *v = &b->closure_var[i];
            dbuf_printf(&output, "%s{\"type\":%u,\"index\":%u,\"name\":", i ? "," : "", v->closure_type, v->var_idx);
            atom(ctx, v->var_name); dbuf_putc(&output, '}');
        }
        dbuf_putstr(&output, "],\"constants\":[");
        for (int i = 0; i < b->cpool_count; i++) {
            if (i) dbuf_putc(&output, ',');
            JSValue v = b->cpool[i];
            if (JS_VALUE_GET_TAG(v) == JS_TAG_FUNCTION_BYTECODE) dbuf_printf(&output, "{\"function\":%d}", add_function(JS_VALUE_GET_PTR(v)));
            else if (JS_IsNumber(v)) number_value(ctx, v);
            else if (JS_IsString(v)) { dbuf_putstr(&output, "{\"string\":"); json_string(ctx, v); dbuf_putc(&output, '}'); }
            else dbuf_putstr(&output, "{\"unsupported\":true}");
        }
        dbuf_putstr(&output, "],\"instructions\":[");
        for (int pc = 0; pc < b->byte_code_len;) {
            const uint8_t *p = b->byte_code_buf + pc;
            const JSOpCode *info = &short_opcode_info(*p);
            dbuf_printf(&output, "%s{\"pc\":%d,\"op\":\"%s\",\"size\":%u,\"pop\":%u,\"push\":%u,\"operand\":",
                pc ? "," : "", pc, info->name, info->size, info->n_pop, info->n_push);
            switch (info->fmt) {
              case OP_FMT_atom: case OP_FMT_atom_u8: case OP_FMT_atom_u16:
                atom(ctx, get_u32(p + 1)); break;
              case OP_FMT_i8: dbuf_printf(&output, "%d", (int8_t)p[1]); break;
              case OP_FMT_i16: dbuf_printf(&output, "%d", (int16_t)get_u16(p + 1)); break;
              case OP_FMT_i32: dbuf_printf(&output, "%d", (int32_t)get_u32(p + 1)); break;
              case OP_FMT_label8: dbuf_printf(&output, "%d", pc + 1 + (int8_t)p[1]); break;
              case OP_FMT_label16: dbuf_printf(&output, "%d", pc + 1 + (int16_t)get_u16(p + 1)); break;
              case OP_FMT_label: dbuf_printf(&output, "%d", pc + 1 + (int32_t)get_u32(p + 1)); break;
              default:
                dbuf_printf(&output, "%u", info->size == 2 ? p[1] : info->size == 3 ? get_u16(p + 1) : info->size == 5 ? get_u32(p + 1) : 0); break;
            }
            dbuf_putstr(&output, ",\"bytes\":[");
            for (int j = 0; j < info->size; j++) dbuf_printf(&output, "%s%u", j ? "," : "", p[j]);
            dbuf_putstr(&output, "]}"); pc += info->size;
        }
        dbuf_putstr(&output, "]}");
    }
    dbuf_putstr(&output, "]}");
done:
    JS_FreeValue(ctx, compiled); JS_FreeContext(ctx); JS_FreeRuntime(rt);
    if (dbuf_error(&output)) { dbuf_free(&output); return "{\"error\":\"Export allocation failed\"}"; }
    dbuf_putc(&output, 0); return (const char *)output.buf;
}
#ifndef __EMSCRIPTEN__
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    puts(lanes_compile(argv[1])); dbuf_free(&output); return 0;
}
#endif
