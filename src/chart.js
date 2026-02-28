function toChartData(points) {
  return {
    labels: points.map((point) => point.retry),
    values: points.map((point) => point.delayMs),
  };
}

const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

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

  const chart = new ChartConstructor(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Delay (ms)",
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
              return `${value.toLocaleString()} ms`;
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
              return compactNumberFormatter.format(Number(value));
            },
          },
          grid: {
            color: "rgba(39, 39, 42, 0.14)",
          },
          title: {
            display: true,
            text: "Delay (ms)",
            color: "#3f3f46",
          },
        },
      },
    },
  });

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
    update(points) {
      const chartData = toChartData(points);
      chart.data.labels = chartData.labels;
      chart.data.datasets[0].data = chartData.values;
      chart.update();
    },
    clear() {
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
