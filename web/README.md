# web/ — Vercel deployment for the ResearchPadi frontend

The frontend is deployed on **Vercel** (the 404 you saw came from Vercel's
edge). The backend stays on the k8s cluster (see `k8s/` and `PRODUCTION.md`).

## What this folder is

- `README.md` — this guide.
- The actual `vercel.json` lives in **`frontend/vercel.json`** (Vercel
  reads it from the project's Root Directory). It builds the Vite app
  and proxies `/api/*` to the backend.

> The `frontend/` folder is the actual app source and holds the
> `vercel.json`. Vercel's **Root Directory** must be set to `frontend`.
> This `web/` folder is the version-controlled home for the Vercel
> deploy docs.

## Vercel project settings

| Setting | Value |
|---------|-------|
| Framework Preset | Vite |
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

These are also declared in `vercel.json`, but set them in the dashboard
so the first import picks them up correctly.

## Environment variables (Vercel → Project → Settings → Environment)

| Key | Value | Notes |
|-----|-------|-------|
| `API_PROXY_SECRET` | random, 32+ characters | **Same value as on Render.** Sent to the backend as `x-researchpadi-proxy` so it trusts the visitor IP Vercel forwards. Not a `VITE_` variable, so it never reaches the browser. |
| `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` | Same as local `.env`. |
| `VITE_SUPABASE_ANON_KEY` | `<anon key>` | Public anon key (safe in frontend). |

Leave `VITE_API_URL` unset: the app defaults to `/api`. `VITE_*` vars are inlined into the build.

## How the API proxy works

`vercel.json` uses `routes` (rewrites can't carry header transforms):

1. Security headers on every response, and a 1-year cache header on `/assets/*`.
2. `/api/*` is proxied to `https://researchpadi.onrender.com/api/*`. A transform first
   deletes any `x-researchpadi-proxy` header the visitor sent, then sets it from
   `API_PROXY_SECRET`.
3. Real files (`handle: filesystem`), then every other path falls back to
   `/index.html`, so refreshing `/login` or `/workspace/abc` loads the app.

Why the secret: behind Render's load balancer the backend only saw an internal
`10.x` address, so every per-IP limit (OTP sends, logins, the API cap) was shared by
all visitors. The backend (`backend/src/lib/client-ip.ts`) now uses the IP Vercel
forwards when the secret matches, otherwise Cloudflare's `CF-Connecting-IP`.
If `API_PROXY_SECRET` is missing on either side, the site still works; limits just
fall back to Cloudflare's view (Vercel's egress IP for proxied requests).

Change the backend URL in `vercel.json` if the backend moves.

## Local preview of the proxy

To test the proxy locally, run the Vercel CLI from the `frontend` dir:

```bash
cd frontend
vercel dev   # respects vercel.json
```

## Notes

- The `Dockerfile` / `nginx.k8s.conf` in `frontend/` are for the k8s
  path and are ignored by Vercel.
