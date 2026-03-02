# Backoff Calculator

Static single-page app for tuning retry policies and visualizing backoff schedules.

Made fully with AI tooling.

## Features

- Exponential, linear, and fixed backoff strategies
- Inputs for initial delay, max retries, max delay cap, factor, and increment
- Live-updating chart with toggle for per-retry or cumulative delay
- Retry schedule table with raw, capped, and cumulative delay
- Selectable delay display scale (ms/s/min/h) plus human-readable duration output (y/w/d/h/m/s/ms)
- Inline validation that disables stale outputs on invalid input

## Local Development

1. Install dependencies (none beyond lockfile metadata):
   - `npm ci`
2. Run tests:
   - `npm test`
3. Serve the static site:
   - `python3 -m http.server 8080`
4. Open `http://localhost:8080`.

## CI

GitHub Actions workflow:

- Trigger: push to `dev`
- Steps: `npm ci` then `npm test`
- On success: promote the tested commit to `main`
