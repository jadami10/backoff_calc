function toChartData(points) {
  return {
    labels: points.map((point) => point.retry),
    values: points.map((point) => point.delayMs),
  };
}

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
          borderColor: "#0f766e",
          backgroundColor: "rgba(15, 118, 110, 0.13)",
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
          title: {
            display: true,
            text: "Retry Number",
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Delay (ms)",
          },
        },
      },
    },
  });

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
    destroy() {
      chart.destroy();
    },
  };
}

