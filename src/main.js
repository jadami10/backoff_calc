import { generateSchedule, summarizeSchedule, validateConfig } from "./backoff.js";
import { createDelayChart } from "./chart.js";
import { resolveDisplayMode } from "./display.js";
import { initThemeToggle } from "./theme.js";
import {
  clearScheduleTable,
  enforceNonNegativeIntegerInput,
  readConfigFromInputs,
  renderDelayTableHeaders,
  renderScheduleTable,
  renderSummary,
  renderValidation,
  resetSummary,
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
const factorGroup = document.querySelector("#factor-group");
const incrementGroup = document.querySelector("#increment-group");
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

const summaryElements = {
  totalRetries: document.querySelector("#summary-total-retries"),
  finalDelayMs: document.querySelector("#summary-final-delay"),
  totalDelayMs: document.querySelector("#summary-total-delay"),
};

if (
  !(controls instanceof HTMLElement) ||
  strategyInputs.length === 0 ||
  strategyInputs.some((input) => !(input instanceof HTMLInputElement)) ||
  !(factorGroup instanceof HTMLElement) ||
  !(incrementGroup instanceof HTMLElement) ||
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
  };
}

initThemeToggle(themeToggle, {
  onThemeChange() {
    chart.setTheme(getChartThemeTokens());
  },
});

function updateStrategyFields() {
  const selectedStrategy = strategyInputs.find((input) => input.checked)?.value ?? "";
  setStrategyVisibility(selectedStrategy, { factorGroup, incrementGroup });
}

function recompute() {
  updateStrategyFields();
  const displayMode = resolveDisplayMode(displayModeSelect.value);
  renderDelayTableHeaders(displayMode, {
    rawDelay: rawDelayHeader,
    cappedDelay: cappedDelayHeader,
    cumulativeDelay: cumulativeDelayHeader,
  });

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
  if (errors.length > 0) {
    chart.clear(displayMode);
    clearScheduleTable(scheduleBody, "Fix validation errors to see schedule.");
    resetSummary(summaryElements);
    return;
  }

  const points = generateSchedule(config);
  const summary = summarizeSchedule(points);

  chart.update(points, displayMode);
  renderScheduleTable(points, scheduleBody, displayMode);
  renderSummary(summary, summaryElements, displayMode);
}

const debouncedRecompute = debounce(recompute, 100);
const recomputeInputs = [
  ...strategyInputs,
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

updateStrategyFields();
recompute();
