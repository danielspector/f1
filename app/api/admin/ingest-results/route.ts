import { NextResponse } from 'next/server'
import { IngestResultsSchema } from '@/lib/validators'
import { ingestRaceResults, calculateScoresForRace } from '@/services/scoringService'
import { prisma } from '@/lib/prisma'

function verifyAdminKey(request: Request): boolean {
  return request.headers.get('x-admin-key') === process.env.ADMIN_API_KEY
}

export async function POST(request: Request) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = IngestResultsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { seasonYear, round } = parsed.data

  const resultsIngested = await ingestRaceResults(seasonYear, round)

  const race = await prisma.race.findUnique({
    where: { seasonYear_round: { seasonYear, round } },
  })
  if (!race) {
    return NextResponse.json({ error: 'Race not found after ingestion' }, { status: 500 })
  }

  const scoresUpdated = await calculateScoresForRace(race.id)

  return NextResponse.json({ resultsIngested, scoresUpdated })
}
