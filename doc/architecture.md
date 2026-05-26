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

## Modular Monolith & Future Microservices

To facilitate scaling and support potential future transition to microservices, the backend application (`apps/api`) is structured as a **Modular Monolith**.

### Core Architecture Rules

1. **Strict Domain Boundaries**:
   The application is divided into self-contained domain modules (`users`, `availability`, `appointments`, `consultations`, `notifications`). Each module encapsulates its own business logic, controllers, services, and DTOs.

2. **Database Access Isolation**:
   A service in domain module `A` **must never** query database tables/models owned by domain module `B` directly through `PrismaService`. All database interaction is encapsulated inside the respective owning module. 
   - *Example*: If the `appointments` module needs to fetch doctor details or check availability, it must query `UsersService` or `AvailabilityService` respectively.
   - *Microservice Readiness*: This ensures that if the monolithic database is later split into separate databases per service, the modules will not break.

3. **Asynchronous Decoupling via Events**:
   Cross-domain triggers that are asynchronous or side-effects (e.g. creating user alerts upon booking an appointment) should be decoupled using an event-driven mechanism (e.g. NestJS `EventEmitter2` or simple pub/sub).
   - *Example*: Emitting an `appointment.booked` event from `AppointmentsService` that `NotificationsService` listens to.
   - *Microservice Readiness*: When transitioning to microservices, the in-process event emitter can be swapped with an external message broker (like RabbitMQ, Kafka, or Redis) with minimal code changes.

4. **Circular Dependency Prevention**:
   Dependencies between modules must flow in one direction. Circular module imports are strictly prohibited.
