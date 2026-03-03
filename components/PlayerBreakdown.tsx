import type { RaceHistoryEntry } from '@/services/leagueService'

interface Props {
  history: RaceHistoryEntry[]
}

export default function PlayerBreakdown({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-gray-500 text-center">
        No race history yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a2a]">
            <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium w-10">#</th>
            <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Race</th>
            <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">Driver</th>
            <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium hidden sm:table-cell">Team</th>
            <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e1e]">
          {history.map((row) => (
            <tr key={row.raceId} className="bg-[#0f0f0f]">
              <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{row.round}</td>
              <td className="px-4 py-2.5 text-gray-300 whitespace-nowrap">{row.raceName}</td>
              <td className="px-4 py-2.5">
                {row.driverName ? (
                  <span className="text-white">{row.driverName}</span>
                ) : (
                  <span className="text-gray-600 italic">No pick</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-gray-400 hidden sm:table-cell">
                {row.teamName ?? '—'}
              </td>
              <td className="px-4 py-2.5 text-right">
                {row.resultsPending ? (
                  <span className="text-gray-600 text-xs">Pending</span>
                ) : (
                  <span className={`font-semibold tabular-nums ${row.pointsEarned > 0 ? 'text-white' : 'text-gray-600'}`}>
                    {row.pointsEarned}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
