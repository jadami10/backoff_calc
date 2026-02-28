import {
  DEFAULT_DISPLAY_MODE,
  formatDuration,
  resolveDisplayMode,
  unitLabel,
} from "./display.js";

function toChartData(points) {
  return {
    labels: points.map((point) => point.retry),
    values: points.map((point) => point.delayMs),
  };
}

/**
 * @typedef {object} ChartThemeTokens
 * @property {string} lineColor
 * @property {string} fillColor
 * @property {string} axisTextColor
 * @property {string} gridColor
 * @property {string} tooltipBackgroundColor
 * @property {string} tooltipTextColor
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

  const chart = new ChartConstructor(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Delay",
          data: [],
          borderColor: "#27272a",
          backgroundColor: "rgba(39, 39, 42, 0.12)",
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111111",
          titleColor: "#f5f5f5",
          bodyColor: "#f5f5f5",
          callbacks: {
            label(context) {
              const value = context.parsed.y ?? 0;
              return formatDuration(value, currentDisplayMode);
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
            text: `Delay (${unitLabel(currentDisplayMode)})`,
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
    chart.options.scales.y.title.text = `Delay (${unitLabel(currentDisplayMode)})`;
  }

  /**
   * @param {ChartThemeTokens} tokens
   */
  function setTheme(tokens) {
    const dataset = chart.data.datasets[0];
    dataset.borderColor = tokens.lineColor;
    dataset.backgroundColor = tokens.fillColor;

    chart.options.plugins.tooltip.backgroundColor = tokens.tooltipBackgroundColor;
    chart.options.plugins.tooltip.titleColor = tokens.tooltipTextColor;
    chart.options.plugins.tooltip.bodyColor = tokens.tooltipTextColor;

    chart.options.scales.x.ticks.color = tokens.axisTextColor;
    chart.options.scales.x.grid.color = tokens.gridColor;
    chart.options.scales.x.title.color = tokens.axisTextColor;
    chart.options.scales.y.ticks.color = tokens.axisTextColor;
    chart.options.scales.y.grid.color = tokens.gridColor;
    chart.options.scales.y.title.color = tokens.axisTextColor;

    chart.update();
  }

  return {
    update(points, displayMode = currentDisplayMode) {
      applyDisplayMode(displayMode);
      const chartData = toChartData(points);
      chart.data.labels = chartData.labels;
      chart.data.datasets[0].data = chartData.values;
      chart.update();
    },
    clear(displayMode = currentDisplayMode) {
      applyDisplayMode(displayMode);
      chart.data.labels = [];
      chart.data.datasets[0].data = [];
      chart.update();
    },
    setTheme,
    destroy() {
      chart.destroy();
    },
  };
}
