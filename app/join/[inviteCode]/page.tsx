import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import JoinLeagueClient from './JoinLeagueClient'

interface Props {
  params: Promise<{ inviteCode: string }>
}

export default async function JoinPage({ params }: Props) {
  const { inviteCode } = await params
  const session = await auth()

  if (!session) {
    redirect(`/login?callbackUrl=/join/${inviteCode}`)
  }

  const league = await prisma.league.findUnique({ where: { inviteCode } })
  if (!league) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center max-w-sm">
          <p className="text-red-400">Invalid invite link. This league may not exist.</p>
        </div>
      </div>
    )
  }

  if (league.status === 'ARCHIVED') {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-8 text-center max-w-sm">
          <p className="text-gray-400">This league has ended and is no longer accepting new members.</p>
        </div>
      </div>
    )
  }

  // Check if already a member
  const existing = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: league.id, userId: session.user.id } },
  })

  if (existing) {
    redirect(`/league/${league.id}`)
  }

  return <JoinLeagueClient leagueId={league.id} leagueName={league.name} inviteCode={inviteCode} />
}
