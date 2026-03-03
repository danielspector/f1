'use client'

import { useEffect, useState } from 'react'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import LeagueCard from '@/components/LeagueCard'
import LeagueCardSkeleton from '@/components/skeletons/LeagueCardSkeleton'

interface DashboardLeague {
  id: string
  name: string
  seasonYear: number
  status: 'ACTIVE' | 'ARCHIVED'
  role: 'ADMIN' | 'MEMBER'
  totalPoints: number
  rank: number | null
  memberCount: number
  upcomingRace: { id: string; name: string; fp1Deadline: string } | null
  hasPickForUpcoming: boolean
}

export default function DashboardPage() {
  const [leagues, setLeagues] = useState<DashboardLeague[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function load() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error()
      setLeagues(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const activeLeagues = leagues.filter((l) => l.status === 'ACTIVE')
  const archivedLeagues = leagues.filter((l) => l.status === 'ARCHIVED')

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Nav */}
      <header className="border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between max-w-2xl mx-auto">
        <h1 className="font-bold text-white">
          <span className="text-[#e10600]">F1</span> League
        </h1>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-gray-500 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Action bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">My leagues</h2>
          <div className="flex gap-2">
            <Link
              href="/league/new"
              className="bg-[#e10600] hover:bg-[#b00500] text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium"
            >
              + Create
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm flex items-center justify-between">
            <span>Failed to load leagues</span>
            <button onClick={load} className="underline">Retry</button>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => <LeagueCardSkeleton key={i} />)}
          </div>
        )}

        {!loading && !error && leagues.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏁</div>
            <h3 className="text-white font-semibold text-lg mb-2">No leagues yet</h3>
            <p className="text-gray-400 text-sm mb-6">
              Create a league and invite your friends, or join one with an invite link.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/league/new"
                className="bg-[#e10600] hover:bg-[#b00500] text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Create a league
              </Link>
            </div>
          </div>
        )}

        {!loading && activeLeagues.length > 0 && (
          <div className="space-y-3 mb-6">
            {activeLeagues.map((league) => (
              <LeagueCard key={league.id} {...league} />
            ))}
          </div>
        )}

        {!loading && archivedLeagues.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-3 mt-6">Past seasons</h3>
            <div className="space-y-3">
              {archivedLeagues.map((league) => (
                <LeagueCard key={league.id} {...league} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
