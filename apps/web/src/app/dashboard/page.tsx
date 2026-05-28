import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardRedirectPage() {
  const { userId, getToken } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  const user = await currentUser()
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role || 'patient'

  const token = await getToken()
  const apiBase = process.env.INTERNAL_API_URL || 'http://localhost:3001'

  console.log('[dashboard] userId:', userId, 'role:', role, 'hasToken:', !!token)

  if (role === 'doctor') {
    try {
      const res = await fetch(`${apiBase}/api/doctors/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      console.log('[dashboard] GET /doctors/me status:', res.status)
      if (res.ok) {
        const profile = await res.json()
        if (!profile.profileComplete) redirect('/dashboard/doctor/onboarding')
      } else if (res.status === 404 || res.status === 401) {
        redirect('/dashboard/doctor/onboarding')
      }
    } catch (e) {
      if ((e as any)?.digest?.startsWith('NEXT_REDIRECT')) throw e
      console.error('[dashboard] doctors/me fetch error:', e)
    }
    redirect('/dashboard/doctor')
  }

  // Check if patient profile is complete before sending to dashboard
  try {
    const res = await fetch(`${apiBase}/api/patients/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    console.log('[dashboard] GET /patients/me status:', res.status)
    if (res.ok) {
      const profile = await res.json()
      if (!profile.profileComplete) {
        redirect('/dashboard/patient/onboarding')
      }
    } else if (res.status === 404 || res.status === 401) {
      redirect('/dashboard/patient/onboarding')
    }
  } catch (e) {
    if ((e as any)?.digest?.startsWith('NEXT_REDIRECT')) throw e
    console.error('[dashboard] patients/me fetch error:', e)
  }

  redirect('/dashboard/patient')
}
