import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchSeasonSchedule, fetchDriverRoster } from '@/services/f1DataService'

function verifyAdminKey(request: Request): boolean {
  const key = request.headers.get('x-admin-key')
  return key === process.env.ADMIN_API_KEY
}

export async function POST(request: Request) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const yearRaw = body.seasonYear ?? new Date().getFullYear()
  const year = typeof yearRaw === 'number' && yearRaw >= 2024 && yearRaw <= 2100
    ? yearRaw
    : new Date().getFullYear()

  const [schedule, roster] = await Promise.all([
    fetchSeasonSchedule(year),
    fetchDriverRoster(year),
  ])

  let racesUpserted = 0
  for (const race of schedule) {
    await prisma.race.upsert({
      where: { seasonYear_round: { seasonYear: year, round: race.round } },
      update: {
        name: race.name,
        circuit: race.circuit,
        fp1Deadline: race.fp1Datetime,
        raceDatetime: race.raceDatetime,
      },
      create: {
        seasonYear: year,
        round: race.round,
        name: race.name,
        circuit: race.circuit,
        fp1Deadline: race.fp1Datetime,
        raceDatetime: race.raceDatetime,
      },
    })
    racesUpserted++
  }

  let seatsUpserted = 0
  for (const driver of roster) {
    await prisma.seat.upsert({
      where: { seasonYear_driverCode: { seasonYear: year, driverCode: driver.driverCode } },
      update: { driverName: driver.driverName, teamName: driver.teamName },
      create: {
        seasonYear: year,
        driverCode: driver.driverCode,
        driverName: driver.driverName,
        teamName: driver.teamName,
      },
    })
    seatsUpserted++
  }

  return NextResponse.json({ racesUpserted, seatsUpserted })
}
