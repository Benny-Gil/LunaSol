import { UserButton } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server'
import { Video, Calendar, User, Users, Clock, ClipboardList } from 'lucide-react'

export default async function DoctorDashboard() {
  const user = await currentUser()
  const name = user?.lastName ? `Dr. ${user.lastName}` : 'Doctor'

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>
            LunaSol
          </span>
          <span style={{ background: '#f0fdf4', color: '#166534', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>
            Doctor Portal
          </span>
        </div>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>My Patients</a>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Schedule</a>
          <a href="#" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>Appointments</a>
          <UserButton />
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 24px' }}>
        {/* Welcome Banner */}
        <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #064e3b 100%)', borderRadius: '16px', padding: '32px 40px', color: '#ffffff', marginBottom: '32px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
            Good day, {name}!
          </h1>
          <p style={{ color: '#a7f3d0', fontSize: '16px', margin: 0, maxWidth: '600px', lineHeight: 1.5 }}>
            Access and manage your patients, clinical schedule, and appointments in real-time.
          </p>
        </div>

        {/* Quick Stats / Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          {[
            { Icon: Users, title: 'Active Patients', desc: 'View records, history, and notes for your patients.', count: '0 patients' },
            { Icon: Clock, title: 'Manage Schedule', desc: 'Set your hours, slots, and availability configuration.', count: 'Updated today' },
            { Icon: ClipboardList, title: 'Appointments Panel', desc: 'Accept, join, or complete telehealth video calls.', count: '0 pending' },
          ].map(({ Icon, title, desc, count }) => (
            <div key={title} style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)' }}>
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
            </div>
          ))}
        </div>

        {/* Next Session Section */}
        <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '32px', display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', padding: '16px', background: '#ecfdf5', borderRadius: '12px', color: '#059669' }}>
            <Video size={32} />
          </div>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0', color: '#111827' }}>No upcoming sessions</h3>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
              Your schedule is clear. You will receive real-time notifications when new patient calls are booked.
            </p>
          </div>
          <button style={{ background: '#10b981', border: 'none', color: '#ffffff', padding: '12px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            View Schedule
          </button>
        </div>
      </main>
    </div>
  )
}
