import { generateSchedule, summarizeSchedule, validateConfig } from "./backoff.js";
import { createDelayChart } from "./chart.js";
import { resolveDisplayMode } from "./display.js";
import { resolveChartMode } from "./chartMode.js";
import { createShareUrl, readShareStateFromUrl } from "./share.js";
import { initThemeToggle } from "./theme.js";
import {
  enforceNonNegativeIntegerInput,
  readConfigFromInputs,
  renderDelayTableHeaders,
  renderScheduleTable,
  renderSummary,
  renderValidation,
  setStrategyVisibility,
} from "./ui.js";

function debounce(fn, waitMs) {
  let timeoutId = null;

  return (...args) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, waitMs);
  };
}

const controls = document.querySelector("#backoff-controls");
const strategyInputs = Array.from(
  document.querySelectorAll('input[name="strategy"]'),
);
const chartModeInputs = Array.from(
  document.querySelectorAll('input[name="chartMode"]'),
);
const factorGroup = document.querySelector("#factor-group");
const incrementGroup = document.querySelector("#increment-group");
const shareLinkButton = document.querySelector("#share-link");
const themeToggle = document.querySelector("#theme-toggle");
const scheduleBody = document.querySelector("#schedule-body");
const chartCanvas = document.querySelector("#delay-chart");
const displayModeSelect = document.querySelector("#display-mode");
const rawDelayHeader = document.querySelector("#raw-delay-header");
const cappedDelayHeader = document.querySelector("#capped-delay-header");
const cumulativeDelayHeader = document.querySelector("#cumulative-delay-header");
const initialDelayInput = document.querySelector("#initialDelayMs");
const maxRetriesInput = document.querySelector("#maxRetries");
const maxDelayInput = document.querySelector("#maxDelayMs");
const factorInput = document.querySelector("#factor");
const incrementInput = document.querySelector("#incrementMs");
const initialDelayError = document.querySelector("#error-initialDelayMs");
const maxRetriesError = document.querySelector("#error-maxRetries");
const maxDelayError = document.querySelector("#error-maxDelayMs");
const factorError = document.querySelector("#error-factor");
const incrementError = document.querySelector("#error-incrementMs");
const MAX_RETRIES_WARNING_THRESHOLD = 300;

const summaryElements = {
  totalRetries: document.querySelector("#summary-total-retries"),
  finalDelayMs: document.querySelector("#summary-final-delay"),
  totalDelayMs: document.querySelector("#summary-total-delay"),
};

if (
  !(controls instanceof HTMLElement) ||
  strategyInputs.length === 0 ||
  strategyInputs.some((input) => !(input instanceof HTMLInputElement)) ||
  chartModeInputs.length === 0 ||
  chartModeInputs.some((input) => !(input instanceof HTMLInputElement)) ||
  !(factorGroup instanceof HTMLElement) ||
  !(incrementGroup instanceof HTMLElement) ||
  !(shareLinkButton instanceof HTMLButtonElement) ||
  !(themeToggle instanceof HTMLButtonElement) ||
  !(scheduleBody instanceof HTMLElement) ||
  !(chartCanvas instanceof HTMLCanvasElement) ||
  !(displayModeSelect instanceof HTMLSelectElement) ||
  !(rawDelayHeader instanceof HTMLElement) ||
  !(cappedDelayHeader instanceof HTMLElement) ||
  !(cumulativeDelayHeader instanceof HTMLElement) ||
  !(initialDelayInput instanceof HTMLInputElement) ||
  !(maxRetriesInput instanceof HTMLInputElement) ||
  !(maxDelayInput instanceof HTMLInputElement) ||
  !(factorInput instanceof HTMLInputElement) ||
  !(incrementInput instanceof HTMLInputElement) ||
  !(initialDelayError instanceof HTMLElement) ||
  !(maxRetriesError instanceof HTMLElement) ||
  !(maxDelayError instanceof HTMLElement) ||
  !(factorError instanceof HTMLElement) ||
  !(incrementError instanceof HTMLElement) ||
  !(summaryElements.totalRetries instanceof HTMLElement) ||
  !(summaryElements.finalDelayMs instanceof HTMLElement) ||
  !(summaryElements.totalDelayMs instanceof HTMLElement)
) {
  throw new Error("Application failed to initialize due to missing DOM elements.");
}

const configInputs = {
  strategyInputs,
  initialDelayMs: initialDelayInput,
  maxRetries: maxRetriesInput,
  maxDelayMs: maxDelayInput,
  factor: factorInput,
  incrementMs: incrementInput,
};

