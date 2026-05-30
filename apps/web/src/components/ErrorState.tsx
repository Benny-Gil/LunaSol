import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Reusable, friendly error panel. Used by the App Router error boundaries and
 * by any data view that wants to surface a load failure inline instead of a
 * blank screen. Presentational only — pass `onRetry` to show a retry button.
 */
export default function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  homeHref = '/',
  compact = false,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  homeHref?: string | null
  compact?: boolean
}) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '12px',
        padding: compact ? '32px 20px' : '64px 24px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        color: '#374151',
      }}
    >
      <div style={{ display: 'inline-flex', padding: '12px', background: '#fef2f2', borderRadius: '12px' }}>
        <AlertTriangle size={compact ? 24 : 32} color="#dc2626" />
      </div>
      <h2 style={{ fontSize: compact ? '16px' : '20px', fontWeight: 700, color: '#111827', margin: 0 }}>{title}</h2>
      <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, maxWidth: '420px', lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '8px', border: 'none',
              background: '#10b981', color: '#ffffff', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            <RefreshCw size={15} /> Try again
          </button>
        )}
        {homeHref && (
          <a
            href={homeHref}
            style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '10px 18px', borderRadius: '8px', border: '1px solid #d1d5db',
              background: '#ffffff', color: '#374151', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
            }}
          >
            Go home
          </a>
        )}
      </div>
    </div>
  )
}
