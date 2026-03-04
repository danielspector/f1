import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'
import { CreateLeagueSchema } from '@/lib/validators'
import { getUpcomingRace } from '@/lib/deadlines'

// GET /api/leagues — all leagues for the current user with dashboard aggregate data
export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id

  const memberships = await prisma.leagueMember.findMany({
    where: { userId },
    include: {
      league: {
        include: {
          members: { select: { userId: true, role: true } },
          scores: { where: { userId }, select: { pointsEarned: true } },
          picks: {
            where: { userId },
            include: { race: true },
          },
        },
      },
    },
  })

  const races = await prisma.race.findMany({
    where: { seasonYear: new Date().getFullYear() },
    orderBy: { round: 'asc' },
  })

  const upcomingRace = getUpcomingRace(races)

  const leagues = await Promise.all(
    memberships.map(async (m) => {
      const totalPoints = m.league.scores.reduce((sum, s) => sum + s.pointsEarned, 0)

      // Calculate rank
      const allScores = await prisma.playerScore.groupBy({
        by: ['userId'],
        where: { leagueId: m.leagueId },
        _sum: { pointsEarned: true },
        orderBy: { _sum: { pointsEarned: 'desc' } },
      })
      const rank = allScores.findIndex((s) => s.userId === userId) + 1

      const hasPickForUpcoming = upcomingRace
        ? m.league.picks.some((p) => p.raceId === upcomingRace.id)
        : false

      return {
        id: m.league.id,
        name: m.league.name,
        inviteCode: m.league.inviteCode,
        seasonYear: m.league.seasonYear,
        status: m.league.status,
        role: m.role,
        totalPoints,
        rank: rank || null,
        memberCount: m.league.members.length,
        upcomingRace: upcomingRace
          ? { id: upcomingRace.id, name: upcomingRace.name, fp1Deadline: upcomingRace.fp1Deadline }
          : null,
        hasPickForUpcoming,
      }
    }),
  )

  return NextResponse.json(leagues)
}

// POST /api/leagues — create a new league
export async function POST(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id

  const body = await request.json().catch(() => ({}))
  const parsed = CreateLeagueSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { name, seasonYear, chipsEnabled } = parsed.data

  // Verify the user still exists in the database (JWT session may outlive the user row)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 })
  }

  const league = await prisma.league.create({
    data: {
      name,
      seasonYear,
      inviteCode: crypto.randomUUID(),
      createdById: userId,
      ...(chipsEnabled !== undefined && { chipsEnabled }),
      members: {
        create: { userId, role: 'ADMIN' },
      },
    },
  })

  return NextResponse.json(league, { status: 201 })
}
