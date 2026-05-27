import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardRedirectPage() {
  const { userId } = auth()
  if (!userId) {
    redirect('/sign-in')
  }

  const user = await currentUser()
  const role = user?.publicMetadata?.role || user?.unsafeMetadata?.role || 'patient'

  if (role === 'doctor') {
    redirect('/dashboard/doctor')
  } else {
    redirect('/dashboard/patient')
  }
}
