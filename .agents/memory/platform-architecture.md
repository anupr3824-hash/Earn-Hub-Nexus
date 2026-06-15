---
name: Telegram Earn Platform Architecture
description: Monorepo structure, service layout, Firebase setup, and key design decisions for the Telegram Earning Platform.
---

## Services
- `artifacts/api-server` — Express + Firebase Firestore + Telegraf bot. Port via `PORT` env. Build: `node build.mjs` (esbuild). Dev: `export NODE_ENV=development && pnpm run build && pnpm run start`.
- `artifacts/mini-app` — Vite React. Dark navy/gold theme always-on (dark class forced in main.tsx unconditionally).
- `artifacts/admin-panel` — Vite React. Slate/blue theme. Login: admin/admin (env: ADMIN_USERNAME/ADMIN_PASSWORD).

## Firebase
Requires env secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Without them API returns 503 (graceful degradation). Set in Replit Secrets.

## Required Env Secrets (not yet set)
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `MINI_APP_URL`, `BOT_USERNAME`, `GEMINI_API_KEY`

**Why:** Firebase Admin SDK needs service account creds. Bot needs token. Gemini needs API key.
