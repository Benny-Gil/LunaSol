# Deployment

## Decision: Docker + Cloudflare Tunnel

**Why Docker:**

- Reproducible builds — identical environment in dev and production
- All services (Next.js, NestJS, FastAPI, Postgres, LiveKit, Nginx, pgAdmin) are orchestrated with a single `docker compose` command
- Easy to restart, update, or replace individual services without touching others
- `docker-compose.yml` (dev) and `docker-compose.prod.yml` (prod) share service definitions with environment-specific overrides

**Why Cloudflare Tunnel:**

- No need for a public IP or open inbound ports on the server
- HTTPS is handled automatically by Cloudflare — no cert management needed
- Built-in DDoS protection and CDN caching
- A single `cloudflared` container connects the server to Cloudflare's edge

**Alternative considered:** Direct Nginx + Certbot on a VPS with a public IP. Rejected because it requires port forwarding, a static IP, and manual certificate renewal. Cloudflare Tunnel is simpler and more secure.

---

## Service Map (Production)

| Service       | Image                  | Network           | Exposed              |
| ------------- | ---------------------- | ----------------- | -------------------- |
| `web`         | Next.js build          | internal          | Via Nginx            |
| `api`         | NestJS build           | internal          | Via Nginx `/api`     |
| `ai`          | FastAPI + llama-cpp    | internal          | No                   |
| `db`          | postgres:16            | internal          | No                   |
| `pgadmin`     | dpage/pgadmin4         | internal          | Via Nginx `/pgadmin` |
| `nginx`       | nginx:alpine           | internal + tunnel | Entry point          |
| `cloudflared` | cloudflare/cloudflared | internal          | Tunnel daemon        |

Only `nginx` is the network entry point. All other services communicate on the internal Docker network and are never directly reachable from outside.

---

## Nginx Routing

```nginx
server {
    listen 80;

    location / {
        proxy_pass http://web:3000;
    }

    location /api {
        proxy_pass http://api:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /pgadmin {
        proxy_pass http://pgadmin:5050;
        proxy_set_header X-Script-Name /pgadmin;
        proxy_set_header Host $host;
    }
}
```

`X-Script-Name /pgadmin` is required for pgAdmin to generate correct internal URLs when running behind a sub-path proxy.

---

## CI/CD Pipeline

**Tool:** GitHub Actions

**Trigger:** Push to `prod` branch

```
push to prod
  → GitHub Actions workflow runs
    → SSH into server using stored deploy key
      → docker compose -f docker-compose.prod.yml up -d --build
        → docker exec api npx prisma migrate deploy
```

**Why SSH deploy over Docker Hub:**
Avoids pushing images to a registry. The server builds directly from source on each deploy. For a small team this is simpler and keeps secrets (like the database URL baked into the NestJS build) off external registries.

**Rollback:** If the deploy command fails, Docker leaves the previously running containers untouched. Manual rollback is done by checking out the previous commit on `prod` and re-running the pipeline.

---

## Secrets Management

All secrets live in `.env.prod` on the server — never in the repository.

| Variable                   | Used by                        |
| -------------------------- | ------------------------------ |
| `DATABASE_URL`             | NestJS / Prisma                |
| `CLERK_SECRET_KEY`         | NestJS auth guard + webhook    |
| `CLERK_WEBHOOK_SECRET`     | Webhook signature verification |
| `LIVEKIT_API_KEY`          | Room token signing key name    |
| `LIVEKIT_API_SECRET`       | Room token signing secret      |
| `PGADMIN_DEFAULT_EMAIL`    | pgAdmin login                  |
| `PGADMIN_DEFAULT_PASSWORD` | pgAdmin login                  |
| `CLOUDFLARE_TUNNEL_TOKEN`  | cloudflared tunnel daemon      |

The server SSH key used by GitHub Actions is stored as a GitHub Actions secret (`SSH_PRIVATE_KEY`). It never touches the repository.

---

## GGUF Model Volume

The AI model file is large (~1–4 GB) and changes independently of the codebase. It is stored on the host at `/data/models/model.gguf` and mounted into the `ai` container:

```yaml
ai:
  volumes:
    - /data/models:/models:ro
```

To update the model: replace the file on the host and restart the `ai` container. No image rebuild required.
