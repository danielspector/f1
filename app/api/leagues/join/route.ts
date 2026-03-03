import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'
import { JoinLeagueSchema } from '@/lib/validators'

export async function POST(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id

  const body = await request.json().catch(() => ({}))
  const parsed = JoinLeagueSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { inviteCode } = parsed.data

  const league = await prisma.league.findUnique({ where: { inviteCode } })
  if (!league) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 })
  }

  if (league.status === 'ARCHIVED') {
    return NextResponse.json({ error: 'This league has ended' }, { status: 400 })
  }

  // Idempotent — return success if already a member
  const existing = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: league.id, userId } },
  })

  if (!existing) {
    await prisma.leagueMember.create({
      data: { leagueId: league.id, userId, role: 'MEMBER' },
    })
  }

  return NextResponse.json({ leagueId: league.id, leagueName: league.name })
}
