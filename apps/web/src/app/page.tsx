import { Video, Bot, FolderOpen, Bell, ArrowRight, ShieldCheck, Lock, BadgeCheck } from 'lucide-react'
import { Show, UserButton, SignInButton, SignUpButton } from '@clerk/nextjs'

// Single muted accent used sparingly (feature icons, badge). Deeper/less
// saturated than the focus-ring indigo so it reads as a brand tint, not a
// bright color. Tweak here to adjust the accent everywhere.
const ACCENT = '#4338ca'
const ACCENT_WASH = '#eef2ff'

export default function Home() {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#ffffff', minHeight: '100vh', color: '#111827' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap', gap: '16px' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>
          LunaSol
        </span>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a href="#features" className="ls-navlink" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>Features</a>
          <a href="#trust" className="ls-navlink" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>About</a>
          <a href="#contact" className="ls-navlink" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>Contact</a>
          <Show when="signed-out">
            {/* Sign in is a text link (matching the nav links above); Get started
                is the single primary button — so the header has no duplicate buttons. */}
            <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
              <button className="ls-navlink" style={{ background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '15px', padding: 0, fontFamily: 'inherit' }}>
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
              <button className="ls-btn ls-btn-primary" style={{ background: '#111827', border: 'none', color: '#ffffff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                Get started
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <a href="/dashboard" className="ls-navlink" style={{ color: '#111827', textDecoration: 'none', fontSize: '15px', fontWeight: 600 }}>
              Dashboard
            </a>
            <UserButton />
          </Show>
        </div>
      </nav>

      <main>
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '96px 24px 80px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'inline-block', background: ACCENT_WASH, border: '1px solid #e0e7ff', borderRadius: '999px', padding: '5px 14px', fontSize: '13px', color: ACCENT, marginBottom: '28px', fontWeight: 500 }}>
          Telehealth · Digital Care
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1, margin: '0 auto 20px', maxWidth: '760px', color: '#111827', letterSpacing: '-1.5px' }}>
          Better care, closer to you
        </h1>
        <p style={{ fontSize: '18px', color: '#6b7280', maxWidth: '500px', margin: '0 auto 44px', lineHeight: 1.7 }}>
          Connect with your care team, track your health, and manage appointments — all in one place.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Show when="signed-out">
            <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
              <button className="ls-btn ls-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', border: 'none', color: '#fff', padding: '13px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
                Get started <ArrowRight size={16} />
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <a href="/dashboard" className="ls-btn ls-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', border: 'none', color: '#fff', padding: '13px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, textDecoration: 'none' }}>
              Go to Dashboard <ArrowRight size={16} />
            </a>
          </Show>
          <a href="#features" className="ls-btn ls-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', background: 'transparent', border: '1px solid #d1d5db', color: '#111827', padding: '13px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 500, cursor: 'pointer', textDecoration: 'none' }}>
            Learn more
          </a>
        </div>
      </section>

      {/* Trust strip */}
      <section id="trust" style={{ borderBottom: '1px solid #e5e7eb', padding: '24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: '12px 40px' }}>
          {[
            { Icon: BadgeCheck, label: 'Licensed providers' },
            { Icon: Video, label: 'Secure video consultations' },
            { Icon: Lock, label: 'Your records, encrypted' },
            { Icon: ShieldCheck, label: 'Private by design' },
          ].map(({ Icon, label }) => (
            <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px', fontWeight: 500 }}>
              <Icon size={16} color={ACCENT} aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ maxWidth: '1100px', margin: '0 auto', padding: '80px 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '28px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.5px' }}>Everything you need</h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '56px', fontSize: '16px' }}>Built for patients and providers alike.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          {[
            { Icon: Video, title: 'Virtual Consultations', desc: 'Connect with licensed providers from home via secure video or chat.' },
            { Icon: Bot, title: 'Health Assistant', desc: 'Get instant answers and triage guidance from our clinical support tool.' },
            { Icon: FolderOpen, title: 'Health Records', desc: 'All your records, prescriptions, and history in one secure place.' },
            { Icon: Bell, title: 'Smart Reminders', desc: 'Never miss a medication, appointment, or follow-up.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="ls-card" style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '28px 24px' }}>
              <div style={{ display: 'inline-flex', padding: '10px', background: ACCENT_WASH, borderRadius: '8px', marginBottom: '16px' }}>
                <Icon size={20} color={ACCENT} aria-hidden="true" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#111827' }}>{title}</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '72px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 700, marginBottom: '12px', letterSpacing: '-0.5px' }}>
          Ready to take control of your health?
        </h2>
        <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '16px' }}>Care that fits your schedule — sign up in minutes.</p>
        <Show when="signed-out">
          <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
            <button className="ls-btn ls-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#111827', border: 'none', color: '#fff', padding: '14px 32px', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
              Create free account <ArrowRight size={16} />
            </button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <a href="/dashboard" className="ls-btn ls-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#111827', border: 'none', color: '#fff', padding: '14px 32px', borderRadius: '8px', fontSize: '16px', fontWeight: 600, textDecoration: 'none' }}>
            Go to Dashboard <ArrowRight size={16} />
          </a>
        </Show>
      </section>
      </main>

      {/* Footer */}
      <footer id="contact" style={{ borderTop: '1px solid #e5e7eb', padding: '40px 48px 28px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px' }}>
          <div>
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>LunaSol</span>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '8px 0 0', maxWidth: '280px', lineHeight: 1.6 }}>
              Telehealth and digital care, closer to you.
            </p>
            <a href="mailto:support@lunasol.health" className="ls-navlink" style={{ display: 'inline-block', color: '#6b7280', textDecoration: 'none', fontSize: '13px', marginTop: '12px' }}>
              support@lunasol.health
            </a>
          </div>
          <nav aria-label="Footer" style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
            <a href="/privacy" className="ls-navlink" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>Privacy</a>
            <a href="/terms" className="ls-navlink" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>Terms</a>
            <a href="mailto:support@lunasol.health" className="ls-navlink" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>Contact</a>
          </nav>
        </div>
        <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '32px' }}>
          © {new Date().getFullYear()} LunaSol. All rights reserved.
        </p>
      </footer>

    </div>
  )
}
