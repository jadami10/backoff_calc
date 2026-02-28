import {
  DEFAULT_JITTER_TYPE,
  resolveJitterType,
} from "./backoff.js";
import {
  DEFAULT_DISPLAY_MODE,
  formatDuration,
  resolveDisplayMode,
  unitLabel,
} from "./display.js";
import { DEFAULT_CHART_MODE, resolveChartMode } from "./chartMode.js";

const HOVER_GUIDE_PLUGIN_ID = "hoverGuide";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SUBTLE_DATA_ANIMATION = {
  duration: 440,
  easing: "easeOutCubic",
};

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== "function") {
    return false;
  }
  return globalThis.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function resolveAnimationOptions() {
  if (prefersReducedMotion()) {
    return false;
  }
  return { ...SUBTLE_DATA_ANIMATION };
}

const hoverGuidePlugin = {
  id: HOVER_GUIDE_PLUGIN_ID,
  afterDatasetsDraw(chart, _args, options) {
    const activeElements = chart.tooltip?.getActiveElements?.() ?? [];
    if (activeElements.length === 0) {
      return;
    }

    const { chartArea, ctx } = chart;
    const x = activeElements[0].element.x;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = options?.lineWidth ?? 1;
    ctx.strokeStyle = options?.color ?? "rgba(39, 39, 42, 0.28)";
    ctx.stroke();
    ctx.restore();
  },
};

/**
 * @param {{
 *   delayMs:number,
 *   expectedDelayMs?:number,
 *   minDelayMs?:number,
 *   maxDelayMs?:number,
 *   cumulativeDelayMs:number,
 *   cumulativeMinDelayMs?:number,
 *   cumulativeMaxDelayMs?:number
 * }} point
 * @param {import("./chartMode.js").ChartMode} chartMode
 */
function pointValues(point, chartMode) {
  if (chartMode === "cumulative") {
    return {
      expected: point.cumulativeDelayMs,
      min: point.cumulativeMinDelayMs ?? point.cumulativeDelayMs,
      max: point.cumulativeMaxDelayMs ?? point.cumulativeDelayMs,
    };
  }

  return {
    expected: point.expectedDelayMs ?? point.delayMs,
    min: point.minDelayMs ?? point.delayMs,
    max: point.maxDelayMs ?? point.delayMs,
  };
}

/**
 * @param {Array<{retry:number}> & Array<{
 *   delayMs:number,
 *   expectedDelayMs?:number,
 *   minDelayMs?:number,
 *   maxDelayMs?:number,
 *   cumulativeDelayMs:number,
 *   cumulativeMinDelayMs?:number,
 *   cumulativeMaxDelayMs?:number
 * }>} points
 * @param {import("./chartMode.js").ChartMode} chartMode
 * @param {import("./backoff.js").JitterType} jitterType
 */
function toChartData(points, chartMode, jitterType) {
  const resolvedJitterType = resolveJitterType(jitterType);

  return {
    labels: points.map((point) => point.retry),
    expectedValues: points.map((point) => pointValues(point, chartMode).expected),
    minValues: points.map((point) => pointValues(point, chartMode).min),
    maxValues: points.map((point) => pointValues(point, chartMode).max),
    showRange: resolvedJitterType !== "none",
  };
}

/**
 * @param {import("./display.js").DisplayMode} displayMode
 * @param {import("./chartMode.js").ChartMode} chartMode
 */
function yAxisTitle(displayMode, chartMode) {
  const prefix = chartMode === "cumulative" ? "Cumulative Delay" : "Delay";
  return `${prefix} (${unitLabel(displayMode)})`;
}

