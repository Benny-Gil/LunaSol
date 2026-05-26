# LunaSol — Design & Architecture Docs

This directory documents the design decisions behind LunaSol. Each file covers one concern area — what was decided, why, and what trade-offs were accepted.

## Index

| Document | What it covers |
|---|---|
| [architecture.md](./architecture.md) | System overview, service map, monorepo structure |
| [data-model.md](./data-model.md) | Entity design, schema decisions, relationship rationale |
| [auth.md](./auth.md) | Clerk integration, JWT flow, role model, webhook sync |
| [api.md](./api.md) | REST conventions, module structure, error handling, DTOs |
| [ai-service.md](./ai-service.md) | Local GGUF inference, FastAPI design, SSE streaming chain |
| [notifications.md](./notifications.md) | Socket.io gateway, room model, event catalog |
| [video.md](./video.md) | Jitsi self-hosted setup, room auth, session lifecycle |
| [deployment.md](./deployment.md) | Docker, Nginx, Cloudflare Tunnel, CI/CD pipeline |
| [frontend.md](./frontend.md) | Next.js App Router, Shadcn, routing, data fetching patterns |
