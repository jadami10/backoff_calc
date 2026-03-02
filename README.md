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

1. Install dependencies:
   - `bun install`
2. Run tests:
   - `bun run test`
3. Build the site:
   - `bun run build`
4. Serve the built output:
   - `bun run serve`
5. Open `http://localhost:8080`.

## Build Output

- Bundled application files are emitted to `dist/`.
- Deploy the `dist/` directory to static hosting.

## CI

GitHub Actions workflow:

- Trigger: push to `dev`
- Steps: `bun install --frozen-lockfile`, `bun run check`
- On success: promote the tested commit to `main`
