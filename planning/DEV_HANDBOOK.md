# LunaSol Dev Handbook

Telehealth monorepo — Next.js · NestJS · FastAPI · Postgres · Docker

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [First-time setup](#2-first-time-setup)
3. [Running the stack](#3-running-the-stack)
4. [Service URLs](#4-service-urls)
5. [Common tasks](#5-common-tasks)
6. [Environment variables](#6-environment-variables)
7. [Database](#7-database)
8. [AI service and model](#8-ai-service-and-model)
9. [Branch and commit rules](#9-branch-and-commit-rules)
10. [Deployment](#10-deployment)
11. [Repo layout](#11-repo-layout)

---

## 1. Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 22+ | https://nodejs.org |
| pnpm | 11+ | `npm i -g pnpm` |
| Docker + Compose | 27+ / 2.x | https://docs.docker.com/get-docker |
| Git | any | https://git-scm.com |
| Python | 3.12+ | only needed if running `apps/ai` outside Docker |

---

## 2. First-time setup

```bash
# 1. Clone
git clone https://github.com/Benny-Gil/LunaSol.git
cd LunaSol

# 2. Install all workspace dependencies
pnpm install

# 3. Copy the env file and fill in real values
cp .env.example .env
# Edit .env — at minimum set your Clerk keys (see §6)

# 4. Copy the api-specific env
cp apps/api/.env.example apps/api/.env
# DATABASE_URL in apps/api/.env should point to localhost:5432 for local dev
# DATABASE_URL in root .env should point to db:5432 for Docker dev
```

---

## 3. Running the stack

### Option A — Docker (recommended, mirrors production)

Starts Postgres, pgAdmin, Nginx, and all three app services with hot reload.

```bash
# Start everything
docker compose up

# Start in the background
docker compose up -d

# Start only infra (db + pgadmin + nginx), run apps locally
docker compose up db pgadmin nginx -d

# Rebuild a single service after Dockerfile changes
docker compose up --build api

# Stop and remove containers (keeps volumes)
docker compose down

# Stop and wipe all data volumes
docker compose down -v
```

**First run only** — run the initial migration after the DB is healthy:

```bash
# From repo root, with db running
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lunasol?schema=public" \
  npx prisma migrate dev --name init
```

### Option B — Local (faster feedback loop for a single service)

```bash
# Terminal 1 — db only via Docker
docker compose up db -d

# Terminal 2 — api
cd apps/api
pnpm dev

# Terminal 3 — web
cd apps/web
pnpm dev

# Terminal 4 — ai (optional, needs Python env)
cd apps/ai
uvicorn src.main:app --reload --port 8000
```

### Option C — Turborepo (all JS/TS apps at once, no Docker)

```bash
# Requires db to already be running (docker compose up db -d)
pnpm dev        # runs turbo dev → starts web + api concurrently

pnpm build      # builds in dependency order: types → api + web
pnpm lint       # lints all packages
```

---

## 4. Service URLs

| Service | URL | Notes |
|---|---|---|
| Web (Next.js) | http://localhost | via Nginx in Docker; http://localhost:3000 locally |
| API (NestJS) | http://localhost/api | via Nginx in Docker; http://localhost:3001 locally |
| AI (FastAPI) | internal only | `http://api:8000` inside Docker network; http://localhost:8000 locally |
| pgAdmin | http://localhost/pgadmin | Login: `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD` from `.env` |
| Postgres | `localhost:5432` | Direct connection for migrations and Prisma Studio |

---

## 5. Common tasks

### Generate the Prisma client (after schema changes)

```bash
cd apps/api
npx prisma generate
```

### Create a migration (after editing `schema.prisma`)

```bash
cd apps/api
# With db running at localhost:5432:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lunasol?schema=public" \
  npx prisma migrate dev --name <describe-the-change>
```

### Open Prisma Studio (visual DB browser)

```bash
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lunasol?schema=public" \
  npx prisma studio
# Opens at http://localhost:5555
```

### Add a dependency to a specific workspace package

```bash
# Add to api only
pnpm --filter @lunasol/api add some-package

# Add as a dev dependency to web
pnpm --filter @lunasol/web add -D some-package

# Add a shared type to packages/types
pnpm --filter @lunasol/types add some-package
```

### Build only the types package (needed before running api/web locally)

```bash
pnpm --filter @lunasol/types build
```

### Lint and format

```bash
pnpm lint             # ESLint across all packages
pnpm format           # Prettier across all files
```

### View logs for a single Docker service

```bash
docker compose logs -f api
docker compose logs -f db
```

### Restart a single service without rebuilding

```bash
docker compose restart api
```

---

## 6. Environment variables

Two `.env` files are needed:

### Root `.env` (used by Docker Compose)

Copy from `.env.example`. Key variables:

| Variable | Description |
|---|---|
| `POSTGRES_DB` | Database name (default: `lunasol`) |
| `POSTGRES_USER` | DB username (default: `postgres`) |
| `POSTGRES_PASSWORD` | DB password |
| `DATABASE_URL` | Full DSN — uses `db` as host inside Docker |
| `PGADMIN_DEFAULT_EMAIL` | pgAdmin login email (must be a valid domain, not `.local`) |
| `PGADMIN_DEFAULT_PASSWORD` | pgAdmin login password |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `CLERK_SECRET_KEY` | Clerk backend key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |

### `apps/api/.env` (used when running api locally, outside Docker)

Copy from `apps/api/.env.example`. Same variables as root but `DATABASE_URL` points to `localhost:5432` instead of `db:5432`.

> **Never commit `.env` files.** Both are in `.gitignore`. Only `.env.example` files are committed.

### Getting Clerk keys

1. Sign up at https://clerk.com and create an application
2. Copy `Publishable key` → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
3. Copy `Secret key` → `CLERK_SECRET_KEY`
4. Go to Webhooks → add endpoint `https://your-domain/api/auth/webhook` → copy signing secret → `CLERK_WEBHOOK_SECRET`

---

## 7. Database

### Connection details (local dev)

```
host:     localhost
port:     5432
database: lunasol
user:     postgres
password: postgres   (or whatever is in your .env)
```

### Migration workflow

```
Edit schema.prisma
    ↓
prisma migrate dev --name <name>   ← creates SQL file + applies it
    ↓
prisma generate                    ← regenerates the client
    ↓
Commit both migration file and schema.prisma
```

### Migration on production deploy

The GitHub Actions pipeline runs `prisma migrate deploy` inside the api container after `docker compose up`. This applies any pending migrations that weren't on the server yet. `migrate deploy` never creates new migrations — only applies committed ones.

### Resetting the local database (dev only)

```bash
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/lunasol?schema=public" \
  npx prisma migrate reset
# Drops all tables, re-runs all migrations, and re-seeds if a seed script exists
```

---

## 8. AI service and model

The AI service (`apps/ai`) runs FastAPI + `llama-cpp-python` and is never exposed publicly — only `apps/api` calls it internally.

### Getting a model

Download a quantized GGUF model and place it on the host:

```bash
# Example: Qwen 2.5 1.5B (fast on CPU, ~1 GB)
mkdir -p /data/models
# Download from Hugging Face or similar and place at:
/data/models/model.gguf
```

The Docker Compose production config mounts this path into the ai container. In development the model path is set via environment variable in `apps/ai/.env`.

> The model file is never committed to the repo — it's too large and changes independently of the code.

### Running the AI service locally without Docker

```bash
cd apps/ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

---

## 9. Branch and commit rules

### Branch naming

```
feature/<issue-number>-short-description
fix/<issue-number>-short-description
chore/<issue-number>-short-description
```

Examples: `feature/6-clerk-auth`, `fix/14-patient-profile-validation`

### Commit style

One logical unit per commit. Use conventional commit prefixes:

| Prefix | When |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `chore` | Config, tooling, deps (no production code change) |
| `feat(scope)` | Feature scoped to a package, e.g. `feat(api)`, `feat(web)` |

```bash
# Good — one atomic commit per concern
git commit -m "feat(api): add PrismaService and global PrismaModule"
git commit -m "fix(nginx): use Docker DNS resolver with variable upstreams"

# Bad — everything in one commit
git commit -m "add auth, fix nginx, update types, misc fixes"
```

### Pull requests

- One PR per GitHub issue (or one PR closing multiple related issues)
- PR title mirrors the issue title
- Body: brief summary + test plan checklist

---

## 10. Deployment

Deployment is automated via GitHub Actions on push to the `prod` branch.

### Pipeline steps

```
push to prod
  → GitHub Actions: .github/workflows/deploy.yml
    → SSH into server (using DEPLOY_SSH_KEY secret)
      → git pull origin prod
      → docker compose -f docker-compose.prod.yml build
      → docker compose -f docker-compose.prod.yml up -d --remove-orphans
      → docker compose exec api npx prisma migrate deploy
      → docker image prune -f
```

Build failures abort before containers are swapped — the live deployment is untouched.

### Required GitHub secrets (Settings → Environments → production)

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | Server IP or hostname |
| `DEPLOY_USER` | SSH username (e.g. `ubuntu`) |
| `DEPLOY_SSH_KEY` | Private key content (the server's authorized key) |
| `DEPLOY_PATH` | Absolute path to the repo on the server |

### Manual deploy (if Actions is unavailable)

```bash
ssh user@your-server
cd /path/to/LunaSol
git pull origin prod
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

---

## 11. Repo layout

```
LunaSol/
├── apps/
│   ├── web/                  # Next.js 14 (App Router) — port 3000
│   │   ├── Dockerfile.dev
│   │   ├── next.config.ts
│   │   └── src/app/          # Routes, layouts, components
│   ├── api/                  # NestJS — port 3001
│   │   ├── Dockerfile.dev
│   │   ├── prisma/
│   │   │   ├── schema.prisma # Single source of truth for DB schema
│   │   │   └── migrations/   # Committed migration SQL files
│   │   ├── prisma.config.ts
│   │   └── src/              # Modules, controllers, services
│   └── ai/                   # FastAPI — port 8000 (internal only)
│       ├── Dockerfile.dev
│       ├── requirements.txt
│       └── src/
├── packages/
│   └── types/                # Shared TypeScript DTOs (@lunasol/types)
│       └── src/              # user, patient, doctor, appointment, notification
├── nginx/
│   └── dev.conf              # Nginx reverse proxy config (dev)
├── doc/                      # Architecture and design decision docs
├── planning/                 # Roadmap, handbook, and issue plans
├── .github/workflows/
│   └── deploy.yml            # CI/CD pipeline
├── docker-compose.yml        # Local dev stack
├── docker-compose.prod.yml   # Production stack (Cloudflare Tunnel + no dev volumes)
├── turbo.json                # Turborepo task graph
├── pnpm-workspace.yaml       # pnpm workspaces config
├── tsconfig.base.json        # Shared TypeScript base config
├── .env.example              # Root env template
└── package.json              # Root scripts: dev, build, lint, format
```
