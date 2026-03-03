import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'

export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const yearParam = searchParams.get('seasonYear')
  const seasonYear = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

  const races = await prisma.race.findMany({
    where: { seasonYear },
    orderBy: { round: 'asc' },
    include: {
      results: { select: { id: true } },
    },
  })

  const now = new Date()

  const racesWithStatus = races.map((race) => {
    const fp1 = new Date(race.fp1Deadline)
    const raceTime = new Date(race.raceDatetime)
    const hasResults = race.results.length > 0
    const daysUntilFP1 = (fp1.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    let status: 'upcoming' | 'picking_open' | 'locked' | 'results_in'
    if (hasResults) {
      status = 'results_in'
    } else if (fp1 <= now) {
      status = 'locked'
    } else if (daysUntilFP1 <= 7) {
      status = 'picking_open'
    } else {
      status = 'upcoming'
    }

    return {
      id: race.id,
      seasonYear: race.seasonYear,
      round: race.round,
      name: race.name,
      circuit: race.circuit,
      fp1Deadline: race.fp1Deadline,
      raceDatetime: race.raceDatetime,
      status,
    }
  })

  return NextResponse.json(racesWithStatus, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
  })
}
