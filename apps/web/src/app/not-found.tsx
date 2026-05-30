// Graceful 404 for unknown routes (App Router `not-found` convention).
import ErrorState from '@/components/ErrorState'

export default function NotFound() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
      <ErrorState
        title="Page not found"
        message="The page you're looking for doesn't exist or may have moved."
        homeHref="/"
      />
    </main>
  )
}
