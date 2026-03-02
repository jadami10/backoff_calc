/**
 * @typedef {"exponential" | "linear" | "fixed"} BackoffStrategy
 */
/**
 * @typedef {"none" | "equal" | "full"} JitterType
 */

const MAX_RETRIES_LIMIT = 1000;
export const DEFAULT_JITTER_TYPE = "none";

/**
 * @typedef {"config" | "strategy" | "initialDelayMs" | "maxRetries" | "maxDelayMs" | "factor" | "incrementMs" | "jitter"} ValidationErrorField
 */

/**
 * @typedef {object} ValidationError
 * @property {ValidationErrorField} field
 * @property {string} message
 */

/**
 * @typedef {object} BackoffConfig
 * @property {BackoffStrategy} strategy
 * @property {number} initialDelayMs
 * @property {number} maxRetries
 * @property {number | null} maxDelayMs
 * @property {number} [factor]
 * @property {number} [incrementMs]
 * @property {JitterType} [jitter]
 */

/**
 * @typedef {object} RetryPoint
 * @property {number} retry
 * @property {number} rawDelayMs
 * @property {number} minDelayMs
 * @property {number} expectedDelayMs
 * @property {number} maxDelayMs
 * @property {number} delayMs
 * @property {number} cumulativeDelayMs
 * @property {number} cumulativeMinDelayMs
 * @property {number} cumulativeMaxDelayMs
 */

/**
 * @typedef {object} ScheduleSummary
 * @property {number} totalRetries
 * @property {number} finalDelayMs
 * @property {number} totalDelayMs
 */

/**
 * @typedef {"delay" | "cumulative"} ChartMathMode
 */

/**
 * @typedef {"expected" | "simulated"} ChartMathSeriesMode
 */

/**
 * @typedef {object} ChartMathActivePoint
 * @property {number} retry
 * @property {number} valueMs
 * @property {number} minMs
 * @property {number} maxMs
 */

/**
 * @typedef {object} ChartMathVariableBinding
 * @property {"D0" | "F" | "I" | "Dcap" | "r"} symbol
 * @property {string} label
 * @property {number | string | null} value
 * @property {boolean} visible
 */

/**
 * @typedef {object} ChartMathExplanationContext
 * @property {BackoffConfig} config
 * @property {ChartMathMode | string} chartMode
 * @property {ChartMathSeriesMode | string} chartSeriesMode
 * @property {ChartMathActivePoint | null} [activePoint]
 */

/**
 * @typedef {object} ChartMathExplanationModel
 * @property {BackoffStrategy} strategy
 * @property {JitterType} jitterType
 * @property {ChartMathMode} chartMode
 * @property {ChartMathSeriesMode} chartSeriesMode
 * @property {boolean} hasCap
 * @property {number} maxRetries
 * @property {number | null} activeRetry
 * @property {ChartMathActivePoint | null} activePoint
 * @property {"E" | "S"} chartSourceSymbol
 * @property {{
 *   initialDelayMs:number,
 *   factor:number | null,
 *   incrementMs:number | null,
 *   maxDelayMs:number | null
 * }} constants
 * @property {{
 *   rawDelayMs:number | null,
 *   cappedDelayMs:number | null,
 *   baseChartValueMs:number | null,
 *   expectedDelayMs:number | null,
 *   minDelayMs:number | null,
 *   maxDelayMs:number | null,
 *   randomizedMinValueMs:number | null,
 *   randomizedExpectedValueMs:number | null,
 *   randomizedMaxValueMs:number | null,
 *   chartedValueMs:number | null
 * }} resolved
 * @property {ChartMathVariableBinding[]} variableBindings
 */

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * @param {unknown} value
 * @returns {ChartMathMode}
 */
function resolveChartMathMode(value) {
  if (value === "cumulative") {
    return "cumulative";
  }
  return "delay";
}

/**
 * @param {unknown} value
 * @returns {ChartMathSeriesMode}
 */
function resolveChartMathSeriesMode(value) {
  if (value === "simulated") {
    return "simulated";
  }
  return "expected";
}

/**
 * @param {BackoffConfig} config
 * @param {number} retry
 * @returns {number}
 */
function rawDelayAtRetry(config, retry) {
  if (config.strategy === "exponential") {
    return config.initialDelayMs * config.factor ** (retry - 1);
  }

  if (config.strategy === "linear") {
    return config.initialDelayMs + (retry - 1) * config.incrementMs;
  }

  return config.initialDelayMs;
}

/**
 * @param {BackoffConfig} config
 * @param {number} retry
 */
function cappedDelayAtRetry(config, retry) {
  const rawDelayMs = rawDelayAtRetry(config, retry);
  if (config.maxDelayMs == null) {
    return rawDelayMs;
  }
  return Math.min(rawDelayMs, config.maxDelayMs);
}

/**
 * @param {unknown} activePoint
 * @param {number} maxRetries
 * @returns {ChartMathActivePoint | null}
 */
