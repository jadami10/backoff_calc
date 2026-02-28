import assert from "node:assert/strict";
import test from "node:test";

import { applyTheme, resolveInitialTheme, toggleTheme } from "../src/theme.js";

test("resolveInitialTheme returns dark when prefers-color-scheme is dark", () => {
  const theme = resolveInitialTheme({
    matchMedia(query) {
      assert.equal(query, "(prefers-color-scheme: dark)");
      return { matches: true };
    },
  });

  assert.equal(theme, "dark");
});

test("resolveInitialTheme returns light when prefers-color-scheme is not dark", () => {
  const theme = resolveInitialTheme({
    matchMedia() {
      return { matches: false };
    },
  });

  assert.equal(theme, "light");
});

test("toggleTheme flips between light and dark", () => {
  assert.equal(toggleTheme("light"), "dark");
  assert.equal(toggleTheme("dark"), "light");
});

test("applyTheme sets the document dataset", () => {
  const fakeDoc = {
    documentElement: {
      dataset: {},
    },
  };

  applyTheme("dark", fakeDoc);
  assert.equal(fakeDoc.documentElement.dataset.theme, "dark");
});

