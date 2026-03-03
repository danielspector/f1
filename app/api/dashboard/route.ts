import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'
import { getUpcomingRace } from '@/lib/deadlines'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id

  const memberships = await prisma.leagueMember.findMany({
    where: { userId },
    include: {
      league: {
        include: {
          members: { select: { userId: true } },
          scores: { where: { userId }, select: { pointsEarned: true } },
          picks: { where: { userId }, select: { raceId: true } },
        },
      },
    },
  })

  const seasonYear = new Date().getFullYear()
  const races = await prisma.race.findMany({
    where: { seasonYear },
    orderBy: { round: 'asc' },
  })
  const upcomingRace = getUpcomingRace(races)

  const leagues = await Promise.all(
    memberships.map(async (m) => {
      const totalPoints = m.league.scores.reduce((sum, s) => sum + s.pointsEarned, 0)

      const allMemberTotals = await prisma.playerScore.groupBy({
        by: ['userId'],
        where: { leagueId: m.leagueId },
        _sum: { pointsEarned: true },
        orderBy: { _sum: { pointsEarned: 'desc' } },
      })

      const myIndex = allMemberTotals.findIndex((s) => s.userId === userId)
      const rank = myIndex >= 0 ? myIndex + 1 : null

      const hasPickForUpcoming = upcomingRace
        ? m.league.picks.some((p) => p.raceId === upcomingRace.id)
        : false

      return {
        id: m.league.id,
        name: m.league.name,
        seasonYear: m.league.seasonYear,
        status: m.league.status,
        role: m.role,
        totalPoints,
        rank,
        memberCount: m.league.members.length,
        upcomingRace: upcomingRace
          ? {
              id: upcomingRace.id,
              name: upcomingRace.name,
              fp1Deadline: upcomingRace.fp1Deadline.toISOString(),
            }
          : null,
        hasPickForUpcoming,
      }
    }),
  )

  return NextResponse.json(leagues, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  })
}
