import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ReportFilePicker } from './report-file-picker'
import { requirePatient } from '@/lib/auth/patient'
import { LogoutLinkRow } from '@/components/logout-button'
import { reportIdSchema, validateUploadFile } from '@/lib/validations/upload'

const STORAGE_BUCKET = 'patient-reports'

type UploadedReport = {
  id: string
  file_name: string
  file_path: string
  content_type: string | null
  created_at: string | null
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

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\]/g, '_').trim() || 'file'
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

async function uploadReport(formData: FormData) {
  'use server'

  const { user, patient } = await requirePatient()

  const file = formData.get('file')
  if (!(file instanceof File)) {
    redirect('/patient/uploads?error=Please+choose+a+file+to+upload.')
  }

  const validation = validateUploadFile(file)
  if (!validation.ok) {
    redirect(`/patient/uploads?error=${encodeURIComponent(validation.message)}`)
  }

  const safeName = sanitizeFileName(file.name)
  const filePath = `${patient.id}/${crypto.randomUUID()}-${safeName}`
  const supabase = await createClient()

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (storageError) {
    redirect('/patient/uploads?error=Upload+failed.+Please+try+again.')
  }

  const { error: dbError } = await supabase.from('uploaded_reports').insert({
    patient_id: patient.id,
    uploaded_by: user.id,
    file_path: filePath,
    file_name: file.name,
    content_type: file.type || 'application/octet-stream',
  })

  if (dbError) {
    await supabase.storage.from(STORAGE_BUCKET).remove([filePath])
    redirect('/patient/uploads?error=Could+not+save+report+metadata.+Please+try+again.')
  }

  revalidatePath('/patient/uploads')
  revalidatePath('/patient/dashboard')
  redirect('/patient/uploads')
}

async function deleteReport(formData: FormData) {
  'use server'

  const { patient } = await requirePatient()

  const reportIdRaw = formData.get('reportId')
  const parsed = reportIdSchema.safeParse(reportIdRaw)
  if (!parsed.success) {
    redirect('/patient/uploads?error=Invalid+report.')
  }
  const reportId = parsed.data

  const supabase = await createClient()

  const { data: report, error: fetchError } = await supabase
    .from('uploaded_reports')
    .select('file_path')
    .eq('id', reportId)
    .eq('patient_id', patient.id)
    .maybeSingle()

  if (fetchError || !report) {
    redirect('/patient/uploads?error=Report+not+found.')
  }

  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([report.file_path])

  if (storageError) {
    redirect('/patient/uploads?error=Could+not+delete+file.+Please+try+again.')
  }

  const { error: dbError } = await supabase
    .from('uploaded_reports')
    .delete()
    .eq('id', reportId)
    .eq('patient_id', patient.id)

  if (dbError) {
    redirect('/patient/uploads?error=Could+not+delete+report.+Please+try+again.')
  }

  revalidatePath('/patient/uploads')
  revalidatePath('/patient/dashboard')
  redirect('/patient/uploads')
}

export default async function PatientUploadsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { patient } = await requirePatient()
  const supabase = await createClient()
  const params = await searchParams

  const { data, error } = await supabase
    .from('uploaded_reports')
    .select('id, file_name, file_path, content_type, created_at')
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: false })

  const reports: UploadedReport[] = data ?? []
  const hasListError = Boolean(error)

  const reportsWithUrls = await Promise.all(
    reports.map(async (report) => {
      const { data: signed } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(report.file_path, 3600)
      return { report, url: signed?.signedUrl ?? null }
    })
  )

  return (
    <MobileShell>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900">My reports</h1>
        <p className="text-xs text-gray-500">Upload lab reports and documents.</p>
      </div>

      <form action={uploadReport} className="mb-4">
        <ReportFilePicker />
        <button
          type="submit"
          className="mt-3 w-full rounded-xl bg-[#1AA7A1] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#178f89] active:bg-[#157a75]"
        >
          Upload
        </button>
      </form>

      {params.error ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {decodeURIComponent(params.error)}
        </p>
      ) : null}

      {hasListError ? (
        <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Unable to load uploaded reports right now.
        </p>
      ) : null}

      {!hasListError && reports.length === 0 ? (
        <p className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          No reports uploaded yet.
        </p>
      ) : null}

      {!hasListError && reportsWithUrls.length > 0 ? (
        <ul className="mb-3 space-y-2">
          {reportsWithUrls.map(({ report, url }) => (
            <li
              key={report.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
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
              </div>
              <form action={deleteReport}>
                <input type="hidden" name="reportId" value={report.id} />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 active:bg-red-100"
                >
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <Link href="/patient/dashboard" className="inline-block text-[13px] text-[#1AA7A1]">
        Back to prescriptions
      </Link>

      <LogoutLinkRow />
    </MobileShell>
  )
}
