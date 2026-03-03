'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) return setError('Passwords do not match')
    if (form.password.length < 8) return setError('Password must be at least 8 characters')

    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: form.password }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) return setError(data.error || 'Something went wrong')

    router.push('/login?reset=1')
  }

  if (!token) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center">
        <p className="text-red-400 text-sm">Invalid reset link. Please request a new one.</p>
        <Link
          href="/forgot-password"
          className="inline-block mt-4 text-sm text-[#e10600] hover:underline"
        >
          Request reset
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8">
      <h2 className="text-xl font-semibold text-white mb-6">Set a new password</h2>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-5 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">New password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#e10600] transition-colors"
            placeholder="Min. 8 characters"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Confirm new password</label>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#e10600] transition-colors"
            placeholder="Repeat your password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#e10600] hover:bg-[#b00500] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          {loading ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