/**
 * @typedef {object} ChartThemeTokens
 * @property {string} lineColor
 * @property {string} fillColor
 * @property {string} rangeFillColor
 * @property {string} axisTextColor
 * @property {string} gridColor
 * @property {string} tooltipBackgroundColor
 * @property {string} tooltipTextColor
 * @property {string} hoverGuideColor
 */

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createDelayChart(canvas) {
  const ChartConstructor = globalThis.Chart;
  if (!ChartConstructor) {
    throw new Error("Chart.js is not loaded.");
  }

  let currentDisplayMode = DEFAULT_DISPLAY_MODE;
  let currentChartMode = DEFAULT_CHART_MODE;
  let currentJitterType = DEFAULT_JITTER_TYPE;
  let currentChartData = {
    labels: [],
    expectedValues: [],
    minValues: [],
    maxValues: [],
    showRange: false,
  };
  let activePointIndex = null;
  let isPointerInsideChart = false;

  /**
   * @param {number} index
   */
  function clampIndex(index) {
    const maxIndex = chart.data.datasets[0].data.length - 1;
    return Math.min(Math.max(index, 0), maxIndex);
  }

  /**
   * @param {number} index
   */
  function setActivePoint(index) {
    if (chart.data.datasets[0].data.length === 0) {
      activePointIndex = null;
      chart.setActiveElements([]);
      chart.tooltip?.setActiveElements?.([], { x: 0, y: 0 });
      return;
    }

    const clampedIndex = clampIndex(index);
    const point = chart.getDatasetMeta(0).data[clampedIndex];
    if (!point) {
      return;
    }

    activePointIndex = clampedIndex;
    const activeElements = [{ datasetIndex: 0, index: clampedIndex }];
    const anchor = point.getProps(["x", "y"], true);
    chart.setActiveElements(activeElements);
    chart.tooltip?.setActiveElements?.(activeElements, anchor);
  }

  function clearActivePoint() {
    activePointIndex = null;
    chart.setActiveElements([]);
    chart.tooltip?.setActiveElements?.([], { x: 0, y: 0 });
  }

  /**
   * @param {MouseEvent | TouchEvent} event
   */
  function snapToNearestX(event) {
    const elements = chart.getElementsAtEventForMode(
      event,
      "index",
      { axis: "x", intersect: false },
      false,
    );
    if (elements.length === 0) {
      clearActivePoint();
      chart.update("none");
      return;
    }

    setActivePoint(elements[0].index);
    chart.update("none");
  }

  const chart = new ChartConstructor(canvas, {
    type: "line",
    plugins: [hoverGuidePlugin],
    data: {
      labels: [],
      datasets: [
        {
          label: "Expected Delay",
          data: [],
          borderColor: "#27272a",
          backgroundColor: "rgba(39, 39, 42, 0.12)",
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 4,
          pointHitRadius: 18,
          fill: true,
          tension: 0.2,
        },
        {
          label: "Min Delay",
          data: [],
          borderColor: "rgba(39, 39, 42, 0)",
          borderWidth: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          pointHitRadius: 0,
          fill: false,
          tension: 0.2,
        },
        {
          label: "Max Delay",
          data: [],
          borderColor: "rgba(39, 39, 42, 0)",
          backgroundColor: "rgba(39, 39, 42, 0.18)",
          borderWidth: 0,
          pointRadius: 0,
          pointHoverRadius: 0,
          pointHitRadius: 0,
          fill: "-1",
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: resolveAnimationOptions(),
      interaction: {
        mode: "index",
        axis: "x",
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        [HOVER_GUIDE_PLUGIN_ID]: {
          color: "rgba(39, 39, 42, 0.28)",
          lineWidth: 1,
        },
        tooltip: {
          backgroundColor: "#111111",
          titleColor: "#f5f5f5",
          bodyColor: "#f5f5f5",
          intersect: false,
          mode: "index",
          displayColors: false,
          filter(context) {
            return context.datasetIndex === 0;
          },
          callbacks: {
            label(context) {
              const index = context.dataIndex;
              if (index < 0 || index >= currentChartData.expectedValues.length) {
                return "-";
              }

              const expected = currentChartData.expectedValues[index];
              if (!currentChartData.showRange) {
                return formatDuration(expected, currentDisplayMode);
              }

              const min = currentChartData.minValues[index];
              const max = currentChartData.maxValues[index];
              return [
                `Min: ${formatDuration(min, currentDisplayMode)}`,
                `Expected: ${formatDuration(expected, currentDisplayMode)}`,
                `Max: ${formatDuration(max, currentDisplayMode)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#3f3f46",
            maxTicksLimit: 10,
          },
          grid: {
            color: "rgba(39, 39, 42, 0.14)",
          },
          title: {
            display: true,
            text: "Retry Number",
            color: "#3f3f46",
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#3f3f46",
            callback(value) {
              return formatDuration(Number(value), currentDisplayMode);
            },
          },
          grid: {
            color: "rgba(39, 39, 42, 0.14)",
          },
          title: {
            display: true,
            text: yAxisTitle(currentDisplayMode, currentChartMode),
            color: "#3f3f46",
          },
        },
      },
    },
  });

  /**
   * @param {import("./display.js").DisplayMode} displayMode
   */
  function applyDisplayMode(displayMode) {
    currentDisplayMode = resolveDisplayMode(displayMode);
    chart.options.scales.y.title.text = yAxisTitle(currentDisplayMode, currentChartMode);
  }

  /**
   * @param {import("./chartMode.js").ChartMode} chartMode
   */
  function applyChartMode(chartMode) {
    currentChartMode = resolveChartMode(chartMode);
    chart.options.scales.y.title.text = yAxisTitle(currentDisplayMode, currentChartMode);
  }

  /**
   * @param {import("./backoff.js").JitterType} jitterType
   */
  function applyJitterType(jitterType) {
    currentJitterType = resolveJitterType(jitterType);
  }

  /**
   * @param {ChartThemeTokens} tokens
   */
  function setTheme(tokens) {
    const expectedDataset = chart.data.datasets[0];
    const maxDataset = chart.data.datasets[2];

    expectedDataset.borderColor = tokens.lineColor;
    expectedDataset.backgroundColor = tokens.fillColor;
    maxDataset.backgroundColor = tokens.rangeFillColor;

    chart.options.plugins.tooltip.backgroundColor = tokens.tooltipBackgroundColor;
    chart.options.plugins.tooltip.titleColor = tokens.tooltipTextColor;
    chart.options.plugins.tooltip.bodyColor = tokens.tooltipTextColor;

    chart.options.scales.x.ticks.color = tokens.axisTextColor;
    chart.options.scales.x.grid.color = tokens.gridColor;
    chart.options.scales.x.title.color = tokens.axisTextColor;
    chart.options.scales.y.ticks.color = tokens.axisTextColor;
    chart.options.scales.y.grid.color = tokens.gridColor;
    chart.options.scales.y.title.color = tokens.axisTextColor;
    chart.options.plugins[HOVER_GUIDE_PLUGIN_ID].color = tokens.hoverGuideColor;

    chart.update("none");
  }

  function handlePointerEnterOrMove(event) {
    isPointerInsideChart = true;
    snapToNearestX(event);
  }

  function handlePointerLeave() {
    isPointerInsideChart = false;
    clearActivePoint();
    chart.update("none");
  }

  canvas.addEventListener("mousemove", handlePointerEnterOrMove);
  canvas.addEventListener("mouseenter", handlePointerEnterOrMove);
  canvas.addEventListener("touchmove", handlePointerEnterOrMove, { passive: true });
  canvas.addEventListener("touchstart", handlePointerEnterOrMove, { passive: true });
  canvas.addEventListener("mouseleave", handlePointerLeave);
  canvas.addEventListener("touchend", handlePointerLeave, { passive: true });
  canvas.addEventListener("touchcancel", handlePointerLeave, { passive: true });

  return {
    update(
      points,
      jitterType = currentJitterType,
      displayMode = currentDisplayMode,
      chartMode = currentChartMode,
    ) {
      applyDisplayMode(displayMode);
      applyChartMode(chartMode);
      applyJitterType(jitterType);
      chart.options.animation = resolveAnimationOptions();

      const chartData = toChartData(points, currentChartMode, currentJitterType);
      currentChartData = chartData;
      chart.data.labels = chartData.labels;

      const expectedDataset = chart.data.datasets[0];
      const minDataset = chart.data.datasets[1];
      const maxDataset = chart.data.datasets[2];

      expectedDataset.data = chartData.expectedValues;
      expectedDataset.fill = chartData.showRange ? false : true;

      minDataset.hidden = !chartData.showRange;
      maxDataset.hidden = !chartData.showRange;
      minDataset.data = chartData.showRange ? chartData.minValues : [];
      maxDataset.data = chartData.showRange ? chartData.maxValues : [];

      if (chartData.expectedValues.length === 0) {
        clearActivePoint();
      } else if (isPointerInsideChart && activePointIndex !== null) {
        setActivePoint(activePointIndex);
      } else {
        clearActivePoint();
      }
      chart.update();
    },
    clear(displayMode = currentDisplayMode, chartMode = currentChartMode) {
      applyDisplayMode(displayMode);
      applyChartMode(chartMode);
      chart.options.animation = resolveAnimationOptions();

      chart.data.labels = [];
      for (const dataset of chart.data.datasets) {
        dataset.data = [];
        dataset.hidden = false;
      }
      currentChartData = {
        labels: [],
        expectedValues: [],
        minValues: [],
        maxValues: [],
        showRange: false,
      };

      clearActivePoint();
      chart.update();
    },
    setTheme,
    destroy() {
      canvas.removeEventListener("mousemove", handlePointerEnterOrMove);
      canvas.removeEventListener("mouseenter", handlePointerEnterOrMove);
      canvas.removeEventListener("touchmove", handlePointerEnterOrMove);
      canvas.removeEventListener("touchstart", handlePointerEnterOrMove);
      canvas.removeEventListener("mouseleave", handlePointerLeave);
      canvas.removeEventListener("touchend", handlePointerLeave);
      canvas.removeEventListener("touchcancel", handlePointerLeave);
      chart.destroy();
    },
  };
}
