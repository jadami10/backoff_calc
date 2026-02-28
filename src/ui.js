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
 * @param {HTMLElement} container
 */
export function renderValidation(errors, container) {
  if (!errors.length) {
    container.hidden = true;
    container.textContent = "";
    return;
  }

  const list = document.createElement("ul");
  for (const error of errors) {
    const item = document.createElement("li");
    item.textContent = error;
    list.append(item);
  }

  container.replaceChildren(list);
  container.hidden = false;
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