const chart = createDelayChart(chartCanvas);
enforceNonNegativeIntegerInput(maxRetriesInput);

function readCssVariable(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getChartThemeTokens() {
  return {
    lineColor: readCssVariable("--chart-line"),
    fillColor: readCssVariable("--chart-fill"),
    axisTextColor: readCssVariable("--chart-axis"),
    gridColor: readCssVariable("--chart-grid"),
    tooltipBackgroundColor: readCssVariable("--chart-tooltip-bg"),
    tooltipTextColor: readCssVariable("--chart-tooltip-text"),
    hoverGuideColor: readCssVariable("--chart-grid"),
  };
}

function hasMissingChartThemeTokens(tokens) {
  return Object.values(tokens).some((token) => token.length === 0);
}

const CHART_THEME_SYNC_MAX_ATTEMPTS = 8;

function syncChartThemeWithCss(attempt = 0) {
  const tokens = getChartThemeTokens();

  // On hard loads, CSS variables may briefly be unavailable while JS initializes.
  if (hasMissingChartThemeTokens(tokens)) {
    if (attempt >= CHART_THEME_SYNC_MAX_ATTEMPTS) {
      return;
    }

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        syncChartThemeWithCss(attempt + 1);
      });
      return;
    }

    setTimeout(() => {
      syncChartThemeWithCss(attempt + 1);
    }, 16);
    return;
  }

  chart.setTheme(tokens);
}

initThemeToggle(themeToggle, {
  onThemeChange() {
    syncChartThemeWithCss();
  },
});

if (document.readyState === "complete") {
  syncChartThemeWithCss();
} else {
  window.addEventListener("load", () => {
    syncChartThemeWithCss();
  });
}

function getSelectedStrategy() {
  return strategyInputs.find((input) => input.checked)?.value ?? "";
}

function getSelectedChartMode() {
  const selectedMode = chartModeInputs.find((input) => input.checked)?.value ?? "";
  return resolveChartMode(selectedMode);
}

function applySharedStateFromUrl() {
  const shareState = readShareStateFromUrl(window.location.href);

  if (
    shareState.strategy === "exponential" ||
    shareState.strategy === "linear" ||
    shareState.strategy === "fixed"
  ) {
    const targetInput = strategyInputs.find((input) => input.value === shareState.strategy);
    if (targetInput != null) {
      targetInput.checked = true;
    }
  }

  if (typeof shareState.initialDelayMs === "string") {
    initialDelayInput.value = shareState.initialDelayMs;
  }
  if (typeof shareState.maxRetries === "string") {
    maxRetriesInput.value = shareState.maxRetries;
  }
  if (typeof shareState.maxDelayMs === "string") {
    maxDelayInput.value = shareState.maxDelayMs;
  }
  if (typeof shareState.factor === "string") {
    factorInput.value = shareState.factor;
  }
  if (typeof shareState.incrementMs === "string") {
    incrementInput.value = shareState.incrementMs;
  }
  if (typeof shareState.displayMode === "string") {
    displayModeSelect.value = shareState.displayMode;
  }
  if (typeof shareState.chartMode === "string") {
    const targetInput = chartModeInputs.find((input) => input.value === shareState.chartMode);
    if (targetInput != null) {
      targetInput.checked = true;
    }
  }
}

/**
 * @param {string} text
 */
async function copyTextToClipboard(text) {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard != null &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallbackTextarea = document.createElement("textarea");
  fallbackTextarea.value = text;
  fallbackTextarea.setAttribute("readonly", "");
  fallbackTextarea.style.position = "fixed";
  fallbackTextarea.style.opacity = "0";
  document.body.append(fallbackTextarea);
  fallbackTextarea.select();

  const copied = document.execCommand("copy");
  fallbackTextarea.remove();

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}

let shareButtonFeedbackTimeoutId = null;

function resetShareButtonState() {
  shareLinkButton.setAttribute("aria-label", "Copy URL for current config");
  shareLinkButton.setAttribute("title", "Copy URL for current config");
  shareLinkButton.classList.remove("share-link-button--copied");
  shareLinkButton.classList.remove("share-link-button--error");
}

