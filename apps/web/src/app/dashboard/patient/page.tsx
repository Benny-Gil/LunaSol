import { UserButton } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server'
import { Video, Bot, FolderOpen, Calendar } from 'lucide-react'

export default async function PatientDashboard() {
  const user = await currentUser()
  const name = user?.firstName || 'Patient'

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>
            LunaSol
          </span>
          <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>
            Patient Portal
          </span>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <a href="/doctors" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Find Doctors</a>
          <a href="/dashboard/patient/appointments" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Appointments</a>
          <a href="/dashboard/patient/records" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Records</a>
          <a href="/dashboard/patient/profile" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Profile</a>
          <UserButton />
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Welcome Banner */}
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '16px', padding: '32px 40px', color: '#ffffff', marginBottom: '32px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Welcome back, {name}!
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0, maxWidth: '600px', lineHeight: 1.5 }}>
            All your health resources, virtual consultations, and medical records are synchronized and ready.
          </p>
        </div>

        {/* Quick Stats / Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          {[
            { Icon: Video, title: 'Virtual Consultations', href: '/dashboard/patient/appointments', desc: 'Join or schedule a video call with a practitioner.', count: 'No active calls' },
            { Icon: Calendar, title: 'Appointments', href: '/dashboard/patient/appointments', desc: 'View, reschedule, or book a doctor appointment.', count: '0 upcoming' },
            { Icon: FolderOpen, title: 'Medical Records', href: '/dashboard/patient/records', desc: 'Securely access prescriptions and test results.', count: 'Updated recently' },
          ].map(({ Icon, title, href, desc, count }) => (
            <a key={title} href={href} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)', textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{ display: 'inline-flex', padding: '8px', background: '#f3f4f6', borderRadius: '8px' }}>
                  <Icon size={20} color="#111827" />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: '12px' }}>
                  {count}
                </span>
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px', color: '#111827' }}>{title}</h3>
              <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>{desc}</p>
            </a>
          ))}
        </div>

        {/* AI Assistant Section */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', padding: '16px', background: '#eff6ff', borderRadius: '12px', color: '#2563eb' }}>
            <Bot size={32} />
          </div>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0', color: '#111827' }}>Need immediate support?</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
              Use our AI-powered clinical assistant to triage symptoms and receive curated advice.
            </p>
          </div>
          <a href="/doctors" style={{ background: '#111827', border: 'none', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>
            Find a Doctor
          </a>
        </div>
      </main>
    </div>
  )
}
