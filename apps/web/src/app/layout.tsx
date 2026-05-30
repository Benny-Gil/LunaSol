import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'LunaSol Telehealth',
  description: 'Telehealth and digital care platform',
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
