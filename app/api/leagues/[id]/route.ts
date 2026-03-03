import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'
import { UpdateLeagueSchema } from '@/lib/validators'
import { getLeaderboard } from '@/services/leagueService'

type Params = { params: Promise<{ id: string }> }

// GET /api/leagues/[id] — league details + leaderboard
export async function GET(_req: Request, { params }: Params) {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id
  const { id } = await params

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: id, userId } },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const league = await prisma.league.findUnique({ where: { id } })
  if (!league) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const leaderboard = await getLeaderboard(id)

  return NextResponse.json({ ...league, leaderboard, currentUserRole: membership.role })
}

// PATCH /api/leagues/[id] — update league name (admin only)
export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id
  const { id } = await params

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: id, userId } },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = UpdateLeagueSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const updated = await prisma.league.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}
