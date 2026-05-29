# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (all services via Docker)
docker compose up

# Dev (individual services, outside Docker)
pnpm dev                          # all apps via Turborepo
pnpm --filter @lunasol/api dev    # NestJS only (nest start --watch)
pnpm --filter @lunasol/web dev    # Next.js only

# Build
pnpm build

# Lint
pnpm lint

# Database
pnpm seed                                                        # seed (idempotent — wipes and re-creates)
npx prisma migrate reset --schema apps/api/prisma/schema.prisma # drop + migrate + seed
pnpm --filter @lunasol/api exec prisma migrate dev              # apply a new migration
pnpm --filter @lunasol/api exec prisma generate                 # regenerate Prisma client after schema change
```

There are no automated tests yet.

## Environment Variables

Copy `.env.example` to `.env` at the repo root. Required vars:

| Variable | Used by |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | web |
| `CLERK_SECRET_KEY` | web, api |
| `CLERK_WEBHOOK_SECRET` | api |
| `DATABASE_URL` | api |

`INTERNAL_API_URL` is set automatically in `docker-compose.yml` (`http://api:3001`) for server-side fetches from the web container.

## Architecture

Three runtime services behind a single Nginx entry point:

```
Browser → Cloudflare Tunnel → Nginx :80
  /        → web  (Next.js  :3000)
  /api/*   → api  (NestJS   :3001)
```

`api` communicates with `ai` (FastAPI :8000) and `db` (Postgres :5432) over the internal Docker network — neither is publicly reachable.

Video uses **LiveKit Cloud**: the browser connects directly to the LiveKit Cloud project (`NEXT_PUBLIC_LIVEKIT_URL`), not through Nginx/the Tunnel. The API only mints join tokens and receives LiveKit webhooks at `/api/livekit/webhook`. See `doc/video.md`.

### `apps/web` — Next.js 14

- **Routing:** App Router. All protected pages live under `src/app/dashboard/`.
- **Auth:** Clerk via `@clerk/nextjs`. Server components use `auth()` / `currentUser()` from `@clerk/nextjs/server`. Client components use `useAuth()`.
- **API calls:** Client components call `apiFetch()` from `src/lib/api.ts` — it prefixes `/api`, attaches the Bearer token, and throws on non-2xx. Server components (e.g. `dashboard/page.tsx`) use raw `fetch` with `INTERNAL_API_URL` to bypass Nginx.
- **Dashboard redirect:** `app/dashboard/page.tsx` is the single entry point after login. It reads the role from `publicMetadata`, calls the role's `/me` endpoint to check `profileComplete`, and redirects to onboarding or the role dashboard accordingly.

### `apps/api` — NestJS (Modular Monolith)

- **Global guards:** `ClerkAuthGuard` (JWT verification via Clerk JWKS) and `RolesGuard` are applied globally via `APP_GUARD` in `app.module.ts`. Use `@Public()` to opt out of auth, `@Roles('doctor'|'patient')` to restrict by role.
- **Module rule:** A service in module A must never query DB tables owned by module B directly. Cross-module data access goes through the owning module's service. See `doc/architecture.md`.
- **Webhook:** `POST /api/auth/webhook` (Svix signature verified) is the canonical place where `publicMetadata.role` is set on Clerk and the User + profile row are created in the DB. `ensureDoctorRecord` / `ensurePatientRecord` in each service handle the race-condition case where a user hits an API endpoint before the webhook fires — they create the DB row and call `clerk.users.updateUserMetadata` to sync the role.
- **File uploads:** Profile pictures are stored on disk at `uploads/profile-pictures/` and served as static files under `/api/uploads/`. The URL is persisted as `/api/uploads/profile-pictures/<filename>`.
- **Prisma schema:** `apps/api/prisma/schema.prisma`. Run `prisma generate` after any schema change.

### `packages/types` — Shared TypeScript DTOs

Imported as `@lunasol/types` in both `web` and `api`. Add shared request/response shapes here rather than duplicating them.

## Data Model Summary

`User` (Clerk identity) → `PatientProfile` or `DoctorProfile` (1:1). Doctors own `AvailabilitySlot`s; patients book `Appointment`s against slots. An `Appointment` generates a `ConsultationRecord` which contains `Prescription`s. `Notification`s are persisted per user. See `doc/data-model.md` for the full ER diagram.

## Key Patterns

- **`profileComplete` flag:** Returned on every profile response. Currently `true` when `bio` is non-empty (doctors) or `weight > 0 && height > 0` (patients). Dashboard redirect uses this to gate onboarding.
- **Role stored in two places:** Clerk `publicMetadata.role` (in JWT, lowercase `'doctor'`/`'patient'`) and `User.role` in DB (uppercase enum `DOCTOR`/`PATIENT`). Keep them in sync.
- **No hard deletes on appointments:** Status-only cancellation to preserve medical audit trail.
