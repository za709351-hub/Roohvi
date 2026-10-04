# Roohvi web demo (Vercel-ready)

Static site (`index.html` + `assets/`) plus one serverless function (`api/chat.js`) for the live AI chat.
Roohvi is an AI companion, not a doctor, therapist or emergency service. The PC app stays the real product.

## Deploy on Vercel (about 3 minutes)
1. Put this folder in a GitHub repo (or use `npx vercel` from this folder).
2. Vercel > Add New > Project > import the repo. Framework preset: **Other**. No build command.
3. Settings > Environment Variables, add ONE of:
   - `GEMINI_API_KEY` (default; optional `GEMINI_MODEL`, default `gemini-2.5-flash`)
   - `ANTHROPIC_API_KEY` (optional `ANTHROPIC_MODEL`)
4. Deploy (or Redeploy after adding the key). Open the link and chat.

Never put the key in `index.html`. It lives only in Vercel's environment variables.

## What works without a key
Everything except the live AI replies: the site falls back to the scripted demo replies, so it never breaks.

## Safety on the server
- Crisis wording is caught before the model is called; the page shows the Pakistan helpline card.
- Replies containing doses, diagnoses or prescriptions are dropped (scripted reply is used).
- Basic rate limit: 12 requests per minute per IP (per server instance). For heavier traffic add Vercel Firewall or Upstash.

## Local test
`npx vercel dev` (needs the env var in a `.env.local` file).
