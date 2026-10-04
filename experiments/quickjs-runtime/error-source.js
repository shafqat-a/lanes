// ES2025 Error constructors, InstallErrorCause and Error.prototype.toString.
// Number-to-string conversion still uses the explicitly bounded native subset.
export const textSource = `function textBootstrap(value) {
  return __lanesText(__lanesPrimitive(value, true));
}`;

export const errorSource = `function errorBootstrap(message, options, kind) {
  const error = __lanesError(undefined, undefined, kind);
  if (message !== undefined) {
    const text = __lanesToText(message);
    const desc = __lanesDescriptor();
    desc.value = text; desc.writable = true; desc.configurable = true;
    __lanesDefine(error, "message", desc);
  }
  if (options !== null && (typeof options === "object" || typeof options === "function") && "cause" in options) {
    const cause = options.cause;
    const desc = __lanesDescriptor();
    desc.value = cause; desc.writable = true; desc.configurable = true;
    __lanesDefine(error, "cause", desc);
  }
  return error;
}`;

export const errorTextSource = `function errorTextBootstrap() {
  "use strict";
  const error = this;
  if (error === null || (typeof error !== "object" && typeof error !== "function")) throw new TypeError("Invalid error receiver");
  const rawName = error.name;
  const name = rawName === undefined ? "Error" : __lanesToText(rawName);
  const rawMessage = error.message;
  const message = rawMessage === undefined ? "" : __lanesToText(rawMessage);
  if (name === "") return message;
  if (message === "") return name;
  return name + ": " + message;
}`;
