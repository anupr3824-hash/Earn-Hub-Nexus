---
name: Telegram Earn Platform Architecture
description: Monorepo structure, service layout, Firebase setup, and key design decisions for the Telegram Earning Platform.
---

## Services & Workflow Commands
- `artifacts/api-server` — Express + Firebase Firestore + Telegraf bot. Workflow: `PORT=8080 pnpm --filter @workspace/api-server run dev`. Dev script: build then start (esbuild → node dist/index.mjs).
- `artifacts/mini-app` — Vite React. Dark navy/gold theme always-on. Workflow: `PORT=18801 BASE_PATH=/ pnpm --filter @workspace/mini-app run dev`. previewPath = `/`.
- `artifacts/admin-panel` — Vite React. Slate/blue theme. Workflow: `PORT=20130 BASE_PATH=/admin/ pnpm --filter @workspace/admin-panel run dev`. previewPath = `/admin/`.

**Both PORT and BASE_PATH are required env vars for the Vite frontends. Without them the vite.config.ts throws at startup.**
**Ports: API=8080, Mini App=18801 (external 3000), Admin=20130 (external 3002).**

## Firebase
Requires env secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Without them API returns 503 (graceful degradation). Set in Replit Secrets.

## Required Env Secrets (not yet set)
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `MINI_APP_URL`, `BOT_USERNAME`, `GEMINI_API_KEY`

**Why:** Firebase Admin SDK needs service account creds. Bot needs token. Gemini needs API key.
