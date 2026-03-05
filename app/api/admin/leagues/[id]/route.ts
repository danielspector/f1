import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth-helpers'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const { id } = await params

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      scores: {
        select: { userId: true, pointsEarned: true, raceId: true },
      },
      picks: {
        include: {
          race: { select: { id: true, name: true, round: true } },
          seat: { select: { driverName: true, driverCode: true, teamName: true } },
          score: { select: { pointsEarned: true } },
        },
        orderBy: { race: { round: 'asc' } },
      },
    },
  })

  if (!league) {
    return NextResponse.json({ error: 'League not found' }, { status: 404 })
  }

  const memberTotals = new Map<string, number>()
  for (const s of league.scores) {
    memberTotals.set(s.userId, (memberTotals.get(s.userId) || 0) + s.pointsEarned)
  }

  const members = league.members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    totalPoints: memberTotals.get(m.user.id) || 0,
  }))

  const picksByUser = new Map<string, typeof formattedPicks>()
  const formattedPicks = league.picks.map((p) => ({
    userId: p.userId,
    race: { id: p.race.id, name: p.race.name, round: p.race.round },
    driver: { name: p.seat.driverName, code: p.seat.driverCode, team: p.seat.teamName },
    points: p.score?.pointsEarned ?? null,
  }))

  for (const pick of formattedPicks) {
    const existing = picksByUser.get(pick.userId) || []
    existing.push(pick)
    picksByUser.set(pick.userId, existing)
  }

  return NextResponse.json({
    id: league.id,
    name: league.name,
    seasonYear: league.seasonYear,
    status: league.status,
    chipsEnabled: league.chipsEnabled,
    members,
    picks: Object.fromEntries(picksByUser),
  })
}
