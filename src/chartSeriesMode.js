/**
 * @typedef {"expected" | "simulated"} ChartSeriesMode
 */

export const CHART_SERIES_MODES = /** @type {const} */ (["expected", "simulated"]);

export const DEFAULT_CHART_SERIES_MODE = "expected";

/**
 * @param {unknown} value
 * @returns {value is ChartSeriesMode}
 */
export function isChartSeriesMode(value) {
  return (
    typeof value === "string" &&
    CHART_SERIES_MODES.includes(/** @type {ChartSeriesMode} */ (value))
  );
}

/**
 * @param {unknown} value
 * @returns {ChartSeriesMode}
 */
export function resolveChartSeriesMode(value) {
  return isChartSeriesMode(value) ? value : DEFAULT_CHART_SERIES_MODE;
}
