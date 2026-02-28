# Backoff Calculator

Static single-page app for tuning retry policies and visualizing backoff schedules.

## Features

- Exponential and linear backoff strategies
- Inputs for initial delay, max retries, max delay cap, factor, and increment
- Live-updating chart of retry delay
- Retry schedule table with raw, capped, and cumulative delay
- Selectable delay display scale (ms/s/min/h) plus humanized duration output
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
- Trigger: push to `main` and pull requests
- Steps: `npm ci` then `npm test`

## Netlify Deployment

1. Push this repository to GitHub.
2. In Netlify, create a new site from Git and connect the repo.
3. Configure:
   - Branch to deploy: `main`
   - Base directory: leave empty
   - Build command: leave empty
   - Publish directory: `.`
4. Save and deploy.

After setup, every push to `main` auto-deploys on Netlify.

## Domain Setup

1. Buy a domain from any registrar.
2. In Netlify site settings, add:
   - `yourdomain.com`
   - optionally `www.yourdomain.com`
3. Configure one canonical domain (for example, redirect `www` to apex).
4. Keep Netlify-managed HTTPS certificates enabled (automatic).
