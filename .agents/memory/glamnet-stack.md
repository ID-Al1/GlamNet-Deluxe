---
name: GlamNet stack & auth
description: Core tech stack, auth mechanism, demo credentials, and key library choices for the GlamNet app.
---

- **Stack**: Express 5 + Drizzle ORM + PostgreSQL; React + Vite + Wouter; Tailwind CSS v4; TanStack React Query; shadcn/ui; Framer Motion available.
- **Auth**: Custom HMAC-SHA256 token stored in `localStorage` key `glamnet_auth`. `setAuthToken()` from `@workspace/api-client-react`. `AuthProvider` reads localStorage synchronously (lazy `useState`) — `isLoading` is always false to avoid auth waterfall.
- **Demo credentials**: all passwords `demo1234`. Emails: `client@glamnet.co.za`, `artist@glamnet.co.za`, `brand@glamnet.co.za`.
- **QueryClient**: `staleTime: 30s`, `gcTime: 5min`, `refetchOnWindowFocus: false`.
- **Routing**: Wouter with `base={import.meta.env.BASE_URL}`. `/profile/setup` is outside AppLayout in the router so it can render full-screen.

**Why:** Custom HMAC token avoids JWT library overhead; localStorage chosen for simplicity (no httpOnly cookie complexity). Synchronous auth read was critical to eliminate dashboard flash of unauthenticated state.
