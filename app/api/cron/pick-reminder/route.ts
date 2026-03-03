import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendPickReminders } from '@/services/notificationService'

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Find races where FP1 is within the next 24 hours (but hasn't passed yet)
  const upcomingRaces = await prisma.race.findMany({
    where: {
      fp1Deadline: { gte: now, lte: in24h },
    },
  })

  let totalSent = 0
  for (const race of upcomingRaces) {
    await sendPickReminders(race.id)
    totalSent++
  }

  return NextResponse.json({ racesProcessed: totalSent })
}
