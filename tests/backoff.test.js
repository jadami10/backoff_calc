import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChartMathExplanation,
  generateSchedule,
  summarizeSchedule,
  validateConfig,
} from "../src/backoff.js";

test("exponential schedule without cap", () => {
  const schedule = generateSchedule({
    strategy: "exponential",
    initialDelayMs: 500,
    maxRetries: 5,
    maxDelayMs: null,
    factor: 2,
  });

  assert.equal(schedule.length, 5);
  assert.deepEqual(
    schedule.map((point) => point.delayMs),
    [500, 1000, 2000, 4000, 8000],
  );
  assert.equal(schedule[4].cumulativeDelayMs, 15500);
});

test("exponential schedule with max delay cap", () => {
  const schedule = generateSchedule({
    strategy: "exponential",
    initialDelayMs: 500,
    maxRetries: 6,
    maxDelayMs: 1500,
    factor: 2,
  });

  assert.deepEqual(
    schedule.map((point) => point.delayMs),
    [500, 1000, 1500, 1500, 1500, 1500],
  );
  assert.equal(schedule[5].cumulativeDelayMs, 7500);
});

test("linear schedule with increment", () => {
  const schedule = generateSchedule({
    strategy: "linear",
    initialDelayMs: 500,
    maxRetries: 4,
    maxDelayMs: null,
    incrementMs: 500,
  });

  assert.deepEqual(
    schedule.map((point) => point.delayMs),
    [500, 1000, 1500, 2000],
  );
  assert.equal(schedule[3].cumulativeDelayMs, 5000);
});

test("fixed schedule uses the same delay on every retry", () => {
  const schedule = generateSchedule({
    strategy: "fixed",
    initialDelayMs: 750,
    maxRetries: 4,
    maxDelayMs: null,
  });

  assert.deepEqual(
    schedule.map((point) => point.delayMs),
    [750, 750, 750, 750],
  );
  assert.equal(schedule[3].cumulativeDelayMs, 3000);
});

test("fixed schedule respects max delay cap", () => {
  const schedule = generateSchedule({
    strategy: "fixed",
    initialDelayMs: 1200,
    maxRetries: 3,
    maxDelayMs: 1000,
  });

  assert.deepEqual(
    schedule.map((point) => point.delayMs),
    [1000, 1000, 1000],
  );
  assert.equal(schedule[2].cumulativeDelayMs, 3000);
});

test("equal jitter exposes min, expected, and max delay ranges", () => {
  const schedule = generateSchedule({
    strategy: "linear",
    initialDelayMs: 500,
    maxRetries: 2,
    maxDelayMs: null,
    incrementMs: 500,
    jitter: "equal",
  });

  assert.deepEqual(
    schedule.map((point) => ({
      minDelayMs: point.minDelayMs,
      expectedDelayMs: point.expectedDelayMs,
      maxDelayMs: point.maxDelayMs,
      cumulativeDelayMs: point.cumulativeDelayMs,
      cumulativeMinDelayMs: point.cumulativeMinDelayMs,
      cumulativeMaxDelayMs: point.cumulativeMaxDelayMs,
    })),
    [
      {
        minDelayMs: 250,
        expectedDelayMs: 375,
        maxDelayMs: 500,
        cumulativeDelayMs: 375,
        cumulativeMinDelayMs: 250,
        cumulativeMaxDelayMs: 500,
      },
      {
        minDelayMs: 500,
        expectedDelayMs: 750,
        maxDelayMs: 1000,
        cumulativeDelayMs: 1125,
        cumulativeMinDelayMs: 750,
        cumulativeMaxDelayMs: 1500,
      },
    ],
  );
});

