'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center">
        <div className="text-4xl mb-4">✉️</div>
        <h2 className="text-xl font-semibold text-white mb-2">Check your inbox</h2>
        <p className="text-gray-400 text-sm">
          If an account exists for <span className="text-white">{email}</span>, we sent a password
          reset link.
        </p>
        <Link href="/login" className="inline-block mt-6 text-sm text-[#e10600] hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8">
      <h2 className="text-xl font-semibold text-white mb-2">Reset your password</h2>
      <p className="text-gray-400 text-sm mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#e10600] transition-colors"
            placeholder="you@example.com"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#e10600] hover:bg-[#b00500] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="text-sm text-gray-500 text-center mt-5">
        <Link href="/login" className="text-[#e10600] hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