function setShareButtonCopiedFeedback() {
  if (shareButtonFeedbackTimeoutId !== null) {
    clearTimeout(shareButtonFeedbackTimeoutId);
  }

  shareLinkButton.setAttribute("aria-label", "Copied URL to clipboard");
  shareLinkButton.setAttribute("title", "Copied URL to clipboard");
  shareLinkButton.classList.add("share-link-button--copied");
  shareLinkButton.classList.remove("share-link-button--error");

  shareButtonFeedbackTimeoutId = setTimeout(() => {
    resetShareButtonState();
    shareButtonFeedbackTimeoutId = null;
  }, 1400);
}

function setShareButtonErrorFeedback() {
  if (shareButtonFeedbackTimeoutId !== null) {
    clearTimeout(shareButtonFeedbackTimeoutId);
  }

  shareLinkButton.setAttribute("aria-label", "Failed to copy URL");
  shareLinkButton.setAttribute("title", "Failed to copy URL");
  shareLinkButton.classList.remove("share-link-button--copied");
  shareLinkButton.classList.add("share-link-button--error");

  shareButtonFeedbackTimeoutId = setTimeout(() => {
    resetShareButtonState();
    shareButtonFeedbackTimeoutId = null;
  }, 1400);
}

function updateStrategyFields() {
  const selectedStrategy = getSelectedStrategy();
  setStrategyVisibility(selectedStrategy, { factorGroup, incrementGroup });
}

/**
 * @param {{maxRetries:number}} config
 * @param {Array<{field:string}>} errors
 */
function renderMaxRetriesWarning(config, errors) {
  const hasMaxRetriesError = errors.some((error) => error.field === "maxRetries");
  maxRetriesError.classList.remove("field-error--warning");

  if (hasMaxRetriesError) {
    return;
  }

  if (
    !Number.isInteger(config.maxRetries) ||
    config.maxRetries <= MAX_RETRIES_WARNING_THRESHOLD
  ) {
    maxRetriesError.textContent = "";
    return;
  }

  maxRetriesError.classList.add("field-error--warning");
  maxRetriesError.textContent = `Large schedules above ${MAX_RETRIES_WARNING_THRESHOLD} retries may render slowly.`;
}

function recompute() {
  updateStrategyFields();
  const displayMode = resolveDisplayMode(displayModeSelect.value);
  const chartMode = getSelectedChartMode();

  const config = readConfigFromInputs(configInputs);
  const errors = validateConfig(config);

  renderValidation(errors, {
    inputs: {
      initialDelayMs: initialDelayInput,
      maxRetries: maxRetriesInput,
      maxDelayMs: maxDelayInput,
      factor: factorInput,
      incrementMs: incrementInput,
    },
    messages: {
      initialDelayMs: initialDelayError,
      maxRetries: maxRetriesError,
      maxDelayMs: maxDelayError,
      factor: factorError,
      incrementMs: incrementError,
    },
  });
  renderMaxRetriesWarning(config, errors);
  if (errors.length > 0) {
    return;
  }

  const points = generateSchedule(config);
  const summary = summarizeSchedule(points);

  renderDelayTableHeaders(displayMode, {
    rawDelay: rawDelayHeader,
    cappedDelay: cappedDelayHeader,
    cumulativeDelay: cumulativeDelayHeader,
  });
  chart.update(points, displayMode, chartMode);
  renderScheduleTable(points, scheduleBody, displayMode);
  renderSummary(summary, summaryElements, displayMode);
}

const debouncedRecompute = debounce(recompute, 100);
const recomputeInputs = [
  ...strategyInputs,
  ...chartModeInputs,
  initialDelayInput,
  maxRetriesInput,
  maxDelayInput,
  factorInput,
  incrementInput,
];
for (const input of recomputeInputs) {
  input.addEventListener("input", debouncedRecompute);
  input.addEventListener("change", debouncedRecompute);
}
displayModeSelect.addEventListener("change", recompute);

shareLinkButton.addEventListener("click", async () => {
  const shareUrl = createShareUrl(window.location.href, {
    strategy: getSelectedStrategy(),
    initialDelayMs: initialDelayInput.value,
    maxRetries: maxRetriesInput.value,
    maxDelayMs: maxDelayInput.value,
    factor: factorInput.value,
    incrementMs: incrementInput.value,
    displayMode: resolveDisplayMode(displayModeSelect.value),
    chartMode: getSelectedChartMode(),
  });

  try {
    await copyTextToClipboard(shareUrl);
    setShareButtonCopiedFeedback();
  } catch {
    setShareButtonErrorFeedback();
  }
});

applySharedStateFromUrl();
updateStrategyFields();
recompute();
