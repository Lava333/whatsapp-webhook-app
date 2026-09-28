# WhatsApp Cloud API — Webhook + Analytics Dashboard

A production-ready WhatsApp Cloud API webhook server with real-time analytics dashboard.

## Features
- ✅ WhatsApp webhook verification (GET) + message handler (POST)
- ✅ SQLite database (messages, clients, analytics)
- ✅ Analytics Dashboard with Chart.js
- ✅ Login-protected dashboard
- ✅ Client segregation — view per-user message history
- ✅ Daily / weekly trend charts

## Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### Environment Variables (set in Railway dashboard)

| Variable | Description |
|---|---|
| `VERIFY_TOKEN` | Your chosen webhook verify token |
| `WHATSAPP_ACCESS_TOKEN` | From Meta API Setup |
| `PHONE_NUMBER_ID` | From Meta API Setup |
| `WABA_ID` | WhatsApp Business Account ID |
| `ADMIN_USER` | Dashboard login username |
| `ADMIN_PASS` | Dashboard login password |
| `SESSION_SECRET` | Random string for session encryption |

## Local Development

```bash
npm install
cp .env.example .env   # fill in your values
npm start              # start server on port 3001
npm run ngrok          # start cloudflare tunnel
npm run seed           # seed demo data
npm run test:webhook   # simulate a webhook POST
```

## Webhook Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/whatsapp/webhook` | Meta verification |
| POST | `/whatsapp/webhook` | Receive messages |
| GET | `/health` | Health check |
| GET | `/api/stats/summary` | Analytics summary |
| GET | `/api/stats/daily` | Daily time-series |
| GET | `/api/clients` | All clients |
| GET | `/api/messages` | Message log |
