/**
 * @typedef {"exponential" | "linear"} BackoffStrategy
 */

/**
 * @typedef {object} BackoffConfig
 * @property {BackoffStrategy} strategy
 * @property {number} initialDelayMs
 * @property {number} maxRetries
 * @property {number | null} maxDelayMs
 * @property {number} [factor]
 * @property {number} [incrementMs]
 */

/**
 * @typedef {object} RetryPoint
 * @property {number} retry
 * @property {number} rawDelayMs
 * @property {number} delayMs
 * @property {number} cumulativeDelayMs
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
 * @param {BackoffConfig} config
 * @returns {string[]}
 */
export function validateConfig(config) {
  const errors = [];

  if (config == null || typeof config !== "object") {
    return ["Configuration is required."];
  }

  if (config.strategy !== "exponential" && config.strategy !== "linear") {
    errors.push("Strategy must be either exponential or linear.");
  }

  if (!isFiniteNumber(config.initialDelayMs) || config.initialDelayMs < 0) {
    errors.push("Initial delay must be a number >= 0.");
  }

  if (!Number.isInteger(config.maxRetries) || config.maxRetries < 0) {
    errors.push("Max retries must be an integer >= 0.");
  }

  if (
    config.maxDelayMs !== null &&
    (!isFiniteNumber(config.maxDelayMs) || config.maxDelayMs < 0)
  ) {
    errors.push("Max delay cap must be empty or a number >= 0.");
  }

  if (config.strategy === "exponential") {
    if (!isFiniteNumber(config.factor) || config.factor <= 1) {
      errors.push("Exponential strategy requires factor > 1.");
    }
  }

  if (config.strategy === "linear") {
    if (!isFiniteNumber(config.incrementMs) || config.incrementMs < 0) {
      errors.push("Linear strategy requires increment >= 0.");
    }
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
    throw new Error(`Invalid backoff config: ${errors.join(" ")}`);
  }

  const schedule = [];
  let cumulativeDelayMs = 0;

  for (let retry = 1; retry <= config.maxRetries; retry += 1) {
    let rawDelayMs;

    if (config.strategy === "exponential") {
      rawDelayMs = config.initialDelayMs * config.factor ** (retry - 1);
    } else {
      rawDelayMs = config.initialDelayMs + (retry - 1) * config.incrementMs;
    }

    const delayMs =
      config.maxDelayMs == null ? rawDelayMs : Math.min(rawDelayMs, config.maxDelayMs);

    cumulativeDelayMs += delayMs;

    schedule.push({
      retry,
      rawDelayMs,
      delayMs,
      cumulativeDelayMs,
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

