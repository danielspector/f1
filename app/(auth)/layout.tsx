export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            <span className="text-[#e10600]">F1</span> League
          </h1>
          <p className="text-gray-400 text-sm mt-1">Pick your driver. Earn the points.</p>
        </div>
        {children}
      </div>
    </div>
  )
}
