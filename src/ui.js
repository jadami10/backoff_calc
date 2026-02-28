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

function formatMs(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ms`;
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
 * @param {HTMLFormElement} form
 */
export function readConfigFromForm(form) {
  const formData = new FormData(form);
  const maxDelayRaw = String(formData.get("maxDelayMs") ?? "").trim();

  return {
    strategy: String(formData.get("strategy") ?? ""),
    initialDelayMs: toNumber(String(formData.get("initialDelayMs") ?? "")),
    maxRetries: toNumber(String(formData.get("maxRetries") ?? "")),
    maxDelayMs: maxDelayRaw === "" ? null : toNumber(maxDelayRaw),
    factor: toNumber(String(formData.get("factor") ?? "")),
    incrementMs: toNumber(String(formData.get("incrementMs") ?? "")),
  };
}

/**
 * @param {"exponential" | "linear"} strategy
 * @param {{factorGroup: HTMLElement, incrementGroup: HTMLElement}} sections
 */
export function setStrategyVisibility(strategy, sections) {
  sections.factorGroup.hidden = strategy !== "exponential";
  sections.incrementGroup.hidden = strategy !== "linear";
}

/**
 * @param {string[]} errors
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
    if (error.includes("Initial delay")) {
      fieldErrors.initialDelayMs = error;
      continue;
    }
    if (error.includes("Max retries")) {
      fieldErrors.maxRetries = error;
      continue;
    }
    if (error.includes("Max delay cap")) {
      fieldErrors.maxDelayMs = error;
      continue;
    }
    if (error.includes("factor")) {
      fieldErrors.factor = error;
      continue;
    }
    if (error.includes("increment")) {
      fieldErrors.incrementMs = error;
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
 */
export function renderScheduleTable(points, tbody) {
  if (!points.length) {
    clearScheduleTable(tbody, "No retries configured.");
    return;
  }

  const rows = points.map((point) => {
    const row = document.createElement("tr");
    const retry = document.createElement("td");
    const rawDelay = document.createElement("td");
    const cappedDelay = document.createElement("td");
    const cumulativeDelay = document.createElement("td");

    retry.textContent = point.retry.toString();
    rawDelay.textContent = formatMs(point.rawDelayMs);
    cappedDelay.textContent = formatMs(point.delayMs);
    cumulativeDelay.textContent = formatMs(point.cumulativeDelayMs);

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
 */
export function renderSummary(summary, summaryElements) {
  summaryElements.totalRetries.textContent = summary.totalRetries.toLocaleString();
  summaryElements.finalDelayMs.textContent = formatMs(summary.finalDelayMs);
  summaryElements.totalDelayMs.textContent = formatMs(summary.totalDelayMs);
}
