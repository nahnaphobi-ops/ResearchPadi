# ResearchPadi — Production Readiness Runbook

Target: **15,000–20,000 concurrent users** at launch.

This document covers the infrastructure shipped under `k8s/` and the
CI/CD pipeline. Application/feature completeness is tracked separately
in `docs/ARCHITECTURE.md` (Phases 1–5).

---

## 1. Architecture (as deployed)

```
                        ┌─────────────────────────────┐
   Users  ── HTTPS ──►  │  nginx Ingress (TLS, gzip)  │
                        └──────────────┬──────────────┘
                                       │  /api/*  → backend-service:5000
                                       │  /*      → frontend-service:80
                  ┌────────────────────┴────────────────────┐
                  ▼                                          ▼
        ┌──────────────────┐                      ┌──────────────────┐
        │ backend (HPA)    │  6–40 replicas       │ frontend (SPA)   │  4 replicas
        │ Express + BullMQ │  (NODE_ENV=prod)     │ nginx static     │
        └────────┬─────────┘                      └──────────────────┘
                 │ enqueue jobs
                 ▼
        ┌──────────────────┐
        │ worker (HPA)     │  4–30 replicas (paper pipeline)
        └────────┬─────────┘
                 │
     ┌───────────┴────────────┐
     ▼                        ▼
┌───────────┐         ┌──────────────────┐
│ Redis HA  │◄────────│ Supabase (PG +   │
│ 3-node    │ queues, │  pgvector, auth) │
│ Sentinel  │ cache   └──────────────────┘
└───────────┘
```

---

## 2. What changed to support 20K concurrent

| Area | Before | Now |
|------|--------|-----|
| Backend replicas | 3 (fixed) | 6 → 40 (HPA on CPU 65% / mem 75%) |
| Worker replicas | 2 (fixed) | 4 → 30 (HPA on CPU 60% / mem 75%) |
| Frontend | missing in k8s | 4 replicas + Service + healthz |
| Redis | **single pod (SPOF)** | **3-node Sentinel HA** (quorum 2) |
| Ingress | pointed at non-existent `backend-service` | fixed to `backend-service` |
| Dockerfiles | **none (couldn't build)** | multi-stage backend + frontend |
| CI/CD | none | build → test → push → rollout |
| PDBs | none | backend 80% / worker 50% / redis 2 / fe 2 |

---

## 3. Pre-launch checklist (must complete before go-live)

- [ ] **Registry & secrets**: create `researchpadi-secrets` with real
      values (see `k8s/secrets.yaml` header for the `kubectl` command).
      Use External Secrets / sealed-secrets for GitOps safety.
- [ ] **TLS**: `cert-manager` ClusterIssuer `letsencrypt-prod` must exist,
      or swap to your cert mechanism. Domains: `researchpadi.com`,
      `www.researchpadi.com`, `admin.researchpadi.com`.
- [ ] **Admin auth**: generate `admin-basic-auth` htpasswd hash.
- [ ] **Redis decision**: either keep the in-cluster Sentinel HA (shipped)
      **or** point `redis-url` at a managed Redis (ElastiCache /
      Memorystore / Upstash). Managed is recommended for launch.
- [ ] **Supabase capacity**: confirm connection pooler (PgBouncer) is on;
      ~40 backend pods × pool size can exhaust a default 100-connection
      limit. Use Supabase Pooler or `pgbouncer` transaction mode.
- [ ] **AI API rate limits**: at 20K concurrent, the Anthropic/OpenAI
      spend and RPM/TPM limits will be the real bottleneck for the paper
      pipeline. Pre-arrange increased quotas; the worker HPA + BullMQ
      queue smooths bursts so jobs wait instead of failing.
- [ ] **Domain DNS**: point A/AAAA records at the ingress controller
      external IP / LoadBalancer.
- [ ] **kubeconfig secret**: store base64 `KUBE_CONFIG` as a GitHub
      Actions secret for the deploy workflow.

---

## 4. Deploy

```bash
# One-time infra (namespace, secrets, redis, pdbs)
kubectl apply -k k8s/overlays/production

# Or via CI: push to main triggers .github/workflows/deploy.yml
# Images are pinned to the commit SHA for rollback traceability.

# Roll back a bad deploy:
kubectl rollout undo deployment/researchpadi-backend -n researchpadi
kubectl rollout undo deployment/researchpadi-worker  -n researchpadi
kubectl rollout undo deployment/researchpadi-frontend -n researchpadi
```

---

## 5. Load testing

The repo ships `loadtest/k6-test.js` (`npm run loadtest` in frontend).
Run it against a staging cluster sized at the min replicas above, then
ramp to simulate 20K concurrent sessions (mix of auth, paper submit,
workspace AI calls, downloads). Watch HPA scale-up latency and Redis
memory headroom.

---

## 6. Known gaps still open (not infra-blocked)

- **Frontend `index.tsx` vs `main.tsx`**: ensure the Vite entry builds to
  `dist/` (Dockerfile copies `/app/dist`).
- **No DB migrations CI**: `supabase/migrations/*.sql` are applied
  manually. Add a migration step to the deploy job before rollout.
- **Observability**: no Prometheus/Grafana or log aggregation wired yet.
  Add before launch — at 20K concurrent you need metrics on queue depth,
  p99 latency, and AI API error rates.
- **Secrets rotation**: no automated key rotation.
```
