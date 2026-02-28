import assert from "node:assert/strict";
import test from "node:test";

import { generateSchedule, summarizeSchedule, validateConfig } from "../src/backoff.js";

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
