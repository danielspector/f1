'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewLeaguePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const currentYear = new Date().getFullYear()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('League name is required')
    if (name.trim().length > 50) return setError('Name must be 50 characters or less')

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), seasonYear: currentYear }),
      })

      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Failed to create league')

      router.push(`/league/${data.id}`)
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-white mb-6 inline-block">
          ← Back to dashboard
        </Link>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8">
          <h1 className="text-xl font-semibold text-white mb-2">Create a league</h1>
          <p className="text-gray-400 text-sm mb-6">
            Give your league a name. You&apos;ll get an invite link to share with friends.
          </p>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">League name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#e10600] transition-colors"
                placeholder="e.g. Saturday Night Paddock Club"
              />
              <p className="text-xs text-gray-600 mt-1 text-right">{name.length}/50</p>
            </div>

            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">
                Season: <span className="text-gray-300">{currentYear}</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#e10600] hover:bg-[#b00500] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading ? 'Creating…' : 'Create league'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
