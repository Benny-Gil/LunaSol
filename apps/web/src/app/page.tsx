export default function Home() {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#0a0f1e', minHeight: '100vh', color: '#e8eaf0' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 48px', borderBottom: '1px solid #1e2740' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, background: 'linear-gradient(135deg, #7c9fff, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          LunaSol
        </span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <a href="#" style={{ color: '#9aa5c4', textDecoration: 'none', fontSize: '15px' }}>Features</a>
          <a href="#" style={{ color: '#9aa5c4', textDecoration: 'none', fontSize: '15px' }}>About</a>
          <button style={{ background: 'transparent', border: '1px solid #3b4f7a', color: '#9aa5c4', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 24px 80px' }}>
        <div style={{ display: 'inline-block', background: '#111827', border: '1px solid #1e2740', borderRadius: '999px', padding: '6px 16px', fontSize: '13px', color: '#7c9fff', marginBottom: '28px' }}>
          Telehealth · AI-Assisted Care
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.1, margin: '0 auto 24px', maxWidth: '800px', background: 'linear-gradient(160deg, #ffffff 40%, #7c9fff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Healthcare, reimagined with AI
        </h1>
        <p style={{ fontSize: '18px', color: '#9aa5c4', maxWidth: '520px', margin: '0 auto 48px', lineHeight: 1.7 }}>
          Connect with your care team, get AI-powered insights, and manage your health — all in one place.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button style={{ background: 'linear-gradient(135deg, #7c9fff, #c084fc)', border: 'none', color: '#fff', padding: '14px 32px', borderRadius: '10px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}>
            Get started
          </button>
          <button style={{ background: 'transparent', border: '1px solid #3b4f7a', color: '#9aa5c4', padding: '14px 32px', borderRadius: '10px', fontSize: '16px', cursor: 'pointer' }}>
            Learn more
          </button>
        </div>
      </section>

      {/* Feature cards */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', maxWidth: '1100px', margin: '0 auto', padding: '0 24px 100px' }}>
        {[
          { icon: '🩺', title: 'Virtual Consultations', desc: 'Connect with licensed providers from home via secure video or chat.' },
          { icon: '🤖', title: 'AI Health Assistant', desc: 'Get instant answers and triage guidance powered by our AI model.' },
          { icon: '📋', title: 'Health Records', desc: 'All your records, prescriptions, and history in one secure place.' },
          { icon: '🔔', title: 'Smart Reminders', desc: 'Never miss a medication, appointment, or follow-up.' },
        ].map(({ icon, title, desc }) => (
          <div key={title} style={{ background: '#111827', border: '1px solid #1e2740', borderRadius: '16px', padding: '32px 28px' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>{icon}</div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '10px', color: '#e8eaf0' }}>{title}</h3>
            <p style={{ fontSize: '14px', color: '#6b7a99', lineHeight: 1.6, margin: 0 }}>{desc}</p>
          </div>
        ))}
      </section>

      {/* CTA banner */}
      <section style={{ background: 'linear-gradient(135deg, #0d1a3a, #1a0d3a)', borderTop: '1px solid #1e2740', borderBottom: '1px solid #1e2740', padding: '72px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 42px)', fontWeight: 800, marginBottom: '16px', color: '#e8eaf0' }}>
          Ready to take control of your health?
        </h2>
        <p style={{ color: '#9aa5c4', marginBottom: '36px', fontSize: '16px' }}>Join thousands already on LunaSol.</p>
        <button style={{ background: 'linear-gradient(135deg, #7c9fff, #c084fc)', border: 'none', color: '#fff', padding: '16px 40px', borderRadius: '10px', fontSize: '17px', fontWeight: 600, cursor: 'pointer' }}>
          Create free account
        </button>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '32px', color: '#3b4f7a', fontSize: '13px' }}>
        © {new Date().getFullYear()} LunaSol. All rights reserved.
      </footer>

    </div>
  )
}
