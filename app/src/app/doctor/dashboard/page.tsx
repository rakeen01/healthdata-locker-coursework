export default function DoctorDashboardPage() {
  return (
    <main className="flex min-h-screen w-full justify-center bg-gray-50">
      <div className="mx-auto my-6 w-full max-w-[420px] overflow-hidden rounded-[32px] border-[10px] border-gray-900 bg-white p-6 shadow-xl">
        <h1 className="text-lg font-semibold text-gray-900">Doctor dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Doctor-facing workflows are not available in this patient MVP checkpoint.
        </p>
        <p className="mt-3 text-xs text-gray-500">
          Future phase: prescription creation, patient search, and clinic tools.
        </p>
      </div>
    </main>
  )
}
