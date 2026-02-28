import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CHART_SERIES_MODE,
  isChartSeriesMode,
  resolveChartSeriesMode,
} from "../src/chartSeriesMode.js";

test("chart series mode helpers validate and normalize values", () => {
  assert.equal(isChartSeriesMode("expected"), true);
  assert.equal(isChartSeriesMode("simulated"), true);
  assert.equal(isChartSeriesMode("sampled"), false);
  assert.equal(resolveChartSeriesMode("unknown"), DEFAULT_CHART_SERIES_MODE);
  assert.equal(resolveChartSeriesMode("simulated"), "simulated");
});
