'use client'

import { useState } from 'react'
import PlayerBreakdown from './PlayerBreakdown'
import type { LeaderboardEntry } from '@/services/leagueService'

interface Props {
  entries: LeaderboardEntry[]
  currentUserId: string
}

export default function Leaderboard({ entries, currentUserId }: Props) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No members have scored yet.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const isExpanded = expandedUserId === entry.userId
        const isCurrentUser = entry.userId === currentUserId
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null

        return (
          <div key={entry.userId}>
            <button
              onClick={() => setExpandedUserId(isExpanded ? null : entry.userId)}
              className={[
                'w-full text-left rounded-lg px-4 py-3 transition-colors flex items-center gap-3',
                isCurrentUser
                  ? 'bg-[#e10600]/10 border border-[#e10600]/30 hover:bg-[#e10600]/15'
                  : 'bg-[#1a1a1a] border border-[#2a2a2a] hover:bg-[#222]',
              ].join(' ')}
            >
              {/* Rank */}
              <div className="w-8 text-center shrink-0">
                {medal ? (
                  <span className="text-lg">{medal}</span>
                ) : (
                  <span className="text-gray-500 text-sm font-mono">{entry.rank}</span>
                )}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium truncate ${isCurrentUser ? 'text-white' : 'text-gray-200'}`}>
                  {entry.userName || entry.userEmail}
                  {isCurrentUser && <span className="text-gray-500 text-xs ml-2">(you)</span>}
                </span>
              </div>

              {/* Current race pick indicator */}
              {entry.hasCurrentPick && (
                <span className="shrink-0 text-xs text-green-500 font-medium">✓ picked</span>
              )}

              {/* Points */}
              <div className="shrink-0 text-right">
                <span className="text-white font-bold tabular-nums">{entry.totalPoints}</span>
                <span className="text-gray-500 text-xs ml-1">pts</span>
              </div>

              {/* Expand chevron */}
              <div className={`shrink-0 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                ▾
              </div>
            </button>

            {isExpanded && (
              <div className="border-x border-b border-[#2a2a2a] rounded-b-lg overflow-hidden -mt-1 mb-1">
                <PlayerBreakdown history={entry.history} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
