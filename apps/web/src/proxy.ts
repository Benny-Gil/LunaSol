import { clerkMiddleware } from '@clerk/nextjs/server'

// frontendApiProxy only works with production Clerk instances (pk_live_*).
// Dev instances use Clerk's standard dev-browser redirect mechanism instead.
const isProduction = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_')

export default clerkMiddleware(
  isProduction ? { frontendApiProxy: { enabled: true, path: '/__clerk' } } : {},
)

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
}
