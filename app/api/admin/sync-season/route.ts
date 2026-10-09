import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { fetchSeasonSchedule, fetchDriverRoster } from '@/services/f1DataService'
import { ScheduleConflictError, syncSeasonSchedule } from '@/services/scheduleService'

function verifyAdminKey(request: Request): boolean {
  const key = request.headers.get('x-admin-key')
  return !!process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY
}

export async function POST(request: Request) {
  if (!verifyAdminKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const yearRaw = body.seasonYear ?? new Date().getFullYear()
  const year =
    typeof yearRaw === 'number' && yearRaw >= 2024 && yearRaw <= 2100
      ? yearRaw
      : new Date().getFullYear()

  const [schedule, roster] = await Promise.all([fetchSeasonSchedule(year), fetchDriverRoster(year)])

  let raceSync
  try {
    raceSync = await syncSeasonSchedule(prisma, year, schedule)
  } catch (error) {
    if (error instanceof ScheduleConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
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

  return NextResponse.json({ ...raceSync, seatsUpserted })
}
