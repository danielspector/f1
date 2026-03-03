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
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Find races that ended in the last 24 hours and don't yet have results
  const races = await prisma.race.findMany({
    where: {
      raceDatetime: { gte: twentyFourHoursAgo, lte: now },
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
