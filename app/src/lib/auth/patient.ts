import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export type PatientRecord = {
  id: string
  full_name: string | null
  user_id: string | null
}

export async function getAuthUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function requireAuthUser(): Promise<User> {
  const user = await getAuthUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

export async function resolvePatientForUser(userId: string): Promise<PatientRecord | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data as PatientRecord
}

export async function requirePatient(): Promise<{ user: User; patient: PatientRecord }> {
  const user = await requireAuthUser()
  const patient = await resolvePatientForUser(user.id)

  if (!patient) {
    redirect('/patient/account-setup')
  }

  return { user, patient }
}

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}
