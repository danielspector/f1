import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl font-bold text-white mb-3">
        <span className="text-[#e10600]">F1</span> League
      </h1>
      <p className="text-gray-400 text-lg mb-2">Pick your driver. Earn their points.</p>
      <p className="text-gray-600 text-sm max-w-sm mb-10">
        Compete with friends in a private league. Select one driver per race weekend and climb the
        leaderboard by the end of the season.
      </p>
      <div className="flex gap-3">
        <Link
          href="/register"
          className="bg-[#e10600] hover:bg-[#b00500] text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="border border-[#2a2a2a] hover:border-[#3a3a3a] text-gray-300 hover:text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          Sign in
        </Link>
      </div>
    </div>
  )
}