test("full jitter is calculated from capped deterministic delay", () => {
  const schedule = generateSchedule({
    strategy: "fixed",
    initialDelayMs: 1200,
    maxRetries: 3,
    maxDelayMs: 1000,
    jitter: "full",
  });

  assert.deepEqual(
    schedule.map((point) => ({
      minDelayMs: point.minDelayMs,
      expectedDelayMs: point.expectedDelayMs,
      maxDelayMs: point.maxDelayMs,
      delayMs: point.delayMs,
    })),
    [
      { minDelayMs: 0, expectedDelayMs: 500, maxDelayMs: 1000, delayMs: 500 },
      { minDelayMs: 0, expectedDelayMs: 500, maxDelayMs: 1000, delayMs: 500 },
      { minDelayMs: 0, expectedDelayMs: 500, maxDelayMs: 1000, delayMs: 500 },
    ],
  );
  assert.equal(schedule[2].cumulativeDelayMs, 1500);
  assert.equal(schedule[2].cumulativeMinDelayMs, 0);
  assert.equal(schedule[2].cumulativeMaxDelayMs, 3000);
});

test("maxRetries = 0 returns empty schedule and zero summary", () => {
  const schedule = generateSchedule({
    strategy: "linear",
    initialDelayMs: 100,
    maxRetries: 0,
    maxDelayMs: null,
    incrementMs: 100,
  });

  assert.deepEqual(schedule, []);
  assert.deepEqual(summarizeSchedule(schedule), {
    totalRetries: 0,
    finalDelayMs: 0,
    totalDelayMs: 0,
  });
});

test("maxRetries = 0 returns empty schedule with jitter enabled", () => {
  const schedule = generateSchedule({
    strategy: "fixed",
    initialDelayMs: 100,
    maxRetries: 0,
    maxDelayMs: null,
    jitter: "full",
  });

  assert.deepEqual(schedule, []);
  assert.deepEqual(summarizeSchedule(schedule), {
    totalRetries: 0,
    finalDelayMs: 0,
    totalDelayMs: 0,
  });
});

test("maxRetries upper bound accepts 1000", () => {
  const errors = validateConfig({
    strategy: "linear",
    initialDelayMs: 100,
    maxRetries: 1000,
    maxDelayMs: null,
    incrementMs: 100,
  });

  assert.equal(errors.length, 0);
});

test("validation accepts known jitter types", () => {
  const baseConfig = {
    strategy: "fixed",
    initialDelayMs: 100,
    maxRetries: 2,
    maxDelayMs: null,
  };

  assert.equal(validateConfig({ ...baseConfig, jitter: "none" }).length, 0);
  assert.equal(validateConfig({ ...baseConfig, jitter: "equal" }).length, 0);
  assert.equal(validateConfig({ ...baseConfig, jitter: "full" }).length, 0);
});

test("validation rejects unknown jitter types", () => {
  const errors = validateConfig({
    strategy: "fixed",
    initialDelayMs: 100,
    maxRetries: 2,
    maxDelayMs: null,
    jitter: "random",
  });

  assert.ok(errors.some((error) => error.field === "jitter"));
  assert.throws(
    () =>
      generateSchedule({
        strategy: "fixed",
        initialDelayMs: 100,
        maxRetries: 2,
        maxDelayMs: null,
        jitter: "random",
      }),
    /Invalid configuration/,
  );
});

test("validation rejects maxRetries above 1000", () => {
  const errors = validateConfig({
    strategy: "linear",
    initialDelayMs: 100,
    maxRetries: 1001,
    maxDelayMs: null,
    incrementMs: 100,
  });

  assert.ok(errors.some((error) => error.field === "maxRetries"));
  assert.ok(errors.some((error) => error.message === "Must be an integer between 0 and 1000."));
  assert.throws(
    () =>
      generateSchedule({
        strategy: "linear",
        initialDelayMs: 100,
        maxRetries: 1001,
        maxDelayMs: null,
        incrementMs: 100,
      }),
    /Invalid configuration/,
  );
});

