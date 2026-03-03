'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface RaceWithStatus {
  id: string
  round: number
  name: string
  circuit: string
  fp1Deadline: string
  raceDatetime: string
  status: 'upcoming' | 'picking_open' | 'locked' | 'results_in'
}

interface UserPick {
  raceId: string
}

interface Props {
  races: RaceWithStatus[]
  userPicks: UserPick[]
  leagueId: string
}

const STATUS_LABELS: Record<RaceWithStatus['status'], string> = {
  upcoming: 'Upcoming',
  picking_open: 'Pick now',
  locked: 'Locked',
  results_in: 'Results in',
}

const STATUS_COLORS: Record<RaceWithStatus['status'], string> = {
  upcoming: 'text-gray-500 bg-[#2a2a2a]',
  picking_open: 'text-orange-300 bg-orange-900/30',
  locked: 'text-gray-500 bg-[#2a2a2a]',
  results_in: 'text-green-300 bg-green-900/20',
}

function Countdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    function update() {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Now')
        return
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      if (days > 0) setTimeLeft(`${days}d ${hours}h`)
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m`)
      else setTimeLeft(`${mins}m`)
    }

    update()
    const id = setInterval(update, 60000)
    return () => clearInterval(id)
  }, [deadline])

  return <span className="text-orange-400 font-mono text-xs">{timeLeft}</span>
}

export default function RaceCalendar({ races, userPicks, leagueId }: Props) {
  const picksByRaceId = new Set(userPicks.map((p) => p.raceId))

  const nextPickableRace = races.find((r) => r.status === 'picking_open')

  if (races.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">Season schedule not loaded yet.</div>
    )
  }

  return (
    <div className="space-y-2">
      {races.map((race) => {
        const hasPick = picksByRaceId.has(race.id)
        const isNext = race.id === nextPickableRace?.id
        const canPick = race.status === 'picking_open'

        return (
          <div
            key={race.id}
            className={[
              'rounded-lg border transition-colors',
              isNext
                ? 'border-[#e10600]/30 bg-[#e10600]/5'
                : 'border-[#2a2a2a] bg-[#1a1a1a]',
            ].join(' ')}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Round */}
              <div className="w-7 shrink-0 text-center">
                <span className="text-gray-600 text-xs font-mono">{race.round}</span>
              </div>

              {/* Race info */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isNext ? 'text-white' : 'text-gray-300'}`}>
                  {race.name}
                </p>
                <p className="text-xs text-gray-600 truncate">{race.circuit}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-600">
                    FP1: {new Date(race.fp1Deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  {canPick && (
                    <>
                      <span className="text-gray-600">·</span>
                      <Countdown deadline={race.fp1Deadline} />
                    </>
                  )}
                </div>
              </div>

              {/* Status & action */}
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[race.status]}`}>
                  {STATUS_LABELS[race.status]}
                </span>
                {hasPick && (
                  <span className="text-xs text-green-400">✓ Pick in</span>
                )}
                {canPick && !hasPick && (
                  <Link
                    href={`/league/${leagueId}/pick/${race.id}`}
                    className="text-xs bg-[#e10600] hover:bg-[#b00500] text-white px-3 py-1 rounded-full transition-colors"
                  >
                    Pick →
                  </Link>
                )}
                {(race.status === 'locked' || race.status === 'results_in') && hasPick && (
                  <Link
                    href={`/league/${leagueId}/pick/${race.id}`}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    View →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
