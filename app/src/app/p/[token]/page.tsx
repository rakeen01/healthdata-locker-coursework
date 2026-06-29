import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getAuthUser, resolvePatientForUser } from '@/lib/auth/patient'

type PublicPrescriptionRow = {
  visit_date: string | null
  doctor_name: string | null
  diagnosis: string | null
  notes: string | null
  prescription_text: string | null
  patient_full_name: string | null
}

function formatVisitDate(visitDate: string | null): string {
  if (!visitDate) return '-'
  const parsed = new Date(visitDate)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen w-full justify-center bg-gray-50">
      <div className="mx-auto my-6 mb-10 w-full max-w-[420px] overflow-hidden rounded-[32px] border-[10px] border-gray-900 bg-white shadow-xl">
        <div className="flex h-14 items-center justify-center bg-[#1AA7A1] text-base font-semibold text-white">
          HealthData Locker
        </div>
        <div className="p-4">{children}</div>
      </div>
    </main>
  )
}

function NotFoundContent({ showBackLink }: { showBackLink: boolean }) {
  return (
    <>
      <h1 className="text-lg font-semibold text-gray-900">Prescription not found</h1>
      <p className="mt-2 text-sm text-gray-500">
        This link is invalid or no longer available.
      </p>
      {showBackLink ? (
        <Link href="/patient/dashboard" className="mt-6 inline-block text-[13px] text-[#1AA7A1]">
          Back to prescriptions
        </Link>
      ) : null}
    </>
  )
}

export default async function PublicPrescriptionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const authUser = await getAuthUser()
  const showBackLink = Boolean(authUser)

  if (authUser) {
    const patient = await resolvePatientForUser(authUser.id)
    if (!patient) {
      return (
        <MobileShell>
          <NotFoundContent showBackLink={false} />
        </MobileShell>
      )
    }

    const { data: owned, error: ownedError } = await supabase
      .from('prescriptions')
      .select(
        'visit_date, doctor_name, diagnosis, notes, prescription_text, patient_id, patients(full_name)'
      )
      .eq('public_token', token)
      .eq('patient_id', patient.id)
      .maybeSingle()

    if (ownedError || !owned) {
      return (
        <MobileShell>
          <NotFoundContent showBackLink={showBackLink} />
        </MobileShell>
      )
    }

    const patientJoin = Array.isArray(owned.patients) ? owned.patients[0] : owned.patients
    const prescription: PublicPrescriptionRow = {
      visit_date: owned.visit_date,
      doctor_name: owned.doctor_name,
      diagnosis: owned.diagnosis,
      notes: owned.notes,
      prescription_text: owned.prescription_text,
      patient_full_name:
        patientJoin && typeof patientJoin === 'object' && 'full_name' in patientJoin
          ? (patientJoin.full_name as string | null)
          : patient.full_name,
    }

    return (
      <MobileShell>
        <h1 className="mb-4 text-lg font-semibold text-gray-900">Prescription</h1>
        <PrescriptionFields prescription={prescription} />
        <Link href="/patient/dashboard" className="mt-6 inline-block text-[13px] text-[#1AA7A1]">
          Back to prescriptions
        </Link>
      </MobileShell>
    )
  }

  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    'get_prescription_by_public_token',
    { p_token: token }
  )

  const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows

  if (rpcError || !row) {
    return (
      <MobileShell>
        <NotFoundContent showBackLink={false} />
      </MobileShell>
    )
  }

  const prescription = row as PublicPrescriptionRow

  return (
    <MobileShell>
      <h1 className="mb-4 text-lg font-semibold text-gray-900">Prescription</h1>
      <PrescriptionFields prescription={prescription} />
    </MobileShell>
  )
}

function PrescriptionFields({ prescription }: { prescription: PublicPrescriptionRow }) {
  return (
    <dl className="space-y-4">
      <div>
        <dt className="text-sm text-gray-500">Patient</dt>
        <dd className="text-base font-medium text-gray-900">
          {prescription.patient_full_name ?? 'Not available'}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-gray-500">Visit Date</dt>
        <dd className="text-base text-gray-900">{formatVisitDate(prescription.visit_date)}</dd>
      </div>
      <div>
        <dt className="text-sm text-gray-500">Doctor</dt>
        <dd className="text-base text-gray-900">{prescription.doctor_name ?? '-'}</dd>
      </div>
      <div>
        <dt className="text-sm text-gray-500">Diagnosis</dt>
        <dd className="text-base text-gray-900">{prescription.diagnosis ?? '-'}</dd>
      </div>
      <div>
        <dt className="text-sm text-gray-500">Prescription</dt>
        <dd className="whitespace-pre-wrap text-base text-gray-900">
          {prescription.prescription_text ?? '-'}
        </dd>
      </div>
      <div>
        <dt className="text-sm text-gray-500">Notes</dt>
        <dd className="whitespace-pre-wrap text-base text-gray-900">
          {prescription.notes ?? '-'}
        </dd>
      </div>
    </dl>
  )
}
