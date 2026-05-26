# Video Consultation

## Decision: Self-Hosted Jitsi over Daily.co / Agora / Twilio

| Option | Cost | Control | Complexity |
|---|---|---|---|
| Daily.co | Paid after free tier | Low | Low |
| Agora | 10k min/month free | Medium | Medium |
| Jitsi self-hosted | Free (self-hosted) | Full | Medium |
| Custom WebRTC | Free | Full | Very high |

**Why Jitsi:**
- Completely free — no usage limits, no external billing
- Runs in Docker on the same server — no third-party data handling
- JWT room authentication is built-in — rooms can be locked to specific participants
- Open source and actively maintained
- Fits the self-hosted deployment model already chosen for the rest of the stack

**Trade-off accepted:** Jitsi requires four Docker containers (web, prosody, jicofo, jvb) instead of a single API call. This adds configuration overhead, particularly for the video bridge (JVB) which requires careful network config for peer-to-peer relay.

---

## Jitsi Docker Stack

Four services work together:

| Container | Role |
|---|---|
| `jitsi/web` | Jitsi Meet web interface |
| `jitsi/prosody` | XMPP server — handles signalling |
| `jitsi/jicofo` | Conference focus — manages sessions |
| `jitsi/jvb` | Video bridge — relays media streams |

All four are on the internal Docker network. Only `jitsi/web` is accessible externally via Nginx at `/meet/*`.

---

## Room Lifecycle

```
Appointment status → CONFIRMED
  → NestJS generates jitsiRoom = "appt-<uuid>"
  → Stored on Appointment.jitsiRoom
  → Patient and doctor see "Join Session" button on their appointment detail page

User clicks "Join Session"
  → Frontend calls GET /api/appointments/:id/jitsi-token
  → NestJS verifies the requesting user is the patient or doctor for this appointment
  → NestJS generates a short-lived JWT signed with JITSI_JWT_SECRET
  → Frontend opens /meet/<jitsiRoom>?jwt=<token>
  → Jitsi validates the JWT before admitting the user
```

---

## JWT Room Auth

Jitsi is configured with `ENABLE_AUTH=1` and `AUTH_TYPE=jwt`. Every user joining a room must present a valid JWT.

JWT payload:
```json
{
  "sub": "meet.<your-domain>",
  "iss": "lunasol",
  "aud": "jitsi",
  "room": "appt-<uuid>",
  "exp": <15 minutes from now>,
  "context": {
    "user": {
      "name": "John Patient",
      "email": "john@example.com"
    }
  }
}
```

Signed with `JITSI_JWT_SECRET` (HS256). Jitsi validates the signature and the `room` claim — a token for `appt-abc` cannot be used to join `appt-xyz`.

**Why short-lived tokens (15 min):**
Users should only be able to join within a reasonable window of the scheduled time. A 15-minute TTL means the token is usable when the session starts but expires before the next appointment slot.

---

## Session End

When the doctor leaves the session, the frontend detects the `participantLeft` event and prompts the doctor to add post-consultation notes. The Jitsi room continues to exist until the last participant leaves — there is no server-side "close room" call needed.
