'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  leagueId: string
  leagueName: string
  inviteCode: string
}

export default function JoinLeagueClient({ leagueId, leagueName, inviteCode }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
      })

      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Failed to join')

      router.push(`/league/${leagueId}`)
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center max-w-sm w-full">
        <div className="text-4xl mb-4">🏎️</div>
        <h1 className="text-xl font-semibold text-white mb-2">Join {leagueName}</h1>
        <p className="text-gray-400 text-sm mb-6">
          You&apos;ve been invited to join this F1 league. Start picking drivers and climb the leaderboard!
        </p>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full bg-[#e10600] hover:bg-[#b00500] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          {loading ? 'Joining…' : `Join ${leagueName}`}
        </button>
      </div>
    </div>
  )
}
