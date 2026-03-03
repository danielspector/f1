'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Leaderboard from '@/components/Leaderboard'
import RaceCalendar from '@/components/RaceCalendar'
import AdminPanel from '@/components/AdminPanel'
import type { LeaderboardEntry } from '@/services/leagueService'

type Tab = 'standings' | 'calendar' | 'admin'

interface LeagueData {
  id: string
  name: string
  seasonYear: number
  status: 'ACTIVE' | 'ARCHIVED'
  inviteCode: string
  currentUserRole: 'ADMIN' | 'MEMBER'
  leaderboard: LeaderboardEntry[]
}

interface RaceItem {
  id: string
  round: number
  name: string
  circuit: string
  fp1Deadline: string
  raceDatetime: string
  status: 'upcoming' | 'picking_open' | 'locked' | 'results_in'
}

interface PickItem { raceId: string }

export default function LeaguePage() {
  const { id } = useParams<{ id: string }>()
  const { data: session } = useSession()
  const router = useRouter()

  const [league, setLeague] = useState<LeagueData | null>(null)
  const [races, setRaces] = useState<RaceItem[]>([])
  const [userPicks, setUserPicks] = useState<PickItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('standings')

  useEffect(() => {
    async function load() {
      const [leagueRes, racesRes, picksRes] = await Promise.all([
        fetch(`/api/leagues/${id}`),
        fetch(`/api/races`),
        fetch(`/api/leagues/${id}/picks`),
      ])

      if (!leagueRes.ok) { setLoading(false); return }

      const leagueData = await leagueRes.json()
      const racesData = racesRes.ok ? await racesRes.json() : []
      const picksData = picksRes.ok ? await picksRes.json() : []

      setLeague(leagueData)
      setRaces(racesData)
      setUserPicks(picksData.map((p: { raceId: string }) => ({ raceId: p.raceId })))
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading league…</div>
      </div>
    )
  }

  if (!league) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-3">League not found or you don&apos;t have access.</p>
          <Link href="/dashboard" className="text-sm text-[#e10600] hover:underline">Back to dashboard</Link>
        </div>
      </div>
    )
  }

  const isAdmin = league.currentUserRole === 'ADMIN'
  const isArchived = league.status === 'ARCHIVED'
  const members = league.leaderboard.map((e) => ({
    userId: e.userId,
    userName: e.userName,
    userEmail: e.userEmail,
    role: 'MEMBER' as const, // role fetched inline below via leaderboard
  }))

  async function handleRenew() {
    const nextYear = league!.seasonYear + 1
    const res = await fetch(`/api/leagues/${id}/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonYear: nextYear }),
    })
    const data = await res.json()
    if (res.ok) router.push(`/league/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-white mb-4 inline-block">
          ← Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold text-white">{league.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">Season {league.seasonYear}</p>
          </div>
          {isArchived ? (
            <span className="text-xs px-2.5 py-1 bg-gray-800 text-gray-400 rounded-full">Archived</span>
          ) : (
            <span className="text-xs px-2.5 py-1 bg-green-900/30 text-green-400 rounded-full">Active</span>
          )}
        </div>

        {/* Archived banner */}
        {isArchived && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 mb-4 mt-4">
            <p className="text-white font-medium text-sm mb-1">This league has ended — Final Season Standings</p>
            <p className="text-gray-400 text-xs mb-3">The {league.seasonYear} season is over.</p>
            {isAdmin && (
              <button
                onClick={handleRenew}
                className="text-sm bg-[#e10600] hover:bg-[#b00500] text-white px-4 py-2 rounded-lg transition-colors"
              >
                Renew for {league.seasonYear + 1}
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 mt-4">
          {(['standings', 'calendar', ...(isAdmin ? ['admin'] : [])] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                tab === t
                  ? 'bg-[#e10600] text-white'
                  : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#2a2a2a]',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'standings' && (() => {
          const openRaceWithoutPick = !isArchived
            ? races.find(r => r.status === 'picking_open' && !userPicks.some(p => p.raceId === r.id))
            : null
          return (
            <>
              {openRaceWithoutPick && (
                <Link
                  href={`/league/${id}/pick/${openRaceWithoutPick.id}`}
                  className="flex items-center justify-between bg-[#e10600]/10 border border-[#e10600]/30 rounded-xl px-4 py-3 mb-4 hover:bg-[#e10600]/15 transition-colors"
                >
                  <div>
                    <p className="text-white text-sm font-medium">You haven&apos;t picked for {openRaceWithoutPick.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">Deadline: {new Date(openRaceWithoutPick.fp1Deadline).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  <span className="text-[#e10600] text-sm font-medium shrink-0 ml-4">Make pick →</span>
                </Link>
              )}
              <Leaderboard entries={league.leaderboard} currentUserId={session?.user?.id ?? ''} />
            </>
          )
        })()}

        {tab === 'calendar' && (
          <RaceCalendar
            races={isArchived ? races : races}
            userPicks={userPicks}
            leagueId={id}
          />
        )}

        {tab === 'admin' && isAdmin && (
          <AdminPanel
            leagueId={id}
            leagueName={league.name}
            inviteCode={league.inviteCode}
            members={members}
            currentUserId={session?.user?.id ?? ''}
            onLeagueRenamed={(name) => setLeague({ ...league, name })}
            onMemberRemoved={(userId) =>
              setLeague({
                ...league,
                leaderboard: league.leaderboard.filter((e) => e.userId !== userId),
              })
            }
            onRoleUpdated={() => {/* roles are in leaderboard; re-fetch if needed */}}
          />
        )}
      </div>
    </div>
  )
}
