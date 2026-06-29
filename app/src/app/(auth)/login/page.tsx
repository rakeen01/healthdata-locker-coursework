import { Suspense } from 'react'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full justify-center bg-gray-50">
          <div className="mx-auto my-6 w-full max-w-[420px] rounded-[32px] border-[10px] border-gray-900 bg-white p-6 shadow-xl">
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
