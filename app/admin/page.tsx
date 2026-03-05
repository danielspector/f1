'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface AdminUser {
  id: string
  email: string
  name: string | null
  createdAt: string
  isSuperAdmin: boolean
  leagueCount: number
}

interface AdminLeague {
  id: string
  name: string
  seasonYear: number
  status: string
  createdAt: string
  chipsEnabled: boolean
  memberCount: number
  createdBy: string
}

type Tab = 'leagues' | 'players'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('leagues')
  const [leagues, setLeagues] = useState<AdminLeague[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const url = tab === 'leagues' ? '/api/admin/leagues' : '/api/admin/users'
    fetch(url)
      .then(async (res) => {
        if (res.status === 403) {
          window.location.href = '/dashboard'
          return
        }
        if (!res.ok) throw new Error('Failed to load')
        const data = await res.json()
        if (tab === 'leagues') setLeagues(data)
        else setUsers(data)
      })
      .catch(() => setError('Failed to load data'))
      .finally(() => setLoading(false))
  }, [tab])

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <header className="border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
        <h1 className="font-bold text-white">
          <span className="text-[#e10600]">F1</span> Admin
        </h1>
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-white transition-colors">
          Back to dashboard
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-1 mb-6">
          {(['leagues', 'players'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t
                  ? 'bg-[#e10600] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
              }`}
            >
              {t === 'leagues' ? 'Leagues' : 'Players'}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-gray-500 text-sm py-8 text-center">Loading...</div>
        )}

        {!loading && !error && tab === 'leagues' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Season</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Members</th>
                  <th className="py-3 pr-4 font-medium">Created by</th>
                  <th className="py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {leagues.map((l) => (
                  <tr key={l.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="py-3 pr-4">
                      <Link href={`/admin/league/${l.id}`} className="text-white hover:text-[#e10600] transition-colors">
                        {l.name}
                      </Link>
                    </td>
                    <td className="py-3 pr-4">{l.seasonYear}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        l.status === 'ACTIVE' ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{l.memberCount}</td>
                    <td className="py-3 pr-4">{l.createdBy}</td>
                    <td className="py-3">{new Date(l.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {leagues.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-500">No leagues found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && tab === 'players' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 border-b border-[#2a2a2a]">
                <tr>
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Email</th>
                  <th className="py-3 pr-4 font-medium">Leagues</th>
                  <th className="py-3 pr-4 font-medium">Admin</th>
                  <th className="py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                    <td className="py-3 pr-4 text-white">{u.name || '—'}</td>
                    <td className="py-3 pr-4">{u.email}</td>
                    <td className="py-3 pr-4">{u.leagueCount}</td>
                    <td className="py-3 pr-4">
                      {u.isSuperAdmin && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#e10600]/20 text-[#e10600]">
                          Super Admin
                        </span>
                      )}
                    </td>
                    <td className="py-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
