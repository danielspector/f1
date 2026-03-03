export default function LeaderboardSkeleton() {
  return (
    <div className="space-y-1 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-4 bg-[#2a2a2a] rounded" />
          <div className="flex-1 h-4 bg-[#2a2a2a] rounded" />
          <div className="w-16 h-4 bg-[#2a2a2a] rounded" />
        </div>
      ))}
    </div>
  )
}
