import { redirect } from 'next/navigation'
import { getAuthUser, resolvePatientForUser } from '@/lib/auth/patient'

export default async function Home() {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  const patient = await resolvePatientForUser(user.id)
  if (patient) {
    redirect('/patient/dashboard')
  }

  redirect('/patient/account-setup')
}
