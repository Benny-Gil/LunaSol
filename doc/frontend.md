# Frontend

## Stack: Next.js 14 (App Router) + Tailwind v4 + Shadcn/UI

### Why Next.js 14 App Router over Pages Router

The App Router (introduced in Next.js 13, stable in 14) enables React Server Components (RSC). For a data-heavy app like a telehealth dashboard, RSC means:

- Initial page data is fetched server-side before HTML is sent — no loading spinners for primary content
- Server Components have direct access to environment variables and can call the NestJS API without CORS
- Layouts, loading states, and error boundaries are co-located with routes via the file system

**Trade-off accepted:** The App Router mental model (server vs. client components, `use client` boundaries) has a steeper learning curve than Pages Router. Shared state (auth, socket) must be managed carefully at client component boundaries.

### Why Tailwind v4

- Utility-first CSS keeps styles co-located with components — no context-switching to CSS files
- Tailwind v4's new engine (Oxide) is faster and eliminates the need for a PostCSS config
- Works well with Shadcn's token-based design system

### Why Shadcn/UI

- Shadcn components are copied into the project (not installed as a dependency) — full ownership and customizability
- Built on Radix UI primitives — accessible by default (ARIA, keyboard navigation)
- Designed for Tailwind — no CSS-in-JS overhead

---

## Routing Structure

```
app/
├── (auth)/
│   ├── sign-in/          # Clerk sign-in page
│   └── sign-up/          # Clerk sign-up + role selection
├── dashboard/
│   ├── patient/
│   │   ├── page.tsx      # Patient dashboard home
│   │   ├── doctors/      # Doctor discovery + detail
│   │   ├── appointments/ # Booking, history
│   │   └── records/      # Medical records
│   └── doctor/
│       ├── page.tsx      # Doctor dashboard home
│       ├── schedule/     # Availability management
│       ├── appointments/ # Upcoming + past
│       └── profile/      # Profile edit
└── layout.tsx            # Root layout with ClerkProvider + Socket.io init
```

Route groups `(auth)` and `dashboard` keep auth pages separate from protected pages without affecting the URL.

---

## Data Fetching Patterns

### Server Components (default)

Used for initial page data — doctor listings, appointment history, profile details. Data is fetched directly in the component using `fetch` with the Clerk session token.

```tsx
// app/dashboard/patient/doctors/page.tsx
export default async function DoctorsPage() {
  const { getToken } = auth()
  const token = await getToken()
  const doctors = await fetch('/api/doctors', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  return <DoctorList doctors={doctors} />
}
```

### Client Components (`'use client'`)

Used for interactive features: booking forms, slot pickers, the AI symptom input, and anything that uses `useState` or browser APIs.

### SSE (AI Recommendations)

The symptom input component opens an `EventSource` connection and renders events as they stream in. This must be a Client Component.

### Socket.io

Initialized once in the root layout's client wrapper. Incoming events update a global notification store (Zustand or React context) that the notification bell reads from.

---

## Auth in the Frontend

Clerk's `middleware.ts` runs on every request and redirects unauthenticated users to `/sign-in`. Inside protected routes, `auth()` (Server Components) and `useAuth()` (Client Components) provide the current user and `getToken()`.

Role-based redirects happen at sign-in: the middleware reads `publicMetadata.role` from the session and rewrites the destination to the correct dashboard.

---

## Why No Separate State Management Library

The app's server-side data is fetched fresh per page load via RSC — no need to cache it in global state. The only global client state is:

- Notification list (Socket.io events) — managed with a small Zustand store or React context
- Auth session — managed by Clerk

Adding Redux or a heavy store for two concerns would be over-engineering.
