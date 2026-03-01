/**
 * @typedef {"ms" | "s" | "min" | "h" | "humanize"} DisplayMode
 */

export const DISPLAY_MODES = /** @type {const} */ (["ms", "s", "min", "h", "humanize"]);

export const DEFAULT_DISPLAY_MODE = "humanize";

function formatNumber(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
  const totalCentiMs = Math.round(Math.abs(valueMs) * 100);
  const centiMsPerWeek = 7 * 24 * 3600 * 1000 * 100;
  const centiMsPerDay = 24 * 3600 * 1000 * 100;
  const centiMsPerHour = 3600 * 1000 * 100;
  const centiMsPerMinute = 60 * 1000 * 100;
  const centiMsPerSecond = 1000 * 100;

  let remaining = totalCentiMs;

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

  if (weeks > 0) {
    parts.push(`${weeks.toLocaleString()}w`);
  }
  if (days > 0) {
    parts.push(`${days.toLocaleString()}d`);
  }
  if (hours > 0) {
    parts.push(`${hours.toLocaleString()}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes.toLocaleString()}m`);
  }
  if (seconds > 0) {
    parts.push(`${seconds.toLocaleString()}s`);
  }
  if (millis > 0 || parts.length === 0) {
    parts.push(`${formatNumber(millis)}ms`);
  }

  return `${sign}${parts.join(" ")}`;
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
      return `${formatNumber(valueMs / 1000)} s`;
    case "min":
      return `${formatNumber(valueMs / (60 * 1000))} min`;
    case "h":
      return `${formatNumber(valueMs / (60 * 60 * 1000))} h`;
    case "humanize":
      return formatHumanized(valueMs);
    case "ms":
    default:
      return `${formatNumber(valueMs)} ms`;
  }
}
