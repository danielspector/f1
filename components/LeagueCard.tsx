import Link from 'next/link'

interface UpcomingRace {
  id: string
  name: string
  fp1Deadline: string
}

interface Props {
  id: string
  name: string
  seasonYear: number
  status: 'ACTIVE' | 'ARCHIVED'
  rank: number | null
  totalPoints: number
  memberCount: number
  upcomingRace: UpcomingRace | null
  hasPickForUpcoming: boolean
}

export default function LeagueCard({
  id,
  name,
  seasonYear,
  status,
  rank,
  totalPoints,
  memberCount,
  upcomingRace,
  hasPickForUpcoming,
}: Props) {
  const isArchived = status === 'ARCHIVED'
  const deadlinePassed =
    upcomingRace ? new Date(upcomingRace.fp1Deadline) <= new Date() : true

  let pickStatusLabel = ''
  let pickStatusClass = ''

  if (!isArchived && upcomingRace) {
    if (hasPickForUpcoming) {
      pickStatusLabel = 'Pick submitted'
      pickStatusClass = 'text-green-400 bg-green-900/20'
    } else if (deadlinePassed) {
      pickStatusLabel = 'Deadline passed'
      pickStatusClass = 'text-gray-500 bg-[#2a2a2a]'
    } else {
      pickStatusLabel = 'Pick pending'
      pickStatusClass = 'text-orange-300 bg-orange-900/30'
    }
  }

  return (
    <Link
      href={`/league/${id}`}
      className="block bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl p-5 transition-colors group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-white font-semibold group-hover:text-gray-100 transition-colors leading-tight">
            {name}
          </h3>
          <p className="text-gray-500 text-xs mt-0.5">
            {seasonYear} · {memberCount} {memberCount === 1 ? 'player' : 'players'}
          </p>
        </div>
        {isArchived ? (
          <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded-full">Archived</span>
        ) : pickStatusLabel ? (
          <span className={`text-xs px-2 py-0.5 rounded-full ${pickStatusClass}`}>
            {pickStatusLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div>
          <p className="text-2xl font-bold text-white tabular-nums">{totalPoints}</p>
          <p className="text-xs text-gray-500">points</p>
        </div>
        {rank && (
          <div>
            <p className="text-2xl font-bold text-white tabular-nums">#{rank}</p>
            <p className="text-xs text-gray-500">rank</p>
          </div>
        )}
      </div>

      {!isArchived && upcomingRace && !hasPickForUpcoming && !deadlinePassed && (
        <div className="mt-4 bg-[#e10600]/10 border border-[#e10600]/20 rounded-lg px-3 py-2">
          <p className="text-sm text-[#e10600] font-medium">
            Pick for {upcomingRace.name} →
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Deadline: {new Date(upcomingRace.fp1Deadline).toLocaleString()}
          </p>
        </div>
      )}
    </Link>
  )
}
