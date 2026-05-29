import ProfileForm from '../components/ProfileForm'

export default function OnboardingPage() {
  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 40px', background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>LunaSol</span>
      </nav>
      <ProfileForm mode="onboarding" />
    </div>
  )
}
