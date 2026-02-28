/**
 * @typedef {"delay" | "cumulative"} ChartMode
 */

export const CHART_MODES = /** @type {const} */ (["delay", "cumulative"]);

export const DEFAULT_CHART_MODE = "delay";

/**
 * @param {unknown} value
 * @returns {value is ChartMode}
 */
export function isChartMode(value) {
  return (
    typeof value === "string" &&
    CHART_MODES.includes(/** @type {ChartMode} */ (value))
  );
}

/**
 * @param {unknown} value
 * @returns {ChartMode}
 */
export function resolveChartMode(value) {
  return isChartMode(value) ? value : DEFAULT_CHART_MODE;
}
