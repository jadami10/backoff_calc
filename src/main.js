import {
  isJitterType,
  resolveJitterType,
  generateSchedule,
  summarizeSchedule,
  validateConfig,
} from "./backoff.js";
import { createDelayChart } from "./chart.js";
import { resolveDisplayMode } from "./display.js";
import { resolveChartMode } from "./chartMode.js";
import { resolveChartSeriesMode } from "./chartSeriesMode.js";
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
const chartSeriesModeInputs = Array.from(
  document.querySelectorAll('input[name="chartSeriesMode"]'),
);
const chartSeriesField = document.querySelector("#chart-series-field");
const jitterInputs = Array.from(document.querySelectorAll('input[name="jitter"]'));
const factorGroup = document.querySelector("#factor-group");
const incrementGroup = document.querySelector("#increment-group");
const jitterTrigger = document.querySelector("#jitter-trigger");
const jitterPopover = document.querySelector("#jitter-popover");
const jitterTriggerValue = document.querySelector("#jitter-trigger-value");
const shareLinkButton = document.querySelector("#share-link");
const themeToggle = document.querySelector("#theme-toggle");
const scheduleBody = document.querySelector("#schedule-body");
const chartCanvas = document.querySelector("#delay-chart");
const displayModeSelect = document.querySelector("#display-mode");
const primaryDelayHeader = document.querySelector("#primary-delay-header");
const secondaryDelayHeader = document.querySelector("#secondary-delay-header");
const tertiaryDelayHeader = document.querySelector("#tertiary-delay-header");
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
const chartFallbackMessage = document.querySelector("#chart-fallback-message");
const privacyButton = document.querySelector("#privacy-button");
const privacyModal = document.querySelector("#privacy-modal");
const privacyCloseButton = document.querySelector("#privacy-close");
const helpButton = document.querySelector("#help-button");
const helpModal = document.querySelector("#help-modal");
const helpCloseButton = document.querySelector("#help-close");
const helpTabBackoff = document.querySelector("#help-tab-backoff");
const helpTabJitter = document.querySelector("#help-tab-jitter");
const helpPanelBackoff = document.querySelector("#help-panel-backoff");
const helpPanelJitter = document.querySelector("#help-panel-jitter");
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
  chartSeriesModeInputs.length === 0 ||
  chartSeriesModeInputs.some((input) => !(input instanceof HTMLInputElement)) ||
  !(chartSeriesField instanceof HTMLElement) ||
  jitterInputs.length === 0 ||
  jitterInputs.some((input) => !(input instanceof HTMLInputElement)) ||
  !(factorGroup instanceof HTMLElement) ||
  !(incrementGroup instanceof HTMLElement) ||
  !(jitterTrigger instanceof HTMLButtonElement) ||
  !(jitterPopover instanceof HTMLElement) ||
  !(jitterTriggerValue instanceof HTMLElement) ||
  !(shareLinkButton instanceof HTMLButtonElement) ||
  !(themeToggle instanceof HTMLButtonElement) ||
  !(scheduleBody instanceof HTMLElement) ||
  !(chartCanvas instanceof HTMLCanvasElement) ||
  !(displayModeSelect instanceof HTMLSelectElement) ||
  !(primaryDelayHeader instanceof HTMLElement) ||
  !(secondaryDelayHeader instanceof HTMLElement) ||
  !(tertiaryDelayHeader instanceof HTMLElement) ||
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
  jitterInputs,
};

function createNoopChart() {
  return {
    update() {},
    clear() {},
    destroy() {},
    setTheme() {},
  };
}

function setChartUnavailableMessageVisible(visible) {
  if (!(chartFallbackMessage instanceof HTMLElement)) {
    return;
  }
  chartFallbackMessage.hidden = !visible;
}

let chart = createNoopChart();
let hasWorkingChart = false;

try {
  chart = createDelayChart(chartCanvas);
  hasWorkingChart = true;
  setChartUnavailableMessageVisible(false);
} catch (error) {
  setChartUnavailableMessageVisible(true);
  console.error("Chart initialization failed.", error);
}

