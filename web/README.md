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
| `VITE_API_URL` | `/api` | Relative path; the rewrite below sends it to the backend. |
| `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` | Same as local `.env`. |
| `VITE_SUPABASE_ANON_KEY` | `<anon key>` | Public anon key (safe in frontend). |
| `BACKEND_URL` | `https://api.researchpadi.com` | **Server-side only** — the real backend origin the `/api` rewrite proxies to. Do NOT prefix with `/api`; the rewrite adds it. |

`BACKEND_URL` is referenced only inside `vercel.json`'s rewrite, so it is
never shipped to the browser. `VITE_*` vars are inlined into the build.

## How the API proxy works

Frontend calls (e.g. `api.post('/auth/request-otp')`) resolve against
`VITE_API_URL` = `/api`, producing requests to `/api/auth/request-otp`.
Vercel's rewrite forwards those to `${BACKEND_URL}/api/auth/request-otp`.

Benefits:
- No CORS configuration needed on the backend.
- One domain for users; backend stays on its own origin.

## Local preview of the proxy

To test the rewrite locally, run the Vercel CLI from the `frontend` dir:

```bash
cd frontend
vercel dev   # respects vercel.json; needs BACKEND_URL in .env.local
```

## Notes

- SPA client-side routes (e.g. `/workspace/abc`) are handled by Vite's
  `dist/index.html` fallback automatically on Vercel.
- Static assets under `/assets/` get a 1-year immutable cache header.
- The `Dockerfile` / `nginx.k8s.conf` in `frontend/` are for the k8s
  path and are ignored by Vercel.
