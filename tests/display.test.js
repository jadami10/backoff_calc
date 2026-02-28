import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DISPLAY_MODE,
  formatDuration,
  isDisplayMode,
  resolveDisplayMode,
  unitLabel,
} from "../src/display.js";

function formatNumber(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

test("formats durations with explicit unit scales", () => {
  assert.equal(formatDuration(1500, "ms"), `${formatNumber(1500)} ms`);
  assert.equal(formatDuration(1500, "s"), `${formatNumber(1.5)} s`);
  assert.equal(formatDuration(90_000, "min"), `${formatNumber(1.5)} min`);
  assert.equal(formatDuration(5_400_000, "h"), `${formatNumber(1.5)} h`);
});

test("humanize mode uses compact mixed units", () => {
  assert.equal(formatDuration(500, "humanize"), "500ms");
  assert.equal(formatDuration(1000, "humanize"), "1s");
  assert.equal(formatDuration(61_000, "humanize"), "1m 1s");
  assert.equal(formatDuration(3_661_250, "humanize"), "1h 1m 1s 250ms");
});

test("humanize mode handles zero and fractional milliseconds", () => {
  assert.equal(formatDuration(0, "humanize"), "0 ms");
  assert.equal(formatDuration(1234.56, "humanize"), "1s 234.56ms");
});

test("non-finite values render as placeholder", () => {
  assert.equal(formatDuration(Number.NaN, "ms"), "-");
  assert.equal(formatDuration(Number.POSITIVE_INFINITY, "humanize"), "-");
});

test("display mode helpers validate and normalize values", () => {
  assert.equal(isDisplayMode("ms"), true);
  assert.equal(isDisplayMode("humanize"), true);
  assert.equal(isDisplayMode("days"), false);
  assert.equal(resolveDisplayMode("unknown"), DEFAULT_DISPLAY_MODE);
  assert.equal(resolveDisplayMode("min"), "min");
});

test("unit labels match display mode", () => {
  assert.equal(unitLabel("ms"), "ms");
  assert.equal(unitLabel("s"), "s");
  assert.equal(unitLabel("min"), "min");
  assert.equal(unitLabel("h"), "h");
  assert.equal(unitLabel("humanize"), "humanized");
});
