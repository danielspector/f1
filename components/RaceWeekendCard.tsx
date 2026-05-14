'use client'

import { teamColor } from '@/lib/teamColors'

type ChipType = 'DOUBLE_POINTS' | 'SAFETY_NET'

interface MemberPickRow {
  userId: string
  userName: string | null
  userEmail: string
  driverName: string | null
  driverCode: string | null
  teamName: string | null
  chip: ChipType | null
  pointsEarned: number | null // null = not scored yet
}

interface Props {
  raceName: string
  round: number
  raceDatetime: string
  resultsIn: boolean
  rows: MemberPickRow[]
  currentUserId: string
}

function chipBadge(chip: ChipType) {
  return chip === 'DOUBLE_POINTS' ? '2x' : 'SN'
}

export default function RaceWeekendCard({
  raceName,
  round,
  raceDatetime,
  resultsIn,
  rows,
  currentUserId,
}: Props) {
  const raceDate = new Date(raceDatetime)
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const daysFromRace = Math.round((raceDate.getTime() - now.getTime()) / dayMs)

  let statusLabel: string
  let statusColor: string
  if (resultsIn) {
    statusLabel = 'Results in'
    statusColor = 'text-green-400 bg-green-900/30'
  } else if (daysFromRace > 0) {
    statusLabel = `Picks locked · race in ${daysFromRace}d`
    statusColor = 'text-yellow-400 bg-yellow-900/30'
  } else if (daysFromRace === 0) {
    statusLabel = 'Race day'
    statusColor = 'text-[#e10600] bg-[#e10600]/15'
  } else {
    statusLabel = 'Picks locked · awaiting results'
    statusColor = 'text-yellow-400 bg-yellow-900/30'
  }

  // Sort: by points desc when scored, else alphabetical by name (no-pick rows last in either mode)
  const sorted = [...rows].sort((a, b) => {
    const aHas = a.driverCode != null
    const bHas = b.driverCode != null
    if (aHas !== bHas) return aHas ? -1 : 1
    if (resultsIn) {
      return (b.pointsEarned ?? 0) - (a.pointsEarned ?? 0) || nameOf(a).localeCompare(nameOf(b))
    }
    return nameOf(a).localeCompare(nameOf(b))
  })

  const topPoints = resultsIn ? Math.max(0, ...rows.map((r) => r.pointsEarned ?? 0)) : -1

  return (
    <div className="bg-gradient-to-br from-[#1a1a1a] to-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden mb-4">
      <div className="px-4 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-[11px] uppercase tracking-wide">Round {round} · This race weekend</p>
          <p className="text-white font-semibold text-base mt-0.5">{raceName}</p>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${statusColor}`}>{statusLabel}</span>
      </div>

      <div>
        {sorted.map((row, i) => {
          const isMe = row.userId === currentUserId
          const hasPick = row.driverCode != null
          const isRaceWinner = resultsIn && hasPick && row.pointsEarned != null && row.pointsEarned > 0 && row.pointsEarned === topPoints
          return (
            <div
              key={row.userId}
              className={[
                'flex items-center gap-3 px-4 py-2.5',
                i < sorted.length - 1 ? 'border-b border-[#222]' : '',
                isMe ? 'bg-[#e10600]/[0.06]' : '',
              ].join(' ')}
            >
              {/* Team color stripe */}
              <span
                className="w-1 self-stretch rounded-full"
                style={{ backgroundColor: hasPick ? teamColor(row.teamName) : '#333' }}
              />

              {/* Member name */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm truncate ${isMe ? 'text-white font-medium' : 'text-gray-200'}`}>
                  {nameOf(row)}{isMe && <span className="text-gray-500 font-normal"> (you)</span>}
                </p>
                {hasPick ? (
                  <p className="text-[11px] text-gray-500 truncate">
                    {row.driverName} · {row.teamName}
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-600 italic">missed deadline</p>
                )}
              </div>

              {/* Chip */}
              {row.chip && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#e10600]/20 text-[#e10600]">
                  {chipBadge(row.chip)}
                </span>
              )}

              {/* Points (only when scored) */}
              {resultsIn ? (
                <span
                  className={[
                    'text-sm font-bold tabular-nums w-12 text-right',
                    isRaceWinner ? 'text-[#e10600]' : 'text-white',
                  ].join(' ')}
                >
                  {row.pointsEarned ?? 0}
                  <span className="text-gray-500 text-[10px] font-normal ml-0.5">pts</span>
                </span>
              ) : hasPick ? (
                <span className="text-gray-600 text-[11px]">picked</span>
              ) : (
                <span className="text-gray-700 text-[11px]">—</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function nameOf(r: { userName: string | null; userEmail: string }): string {
  return r.userName || r.userEmail
}
