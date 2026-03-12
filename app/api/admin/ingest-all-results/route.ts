import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ingestRaceResults, calculateScoresForRace } from '@/services/scoringService'
import { requireSuperAdmin } from '@/lib/auth-helpers'

export async function POST() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const now = new Date()

  const races = await prisma.race.findMany({
    where: {
      raceDatetime: { lte: now },
      results: { none: {} },
    },
    orderBy: { round: 'asc' },
  })

  if (races.length === 0) {
    return NextResponse.json({ message: 'No unscored races found', processed: [] })
  }

  const processed: { name: string; round: number; resultsIngested: number; scoresUpdated: number }[] = []
  const errors: { name: string; error: string }[] = []

  for (const race of races) {
    try {
      const resultsIngested = await ingestRaceResults(race.seasonYear, race.round)
      const scoresUpdated = await calculateScoresForRace(race.id)
      processed.push({ name: race.name, round: race.round, resultsIngested, scoresUpdated })
    } catch (err) {
      errors.push({ name: race.name, error: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({ processed, errors })
}
