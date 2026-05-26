# Authentication & Authorization

## Decision: Clerk over custom auth

**Why Clerk:**
- Handles all auth complexity out of the box — registration, login, session management, password reset, MFA
- Issues JWTs verifiable by the NestJS backend without a shared secret (JWKS endpoint)
- Supports `publicMetadata` for storing custom claims (role) that appear in every JWT
- Webhook events for user lifecycle (creation, update, deletion)
- Healthcare context: Clerk is SOC 2 Type II compliant

**Trade-off accepted:** External dependency and cost at scale. For the MVP and hackathon context, the time saved vs. building custom auth justifies it entirely.

---

## Role Model

Two roles: `patient` and `doctor`. Role is set at registration, stored in Clerk's `publicMetadata.role`, and included in every JWT claim.

```
publicMetadata: {
  role: "patient" | "doctor"
}
```

Roles are immutable after registration — a user cannot switch roles without creating a new account.

---

## Auth Flow

### Registration

```
1. User fills registration form (email, password, role selection)
2. Clerk creates the user
3. Clerk fires user.created webhook → POST /api/auth/webhook
4. NestJS verifies webhook signature (CLERK_WEBHOOK_SECRET)
5. NestJS creates PatientProfile or DoctorProfile in DB
6. NestJS calls Clerk Backend API to set publicMetadata.role
7. User is redirected to role-specific dashboard
```

Role is stored in both the database (via the profile table) and Clerk metadata (via `publicMetadata`) so:
- The frontend can read the role from the JWT for routing decisions without an API call
- The backend can read the role from the JWT claim for access control without a DB lookup

### Login

```
1. User logs in via Clerk
2. Clerk issues a JWT
3. Frontend reads publicMetadata.role from the JWT
4. Frontend redirects to /dashboard/patient or /dashboard/doctor
```

### API Requests

Every request from the frontend includes:
```
Authorization: Bearer <clerk-jwt>
```

NestJS `AuthGuard` verifies the JWT on every protected request:
1. Extract the Bearer token from the Authorization header
2. Fetch Clerk's public JWKS from `https://api.clerk.com/v1/jwks`
3. Verify the JWT signature and expiry
4. Attach the decoded claims to `request.user`

---

## Access Control

Two guards applied in NestJS:

### AuthGuard
Applied globally via `APP_GUARD`. Rejects any request without a valid Clerk JWT with HTTP 401. Public endpoints (doctor listing, health check) are decorated with `@Public()` to opt out.

### RoleGuard
Applied per controller or handler via `@Roles('patient')` or `@Roles('doctor')`. Reads `role` from the decoded JWT claims. Returns HTTP 403 if the role does not match.

```
Patient JWT  → /api/patients/me      ✅ allowed
Patient JWT  → /api/doctors/me       ❌ 403
Doctor JWT   → /api/doctors/me       ✅ allowed
No JWT       → /api/doctors          ✅ public (opt-out)
No JWT       → /api/patients/me      ❌ 401
```

---

## Webhook Security

The Clerk webhook endpoint (`POST /api/auth/webhook`) is public (no JWT required — Clerk can't send one). It is secured by verifying the `svix-signature` header against `CLERK_WEBHOOK_SECRET`. Requests that fail signature verification are rejected with HTTP 400.
