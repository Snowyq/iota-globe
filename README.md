# IOTA Globe

A recruitment project inspired by [gmonads.com](https://www.gmonads.com/). An interactive 3D globe showing IOTA network validators.

## LIVE DEMO

- https://iota-globe.vercel.app/

## What it does

- 3D globe with validator locations (marker clustering)
- Live data fetched from IOTA RPC through a server-side API route (RPC is not exposed to the frontend)
- Validator list with basic stats (stake, APY, commission)
- Validator detail view
- Epochs and transactions pages
- Live transaction / checkpoints / tps stream via SSE
- Responsive layout, works on mobile

## Stack

- Next.js 16 / React 19
- Tailwind CSS v4
- [react-globe.gl](https://github.com/vasturiano/globe.gl) + Three.js
- [@iota/iota-sdk](https://www.npmjs.com/package/@iota/iota-sdk)
- shadcn/ui

## Running locally

```bash
pnpm install
pnpm dev
```

Requires a `.env.local` file:

```
TESTNET_URL=...
MAINNET_URL=...
```

## Structure

```
features/     # components grouped by domain (globe, validators, network…)
views/        # page views
app/api/      # server-side RPC proxy
hooks/        # shared hooks
```
