import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardRedirectPage() {
  const { userId, getToken } = await auth()
  if (!userId) {
    redirect('/sign-in')
  }

  const user = await currentUser()
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role || 'patient'

  if (role === 'doctor') {
    redirect('/dashboard/doctor')
  }

  // Check if patient profile is complete before sending to dashboard
  try {
    const token = await getToken()
    const apiBase = process.env.INTERNAL_API_URL || 'http://localhost:3001'
    const res = await fetch(`${apiBase}/api/patients/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (res.ok) {
      const profile = await res.json()
      if (!profile.profileComplete) {
        redirect('/dashboard/patient/onboarding')
      }
    }
  } catch {
    // If API is unreachable, fall through to dashboard
  }

  redirect('/dashboard/patient')
}
