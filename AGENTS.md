# BMS Dashboard — Agent Guide

## Project Overview
A Persian (RTL) shipping operations dashboard.
- Stack: Vite 8 + TypeScript (strict off), Chart.js 4, Leaflet 1.9, xlsx (SheetJS)
- Data source: Google Apps Script proxies + encrypted/local xlsx
- Date support: Gregorian + Jalali (Borkowski algorithm, `src/calendar.ts`)

## Dev Setup
```bash
npm i
npm run dev      # http://localhost:3000
npm run build    # dist/
```
> **Important:** Path contains `&` (`H:\Vesel Checking & Pending\`). `npm run` shims break.
> Use `node node_modules/vite/bin/vite.js build` instead.
> Node ≥ 18 required (uses `AbortSignal.timeout`).

## Architecture
- Entry: `src/main.ts` (config → worker → default render → auto-fetch)
- State: `src/state.ts` (single mutable object + `safeGet/safeSet/safeRemove`)
- Auth: `src/auth.ts` (POST `{action:'login', user, hash}` → token; 30-min session)
- Data: `src/data.ts` (parseRows, aggregateFromRecords, aggregateAsync via Worker)
- Fetch: `src/loader.ts` (GAS proxy, encrypted data.enc, drag-drop xlsx)
- Filter: `src/filter.ts` + `src/ui.ts` (virtual-scroll container list)
- Charts: `src/charts.ts`, Map: `src/map.ts`, Export: `src/export.ts`
- Worker: `public/worker.js` (aggregation off-main-thread; served at `/worker.js`)

## Conventions
- All logging through `log()` in `utils.ts` — gated by `DEBUG = false`
- All DOM access through `$()` from `state.ts` — always null-check before use
- All user-rendered strings pass through `esc()`
- All storage access through `safeGet/safeSet/safeRemove`
- RTL: `index.html` has `dir="rtl"`, map container has `direction:ltr`

## Deployment
- Repo: `github.com/Avaxious/bms-pro`
- Deploy: PowerShell script uploads `dist/` to `gh-pages` branch via GitHub REST API
- Live: https://Avaxious.github.io/bms-pro/
- Token (`.github_token`) is in `.gitignore` — must be revoked after any suspect session

## Critical Knowledge
- Sheet column layout is hard-coded in `parseRows` (`row[14]` = arrival date) — a new column in Excel silently corrupts everything
- Worker and main thread each have a copy of aggregation logic — **must stay in sync**
- `data.xlsx` must NOT be committed or deployed (business-sensitive)
- All dates are normalised to local-midnight in `parseRows` — both calendar modes
