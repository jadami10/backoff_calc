/**
 * @typedef {object} ChartSelectionState
 * @property {number | null} hoverIndex
 * @property {number | null} pinnedIndex
 * @property {boolean} isPointerInside
 */

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function normalizeIndex(value) {
  if (!Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * @returns {ChartSelectionState}
 */
export function createChartSelectionState() {
  return {
    hoverIndex: null,
    pinnedIndex: null,
    isPointerInside: false,
  };
}

/**
 * @param {ChartSelectionState} state
 * @param {number | null} hoverIndex
 * @returns {ChartSelectionState}
 */
export function updateSelectionForPointerMove(state, hoverIndex) {
  return {
    ...state,
    isPointerInside: true,
    hoverIndex: normalizeIndex(hoverIndex),
  };
}

/**
 * @param {ChartSelectionState} state
 * @returns {ChartSelectionState}
 */
export function updateSelectionForPointerLeave(state) {
  return {
    ...state,
    isPointerInside: false,
    hoverIndex: null,
  };
}

/**
 * @param {ChartSelectionState} state
 * @param {number | null} index
 * @returns {ChartSelectionState}
 */
export function togglePinnedSelection(state, index) {
  const normalizedIndex = normalizeIndex(index);
  if (normalizedIndex === null) {
    return state;
  }

  return {
    ...state,
    pinnedIndex: state.pinnedIndex === normalizedIndex ? null : normalizedIndex,
  };
}

/**
 * @param {ChartSelectionState} state
 * @returns {ChartSelectionState}
 */
export function clearPinnedSelection(state) {
  if (state.pinnedIndex === null) {
    return state;
  }

  return {
    ...state,
    pinnedIndex: null,
  };
}

/**
 * @param {ChartSelectionState} state
 * @param {number} pointCount
 * @returns {ChartSelectionState}
 */
export function reconcileSelectionWithPointCount(state, pointCount) {
  const normalizedCount = Number.isInteger(pointCount) && pointCount > 0 ? pointCount : 0;
  if (normalizedCount === 0) {
    if (state.hoverIndex === null && state.pinnedIndex === null) {
      return state;
    }

    return {
      ...state,
      hoverIndex: null,
      pinnedIndex: null,
    };
  }

  const maxIndex = normalizedCount - 1;
  const nextHoverIndex =
    state.hoverIndex === null ? null : Math.min(Math.max(state.hoverIndex, 0), maxIndex);
  const nextPinnedIndex =
    state.pinnedIndex === null ? null : Math.min(Math.max(state.pinnedIndex, 0), maxIndex);

  if (nextHoverIndex === state.hoverIndex && nextPinnedIndex === state.pinnedIndex) {
    return state;
  }

  return {
    ...state,
    hoverIndex: nextHoverIndex,
    pinnedIndex: nextPinnedIndex,
  };
}

/**
 * @param {ChartSelectionState} state
 * @returns {number | null}
 */
export function activeSelectionIndex(state) {
  if (state.pinnedIndex !== null) {
    return state.pinnedIndex;
  }

  if (state.isPointerInside && state.hoverIndex !== null) {
    return state.hoverIndex;
  }

  return null;
}
