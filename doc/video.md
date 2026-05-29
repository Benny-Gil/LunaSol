# Video Consultation

## Decision: LiveKit Cloud

LunaSol uses **LiveKit Cloud** (managed SFU + TURN) for real-time video. The app keeps
minting its own room-join tokens with `livekit-server-sdk`; only the media plane is hosted
by LiveKit.

| Option              | Cost                  | Control | Complexity |
| ------------------- | --------------------- | ------- | ---------- |
| Daily.co            | Paid after free tier  | Low     | Low        |
| Agora               | 10k min/month free    | Medium  | Medium     |
| LiveKit self-hosted | Free (self-hosted)    | Full    | Medium     |
| **LiveKit Cloud**   | **Free Build tier**   | Medium  | **Low**    |

**Why LiveKit Cloud (not self-hosted):** the production host sits behind a Cloudflare
Tunnel on a NAT'd network. The tunnel proxies HTTP/WebSocket only — it cannot carry
WebRTC **media** (UDP), and client-side TURN can't fix an *unreachable SFU*. Self-hosting
the media plane would require router port-forwarding + DDNS + dependence on home-upload
bandwidth/ISP policy — unacceptable for patient-facing medical calls. LiveKit Cloud's
globally-reachable SFU+TURN removes the transport problem entirely; the browser connects
directly to LiveKit, never through our tunnel.

**Cost (Build / free tier):** only WebRTC participant-minutes + downstream bandwidth apply
(no AI agents). A 30-min 1:1 consult ≈ 60 participant-minutes; the free tier (5,000 min +
50 GB/mo) covers ~80 consults/month. Beyond that ≈ $0.06–0.08/consult; the $50/mo Ship
plan only pays off above ~700 consults/month. See [issue #58](../README.md) for the full
analysis.

---

## Architecture

```
Browser ──(signaling + media, WebRTC)──▶ LiveKit Cloud (wss://<project>.livekit.cloud)
   │
   └──(GET /api/appointments/:id/livekit-token)──▶ NestJS API  (mints the join token)

LiveKit Cloud ──(webhook: participant_joined, …)──▶ https://<domain>/api/livekit/webhook
```

Everything else (web, api, db) stays self-hosted behind Nginx + the Cloudflare Tunnel.
Nginx does **not** proxy video traffic — the browser talks to LiveKit Cloud directly using
the `url` returned by the token endpoint.

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
    AND that now is within the join window (5 min before slot start → slot end)
  → NestJS generates a short-lived token signed with LIVEKIT_API_SECRET
  → Frontend connects to LiveKit Cloud (serverUrl = NEXT_PUBLIC_LIVEKIT_URL) with the token
  → LiveKit validates the token before admitting the user
```

---

## JWT Room Auth

LiveKit uses the project's API key + secret for token signing. Every participant joining a
room must present a valid access token, generated server-side with `livekit-server-sdk`:

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

A token for `appt-abc` cannot be used to join `appt-xyz`. The join window is **also enforced
server-side** in `getLivekitToken` (not just the client button), so the endpoint can't be
called out-of-band.

---

## Webhooks

LiveKit Cloud POSTs server events to the API at `POST /api/livekit/webhook`
(`LivekitWebhookController`, `@Public`). The request is authenticated by a signed
`Authorization` header, verified with the project's API key/secret via `WebhookReceiver`.
On `participant_joined`, the API notifies the *other* party ("X has joined the
consultation") through the existing notification plumbing.

- **Configure** the webhook URL in the LiveKit Cloud project dashboard →
  `https://<domain>/api/livekit/webhook`. It's publicly reachable through the tunnel.
- **Local dev limitation:** LiveKit Cloud cannot reach `localhost`, so `participant_joined`
  notifications won't fire in local dev unless you expose the API with a temporary tunnel
  (e.g. cloudflared/ngrok) and point a dev project's webhook at it. The handler logic is
  covered by unit tests regardless.

---

## Session End

When the doctor leaves the session, the LiveKit `disconnected` event fires; the frontend
returns to the appointment detail page and prompts the doctor to add post-consultation
notes. The LiveKit room is cleaned up automatically once all participants leave — no
server-side close call needed.

---

## Environment Variables

| Variable             | Purpose                          |
| -------------------- | -------------------------------- |
| `LIVEKIT_API_KEY`    | LiveKit Cloud project API key — token signing + webhook verification (API) |
| `LIVEKIT_API_SECRET` | LiveKit Cloud project API secret — token signing + webhook verification (API) |
| `NEXT_PUBLIC_LIVEKIT_URL` | **Browser-facing** LiveKit Cloud project URL, e.g. `wss://<project>.livekit.cloud`. Build-time var in the web image. |

> Create the project at https://cloud.livekit.io and copy these from its dashboard. Use a
> separate project for dev vs prod so test traffic and keys stay isolated. `NEXT_PUBLIC_*`
> is baked at build time — changing the URL requires rebuilding the web image.
