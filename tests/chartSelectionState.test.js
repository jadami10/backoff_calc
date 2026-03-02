import assert from "node:assert/strict";
import test from "node:test";

import {
  activeSelectionIndex,
  clearPinnedSelection,
  createChartSelectionState,
  reconcileSelectionWithPointCount,
  togglePinnedSelection,
  updateSelectionForPointerLeave,
  updateSelectionForPointerMove,
} from "../src/chartSelectionState.js";

test("hover selection is active only while pointer is inside", () => {
  let state = createChartSelectionState();

  state = updateSelectionForPointerMove(state, 3);
  assert.equal(activeSelectionIndex(state), 3);

  state = updateSelectionForPointerLeave(state);
  assert.equal(activeSelectionIndex(state), null);
});

test("pinned selection takes precedence over hover until toggled off", () => {
  let state = createChartSelectionState();

  state = updateSelectionForPointerMove(state, 1);
  state = togglePinnedSelection(state, 1);
  assert.equal(activeSelectionIndex(state), 1);

  state = updateSelectionForPointerMove(state, 4);
  assert.equal(activeSelectionIndex(state), 1);

  state = togglePinnedSelection(state, 1);
  assert.equal(activeSelectionIndex(state), 4);
});

test("clearing a pin falls back to hover or none", () => {
  let state = createChartSelectionState();

  state = updateSelectionForPointerMove(state, 2);
  state = togglePinnedSelection(state, 4);
  assert.equal(activeSelectionIndex(state), 4);

  state = clearPinnedSelection(state);
  assert.equal(activeSelectionIndex(state), 2);

  state = updateSelectionForPointerLeave(state);
  state = togglePinnedSelection(state, 5);
  assert.equal(activeSelectionIndex(state), 5);

  state = clearPinnedSelection(state);
  assert.equal(activeSelectionIndex(state), null);
});

test("selection reconciles with data size changes", () => {
  let state = createChartSelectionState();

  state = updateSelectionForPointerMove(state, 5);
  state = togglePinnedSelection(state, 5);
  state = reconcileSelectionWithPointCount(state, 3);
  assert.equal(state.hoverIndex, 2);
  assert.equal(state.pinnedIndex, 2);
  assert.equal(activeSelectionIndex(state), 2);

  state = reconcileSelectionWithPointCount(state, 0);
  assert.equal(state.hoverIndex, null);
  assert.equal(state.pinnedIndex, null);
  assert.equal(activeSelectionIndex(state), null);
});

test("invalid pin index is ignored", () => {
  let state = createChartSelectionState();
  state = updateSelectionForPointerMove(state, 1);
  const unchanged = togglePinnedSelection(state, -1);
  assert.equal(unchanged, state);
});
