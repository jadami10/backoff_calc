import { generateSchedule, summarizeSchedule, validateConfig } from "./backoff.js";
import { createDelayChart } from "./chart.js";
import { initThemeToggle } from "./theme.js";
import {
  clearScheduleTable,
  readConfigFromForm,
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

const form = document.querySelector("#backoff-form");
const strategySelect = document.querySelector("#strategy");
const factorGroup = document.querySelector("#factor-group");
const incrementGroup = document.querySelector("#increment-group");
const themeToggle = document.querySelector("#theme-toggle");
const errorBox = document.querySelector("#error-box");
const scheduleBody = document.querySelector("#schedule-body");
const chartCanvas = document.querySelector("#delay-chart");

const summaryElements = {
  totalRetries: document.querySelector("#summary-total-retries"),
  finalDelayMs: document.querySelector("#summary-final-delay"),
  totalDelayMs: document.querySelector("#summary-total-delay"),
};

if (
  !(form instanceof HTMLFormElement) ||
  !(strategySelect instanceof HTMLSelectElement) ||
  !(factorGroup instanceof HTMLElement) ||
  !(incrementGroup instanceof HTMLElement) ||
  !(themeToggle instanceof HTMLButtonElement) ||
  !(errorBox instanceof HTMLElement) ||
  !(scheduleBody instanceof HTMLElement) ||
  !(chartCanvas instanceof HTMLCanvasElement) ||
  !(summaryElements.totalRetries instanceof HTMLElement) ||
  !(summaryElements.finalDelayMs instanceof HTMLElement) ||
  !(summaryElements.totalDelayMs instanceof HTMLElement)
) {
  throw new Error("Application failed to initialize due to missing DOM elements.");
}

const chart = createDelayChart(chartCanvas);

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
  setStrategyVisibility(strategySelect.value, { factorGroup, incrementGroup });
}

function recompute() {
  updateStrategyFields();
  const config = readConfigFromForm(form);
  const errors = validateConfig(config);

  renderValidation(errors, errorBox);
  if (errors.length > 0) {
    chart.clear();
    clearScheduleTable(scheduleBody, "Fix validation errors to see schedule.");
    resetSummary(summaryElements);
    return;
  }

  const points = generateSchedule(config);
  const summary = summarizeSchedule(points);

  chart.update(points);
  renderScheduleTable(points, scheduleBody);
  renderSummary(summary, summaryElements);
}

const debouncedRecompute = debounce(recompute, 100);

form.addEventListener("input", debouncedRecompute);
form.addEventListener("change", debouncedRecompute);

updateStrategyFields();
recompute();
