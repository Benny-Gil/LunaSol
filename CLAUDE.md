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

# Tests
pnpm test                                       # all suites via Turborepo
pnpm --filter @lunasol/api test                 # NestJS unit specs (Jest, *.spec.ts colocated in src/)
pnpm --filter @lunasol/api test -- appointments # single suite by path/name substring
pnpm --filter @lunasol/api test -- -t "books a slot"  # single test by name (-t)
pnpm --filter @lunasol/api test:e2e             # Nest e2e (apps/api/test/*.e2e-spec.ts, jest-e2e.json)
pnpm --filter @lunasol/e2e test                 # Playwright browser e2e (apps/e2e-tests/)
# apps/ai (Python FastAPI): pytest from apps/ai (see apps/ai/test_main.py)
```

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

`api` communicates with `ai` and `db` (Postgres :5432) over the internal Docker network — neither is publicly reachable. The `ai` service is an **in-repo Python FastAPI app at `apps/ai`** (:8000); the NestJS `ai` module (`apps/api/src/ai`) is the proxy/client to it. The web AI matcher streams from it via Server-Sent Events (`apps/web/src/lib/useAiRecommendation.ts`).

Video uses **LiveKit Cloud**: the browser connects directly to the LiveKit Cloud project (`NEXT_PUBLIC_LIVEKIT_URL`), not through Nginx/the Tunnel. The API only mints join tokens and receives LiveKit webhooks at `/api/livekit/webhook`. See `doc/video.md`.

### `apps/web` — Next.js 14

- **Routing:** App Router. All protected pages live under `src/app/dashboard/`.
- **Auth:** Clerk via `@clerk/nextjs`. Server components use `auth()` / `currentUser()` from `@clerk/nextjs/server`. Client components use `useAuth()`. Sign-in uses Clerk's prebuilt `<SignIn>`; sign-up is a **custom flow** that captures the `role` into `unsafeMetadata`. Gotcha: the default `useSignUp` from `@clerk/nextjs` (v7) is the experimental signals API — the custom sign-up page imports from **`@clerk/nextjs/legacy`** to get the stable `create → prepareEmailAddressVerification → attemptEmailAddressVerification → setActive` flow.
- **API calls:** Client components call `apiFetch()` from `src/lib/api.ts` — it prefixes `/api`, attaches the Bearer token, and throws on non-2xx. Server components (e.g. `dashboard/page.tsx`) use raw `fetch` with `INTERNAL_API_URL` to bypass Nginx.
- **Dashboard redirect:** `app/dashboard/page.tsx` is the single entry point after login. It reads the role from `publicMetadata`, calls the role's `/me` endpoint to check `profileComplete`, and redirects to onboarding or the role dashboard accordingly.

### `apps/api` — NestJS (Modular Monolith)

- **Global guards:** `ClerkAuthGuard` (JWT verification via Clerk JWKS) and `RolesGuard` are applied globally via `APP_GUARD` in `app.module.ts`. Use `@Public()` to opt out of auth, `@Roles('doctor'|'patient')` to restrict by role.
- **Module rule:** A service in module A must never query DB tables owned by module B directly. Cross-module data access goes through the owning module's service. See `doc/architecture.md`.
- **Webhook:** `POST /api/auth/webhook` (Svix signature verified) is the canonical place where `publicMetadata.role` is set on Clerk and the User + profile row are created in the DB. `ensureDoctorRecord` / `ensurePatientRecord` in each service handle the race-condition case where a user hits an API endpoint before the webhook fires — they create the DB row and call `clerk.users.updateUserMetadata` to sync the role.
- **File uploads:** Profile pictures are stored on disk at `uploads/profile-pictures/` and served as static files under `/api/uploads/`. The URL is persisted as `/api/uploads/profile-pictures/<filename>`.
- **Realtime:** `NotificationsGateway` (`apps/api/src/notifications`) is a Socket.IO gateway at `/api/socket.io`, authed with the Clerk JWT; each client joins a room named after its `User.id`. Services push via `emitToUser(userId, event, payload)` and also persist a `Notification` row (so history survives reconnects). Web client: `apps/web/src/lib/useNotifications.ts`. LiveKit webhooks (`/api/livekit/webhook`) use this to notify the other party when someone joins a consultation.
- **Prisma schema:** `apps/api/prisma/schema.prisma`. Run `prisma generate` after any schema change.

### `packages/types` — Shared TypeScript DTOs

Imported as `@lunasol/types` in both `web` and `api`. Add shared request/response shapes here rather than duplicating them.

## Data Model Summary

`User` (Clerk identity) → `PatientProfile` or `DoctorProfile` (1:1). Doctors own `AvailabilitySlot`s; patients book `Appointment`s against slots. An `Appointment` generates a `ConsultationRecord` which contains `Prescription`s. `Notification`s are persisted per user. See `doc/data-model.md` for the full ER diagram.

**Appointment lifecycle:** `PENDING` → doctor confirms (`PATCH /api/appointments/:id/confirm`, which mints `livekitRoom = appt-<uuid>`) → `CONFIRMED` → `COMPLETED`. The join token (`GET /api/appointments/:id/livekit-token`) is gated by a `JOIN_LEAD_MS` (5-min) window around `slot.startTime`/`endTime`.

**Instant (on-demand) appointments:** a doctor opts in via `DoctorProfile.acceptingInstant`; `POST /api/appointments/instant` creates a **slotless** appointment (`slotId` is nullable, `isInstant = true`) that skips the join-window check so the room is reachable immediately. Any appointment-rendering UI must be null-safe on `slot`. Note/prescription writing is doctor-only via `POST /api/appointments/:id/record` and `.../record/prescriptions` (consultations module).

## Key Patterns

- **`profileComplete` flag:** Returned on every profile response. Currently `true` when `bio` is non-empty (doctors) or `weight > 0 && height > 0` (patients). Dashboard redirect uses this to gate onboarding.
- **Role stored in two places:** Clerk `publicMetadata.role` (in JWT, lowercase `'doctor'`/`'patient'`) and `User.role` in DB (uppercase enum `DOCTOR`/`PATIENT`). Keep them in sync.
- **No hard deletes on appointments:** Status-only cancellation to preserve medical audit trail.

## Deployment & Branching

- Feature branches PR into **`main`**; never PR a feature branch into `prod`. A release is promoting `main` → `prod` via a PR.
- Pushing to **`prod`** triggers `.github/workflows/deploy.yml` on a **self-hosted runner**: build images → **`prisma migrate deploy`** → `docker compose -f docker-compose.prod.yml up -d` → health-check `lunasol-prod-api`. Migrations run **before** the new containers start, so any release PR that adds a Prisma migration deploys safely — but it **must include the migration directory** under `apps/api/prisma/migrations/`. The prod DB is only reachable from that runner; you cannot apply prod migrations by hand.
- More detail in `doc/deployment.md`. Other `doc/*.md` files cover auth, notifications, video, the AI service, data model, and testing.
