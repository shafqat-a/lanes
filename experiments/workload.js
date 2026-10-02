export function source(ticks) { return `function simulate(x) {
  let state = x;
  for (let tick = 0; tick < ${ticks}; tick++) {
    state = state ^ (state << 13);
    state = state ^ (state >> 17);
    state = state ^ (state << 5);
    if ((state & 7) === 0) { state += tick; }
  }
  return state;
}`; }
export function native(x, ticks) {
  let state = x;
  for (let tick = 0; tick < ticks; tick++) {
    state ^= state << 13; state ^= state >> 17; state ^= state << 5;
    if ((state & 7) === 0) state = state + tick | 0;
  }
  return state;
}
