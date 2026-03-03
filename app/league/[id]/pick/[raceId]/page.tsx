'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DriverSelector from '@/components/DriverSelector'
import Link from 'next/link'
import type { Seat } from '@prisma/client'

interface SeatWithAvailability extends Seat {
  available: boolean
}

interface PickData {
  race: { id: string; name: string; round: number; fp1Deadline: string; raceDatetime: string }
  deadlinePassed: boolean
  seats: SeatWithAvailability[]
  currentPickSeatId: string | null
  myPick: {
    id: string
    seat: Seat
    score?: { pointsEarned: number } | null
  } | null
  allPicks: Array<{
    id: string
    userId: string
    user: { id: string; name: string | null; email: string }
    seat: Seat
    score?: { pointsEarned: number } | null
  }> | null
}

export default function PickPage() {
  const { id: leagueId, raceId } = useParams<{ id: string; raceId: string }>()
  const router = useRouter()
  const [data, setData] = useState<PickData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPickSeatId, setCurrentPickSeatId] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/picks?raceId=${raceId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setCurrentPickSeatId(d.currentPickSeatId)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [leagueId, raceId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <p className="text-red-400 text-sm">Failed to load race data</p>
      </div>
    )
  }

  const { race, deadlinePassed, seats, myPick, allPicks } = data

  return (
    <div className="min-h-screen bg-[#0f0f0f] px-4 py-6 max-w-2xl mx-auto">
      <Link
        href={`/league/${leagueId}`}
        className="text-sm text-gray-500 hover:text-white mb-4 inline-block"
      >
        ← Back to league
      </Link>

      <div className="mb-6">
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">
          Round {race.round}
        </p>
        <h1 className="text-2xl font-bold text-white">{race.name}</h1>
        <p className="text-gray-400 text-sm mt-1">
          FP1 deadline: {new Date(race.fp1Deadline).toLocaleString()}
        </p>
      </div>

      {/* Deadline passed with no pick */}
      {deadlinePassed && !myPick && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-center mb-6">
          <div className="text-3xl mb-3">⏱️</div>
          <h2 className="text-white font-semibold mb-1">Deadline passed</h2>
          <p className="text-gray-400 text-sm">You didn&apos;t submit a pick — 0 points this race.</p>
        </div>
      )}

      {/* My locked pick (deadline passed, pick submitted) */}
      {deadlinePassed && myPick && (
        <div className="bg-[#1a1a1a] border border-[#e10600]/30 rounded-xl p-5 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Your pick</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">{myPick.seat.driverName}</p>
              <p className="text-gray-400 text-sm">{myPick.seat.teamName}</p>
            </div>
            <div className="text-right">
              {myPick.score != null ? (
                <p className="text-2xl font-bold text-white">
                  {myPick.score.pointsEarned}
                  <span className="text-sm text-gray-400 ml-1">pts</span>
                </p>
              ) : (
                <p className="text-gray-500 text-sm">Pending</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* All picks revealed (after deadline) */}
      {deadlinePassed && allPicks && allPicks.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-[#2a2a2a]">
            <h3 className="text-white font-medium text-sm">All picks this race</h3>
          </div>
          <div className="divide-y divide-[#2a2a2a]">
            {allPicks.map((pick) => (
              <div key={pick.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">
                    {pick.user.name || pick.user.email}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {pick.seat.driverName} · {pick.seat.teamName}
                  </p>
                </div>
                <div className="text-right">
                  {pick.score != null ? (
                    <span className="text-white font-semibold">{pick.score.pointsEarned} pts</span>
                  ) : (
                    <span className="text-gray-500 text-xs">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active pick selection */}
      {!deadlinePassed && (
        <div>
          {currentPickSeatId && (
            <div className="bg-green-900/20 border border-green-700/40 rounded-lg px-4 py-3 mb-4 text-sm text-green-300">
              ✓ Pick submitted — you can change it any time before the deadline.
            </div>
          )}
          <DriverSelector
            seats={seats}
            currentPickSeatId={currentPickSeatId}
            isLocked={false}
            raceName={race.name}
            leagueId={leagueId}
            raceId={raceId}
            onPickSubmitted={(seatId) => {
              setCurrentPickSeatId(seatId)
              // Refresh data to reflect new pick
              setTimeout(() => router.refresh(), 500)
            }}
          />
        </div>
      )}
    </div>
  )
}
