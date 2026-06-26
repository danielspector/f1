import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPickReminders } from '@/services/notificationService'

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

/**
 * Returns the current weekday and hour in New York (America/New_York),
 * which automatically accounts for EST/EDT daylight saving shifts.
 */
function nyTimeParts(now: Date): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  // Intl can emit "24" for midnight; normalise to 0.
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24

  return { weekday, hour }
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Reminders go out at 8pm NY time on Wednesday and Thursday only. The cron
  // fires at both 00:00 and 01:00 UTC (covering 8pm NY in EDT and EST); this
  // gate ensures exactly one of those firings does work, regardless of DST.
  const { weekday, hour } = nyTimeParts(now)
  const isReminderWindow =
    hour === 20 && (weekday === 'Wednesday' || weekday === 'Thursday')

  if (!isReminderWindow) {
    return NextResponse.json({ skipped: true, weekday, hour })
  }

  // Remind for the next race whose FP1 deadline hasn't passed, regardless of
  // how far away the race is. Members who have already picked are skipped
  // inside sendPickReminders.
  const upcomingRace = await prisma.race.findFirst({
    where: { fp1Deadline: { gt: now } },
    orderBy: { fp1Deadline: 'asc' },
  })

  if (!upcomingRace) {
    return NextResponse.json({ racesProcessed: 0, weekday })
  }

  await sendPickReminders(upcomingRace.id)

  return NextResponse.json({ racesProcessed: 1, raceId: upcomingRace.id, weekday })
}
