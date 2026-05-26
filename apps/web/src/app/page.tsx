import { Video, Bot, FolderOpen, Bell, ArrowRight } from 'lucide-react'

export default function Home() {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#ffffff', minHeight: '100vh', color: '#111827' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: '20px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>
          LunaSol
        </span>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>Features</a>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>About</a>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '15px' }}>Contact</a>
          <button style={{ background: 'transparent', border: '1px solid #d1d5db', color: '#374151', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
            Sign in
          </button>
          <button style={{ background: '#111827', border: 'none', color: '#ffffff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '96px 24px 80px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'inline-block', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '999px', padding: '5px 14px', fontSize: '13px', color: '#6b7280', marginBottom: '28px', fontWeight: 500 }}>
          Telehealth · AI-Assisted Care
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800, lineHeight: 1.1, margin: '0 auto 20px', maxWidth: '760px', color: '#111827', letterSpacing: '-1.5px' }}>
          Healthcare, reimagined with AI
        </h1>
        <p style={{ fontSize: '18px', color: '#6b7280', maxWidth: '500px', margin: '0 auto 44px', lineHeight: 1.7 }}>
          Connect with your care team, get AI-powered insights, and manage your health — all in one place.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#111827', border: 'none', color: '#fff', padding: '13px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}>
            Get started <ArrowRight size={16} />
          </button>
          <button style={{ background: 'transparent', border: '1px solid #d1d5db', color: '#374151', padding: '13px 28px', borderRadius: '8px', fontSize: '15px', fontWeight: 500, cursor: 'pointer' }}>
            Learn more
          </button>
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '80px 24px' }}>
        <h2 style={{ textAlign: 'center', fontSize: '28px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.5px' }}>Everything you need</h2>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '56px', fontSize: '16px' }}>Built for patients and providers alike.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
          {[
            { Icon: Video, title: 'Virtual Consultations', desc: 'Connect with licensed providers from home via secure video or chat.' },
            { Icon: Bot, title: 'AI Health Assistant', desc: 'Get instant answers and triage guidance powered by our AI model.' },
            { Icon: FolderOpen, title: 'Health Records', desc: 'All your records, prescriptions, and history in one secure place.' },
            { Icon: Bell, title: 'Smart Reminders', desc: 'Never miss a medication, appointment, or follow-up.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '28px 24px' }}>
              <div style={{ display: 'inline-flex', padding: '10px', background: '#f3f4f6', borderRadius: '8px', marginBottom: '16px' }}>
                <Icon size={20} color="#374151" />
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
        <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '16px' }}>Join thousands already on LunaSol.</p>
        <button style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#111827', border: 'none', color: '#fff', padding: '14px 32px', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
          Create free account <ArrowRight size={16} />
        </button>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '28px', color: '#9ca3af', fontSize: '13px', borderTop: '1px solid #e5e7eb' }}>
        © {new Date().getFullYear()} LunaSol. All rights reserved.
      </footer>

    </div>
  )
}
