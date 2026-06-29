import Link from 'next/link'
import { logout } from '@/lib/auth/actions'
import { getAuthUser } from '@/lib/auth/patient'

export default async function AccountSetupPage() {
  const user = await getAuthUser()

  return (
    <main className="flex min-h-screen w-full justify-center bg-gray-50">
      <div className="mx-auto my-6 mb-10 w-full max-w-[420px] overflow-hidden rounded-[32px] border-[10px] border-gray-900 bg-white shadow-xl">
        <div className="flex h-14 items-center justify-center bg-[#1AA7A1] text-base font-semibold text-white">
          HealthData Locker
        </div>
        <div className="p-4">
          <h1 className="text-lg font-semibold text-gray-900">Account not linked</h1>
          <p className="mt-2 text-sm text-gray-600">
            Your login is active, but this account is not linked to a patient record yet.
            Contact your clinic or administrator to complete setup.
          </p>
          {user?.email ? (
            <p className="mt-3 text-xs text-gray-500">Signed in as {user.email}</p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3">
            <form action={logout}>
              <button
                type="submit"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Log out
              </button>
            </form>
            <Link href="/login" className="text-center text-[13px] text-[#1AA7A1]">
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
