import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DISPLAY_MODE,
  formatDuration,
  isDisplayMode,
  resolveDisplayMode,
  unitLabel,
} from "../src/display.js";

const WEEK_MS = 7 * 24 * 3600 * 1000;

function formatNumber(value) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

test("formats durations with explicit unit scales", () => {
  assert.equal(formatDuration(1500, "ms"), `${formatNumber(1500)} ms`);
  assert.equal(formatDuration(1500, "s"), `${formatNumber(1.5)} s`);
  assert.equal(formatDuration(90_000, "min"), `${formatNumber(1.5)} min`);
  assert.equal(formatDuration(5_400_000, "h"), `${formatNumber(1.5)} h`);
});

test("human-readable mode uses compact mixed units", () => {
  assert.equal(formatDuration(500, "humanize"), "500ms");
  assert.equal(formatDuration(1000, "humanize"), "1s");
  assert.equal(formatDuration(61_000, "humanize"), "1m 1s");
  assert.equal(formatDuration(3_661_250, "humanize"), "1h 1m 1s 250ms");
  assert.equal(formatDuration(86_400_000, "humanize"), "1d");
  assert.equal(formatDuration(694_861_250, "humanize"), "1w 1d 1h 1m 1s 250ms");
});

test("human-readable mode handles zero and fractional milliseconds", () => {
  assert.equal(formatDuration(0, "humanize"), "0 ms");
  assert.equal(formatDuration(1234.56, "humanize"), "1s 234.56ms");
});

test("explicit unit modes switch to scientific notation at 12 digits", () => {
  assert.equal(formatDuration(99_999_999_999, "ms"), "99,999,999,999 ms");
  assert.equal(formatDuration(100_000_000_000, "ms"), "1e+11 ms");

  assert.equal(formatDuration(99_999_999_999 * 1000, "s"), "99,999,999,999 s");
  assert.equal(formatDuration(100_000_000_000 * 1000, "s"), "1e+11 s");

  assert.equal(formatDuration(99_999_999_999 * 60_000, "min"), "99,999,999,999 min");
  assert.equal(formatDuration(100_000_000_000 * 60_000, "min"), "1e+11 min");

  assert.equal(formatDuration(99_999_999_999 * 3_600_000, "h"), "99,999,999,999 h");
  assert.equal(formatDuration(100_000_000_000 * 3_600_000, "h"), "1e+11 h");
});

test("scientific notation keeps four significant digits and trims trailing zeros", () => {
  assert.equal(formatDuration(1_234_567_890_123, "ms"), "1.235e+12 ms");
  assert.equal(formatDuration(1_230_000_000_000, "ms"), "1.23e+12 ms");
  assert.equal(formatDuration(1_000_000_000_000, "ms"), "1e+12 ms");
});

test("scientific notation preserves sign and explicit mode zero formatting", () => {
  assert.equal(formatDuration(-100_000_000_000, "ms"), "-1e+11 ms");
  assert.equal(formatDuration(0, "ms"), "0 ms");
});

test("human-readable mode uses mixed units below weeks cutoff and scientific weeks at cutoff", () => {
  assert.equal(formatDuration(WEEK_MS * 10 ** 10, "humanize"), "10,000,000,000w");
  assert.equal(formatDuration(WEEK_MS * 10 ** 11, "humanize"), "1e+11w");
  assert.equal(formatDuration(-WEEK_MS * 10 ** 11, "humanize"), "-1e+11w");
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
  assert.equal(unitLabel("humanize"), "human-readable");
});
