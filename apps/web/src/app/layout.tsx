import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

// Public base URL of the site, used to resolve absolute URLs for OpenGraph /
// canonical tags. Falls back to localhost in dev.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'LunaSol Telehealth',
    template: '%s · LunaSol',
  },
  description:
    'LunaSol connects you with licensed providers for secure video consultations, keeps your health records in one place, and helps you manage appointments and reminders.',
  keywords: [
    'telehealth',
    'virtual consultations',
    'online doctor',
    'digital health',
    'health records',
    'LunaSol',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'LunaSol — Better care, closer to you',
    description:
      'Connect with your care team, track your health, and manage appointments — all in one place.',
    url: '/',
    siteName: 'LunaSol',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LunaSol — Better care, closer to you',
    description:
      'Connect with your care team, track your health, and manage appointments — all in one place.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Individual pages render their own <main> landmark, so the layout
            uses a neutral wrapper to avoid nested/duplicate <main> elements. */}
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  )
}
