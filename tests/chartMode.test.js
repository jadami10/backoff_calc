import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_CHART_MODE, isChartMode, resolveChartMode } from "../src/chartMode.js";

test("chart mode helpers validate and normalize values", () => {
  assert.equal(isChartMode("delay"), true);
  assert.equal(isChartMode("cumulative"), true);
  assert.equal(isChartMode("total"), false);
  assert.equal(resolveChartMode("unknown"), DEFAULT_CHART_MODE);
  assert.equal(resolveChartMode("cumulative"), "cumulative");
});
