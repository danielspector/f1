'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Member {
  id: string
  name: string | null
  email: string
  role: string
  totalPoints: number
}

interface PickEntry {
  userId: string
  race: { id: string; name: string; round: number }
  driver: { name: string; code: string; team: string }
  points: number | null
}

interface LeagueDetail {
  id: string
  name: string
  seasonYear: number
  status: string
  chipsEnabled: boolean
  members: Member[]
  picks: Record<string, PickEntry[]>
}

export default function AdminLeagueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [league, setLeague] = useState<LeagueDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/leagues/${id}`)
      .then(async (res) => {
        if (res.status === 403) {
          window.location.href = '/dashboard'
          return
        }
        if (!res.ok) throw new Error('Failed to load')
        setLeague(await res.json())
      })
      .catch(() => setError('Failed to load league'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-red-400 text-sm">{error || 'League not found'}</div>
      </div>
    )
  }

  const sortedMembers = [...league.members].sort((a, b) => b.totalPoints - a.totalPoints)

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <header className="border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
        <h1 className="font-bold text-white">
          <span className="text-[#e10600]">F1</span> Admin
        </h1>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-white transition-colors">
          Back to admin
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-white">{league.name}</h2>
          <div className="flex gap-3 mt-1 text-sm text-gray-400">
            <span>{league.seasonYear} season</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              league.status === 'ACTIVE' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
            }`}>
              {league.status}
            </span>
            {league.chipsEnabled && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-900/50 text-blue-400">
                Chips
              </span>
            )}
          </div>
        </div>

        <h3 className="text-sm font-medium text-gray-500 mb-3">Members ({league.members.length})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-gray-500 border-b border-[#2a2a2a]">
              <tr>
                <th className="py-3 pr-4 font-medium">#</th>
                <th className="py-3 pr-4 font-medium">Name</th>
                <th className="py-3 pr-4 font-medium">Email</th>
                <th className="py-3 pr-4 font-medium">Role</th>
                <th className="py-3 font-medium">Points</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {sortedMembers.map((m, i) => (
                <>
                  <tr
                    key={m.id}
                    className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                    onClick={() => setExpandedUser(expandedUser === m.id ? null : m.id)}
                  >
                    <td className="py-3 pr-4 text-gray-500">{i + 1}</td>
                    <td className="py-3 pr-4 text-white">{m.name || '—'}</td>
                    <td className="py-3 pr-4">{m.email}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        m.role === 'ADMIN' ? 'bg-[#e10600]/20 text-[#e10600]' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3 font-medium text-white">{m.totalPoints}</td>
                  </tr>
                  {expandedUser === m.id && league.picks[m.id] && (
                    <tr key={`${m.id}-picks`}>
                      <td colSpan={5} className="bg-[#141414] px-4 py-3">
                        <div className="text-xs text-gray-500 mb-2 font-medium">Picks</div>
                        <div className="grid gap-1">
                          {league.picks[m.id].map((p) => (
                            <div key={p.race.id} className="flex items-center justify-between text-xs py-1">
                              <span className="text-gray-400">R{p.race.round} — {p.race.name}</span>
                              <span className="flex items-center gap-3">
                                <span className="text-white">{p.driver.name} ({p.driver.code})</span>
                                <span className="text-gray-500">{p.driver.team}</span>
                                {p.points !== null && (
                                  <span className="font-medium text-white w-8 text-right">{p.points}pts</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {expandedUser === m.id && !league.picks[m.id] && (
                    <tr key={`${m.id}-no-picks`}>
                      <td colSpan={5} className="bg-[#141414] px-4 py-3 text-xs text-gray-500">
                        No picks yet
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
