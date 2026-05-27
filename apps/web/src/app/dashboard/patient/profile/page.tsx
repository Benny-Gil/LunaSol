import { UserButton } from '@clerk/nextjs'
import ProfileForm from '../components/ProfileForm'

export default function ProfileEditPage() {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a href="/dashboard/patient" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px', textDecoration: 'none' }}>LunaSol</a>
          <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px' }}>Patient Portal</span>
        </div>
        <UserButton />
      </nav>
      <ProfileForm mode="edit" />
    </div>
  )
}
