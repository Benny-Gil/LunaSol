'use client'

// App Router error boundary: catches uncaught render/runtime errors in any
// route segment and shows a graceful fallback with a reset, instead of a blank
// screen. `reset()` re-renders the segment to recover without a full reload.
import { useEffect } from 'react'
import ErrorState from '@/components/ErrorState'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[route error]', error)
  }, [error])

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <ErrorState
        title="This page hit a snag"
        message="We couldn't finish loading this view. You can retry, or head back home."
        onRetry={reset}
      />
    </main>
  )
}
