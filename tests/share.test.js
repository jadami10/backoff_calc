import assert from "node:assert/strict";
import test from "node:test";

import { createShareUrl, readShareStateFromUrl } from "../src/share.js";

test("createShareUrl encodes current configuration into query params", () => {
  const url = createShareUrl("https://example.com/backoff#chart", {
    strategy: "linear",
    initialDelayMs: "250",
    maxRetries: "7",
    maxDelayMs: "",
    factor: "2",
    incrementMs: "400",
    displayMode: "humanize",
    chartMode: "cumulative",
  });

  const parsed = new URL(url);
  assert.equal(parsed.pathname, "/backoff");
  assert.equal(parsed.hash, "#chart");
  assert.equal(parsed.searchParams.get("strategy"), "linear");
  assert.equal(parsed.searchParams.get("initialDelayMs"), "250");
  assert.equal(parsed.searchParams.get("maxRetries"), "7");
  assert.equal(parsed.searchParams.get("maxDelayMs"), "");
  assert.equal(parsed.searchParams.get("factor"), "2");
  assert.equal(parsed.searchParams.get("incrementMs"), "400");
  assert.equal(parsed.searchParams.get("displayMode"), "humanize");
  assert.equal(parsed.searchParams.get("chartMode"), "cumulative");
});

test("readShareStateFromUrl accepts known params and ignores invalid mode values", () => {
  const state = readShareStateFromUrl(
    "https://example.com/?strategy=unknown&displayMode=days&chartMode=total&maxRetries=5&factor=1.5",
  );

  assert.equal(state.strategy, undefined);
  assert.equal(state.displayMode, undefined);
  assert.equal(state.chartMode, undefined);
  assert.equal(state.maxRetries, "5");
  assert.equal(state.factor, "1.5");
});

test("share state round-trips strategy, display mode, and chart mode", () => {
  const original = {
    strategy: "exponential",
    initialDelayMs: "500",
    maxRetries: "5",
    maxDelayMs: "10000",
    factor: "2",
    incrementMs: "500",
    displayMode: "ms",
    chartMode: "delay",
  };
  const url = createShareUrl("https://example.com/", original);
  const parsed = readShareStateFromUrl(url);

  assert.equal(parsed.strategy, original.strategy);
  assert.equal(parsed.initialDelayMs, original.initialDelayMs);
  assert.equal(parsed.maxRetries, original.maxRetries);
  assert.equal(parsed.maxDelayMs, original.maxDelayMs);
  assert.equal(parsed.factor, original.factor);
  assert.equal(parsed.incrementMs, original.incrementMs);
  assert.equal(parsed.displayMode, original.displayMode);
  assert.equal(parsed.chartMode, original.chartMode);
});

test("readShareStateFromUrl accepts fixed strategy", () => {
  const state = readShareStateFromUrl("https://example.com/?strategy=fixed&initialDelayMs=400");

  assert.equal(state.strategy, "fixed");
  assert.equal(state.initialDelayMs, "400");
});
