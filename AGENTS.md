# AGENTS.md

## Purpose

This repository hosts a static backoff calculator web app:

- Tune retry strategy settings (`exponential` or `linear`)
- Visualize per-retry delay with a line chart
- Show table rows for raw delay, capped delay, and cumulative delay

No backend and no build step are required for runtime.

## Tech Stack

- Plain HTML/CSS/JavaScript (ES modules)
- Chart.js loaded from pinned CDN in `index.html`
- Node built-in test runner (`node --test`)
- GitHub Actions CI
- Deployment target: Netlify (static site, no build step, auto-deploy from `main`)

## Source of Truth: Backoff Semantics

Defined in `src/backoff.js` and must stay consistent with UI/tests.

- `maxRetries` means **retries only** (initial request is excluded)
- Retry index is 1-based (`r = 1..maxRetries`)
- Exponential raw delay: `initialDelayMs * factor^(r-1)`
- Linear raw delay: `initialDelayMs + (r-1)*incrementMs`
- Effective delay: `min(rawDelay, maxDelayMs)` when cap is set
- Cumulative delay: running sum of effective delays

## Key Files

- `index.html`: page structure, form fields, chart canvas, summary cards, schedule table
- `styles.css`: responsive layout and visual styles
- `src/backoff.js`: pure math + validation + JSDoc typedef contracts
- `src/ui.js`: form parsing and render helpers (errors/table/summary/strategy visibility)
- `src/chart.js`: Chart.js wrapper (create/update/clear/destroy)
- `src/main.js`: app wiring, debounce, recompute flow
- `tests/backoff.test.js`: unit tests for math and validation
- `.github/workflows/ci.yml`: CI (`npm ci` + `npm test`)

## Local Commands

- Install: `npm ci`
- Test once: `npm test`
- Test watch: `npm run test:watch`
- Serve locally: `python3 -m http.server 8080` then open `http://localhost:8080`

## Guardrails for Changes

- Keep runtime buildless unless explicitly asked to introduce a bundler/framework.
- Preserve module boundaries:
  - put all formula/validation logic in `src/backoff.js`
  - keep rendering concerns in `src/ui.js` and `src/chart.js`
- If changing math or validation behavior, update tests in `tests/backoff.test.js` in the same PR.
- Keep invalid-input behavior strict:
  - show validation errors
  - preserve the last valid chart/table/summary render while inputs are invalid
- For UI additions, maintain mobile usability around ~375px viewport width.

## CI/Deploy Expectations

- CI should pass on every PR and push to `main`.
- Netlify settings:
  - Branch to deploy: `main`
  - Base directory: empty
  - Build command: empty
  - Publish directory: `.`
- Deployment behavior:
  - Pushes to `main` auto-deploy in Netlify.
