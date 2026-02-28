import { DEFAULT_DISPLAY_MODE, formatDuration, resolveDisplayMode, unitLabel } from "./display.js";

/**
 * @typedef {import("./display.js").DisplayMode} DisplayMode
 * @typedef {import("./backoff.js").ValidationError} ValidationError
 */

function toNumber(value) {
  if (typeof value !== "string") {
    return Number.NaN;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return Number.NaN;
  }
  return Number(trimmed);
}

function isDigitKey(key) {
  return key.length === 1 && key >= "0" && key <= "9";
}

/**
 * Prevent non-integer input for a numeric field (typing and paste).
 * @param {HTMLInputElement} input
 */
export function enforceNonNegativeIntegerInput(input) {
  input.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const allowedControlKeys = new Set([
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Tab",
      "Enter",
    ]);

    if (allowedControlKeys.has(event.key)) {
      return;
    }

    if (!isDigitKey(event.key)) {
      event.preventDefault();
    }
  });

  input.addEventListener("paste", (event) => {
    const pastedText = event.clipboardData?.getData("text") ?? "";
    if (!/^\d+$/.test(pastedText)) {
      event.preventDefault();
    }
  });
}

/**
 * @param {{
 *   strategyInputs: HTMLInputElement[],
 *   initialDelayMs: HTMLInputElement,
 *   maxRetries: HTMLInputElement,
 *   maxDelayMs: HTMLInputElement,
 *   factor: HTMLInputElement,
 *   incrementMs: HTMLInputElement
 * }} inputs
 */
export function readConfigFromInputs(inputs) {
  const maxDelayRaw = inputs.maxDelayMs.value.trim();
  const strategy = inputs.strategyInputs.find((input) => input.checked)?.value ?? "";

  return {
    strategy,
    initialDelayMs: toNumber(inputs.initialDelayMs.value),
    maxRetries: toNumber(inputs.maxRetries.value),
    maxDelayMs: maxDelayRaw === "" ? null : toNumber(maxDelayRaw),
    factor: toNumber(inputs.factor.value),
    incrementMs: toNumber(inputs.incrementMs.value),
  };
}

/**
 * @param {"exponential" | "linear" | "fixed"} strategy
 * @param {{factorGroup: HTMLElement, incrementGroup: HTMLElement}} sections
 */
export function setStrategyVisibility(strategy, sections) {
  sections.factorGroup.hidden = strategy !== "exponential";
  sections.incrementGroup.hidden = strategy !== "linear";
}

/**
 * @param {ValidationError[]} errors
 * @param {{
 *   inputs: {
 *     initialDelayMs: HTMLInputElement,
 *     maxRetries: HTMLInputElement,
 *     maxDelayMs: HTMLInputElement,
 *     factor: HTMLInputElement,
 *     incrementMs: HTMLInputElement
 *   },
 *   messages: {
 *     initialDelayMs: HTMLElement,
 *     maxRetries: HTMLElement,
 *     maxDelayMs: HTMLElement,
 *     factor: HTMLElement,
 *     incrementMs: HTMLElement
 *   }
 * }} targets
 */
export function renderValidation(errors, targets) {
  const fieldErrors = {
    initialDelayMs: "",
    maxRetries: "",
    maxDelayMs: "",
    factor: "",
    incrementMs: "",
  };

  for (const error of errors) {
    if (Object.hasOwn(fieldErrors, error.field)) {
      fieldErrors[error.field] = error.message;
    }
  }

  for (const [fieldName, input] of Object.entries(targets.inputs)) {
    const message = fieldErrors[fieldName];
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  targets.messages.initialDelayMs.textContent = fieldErrors.initialDelayMs;
  targets.messages.maxRetries.textContent = fieldErrors.maxRetries;
  targets.messages.maxDelayMs.textContent = fieldErrors.maxDelayMs;
  targets.messages.factor.textContent = fieldErrors.factor;
  targets.messages.incrementMs.textContent = fieldErrors.incrementMs;
}

/**
 * @param {HTMLElement} tbody
 * @param {string} message
 */
export function clearScheduleTable(tbody, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.className = "placeholder-cell";
  cell.textContent = message;
  row.append(cell);
  tbody.replaceChildren(row);
}

/**
 * @param {Array<{retry:number,rawDelayMs:number,delayMs:number,cumulativeDelayMs:number}>} points
 * @param {HTMLElement} tbody
 * @param {DisplayMode} displayMode
 */
export function renderScheduleTable(points, tbody, displayMode = DEFAULT_DISPLAY_MODE) {
  if (!points.length) {
    clearScheduleTable(tbody, "No retries configured.");
    return;
  }

  const normalizedMode = resolveDisplayMode(displayMode);

  const rows = points.map((point) => {
    const row = document.createElement("tr");
    const retry = document.createElement("td");
    const rawDelay = document.createElement("td");
    const cappedDelay = document.createElement("td");
    const cumulativeDelay = document.createElement("td");

    retry.textContent = point.retry.toString();
    rawDelay.textContent = formatDuration(point.rawDelayMs, normalizedMode);
    cappedDelay.textContent = formatDuration(point.delayMs, normalizedMode);
    cumulativeDelay.textContent = formatDuration(point.cumulativeDelayMs, normalizedMode);

    row.append(retry, rawDelay, cappedDelay, cumulativeDelay);
    return row;
  });

  tbody.replaceChildren(...rows);
}

/**
 * @param {{totalRetries: HTMLElement, finalDelayMs: HTMLElement, totalDelayMs: HTMLElement}} summaryElements
 */
export function resetSummary(summaryElements) {
  summaryElements.totalRetries.textContent = "-";
  summaryElements.finalDelayMs.textContent = "-";
  summaryElements.totalDelayMs.textContent = "-";
}

/**
 * @param {{totalRetries: number, finalDelayMs: number, totalDelayMs: number}} summary
 * @param {{totalRetries: HTMLElement, finalDelayMs: HTMLElement, totalDelayMs: HTMLElement}} summaryElements
 * @param {DisplayMode} displayMode
 */
export function renderSummary(summary, summaryElements, displayMode = DEFAULT_DISPLAY_MODE) {
  const normalizedMode = resolveDisplayMode(displayMode);
  summaryElements.totalRetries.textContent = summary.totalRetries.toLocaleString();
  summaryElements.finalDelayMs.textContent = formatDuration(summary.finalDelayMs, normalizedMode);
  summaryElements.totalDelayMs.textContent = formatDuration(summary.totalDelayMs, normalizedMode);
}

/**
 * @param {DisplayMode} displayMode
 * @param {{rawDelay: HTMLElement, cappedDelay: HTMLElement, cumulativeDelay: HTMLElement}} headerElements
 */
export function renderDelayTableHeaders(displayMode, headerElements) {
  const normalizedMode = resolveDisplayMode(displayMode);
  const unit = unitLabel(normalizedMode);

  headerElements.rawDelay.textContent = `Raw Delay (${unit})`;
  headerElements.cappedDelay.textContent = `Capped Delay (${unit})`;
  headerElements.cumulativeDelay.textContent = `Cumulative Delay (${unit})`;
}
