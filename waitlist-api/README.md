# Overlord AI — Waitlist API

Tiny dependency-free Node server (Node 18+, zero npm packages) that receives a
waitlist signup and does two things:

1. **Stores the email** in a Supabase table (`POST /rest/v1/waitlist`).
2. **Emails it** to `info@overlordai.co` via Resend.

## Endpoints

- `POST /api/waitlist` — body `{ "email": "user@example.com" }`
- `GET /health` — returns `{ ok, configured: { resend, supabase } }`

## Deploy to Railway

**Option A — CLI (`railway up`):**

```bash
npm i -g @railway/cli
railway login
cd /path/to/overlord-waitlist-api
railway init
railway up
```

**Option B — connect this repo:** create a New Project → Deploy from GitHub repo →
point "Root Directory" at the folder containing `server.js`.

Then, in the Railway service → **Variables**, paste the values from `.env.example`
(`RESEND_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc.).

Railway gives you a public URL like `https://<app>.up.railway.app` — that's the
`WAITLIST_API_URL` the site's popup posts to.

## Local test

```bash
RESEND_API_KEY=... SUPABASE_URL=... SUPABASE_ANON_KEY=... node server.js
curl -X POST http://localhost:3000/api/waitlist \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com"}'
```
