# AuraSafe Gold Tracker

Local-first PWA for tracking physical gold and other precious metals. Data is stored in IndexedDB and encrypted with a PIN-derived key.

## Setup

- Install deps: `pnpm install`
- Dev server: `pnpm dev`
- Build export: `pnpm build`
- Start prod: `pnpm start`

## Notes

- No backend. Everything stays on the device.
- Service worker is enabled in production only.