test("validation rejects invalid values", () => {
  const exponentialErrors = validateConfig({
    strategy: "exponential",
    initialDelayMs: -1,
    maxRetries: 1.25,
    maxDelayMs: -5,
    factor: 1,
  });

  assert.ok(exponentialErrors.length >= 4);
  assert.ok(exponentialErrors.every((error) => "field" in error && "message" in error));

  const linearErrors = validateConfig({
    strategy: "linear",
    initialDelayMs: 10,
    maxRetries: 2,
    maxDelayMs: null,
    incrementMs: -100,
  });

  assert.ok(linearErrors.some((error) => error.field === "incrementMs"));
  assert.ok(linearErrors.some((error) => error.message === "Must be >= 0."));
  assert.throws(
    () =>
      generateSchedule({
        strategy: "linear",
        initialDelayMs: 10,
        maxRetries: 2,
        maxDelayMs: null,
        incrementMs: -100,
      }),
    /Invalid configuration/,
  );
});

test("chart math explanation keeps retry symbolic when no point is hovered", () => {
  const model = buildChartMathExplanation({
    config: {
      strategy: "exponential",
      initialDelayMs: 500,
      maxRetries: 5,
      maxDelayMs: 1500,
      factor: 2,
      jitter: "none",
    },
    chartMode: "delay",
    chartSeriesMode: "expected",
    activePoint: null,
  });

  assert.equal(model.activeRetry, null);
  assert.equal(model.resolved.rawDelayMs, null);
  assert.equal(model.resolved.chartedValueMs, null);
  assert.deepEqual(model.constants, {
    initialDelayMs: 500,
    factor: 2,
    incrementMs: null,
    maxDelayMs: 1500,
  });
  assert.equal(model.variableBindings.find((binding) => binding.symbol === "r")?.value, "symbolic");
});

test("chart math explanation resolves hovered linear equal-jitter values", () => {
  const model = buildChartMathExplanation({
    config: {
      strategy: "linear",
      initialDelayMs: 500,
      maxRetries: 5,
      maxDelayMs: null,
      incrementMs: 500,
      jitter: "equal",
    },
    chartMode: "delay",
    chartSeriesMode: "expected",
    activePoint: {
      retry: 3,
      valueMs: 1125,
      minMs: 750,
      maxMs: 1500,
    },
  });

  assert.equal(model.activeRetry, 3);
  assert.equal(model.chartSourceSymbol, "E");
  assert.equal(model.resolved.rawDelayMs, 1500);
  assert.equal(model.resolved.cappedDelayMs, 1500);
  assert.equal(model.resolved.expectedDelayMs, 1125);
  assert.equal(model.resolved.minDelayMs, 750);
  assert.equal(model.resolved.maxDelayMs, 1500);
  assert.equal(model.resolved.chartedValueMs, 1125);
});

test("chart math explanation uses hovered simulated value when chart series is simulated", () => {
  const model = buildChartMathExplanation({
    config: {
      strategy: "fixed",
      initialDelayMs: 1200,
      maxRetries: 4,
      maxDelayMs: 1000,
      jitter: "full",
    },
    chartMode: "delay",
    chartSeriesMode: "simulated",
    activePoint: {
      retry: 2,
      valueMs: 321,
      minMs: 0,
      maxMs: 1000,
    },
  });

  assert.equal(model.chartSeriesMode, "simulated");
  assert.equal(model.chartSourceSymbol, "S");
  assert.equal(model.resolved.expectedDelayMs, 500);
  assert.equal(model.resolved.chartedValueMs, 321);
});

test("chart math explanation handles maxRetries = 0 without hover substitution", () => {
  const model = buildChartMathExplanation({
    config: {
      strategy: "linear",
      initialDelayMs: 100,
      maxRetries: 0,
      maxDelayMs: null,
      incrementMs: 100,
      jitter: "none",
    },
    chartMode: "cumulative",
    chartSeriesMode: "expected",
    activePoint: {
      retry: 1,
      valueMs: 100,
      minMs: 100,
      maxMs: 100,
    },
  });

  assert.equal(model.maxRetries, 0);
  assert.equal(model.activeRetry, null);
  assert.equal(model.resolved.rawDelayMs, null);
  assert.equal(model.variableBindings.find((binding) => binding.symbol === "Dcap")?.value, "\u221e");
});
