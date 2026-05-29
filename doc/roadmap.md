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

### Video Consultation (LiveKit)
- [ ] `GET /api/appointments/:id/livekit-token` — server-side token generation via `livekit-server-sdk`, scoped to appointment room, 15 min TTL
- [ ] `livekitRoom` field population on appointment confirm
- [ ] Patient consultation room UI — `@livekit/components-react` inside the appointment detail page
- [ ] Doctor consultation room UI — join/leave, post-session prompt for notes

### Doctor Dashboard
- [ ] Doctor appointments list (upcoming, past)
- [ ] Appointment detail page (doctor view) — confirm/complete actions, patient info

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
