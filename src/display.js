/**
 * @typedef {"ms" | "s" | "min" | "h" | "humanize"} DisplayMode
 */

export const DISPLAY_MODES = /** @type {const} */ (["ms", "s", "min", "h", "humanize"]);

export const DEFAULT_DISPLAY_MODE = "humanize";
const DIGIT_CUTOFF = 12;
const SCIENTIFIC_SIGNIFICANT_DIGITS = 4;
const MS_PER_WEEK = 7 * 24 * 3600 * 1000;
const MS_PER_YEAR = 52 * MS_PER_WEEK;
const MAX_HUMANIZED_PARTS = 4;

function formatNumber(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * @param {number} value
 */
function digitCount(value) {
  const absoluteValue = Math.abs(value);
  if (absoluteValue < 1) {
    return 1;
  }
  return Math.floor(Math.log10(absoluteValue)) + 1;
}

/**
 * @param {number} value
 */
function shouldUseScientificNotation(value) {
  return Number.isFinite(value) && digitCount(value) >= DIGIT_CUTOFF;
}

function trimMantissa(mantissa) {
  return mantissa.replace(/(?:\.0+|(\.\d*?[1-9])0+)$/, "$1");
}

/**
 * @param {string} exponent
 */
function normalizeExponent(exponent) {
  const sign = exponent.startsWith("-") ? "-" : "+";
  const rawDigits = exponent.replace(/^[+-]/, "");
  const digits = rawDigits.replace(/^0+/, "") || "0";
  return `${sign}${digits}`;
}

/**
 * @param {number} value
 */
function formatScientificNumber(value) {
  if (value === 0) {
    return "0";
  }

  const sign = value < 0 ? "-" : "";
  const scientific = Math.abs(value).toExponential(SCIENTIFIC_SIGNIFICANT_DIGITS - 1);
  const [mantissa, exponent = "+0"] = scientific.split("e");
  const normalizedMantissa = trimMantissa(mantissa);
  const normalizedExponent = normalizeExponent(exponent);
  return `${sign}${normalizedMantissa}e${normalizedExponent}`;
}

/**
 * @param {number} value
 * @param {"ms" | "s" | "min" | "h"} unit
 */
function formatScaledDuration(value, unit) {
  if (shouldUseScientificNotation(value)) {
    return `${formatScientificNumber(value)} ${unit}`;
  }
  return `${formatNumber(value)} ${unit}`;
}

/**
 * @param {unknown} value
 * @returns {value is DisplayMode}
 */
export function isDisplayMode(value) {
  return (
    typeof value === "string" &&
    DISPLAY_MODES.includes(/** @type {DisplayMode} */ (value))
  );
}

/**
 * @param {unknown} value
 * @returns {DisplayMode}
 */
export function resolveDisplayMode(value) {
  return isDisplayMode(value) ? value : DEFAULT_DISPLAY_MODE;
}

/**
 * @param {DisplayMode} displayMode
 */
export function unitLabel(displayMode) {
  switch (displayMode) {
    case "ms":
      return "ms";
    case "s":
      return "s";
    case "min":
      return "min";
    case "h":
      return "h";
    case "humanize":
      return "human-readable";
    default:
      return "ms";
  }
}

/**
 * @param {number} valueMs
 */
function formatHumanized(valueMs) {
  if (valueMs === 0) {
    return "0 ms";
  }

  const sign = valueMs < 0 ? "-" : "";
  const totalYears = Math.abs(valueMs) / MS_PER_YEAR;
  if (shouldUseScientificNotation(totalYears)) {
    return `${sign}${formatScientificNumber(totalYears)}y`;
  }

  const totalCentiMs = Math.round(Math.abs(valueMs) * 100);
  const centiMsPerYear = MS_PER_YEAR * 100;
  const centiMsPerWeek = MS_PER_WEEK * 100;
  const centiMsPerDay = 24 * 3600 * 1000 * 100;
  const centiMsPerHour = 3600 * 1000 * 100;
  const centiMsPerMinute = 60 * 1000 * 100;
  const centiMsPerSecond = 1000 * 100;

  let remaining = totalCentiMs;

  const years = Math.floor(remaining / centiMsPerYear);
  remaining -= years * centiMsPerYear;

  const weeks = Math.floor(remaining / centiMsPerWeek);
  remaining -= weeks * centiMsPerWeek;

  const days = Math.floor(remaining / centiMsPerDay);
  remaining -= days * centiMsPerDay;

  const hours = Math.floor(remaining / centiMsPerHour);
  remaining -= hours * centiMsPerHour;

  const minutes = Math.floor(remaining / centiMsPerMinute);
  remaining -= minutes * centiMsPerMinute;

  const seconds = Math.floor(remaining / centiMsPerSecond);
  remaining -= seconds * centiMsPerSecond;

  const millis = remaining / 100;
  const parts = [];

  if (years > 0) {
    parts.push(`${years.toLocaleString()}y`);
  }
  if (weeks > 0) {
    parts.push(`${weeks.toLocaleString()}w`);
  }
  if (days > 0) {
    parts.push(`${days.toLocaleString()}d`);
  }
  if (hours > 0) {
    parts.push(`${hours.toLocaleString()}h`);
  }
  if (minutes > 0 && years === 0) {
    parts.push(`${minutes.toLocaleString()}m`);
  }
  if (seconds > 0 && years === 0 && weeks === 0) {
    parts.push(`${seconds.toLocaleString()}s`);
  }
  if ((millis > 0 || parts.length === 0) && years === 0 && weeks === 0 && days === 0) {
    parts.push(`${formatNumber(millis)}ms`);
  }

  return `${sign}${parts.slice(0, MAX_HUMANIZED_PARTS).join(" ")}`;
}

/**
 * @param {number} valueMs
 * @param {DisplayMode} displayMode
 */
export function formatDuration(valueMs, displayMode = DEFAULT_DISPLAY_MODE) {
  if (!Number.isFinite(valueMs)) {
    return "-";
  }

  const normalizedMode = resolveDisplayMode(displayMode);

  switch (normalizedMode) {
    case "s":
      return formatScaledDuration(valueMs / 1000, "s");
    case "min":
      return formatScaledDuration(valueMs / (60 * 1000), "min");
    case "h":
      return formatScaledDuration(valueMs / (60 * 60 * 1000), "h");
    case "humanize":
      return formatHumanized(valueMs);
    case "ms":
    default:
      return formatScaledDuration(valueMs, "ms");
  }
}