function normalizeActivePoint(activePoint, maxRetries) {
  if (activePoint == null || typeof activePoint !== "object") {
    return null;
  }

  const normalizedRetry = activePoint.retry;
  const normalizedValueMs = activePoint.valueMs;
  if (
    !Number.isInteger(normalizedRetry) ||
    normalizedRetry < 1 ||
    normalizedRetry > maxRetries ||
    !isFiniteNumber(normalizedValueMs)
  ) {
    return null;
  }

  const normalizedMinMs = isFiniteNumber(activePoint.minMs)
    ? activePoint.minMs
    : normalizedValueMs;
  const normalizedMaxMs = isFiniteNumber(activePoint.maxMs)
    ? activePoint.maxMs
    : normalizedValueMs;

  return {
    retry: normalizedRetry,
    valueMs: normalizedValueMs,
    minMs: normalizedMinMs,
    maxMs: normalizedMaxMs,
  };
}

/**
 * @param {unknown} value
 * @returns {value is JitterType}
 */
export function isJitterType(value) {
  return value === "none" || value === "equal" || value === "full";
}

/**
 * @param {unknown} value
 * @returns {JitterType}
 */
export function resolveJitterType(value) {
  if (isJitterType(value)) {
    return value;
  }
  return DEFAULT_JITTER_TYPE;
}

/**
 * @param {number} cappedDelayMs
 * @param {JitterType} jitterType
 */
function toDelayRange(cappedDelayMs, jitterType) {
  if (jitterType === "equal") {
    return {
      minDelayMs: cappedDelayMs / 2,
      expectedDelayMs: cappedDelayMs * 0.75,
      maxDelayMs: cappedDelayMs,
    };
  }

  if (jitterType === "full") {
    return {
      minDelayMs: 0,
      expectedDelayMs: cappedDelayMs / 2,
      maxDelayMs: cappedDelayMs,
    };
  }

  return {
    minDelayMs: cappedDelayMs,
    expectedDelayMs: cappedDelayMs,
    maxDelayMs: cappedDelayMs,
  };
}

/**
 * @param {BackoffConfig} config
 * @returns {ValidationError[]}
 */
export function validateConfig(config) {
  const errors = [];

  if (config == null || typeof config !== "object") {
    return [{ field: "config", message: "Configuration is required." }];
  }

  if (
    config.strategy !== "exponential" &&
    config.strategy !== "linear" &&
    config.strategy !== "fixed"
  ) {
    errors.push({ field: "strategy", message: "Must be exponential, linear, or fixed." });
  }

  if (!isFiniteNumber(config.initialDelayMs) || config.initialDelayMs < 0) {
    errors.push({ field: "initialDelayMs", message: "Must be >= 0." });
  }

  if (
    !Number.isInteger(config.maxRetries) ||
    config.maxRetries < 0 ||
    config.maxRetries > MAX_RETRIES_LIMIT
  ) {
    errors.push({
      field: "maxRetries",
      message: `Must be an integer between 0 and ${MAX_RETRIES_LIMIT}.`,
    });
  }

  if (
    config.maxDelayMs !== null &&
    (!isFiniteNumber(config.maxDelayMs) || config.maxDelayMs < 0)
  ) {
    errors.push({ field: "maxDelayMs", message: "Must be >= 0 or blank." });
  }

  if (config.strategy === "exponential") {
    if (!isFiniteNumber(config.factor) || config.factor <= 1) {
      errors.push({ field: "factor", message: "Must be > 1." });
    }
  }

  if (config.strategy === "linear") {
    if (!isFiniteNumber(config.incrementMs) || config.incrementMs < 0) {
      errors.push({ field: "incrementMs", message: "Must be >= 0." });
    }
  }

  if (config.jitter !== undefined && !isJitterType(config.jitter)) {
    errors.push({ field: "jitter", message: "Must be none, equal, or full." });
  }

  return errors;
}

/**
 * @param {BackoffConfig} config
 * @returns {RetryPoint[]}
 */
export function generateSchedule(config) {
  const errors = validateConfig(config);
  if (errors.length > 0) {
    throw new Error(`Invalid configuration: ${errors.map((error) => error.message).join(" ")}`);
  }

  const jitterType = resolveJitterType(config.jitter);
  const schedule = [];
  let cumulativeDelayMs = 0;
  let cumulativeMinDelayMs = 0;
  let cumulativeMaxDelayMs = 0;

  for (let retry = 1; retry <= config.maxRetries; retry += 1) {
    let rawDelayMs;

    if (config.strategy === "exponential") {
      rawDelayMs = config.initialDelayMs * config.factor ** (retry - 1);
    } else if (config.strategy === "linear") {
      rawDelayMs = config.initialDelayMs + (retry - 1) * config.incrementMs;
    } else {
      rawDelayMs = config.initialDelayMs;
    }

    const cappedDelayMs =
      config.maxDelayMs == null ? rawDelayMs : Math.min(rawDelayMs, config.maxDelayMs);
    const { minDelayMs, expectedDelayMs, maxDelayMs } = toDelayRange(cappedDelayMs, jitterType);
    const delayMs = expectedDelayMs;

    cumulativeDelayMs += delayMs;
    cumulativeMinDelayMs += minDelayMs;
    cumulativeMaxDelayMs += maxDelayMs;

    schedule.push({
      retry,
      rawDelayMs,
      minDelayMs,
      expectedDelayMs,
      maxDelayMs,
      delayMs,
      cumulativeDelayMs,
      cumulativeMinDelayMs,
      cumulativeMaxDelayMs,
    });
  }

  return schedule;
}

