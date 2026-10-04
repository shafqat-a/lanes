// Phase 6 worker 5: consumers of the generic iterator record.
// The parent replaces phase4-spread.js spreadAppend with spreadAppendSource.
// for-of, array destructuring, and array rest already emit for_of_start /
// for_of_next / iterator_close. Object spread stays copy_data_properties.

import { fileURLToPath } from "node:url";
import { fixtures as fixtureList } from "./fixtures.js";

export const spreadAppendSource = `function spreadAppendBootstrap(array, position, iterable) {
  "use strict";
  const record = __lanesIteratorOpen(iterable);
  const desc = __lanesDescriptor();
  desc.writable = true;
  desc.enumerable = true;
  desc.configurable = true;
  let index = position;
  for (;;) {
    const value = __lanesIteratorStep(record);
    if (value === record) return index;
    desc.value = value;
    __lanesDefine(array, index, desc);
    index++;
  }
}`;

export const fixtures = fixtureList;

export const notesPath = fileURLToPath(new URL("./NOTES.md", import.meta.url));
