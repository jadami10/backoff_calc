import { isDisplayMode } from "./display.js";
import { isChartMode } from "./chartMode.js";

/**
 * @typedef {"exponential" | "linear"} BackoffStrategy
 */

/**
 * @typedef {object} ShareState
 * @property {BackoffStrategy} [strategy]
 * @property {string} [initialDelayMs]
 * @property {string} [maxRetries]
 * @property {string} [maxDelayMs]
 * @property {string} [factor]
 * @property {string} [incrementMs]
 * @property {import("./display.js").DisplayMode} [displayMode]
 * @property {import("./chartMode.js").ChartMode} [chartMode]
 */

const PARAM_KEYS = {
  strategy: "strategy",
  initialDelayMs: "initialDelayMs",
  maxRetries: "maxRetries",
  maxDelayMs: "maxDelayMs",
  factor: "factor",
  incrementMs: "incrementMs",
  displayMode: "displayMode",
  chartMode: "chartMode",
};

/**
 * @param {unknown} value
 * @returns {value is BackoffStrategy}
 */
function isStrategy(value) {
  return value === "exponential" || value === "linear";
}

/**
 * @param {URLSearchParams} searchParams
 * @param {string} key
 */
function readParam(searchParams, key) {
  const value = searchParams.get(key);
  return value === null ? undefined : value;
}

/**
 * @param {string} baseUrl
 * @param {ShareState} state
 */
export function createShareUrl(baseUrl, state) {
  const url = new URL(baseUrl);
  url.search = "";

  if (isStrategy(state.strategy)) {
    url.searchParams.set(PARAM_KEYS.strategy, state.strategy);
  }

  if (typeof state.initialDelayMs === "string") {
    url.searchParams.set(PARAM_KEYS.initialDelayMs, state.initialDelayMs);
  }
  if (typeof state.maxRetries === "string") {
    url.searchParams.set(PARAM_KEYS.maxRetries, state.maxRetries);
  }
  if (typeof state.maxDelayMs === "string") {
    url.searchParams.set(PARAM_KEYS.maxDelayMs, state.maxDelayMs);
  }
  if (typeof state.factor === "string") {
    url.searchParams.set(PARAM_KEYS.factor, state.factor);
  }
  if (typeof state.incrementMs === "string") {
    url.searchParams.set(PARAM_KEYS.incrementMs, state.incrementMs);
  }
  if (isDisplayMode(state.displayMode)) {
    url.searchParams.set(PARAM_KEYS.displayMode, state.displayMode);
  }
  if (isChartMode(state.chartMode)) {
    url.searchParams.set(PARAM_KEYS.chartMode, state.chartMode);
  }

  return url.toString();
}

/**
 * @param {string} urlValue
 * @returns {ShareState}
 */
export function readShareStateFromUrl(urlValue) {
  const url = new URL(urlValue);
  const strategy = readParam(url.searchParams, PARAM_KEYS.strategy);
  const displayMode = readParam(url.searchParams, PARAM_KEYS.displayMode);
  const chartMode = readParam(url.searchParams, PARAM_KEYS.chartMode);
  const state = {};

  if (isStrategy(strategy)) {
    state.strategy = strategy;
  }

  state.initialDelayMs = readParam(url.searchParams, PARAM_KEYS.initialDelayMs);
  state.maxRetries = readParam(url.searchParams, PARAM_KEYS.maxRetries);
  state.maxDelayMs = readParam(url.searchParams, PARAM_KEYS.maxDelayMs);
  state.factor = readParam(url.searchParams, PARAM_KEYS.factor);
  state.incrementMs = readParam(url.searchParams, PARAM_KEYS.incrementMs);

  if (isDisplayMode(displayMode)) {
    state.displayMode = displayMode;
  }
  if (isChartMode(chartMode)) {
    state.chartMode = chartMode;
  }

  return state;
}