/**
 * @param {ChartMathExplanationContext} context
 * @returns {ChartMathExplanationModel}
 */
export function buildChartMathExplanation(context) {
  if (context == null || typeof context !== "object") {
    throw new Error("Invalid chart math context.");
  }

  const errors = validateConfig(context.config);
  if (errors.length > 0) {
    throw new Error(`Invalid configuration: ${errors.map((error) => error.message).join(" ")}`);
  }

  const config = context.config;
  const jitterType = resolveJitterType(config.jitter);
  const chartMode = resolveChartMathMode(context.chartMode);
  const chartSeriesMode = resolveChartMathSeriesMode(context.chartSeriesMode);
  const hasCap = config.maxDelayMs != null;
  const activePoint = normalizeActivePoint(context.activePoint, config.maxRetries);
  const activeRetry = activePoint?.retry ?? null;
  const chartSourceSymbol = chartSeriesMode === "simulated" ? "S" : "E";

  let rawDelayMs = null;
  let cappedDelayMs = null;
  let baseChartValueMs = null;
  let expectedDelayMs = null;
  let minDelayMs = null;
  let maxDelayMs = null;
  let randomizedMinValueMs = null;
  let randomizedExpectedValueMs = null;
  let randomizedMaxValueMs = null;

  if (activeRetry !== null) {
    rawDelayMs = rawDelayAtRetry(config, activeRetry);
    cappedDelayMs = hasCap ? Math.min(rawDelayMs, config.maxDelayMs) : rawDelayMs;
    const resolvedRange = toDelayRange(cappedDelayMs, jitterType);
    expectedDelayMs = resolvedRange.expectedDelayMs;
    minDelayMs = resolvedRange.minDelayMs;
    maxDelayMs = resolvedRange.maxDelayMs;

    if (chartMode === "cumulative") {
      let cumulativeBase = 0;
      for (let retry = 1; retry <= activeRetry; retry += 1) {
        cumulativeBase += cappedDelayAtRetry(config, retry);
      }
      baseChartValueMs = cumulativeBase;
    } else {
      baseChartValueMs = cappedDelayMs;
    }

    const randomizedRange = toDelayRange(baseChartValueMs, jitterType);
    randomizedMinValueMs = randomizedRange.minDelayMs;
    randomizedExpectedValueMs = randomizedRange.expectedDelayMs;
    randomizedMaxValueMs = randomizedRange.maxDelayMs;
  }

  /** @type {ChartMathVariableBinding[]} */
  const variableBindings = [
    {
      symbol: "D0",
      label: "Initial Delay (ms)",
      value: config.initialDelayMs,
      visible: true,
    },
    {
      symbol: "F",
      label: "Backoff Factor",
      value: config.strategy === "exponential" ? config.factor : null,
      visible: config.strategy === "exponential",
    },
    {
      symbol: "I",
      label: "Linear Increment (ms)",
      value: config.strategy === "linear" ? config.incrementMs : null,
      visible: config.strategy === "linear",
    },
    {
      symbol: "Dcap",
      label: "Max Delay Cap (ms)",
      value: hasCap ? config.maxDelayMs : "\u221e",
      visible: true,
    },
    {
      symbol: "r",
      label: `Retry Index (1..${config.maxRetries})`,
      value: activeRetry == null ? "symbolic" : activeRetry,
      visible: true,
    },
  ];

  return {
    strategy: config.strategy,
    jitterType,
    chartMode,
    chartSeriesMode,
    hasCap,
    maxRetries: config.maxRetries,
    activeRetry,
    activePoint,
    chartSourceSymbol,
    constants: {
      initialDelayMs: config.initialDelayMs,
      factor: config.strategy === "exponential" ? config.factor : null,
      incrementMs: config.strategy === "linear" ? config.incrementMs : null,
      maxDelayMs: config.maxDelayMs,
    },
    resolved: {
      rawDelayMs,
      cappedDelayMs,
      baseChartValueMs,
      expectedDelayMs,
      minDelayMs,
      maxDelayMs,
      randomizedMinValueMs,
      randomizedExpectedValueMs,
      randomizedMaxValueMs,
      chartedValueMs: activePoint?.valueMs ?? null,
    },
    variableBindings,
  };
}

/**
 * @param {RetryPoint[]} points
 * @returns {ScheduleSummary}
 */
export function summarizeSchedule(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return {
      totalRetries: 0,
      finalDelayMs: 0,
      totalDelayMs: 0,
    };
  }

  const last = points[points.length - 1];

  return {
    totalRetries: points.length,
    finalDelayMs: last.delayMs,
    totalDelayMs: last.cumulativeDelayMs,
  };
}
