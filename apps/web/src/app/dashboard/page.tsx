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

  if (role === 'doctor') {
    if (token) {
      try {
        const res = await fetch(`${apiBase}/api/doctors/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        if (res.ok) {
          const profile = await res.json()
          if (!profile.profileComplete) redirect('/dashboard/doctor/onboarding')
        } else if (res.status === 404) {
          redirect('/dashboard/doctor/onboarding')
        }
      } catch (e) {
        if ((e as any)?.digest?.startsWith('NEXT_REDIRECT')) throw e
        // If API is unreachable, fall through to dashboard
      }
    }
    redirect('/dashboard/doctor')
  }

  // Check if patient profile is complete before sending to dashboard
  if (token) {
    try {
      const res = await fetch(`${apiBase}/api/patients/me`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const profile = await res.json()
        if (!profile.profileComplete) {
          redirect('/dashboard/patient/onboarding')
        }
      } else if (res.status === 404) {
        // Webhook hasn't fired yet — user has no DB record, treat as incomplete
        redirect('/dashboard/patient/onboarding')
      }
    } catch (e) {
      if ((e as any)?.digest?.startsWith('NEXT_REDIRECT')) throw e
      // If API is unreachable, fall through to dashboard
    }
  }

  redirect('/dashboard/patient')
}
