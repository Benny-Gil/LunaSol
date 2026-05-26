# Real-Time Notifications

## Decision: Socket.io over SSE or Polling

**Why Socket.io:**
- Bidirectional — NestJS can push to specific users at any time without a pending request
- Room concept maps naturally to the user model: each user gets a room by `userId`
- `@nestjs/websockets` + `@nestjs/platform-socket.io` is a native NestJS integration
- Handles reconnection and fallback to long-polling automatically

**Why not SSE for notifications:**
SSE is one-directional and requires the client to maintain an open connection per "channel." Socket.io rooms let one connection serve all notification types for a user.

**Why not polling:**
Polling would work but wastes resources with repeated requests that return nothing. For a healthcare app where timely appointment updates matter, real-time delivery is the right call.

---

## Gateway Design

```
NestJS NotificationsGateway (Socket.io)
  │
  ├── on connect: verify Clerk JWT from handshake auth
  ├── on connect: join room userId
  └── on disconnect: leave room
```

### Auth Handshake
The client passes the Clerk JWT in the Socket.io handshake:
```js
const socket = io('/api', {
  auth: { token: clerkJwt }
})
```
The gateway extracts and verifies the JWT before allowing the connection. Unauthenticated connections are rejected.

### Room Assignment
Each user is placed in a room named by their `userId`:
```ts
socket.join(userId)
```
This means `NotificationsService.sendToUser(userId, event, payload)` emits only to that user's connected clients — no broadcast, no cross-user leakage.

---

## Event Catalog

| Event | Trigger | Recipients |
|---|---|---|
| `appointment.booked` | Patient books a slot | Patient + Doctor |
| `appointment.confirmed` | Doctor confirms | Patient |
| `appointment.cancelled` | Either party cancels | Patient + Doctor |
| `appointment.rescheduled` | Patient reschedules | Patient + Doctor |
| `appointment.reminder` | Scheduled job (upcoming) | Patient + Doctor |
| `appointment.completed` | Doctor marks complete | Patient |

All events share the same payload shape:
```json
{
  "type": "appointment.booked",
  "message": "Your appointment with Dr. Santos is confirmed",
  "appointmentId": "...",
  "createdAt": "..."
}
```

---

## Persistence

Every notification is written to the `Notification` table before being emitted via Socket.io. This ensures:
- Users who were offline when an event fired still see it on their next visit
- `GET /api/notifications` returns the full notification history
- Unread count can be computed from the DB

The Socket.io emit is fire-and-forget after the DB write — delivery to disconnected clients is covered by the persisted record on next load.

---

## Nginx WebSocket Config

Socket.io requires HTTP upgrade headers to be passed through Nginx:
```nginx
location /api {
    proxy_pass http://api:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```
Without these, the WebSocket handshake fails and Socket.io falls back to long-polling.
