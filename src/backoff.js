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

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
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
