# Video Consultation

## Decision: Self-Hosted LiveKit over Jitsi / Daily.co / Agora / Twilio

| Option            | Cost                 | Control | Complexity |
| ----------------- | -------------------- | ------- | ---------- |
| Daily.co          | Paid after free tier | Low     | Low        |
| Agora             | 10k min/month free   | Medium  | Medium     |
| Jitsi self-hosted | Free (self-hosted)   | Full    | Medium-high|
| LiveKit self-hosted | Free (self-hosted) | Full    | Medium     |
| Custom WebRTC     | Free                 | Full    | Very high  |

**Why LiveKit:**

- Completely free — no usage limits, no external billing
- Single Docker container vs. Jitsi's four (web, prosody, jicofo, jvb)
- ~150 MB RAM idle vs. Jitsi's ~1.5–2 GB — fits the server's memory budget
- JWT room authentication built-in — rooms locked to specific participants
- First-class NestJS SDK (`livekit-server-sdk`) and React SDK (`@livekit/components-react`)
- React components are native — no iframe, consultation UI lives inside the app
- Built-in TURN support — no manual UDP port configuration
- Open source and actively maintained

**Trade-off accepted:** LiveKit's Egress service (for recording/transcription) is a separate container if needed. For 1-on-1 consultations without recording, the single `livekit` container is sufficient.

---

## LiveKit Docker Stack

One service handles everything:

| Container  | Role                                      |
| ---------- | ----------------------------------------- |
| `livekit`  | SFU — handles signalling, media relay, TURN |

Exposed internally only. Nginx proxies WebSocket connections at `/meet/*` to the LiveKit server.

---

## Room Lifecycle

```
Appointment status → CONFIRMED
  → NestJS generates livekitRoom = "appt-<uuid>"
  → Stored on Appointment.livekitRoom
  → Patient and doctor see "Join Session" button on their appointment detail page

User clicks "Join Session"
  → Frontend calls GET /api/appointments/:id/livekit-token
  → NestJS verifies the requesting user is the patient or doctor for this appointment
  → NestJS generates a short-lived token signed with LIVEKIT_API_SECRET
  → Frontend connects to LiveKit using @livekit/components-react with the token
  → LiveKit validates the token before admitting the user
```

---

## JWT Room Auth

LiveKit uses API key + secret for token signing. Every participant joining a room must present a valid access token.

Token is generated server-side using `livekit-server-sdk`:

```ts
import { AccessToken } from 'livekit-server-sdk';

const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
  identity: userId,
  name: displayName,
  ttl: '15m',
});
token.addGrant({ room: `appt-${appointmentId}`, roomJoin: true, canPublish: true, canSubscribe: true });
const jwt = await token.toJwt();
```

Token claims:
- `room` — scoped to the specific appointment room (`appt-<uuid>`)
- `identity` — the participant's userId
- `canPublish` / `canSubscribe` — explicit media permissions per participant
- `ttl` — 15 minutes from generation

A token for `appt-abc` cannot be used to join `appt-xyz`.

**Why short-lived tokens (15 min):**
Users should only be able to join within a reasonable window of the scheduled time. A 15-minute TTL means the token is usable when the session starts but expires before the next appointment slot.

---

## Session End

When the doctor leaves the session, the `useRoomContext()` hook fires a `disconnected` event. The frontend prompts the doctor to add post-consultation notes. The LiveKit room is automatically cleaned up once all participants leave — no server-side close call needed.

---

## Environment Variables

| Variable             | Purpose                          |
| -------------------- | -------------------------------- |
| `LIVEKIT_API_KEY`    | Token signing key name           |
| `LIVEKIT_API_SECRET` | Token signing secret             |
| `LIVEKIT_URL`        | WebSocket URL (`ws://livekit:7880`) used by the frontend |
