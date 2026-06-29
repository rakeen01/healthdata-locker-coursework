import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { requirePatient } from '@/lib/auth/patient'
import { LogoutLinkRow } from '@/components/logout-button'

const STORAGE_BUCKET = 'patient-reports'
const RECENT_REPORTS_LIMIT = 3

type PrescriptionListItem = {
  id: string
  visit_date: string | null
  diagnosis: string | null
  doctor_name: string | null
  created_at: string | null
  public_token: string | null
}

type UploadedReportItem = {
  id: string
  file_name: string
  file_path: string
  created_at: string | null
}

function formatVisitDate(visitDate: string | null, createdAt: string | null): string {
  const raw = visitDate ?? createdAt
  if (!raw) return 'Date unavailable'
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatCreatedAt(createdAt: string | null): string {
  if (!createdAt) return 'Date unavailable'
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return 'Date unavailable'
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function PrescriptionCard({ item }: { item: PrescriptionListItem }) {
  const title = `${item.doctor_name ?? 'Doctor unknown'} • ${item.diagnosis ?? 'No diagnosis'}`
  const meta = formatVisitDate(item.visit_date, item.created_at)

  const content = (
    <>
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-xs text-gray-500">{meta}</div>
      {item.public_token ? (
        <div className="mt-1.5 text-[13px] text-[#1AA7A1]">View prescription</div>
      ) : null}
    </>
  )

  if (item.public_token) {
    return (
      <Link
        href={`/p/${item.public_token}`}
        className="mb-2.5 block rounded-xl border border-gray-200 bg-white p-3"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="mb-2.5 rounded-xl border border-gray-200 bg-white p-3">{content}</div>
  )
}

export default async function PatientDashboardPage() {
  const { patient } = await requirePatient()
  const supabase = await createClient()

  const [prescriptionsResult, reportsResult] = await Promise.all([
    supabase
      .from('prescriptions')
      .select('id, visit_date, diagnosis, doctor_name, created_at, public_token')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('uploaded_reports')
      .select('id, file_name, file_path, created_at')
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(RECENT_REPORTS_LIMIT),
  ])

  const prescriptions: PrescriptionListItem[] = prescriptionsResult.data ?? []
  const reports: UploadedReportItem[] = reportsResult.data ?? []
  const prescriptionsError = Boolean(prescriptionsResult.error)
  const reportsError = Boolean(reportsResult.error)

  const reportsWithUrls = await Promise.all(
    reports.map(async (report) => {
      const { data: signed } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(report.file_path, 3600)
      return { report, url: signed?.signedUrl ?? null }
    })
  )

  return (
    <main className="flex min-h-screen w-full justify-center bg-gray-50">
      <div className="mx-auto my-6 mb-10 w-full max-w-[420px] overflow-hidden rounded-[32px] border-[10px] border-gray-900 bg-white shadow-xl">
        <div className="flex h-14 items-center justify-center bg-[#1AA7A1] text-base font-semibold text-white">
          HealthData Locker
        </div>

        <div className="p-4">
          <div className="mb-3">
            <div className="text-lg font-semibold text-gray-900">My prescriptions</div>
            <div className="text-xs text-gray-500">
              All prescriptions saved from your doctors and pharmacies.
            </div>
          </div>

          {prescriptionsError ? (
            <p className="mb-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Unable to load prescriptions right now.
            </p>
          ) : null}

          {!prescriptionsError && prescriptions.length === 0 ? (
            <p className="mb-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              No prescriptions found yet.
            </p>
          ) : null}

          {!prescriptionsError && prescriptions.length > 0
            ? prescriptions.map((item) => <PrescriptionCard key={item.id} item={item} />)
            : null}

          <div className="mb-3 mt-5">
            <div className="text-sm font-semibold text-gray-900">Uploaded reports</div>
            <div className="text-xs text-gray-500">Your recent lab reports and documents.</div>
          </div>

          {reportsError ? (
            <p className="mb-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Unable to load uploaded reports right now.
            </p>
          ) : null}

          {!reportsError && reports.length === 0 ? (
            <p className="mb-2.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              No reports uploaded yet.
            </p>
          ) : null}

          {!reportsError && reportsWithUrls.length > 0 ? (
            <ul className="mb-2.5 space-y-2">
              {reportsWithUrls.map(({ report, url }) => (
                <li
                  key={report.id}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2.5"
                >
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-[#1AA7A1] hover:underline"
                    >
                      {report.file_name}
                    </a>
                  ) : (
                    <span className="text-sm font-medium text-gray-900">{report.file_name}</span>
                  )}
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatCreatedAt(report.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          <Link
            href="/patient/uploads"
            className="group mb-5 mt-2 block rounded-xl border-2 border-dashed border-[#1AA7A1]/45 bg-gradient-to-b from-[#f6fcfb] to-white px-4 py-5 text-center transition-all hover:border-[#1AA7A1] hover:from-[#E0F4F2] hover:to-[#f0faf9] hover:shadow-md"
          >
            <div className="mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-[#E0F4F2] text-[#1AA7A1] transition-colors group-hover:bg-white group-hover:shadow-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className="h-5 w-5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">Lab reports & documents</p>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
              <span className="font-medium text-[#1AA7A1] group-hover:underline">
                Open uploads
              </span>{' '}
              to add PDFs and images
            </p>
          </Link>

          <div className="rounded-xl bg-[#E0F4F2] p-3 text-[13px] text-gray-700">
            Scan the QR on a new prescription to save it here automatically.
          </div>

          <LogoutLinkRow />
        </div>
      </div>
    </main>
  )
}
