export default function LeagueCardSkeleton() {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="h-4 bg-[#2a2a2a] rounded w-36 mb-1.5" />
          <div className="h-3 bg-[#2a2a2a] rounded w-24" />
        </div>
        <div className="h-5 bg-[#2a2a2a] rounded-full w-20" />
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div>
          <div className="h-8 bg-[#2a2a2a] rounded w-12 mb-1" />
          <div className="h-3 bg-[#2a2a2a] rounded w-10" />
        </div>
        <div>
          <div className="h-8 bg-[#2a2a2a] rounded w-8 mb-1" />
          <div className="h-3 bg-[#2a2a2a] rounded w-8" />
        </div>
      </div>
    </div>
  )
}
