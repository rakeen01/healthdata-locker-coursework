'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

const isDevEnvironment = process.env.NODE_ENV !== 'production'

export default function LoginForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/patient/dashboard'
  const authError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [devEmail, setDevEmail] = useState('')
  const [devPassword, setDevPassword] = useState('')
  const [devLoading, setDevLoading] = useState(false)
  const [devError, setDevError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const siteUrl = getSiteUrl()
    const callbackUrl = new URL('/auth/callback', siteUrl)
    callbackUrl.searchParams.set('next', next)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email for the login link.')
    }

    setLoading(false)
  }

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault()
    setDevLoading(true)
    setDevError('')

    const { error } = await supabase.auth.signInWithPassword({
      email: devEmail,
      password: devPassword,
    })

    if (error) {
      setDevError(error.message)
      setDevLoading(false)
      return
    }

    router.push('/patient/dashboard')
    router.refresh()
  }

  return (
    <main className="flex min-h-screen w-full justify-center bg-gray-50">
      <div className="mx-auto my-6 w-full max-w-[420px] overflow-hidden rounded-[32px] border-[10px] border-gray-900 bg-white shadow-xl">
        <div className="flex h-14 items-center justify-center bg-[#1AA7A1] text-base font-semibold text-white">
          HealthData Locker
        </div>
        <div className="w-full space-y-0 p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Patient login</h1>
              <p className="mt-1 text-xs text-gray-500">
                Enter your email to receive a secure sign-in link.
              </p>
            </div>

            {authError === 'auth_callback_failed' ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                Sign-in failed. Please try again.
              </p>
            ) : null}

            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-[#1AA7A1]"
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#1AA7A1] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#178f89] disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>

            {message ? <p className="text-sm text-gray-600">{message}</p> : null}
          </form>

          {isDevEnvironment ? (
            <form onSubmit={handleDevLogin} className="mt-6 space-y-4 border-t border-dashed border-amber-300 pt-6">
              <div>
                <h2 className="text-sm font-semibold text-amber-900">Development login</h2>
                <p className="mt-1 text-xs text-amber-800/80">
                  Local testing only. Not available in production builds.
                </p>
              </div>

              {devError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {devError}
                </p>
              ) : null}

              <input
                type="email"
                placeholder="dev@example.com"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                autoComplete="username"
                className="w-full rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-amber-400"
                required
              />

              <input
                type="password"
                placeholder="Password"
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-amber-400"
                required
              />

              <button
                type="submit"
                disabled={devLoading}
                className="w-full rounded-xl border border-amber-400 bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-200 disabled:opacity-50"
              >
                {devLoading ? 'Signing in...' : 'Sign in with password'}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  )
}
