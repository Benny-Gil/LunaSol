import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

export interface LegalSection {
  heading: string
  body: ReactNode
}

/**
 * Shared layout for static legal/policy pages (Privacy, Terms). Matches the
 * landing page's inline-style aesthetic: a slim header that links back home,
 * a readable text column, and the same muted footer line.
 */
export default function LegalPage({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string
  lastUpdated: string
  intro: string
  sections: LegalSection[]
}) {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#ffffff', minHeight: '100vh', color: '#111827' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '16px' }}>
        <a href="/" className="ls-navlink" style={{ fontSize: '20px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px', textDecoration: 'none' }}>
          LunaSol
        </a>
        <a href="/" className="ls-navlink" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to home
        </a>
      </nav>

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '64px 24px 80px' }}>
        <h1 style={{ fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 800, lineHeight: 1.15, margin: '0 0 12px', letterSpacing: '-1px' }}>
          {title}
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 32px' }}>Last updated: {lastUpdated}</p>

        <div style={{ background: '#eef2ff', border: '1px solid #e0e7ff', borderRadius: '12px', padding: '16px 20px', marginBottom: '40px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#4338ca', lineHeight: 1.6 }}>{intro}</p>
        </div>

        {sections.map(({ heading, body }) => (
          <section key={heading} style={{ marginBottom: '36px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px', letterSpacing: '-0.3px' }}>{heading}</h2>
            <div style={{ color: '#374151', fontSize: '16px', lineHeight: 1.75 }}>{body}</div>
          </section>
        ))}
      </main>

      <footer style={{ borderTop: '1px solid #e5e7eb', padding: '28px' }}>
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', margin: 0 }}>
          © {new Date().getFullYear()} LunaSol. All rights reserved. ·{' '}
          <a href="/privacy" className="ls-navlink" style={{ color: '#9ca3af', textDecoration: 'none' }}>Privacy</a>{' · '}
          <a href="/terms" className="ls-navlink" style={{ color: '#9ca3af', textDecoration: 'none' }}>Terms</a>
        </p>
      </footer>
    </div>
  )
}
