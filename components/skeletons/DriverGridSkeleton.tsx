export default function DriverGridSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i}>
          <div className="h-3 bg-[#2a2a2a] rounded w-28 mb-2" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((j) => (
              <div key={j} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 h-16" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
