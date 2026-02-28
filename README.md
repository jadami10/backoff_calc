# Backoff Calculator

Static single-page app for tuning retry policies and visualizing backoff schedules.

## Features

- Exponential and linear backoff strategies
- Inputs for initial delay, max retries, max delay cap, factor, and increment
- Live-updating chart of retry delay
- Retry schedule table with raw, capped, and cumulative delay
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

## Cloudflare Pages Deployment

1. Push this repository to GitHub.
2. In Cloudflare Pages, create a new project and connect the repo.
3. Configure:
   - Framework preset: `None`
   - Build command: leave empty
   - Build output directory: `.`
   - Production branch: `main`
4. Save and deploy.

Cloudflare Pages will then auto-deploy preview builds for pull requests and production for `main`.

## Domain Setup

1. Buy a domain (Cloudflare Registrar recommended for simplest DNS management).
2. In Cloudflare Pages project settings, add:
   - `yourdomain.com`
   - optionally `www.yourdomain.com`
3. Configure one canonical domain (for example, redirect `www` to apex).
4. Keep SSL/TLS on Cloudflare-managed certificates (automatic).

