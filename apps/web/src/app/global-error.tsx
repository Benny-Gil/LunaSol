'use client'

// Last-resort boundary for errors thrown in the root layout itself. It replaces
// the entire document, so it must render its own <html>/<body>. Kept minimal and
// provider-free since the normal app shell is unavailable here.
import { useEffect } from 'react'
import ErrorState from '@/components/ErrorState'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global error]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
          <ErrorState
            title="The app ran into a problem"
            message="Something went wrong while loading LunaSol. Please try again."
            onRetry={reset}
          />
        </main>
      </body>
    </html>
  )
}