enforceNonNegativeIntegerInput(maxRetriesInput);

function readCssVariable(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getChartThemeTokens() {
  return {
    lineColor: readCssVariable("--chart-line"),
    fillColor: readCssVariable("--chart-fill"),
    rangeFillColor: readCssVariable("--chart-range-fill"),
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
  if (!hasWorkingChart) {
    return;
  }

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

  try {
    chart.setTheme(tokens);
  } catch (error) {
    hasWorkingChart = false;
    chart = createNoopChart();
    setChartUnavailableMessageVisible(true);
    console.error("Chart theming failed.", error);
  }
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

function getSelectedChartSeriesMode() {
  const selectedMode = chartSeriesModeInputs.find((input) => input.checked)?.value ?? "";
  return resolveChartSeriesMode(selectedMode);
}

function getSelectedJitterType() {
  return resolveJitterType(jitterInputs.find((input) => input.checked)?.value);
}

/**
 * @param {import("./backoff.js").JitterType} jitterType
 */
function jitterLabel(jitterType) {
  if (jitterType === "equal") {
    return "Equal";
  }
  if (jitterType === "full") {
    return "Full";
  }
  return "None";
}

function isJitterPopoverOpen() {
  return !jitterPopover.hidden;
}

/**
 * @param {boolean} open
 */
function setJitterPopoverOpen(open) {
  jitterPopover.hidden = !open;
  jitterTrigger.setAttribute("aria-expanded", open ? "true" : "false");
}

/**
 * @param {{focusTrigger?: boolean}} options
 */
function closeJitterPopover(options = {}) {
  setJitterPopoverOpen(false);
  if (options.focusTrigger) {
    jitterTrigger.focus();
  }
}

function syncJitterTriggerValue() {
  jitterTriggerValue.textContent = jitterLabel(getSelectedJitterType());
}

function updateChartSeriesVisibility() {
  const jitterType = getSelectedJitterType();
  const reserveSourceSlot = jitterType === "none";

  chartSeriesField.classList.toggle("source-slot--reserved", reserveSourceSlot);
  chartSeriesField.setAttribute("aria-hidden", reserveSourceSlot ? "true" : "false");

  for (const input of chartSeriesModeInputs) {
    if (reserveSourceSlot) {
      input.setAttribute("tabindex", "-1");
      continue;
    }
    input.removeAttribute("tabindex");
  }
}

/**
 * @param {{
 *   strategy:string,
 *   initialDelayMs:number,
 *   maxRetries:number,
 *   maxDelayMs:number|null,
 *   factor:number,
 *   incrementMs:number,
 *   jitter:string
 * }} config
 */
function simulationCacheKey(config) {
  return JSON.stringify({
    strategy: config.strategy,
    initialDelayMs: config.initialDelayMs,
    maxRetries: config.maxRetries,
    maxDelayMs: config.maxDelayMs,
    factor: config.factor,
    incrementMs: config.incrementMs,
    jitter: config.jitter,
  });
}

let cachedSimulationKey = "";
let cachedSimulationPoints = [];

/**
 * @param {Array<{
 *   delayMs:number,
 *   minDelayMs:number,
 *   maxDelayMs:number
 * }>} points
 */
function buildSimulation(points) {
  const simulation = [];
  let cumulativeSimulatedDelayMs = 0;

  for (const point of points) {
    const span = point.maxDelayMs - point.minDelayMs;
    const simulatedDelayMs =
      span <= 0 ? point.delayMs : point.minDelayMs + Math.random() * span;
    cumulativeSimulatedDelayMs += simulatedDelayMs;
    simulation.push({
      simulatedDelayMs,
      cumulativeSimulatedDelayMs,
    });
  }

  return simulation;
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
  if (isJitterType(shareState.jitter)) {
    const targetInput = jitterInputs.find((input) => input.value === shareState.jitter);
    if (targetInput != null) {
      targetInput.checked = true;
    }
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
  if (typeof shareState.chartSeriesMode === "string") {
    const targetInput = chartSeriesModeInputs.find(
      (input) => input.value === shareState.chartSeriesMode,
    );
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

function updateChartSafely(points, jitterType, chartSeriesMode, displayMode, chartMode) {
  if (!hasWorkingChart) {
    return;
  }

  try {
    chart.update(points, jitterType, chartSeriesMode, displayMode, chartMode);
    setChartUnavailableMessageVisible(false);
  } catch (error) {
    hasWorkingChart = false;
    chart = createNoopChart();
    setChartUnavailableMessageVisible(true);
    console.error("Chart rendering failed.", error);
  }
}

function openPrivacyModal() {
  if (!(privacyModal instanceof HTMLElement)) {
    return;
  }

  if (typeof privacyModal.showModal === "function") {
    privacyModal.showModal();
    return;
  }

  privacyModal.setAttribute("open", "");
}

function closePrivacyModal() {
  if (!(privacyModal instanceof HTMLElement)) {
    return;
  }

  if (typeof privacyModal.close === "function") {
    privacyModal.close();
    return;
  }

  privacyModal.removeAttribute("open");
}

/**
 * @param {string} activeTabId
 */
function setActiveHelpTab(activeTabId) {
  if (
    !(helpTabBackoff instanceof HTMLButtonElement) ||
    !(helpTabJitter instanceof HTMLButtonElement) ||
    !(helpPanelBackoff instanceof HTMLElement) ||
    !(helpPanelJitter instanceof HTMLElement)
  ) {
    return;
  }

  const tabPanelPairs = [
    { tab: helpTabBackoff, panel: helpPanelBackoff },
    { tab: helpTabJitter, panel: helpPanelJitter },
  ];

  for (const { tab, panel } of tabPanelPairs) {
    const isActive = tab.id === activeTabId;
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
    tab.setAttribute("tabindex", isActive ? "0" : "-1");
    panel.hidden = !isActive;
  }
}

function openHelpModal() {
  if (!(helpModal instanceof HTMLElement)) {
    return;
  }

  setActiveHelpTab("help-tab-backoff");
  closeJitterPopover();

  if (!helpModal.hasAttribute("open")) {
    if (typeof helpModal.showModal === "function") {
      helpModal.showModal();
    } else {
      helpModal.setAttribute("open", "");
    }
  }

  if (helpTabBackoff instanceof HTMLButtonElement) {
    helpTabBackoff.focus();
  }
}

function closeHelpModal() {
  if (!(helpModal instanceof HTMLElement) || !helpModal.hasAttribute("open")) {
    return;
  }

  if (typeof helpModal.close === "function") {
    helpModal.close();
    return;
  }

  helpModal.removeAttribute("open");
}

function recompute() {
  updateStrategyFields();
  const displayMode = resolveDisplayMode(displayModeSelect.value);
  const chartMode = getSelectedChartMode();
  const chartSeriesMode = getSelectedChartSeriesMode();
  const jitterType = getSelectedJitterType();
  syncJitterTriggerValue();
  updateChartSeriesVisibility();

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
  const simulationKey = simulationCacheKey(config);
  if (simulationKey !== cachedSimulationKey || cachedSimulationPoints.length !== points.length) {
    cachedSimulationKey = simulationKey;
    cachedSimulationPoints = buildSimulation(points);
  }
  const chartPoints = points.map((point, index) => ({
    ...point,
    simulatedDelayMs: cachedSimulationPoints[index]?.simulatedDelayMs ?? point.delayMs,
    cumulativeSimulatedDelayMs:
      cachedSimulationPoints[index]?.cumulativeSimulatedDelayMs ?? point.cumulativeDelayMs,
  }));
  const summary = summarizeSchedule(points);

  renderDelayTableHeaders(displayMode, {
    primaryDelay: primaryDelayHeader,
    secondaryDelay: secondaryDelayHeader,
    tertiaryDelay: tertiaryDelayHeader,
    cumulativeDelay: cumulativeDelayHeader,
  }, jitterType);
  updateChartSafely(chartPoints, jitterType, chartSeriesMode, displayMode, chartMode);
  renderScheduleTable(points, scheduleBody, displayMode, jitterType);
  renderSummary(summary, summaryElements, displayMode);
}

const debouncedRecompute = debounce(recompute, 100);
const recomputeInputs = [
  ...strategyInputs,
  ...chartModeInputs,
  ...chartSeriesModeInputs,
  ...jitterInputs,
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

jitterTrigger.addEventListener("click", () => {
  setJitterPopoverOpen(!isJitterPopoverOpen());
});

document.addEventListener("pointerdown", (event) => {
  if (!isJitterPopoverOpen()) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    closeJitterPopover();
    return;
  }

  if (jitterPopover.contains(target) || jitterTrigger.contains(target)) {
    return;
  }

  closeJitterPopover();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !isJitterPopoverOpen()) {
    return;
  }
  event.preventDefault();
  closeJitterPopover({ focusTrigger: true });
});

for (const jitterInput of jitterInputs) {
  jitterInput.addEventListener("change", () => {
    syncJitterTriggerValue();
    closeJitterPopover({ focusTrigger: true });
  });
}

shareLinkButton.addEventListener("click", async () => {
  const shareUrl = createShareUrl(window.location.href, {
    strategy: getSelectedStrategy(),
    initialDelayMs: initialDelayInput.value,
    maxRetries: maxRetriesInput.value,
    maxDelayMs: maxDelayInput.value,
    factor: factorInput.value,
    incrementMs: incrementInput.value,
    jitter: getSelectedJitterType(),
    displayMode: resolveDisplayMode(displayModeSelect.value),
    chartMode: getSelectedChartMode(),
    chartSeriesMode: getSelectedChartSeriesMode(),
  });

  try {
    await copyTextToClipboard(shareUrl);
    setShareButtonCopiedFeedback();
  } catch {
    setShareButtonErrorFeedback();
  }
});

if (
  helpButton instanceof HTMLButtonElement &&
  helpCloseButton instanceof HTMLButtonElement &&
  helpModal instanceof HTMLElement &&
  helpTabBackoff instanceof HTMLButtonElement &&
  helpTabJitter instanceof HTMLButtonElement
) {
  const helpTabs = [helpTabBackoff, helpTabJitter];

  helpButton.addEventListener("click", () => {
    openHelpModal();
  });

  helpCloseButton.addEventListener("click", () => {
    closeHelpModal();
  });

  helpModal.addEventListener("click", (event) => {
    if (event.target === helpModal) {
      closeHelpModal();
    }
  });

  helpModal.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeHelpModal();
  });

  helpModal.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    closeHelpModal();
  });

  for (const tab of helpTabs) {
    tab.addEventListener("click", () => {
      setActiveHelpTab(tab.id);
    });

    tab.addEventListener("keydown", (event) => {
      const activeIndex = helpTabs.findIndex((helpTab) => helpTab.id === tab.id);
      if (activeIndex < 0) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        const nextTab = helpTabs[(activeIndex + 1) % helpTabs.length];
        setActiveHelpTab(nextTab.id);
        nextTab.focus();
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        const nextTab = helpTabs[(activeIndex - 1 + helpTabs.length) % helpTabs.length];
        setActiveHelpTab(nextTab.id);
        nextTab.focus();
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        const nextTab = helpTabs[0];
        setActiveHelpTab(nextTab.id);
        nextTab.focus();
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        const nextTab = helpTabs[helpTabs.length - 1];
        setActiveHelpTab(nextTab.id);
        nextTab.focus();
      }
    });
  }
}

if (
  privacyButton instanceof HTMLButtonElement &&
  privacyCloseButton instanceof HTMLButtonElement &&
  privacyModal instanceof HTMLElement
) {
  privacyButton.addEventListener("click", () => {
    openPrivacyModal();
  });

  privacyCloseButton.addEventListener("click", () => {
    closePrivacyModal();
  });

  privacyModal.addEventListener("click", (event) => {
    if (event.target === privacyModal) {
      closePrivacyModal();
    }
  });
}

applySharedStateFromUrl();
updateStrategyFields();
syncJitterTriggerValue();
updateChartSeriesVisibility();
recompute();
