# Architecture

## Overview

LunaSol is a full-stack telehealth web application split across three runtime services (frontend, backend, AI) plus infrastructure services (database, video, notifications, reverse proxy). All services run in Docker and are exposed through a single Nginx entry point connected to the internet via Cloudflare Tunnel.

## Service Map

```
[Browser]
    │
    ▼
[Cloudflare Tunnel]
    │
    ▼
[Nginx :80]
    ├── /          →  web      (Next.js   :3000)
    ├── /api/*     →  api      (NestJS    :3001)   ← WebSocket upgrade for Socket.io
    ├── /meet/*    →  jitsi    (Jitsi     :8443)   ← WebSocket upgrade
    └── /pgadmin   →  pgadmin  (pgAdmin   :5050)

[api] ── internal Docker network ──► [ai]       (FastAPI   :8000)   ← never public
[api] ── internal Docker network ──► [db]       (Postgres  :5432)   ← never public
```

## Monorepo Structure

```
lunasol/
├── apps/
│   ├── web/          # Next.js 14 + Tailwind v4 + Shadcn
│   ├── api/          # NestJS + Prisma
│   └── ai/           # FastAPI + llama-cpp-python
├── packages/
│   └── types/        # Shared TypeScript DTOs (web ↔ api)
├── doc/              # This directory
├── docker-compose.yml
├── docker-compose.prod.yml
├── turbo.json
└── package.json
```

## Why a Monorepo?

**Decision:** Turborepo + pnpm workspaces over separate repositories.

**Rationale:**
- `packages/types` can be shared between `apps/web` and `apps/api` without a publish step — both apps always use the same DTO definitions
- `pnpm` deduplicates `node_modules` across packages, keeping the repo lean
- Turborepo's task graph ensures apps build in dependency order and caches results
- One place to run CI — a single pipeline builds and tests everything

**Trade-off accepted:** FastAPI (`apps/ai`) is Python and cannot share TypeScript types directly. The AI service communicates over HTTP with a documented contract; its input/output types are defined in `packages/types` for the NestJS → FastAPI call, and FastAPI validates with Pydantic.

## Why Three App Services?

| Service | Language | Why separate |
|---|---|---|
| `web` | TypeScript (Next.js) | Frontend; SSR requires its own Node process |
| `api` | TypeScript (NestJS) | Backend; owns the database, auth, and business logic |
| `ai` | Python (FastAPI) | Inference requires Python (`llama-cpp-python`); isolated so a slow model load doesn't affect the main API |

Keeping `ai` separate also means the AI service can be scaled, swapped, or restarted independently without touching the main backend.
