import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  // Find all active leagues where the final race of the season ended 48+ hours ago
  // and all race results have been ingested
  const activeLeagues = await prisma.league.findMany({
    where: { status: 'ACTIVE' },
  })

  const archived: string[] = []

  for (const league of activeLeagues) {
    const races = await prisma.race.findMany({
      where: { seasonYear: league.seasonYear },
      orderBy: { round: 'desc' },
      include: { results: { select: { id: true } } },
    })

    if (!races.length) continue

    const lastRace = races[0]

    // Season is over if: last race ended 48+ hours ago AND has results
    const seasonEnded = new Date(lastRace.raceDatetime) <= twoDaysAgo
    const hasResults = lastRace.results.length > 0

    if (seasonEnded && hasResults) {
      await prisma.league.update({
        where: { id: league.id },
        data: { status: 'ARCHIVED' },
      })
      archived.push(league.name)
    }
  }

  return NextResponse.json({ archived })
}
