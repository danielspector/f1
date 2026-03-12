import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ingestRaceResults, calculateScoresForRace } from '@/services/scoringService'
import { sendRaceSummaries } from '@/services/notificationService'

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find any past races that don't yet have results ingested.
  // No time-window restriction — if a race was missed (e.g. API was slow,
  // cron timing didn't align), it will be picked up on the next run.
  const races = await prisma.race.findMany({
    where: {
      raceDatetime: { lte: now },
      results: { none: {} }, // no results yet
    },
  })

  const processed: string[] = []

  for (const race of races) {
    try {
      await ingestRaceResults(race.seasonYear, race.round)
      await calculateScoresForRace(race.id)
      await sendRaceSummaries(race.id)
      processed.push(race.name)
    } catch (err) {
      console.error(`[CronIngestResults] Failed for ${race.name}:`, err)
    }
  }

  return NextResponse.json({ processed })
}
