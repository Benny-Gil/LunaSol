# Roadmap

Progress against the planned feature set. Updated as of the current state of `main`.

---

## Done

### Infrastructure & Auth
- [x] Docker Compose (dev + prod), Nginx reverse proxy, Cloudflare Tunnel
- [x] CI/CD pipeline — GitHub Actions → SSH → `docker compose --build` + Prisma migrate
- [x] Clerk auth — JWT guard, role model (`doctor` / `patient`), webhook sync, `publicMetadata` propagation
- [x] Role-based guards (`@Roles`, `@Public`) applied globally via `APP_GUARD`

### Onboarding & Profiles
- [x] Patient onboarding flow + profile API (`/api/patients/me`)
- [x] Doctor onboarding flow + profile API (`/api/doctors/me`) with profile picture upload
- [x] `profileComplete` flag gates dashboard redirect for both roles

### Appointments
- [x] Doctor availability slots API (create, list, block)
- [x] Doctor listing API with filters (specialization, name) and availability endpoint
- [x] Appointment management API — book, confirm, cancel, complete; status-only, no hard deletes
- [x] Doctor discovery + detail pages (patient UI)
- [x] Appointment booking flow UI (patient UI)
- [x] Patient appointments list + appointment detail page
- [x] Patient medical records page (consultation records + prescriptions, read-only)

### Video Consultation (LiveKit)
- [x] Self-hosted `livekit-server` Docker service (dev + prod) behind Nginx `/meet` (WebSocket upgrade)
- [x] `livekitRoom` populated on appointment confirm (renamed from legacy `jitsiRoom`)
- [x] `GET /api/appointments/:id/livekit-token` — server-side token via `livekit-server-sdk`, scoped to the appointment room, 15 min TTL, patient/doctor only
- [x] Reusable `<ConsultationSession>` — native `@livekit/components-react` UI, no iframe
- [x] Patient appointment detail page with windowed "Join Session"
- [x] Doctor appointments list + detail page — confirm/complete, join, post-session notes prompt

### Notifications
- [x] Socket.io gateway with per-user rooms
- [x] `appointment.booked` / `appointment.status_changed` events emitted from appointments service
- [x] Notification bell UI with unread count badge and dropdown (real-time updates)
- [x] Notification persistence in DB

### AI Triage
- [x] FastAPI inference service — MedGemma 1.5 4B IQ4_XS, full GPU offload, GGUF via llama-cpp-python
- [x] `POST /recommend` SSE endpoint — streams model output token-by-token
- [x] NestJS SSE relay — fetches doctors from DB, pipes FastAPI stream to browser, appends matched doctor objects in final event
- [x] Offline fallback — keyword + Levenshtein fuzzy matching when AI service is unavailable
- [x] Pre-built CUDA wheel install (no nvcc compilation in Docker build)

### Testing
- [x] Unit testing setup — Vitest (web), Jest (api), Pytest (ai)
- [x] Integration test setup — NestJS supertest against a real DB
- [x] E2E setup — Playwright

---

## In Progress / Up Next

### Doctor Dashboard
- [x] Doctor appointments list (upcoming, past) with confirm/complete actions
- [x] Appointment detail page (doctor view) — confirm/complete, join session, patient info

### Consultation Records & Prescriptions
- [ ] `POST /api/consultations` — create record after session ends (doctor only)
- [ ] `POST /api/consultations/:id/prescriptions` — add prescription to record
- [ ] Doctor-side UI for post-consultation notes and prescription entry

---

## Backlog

- [ ] Email notifications (appointment reminders)
- [ ] Appointment rescheduling flow
- [ ] Doctor calendar view (week/month grid)
- [ ] Patient search by symptom (surface AI recommendations on the discovery page)
- [ ] Admin panel (beyond pgAdmin — user management, audit log)
- [ ] LiveKit Egress for session recording (opt-in, consent required)
