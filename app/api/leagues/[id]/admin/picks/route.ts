import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'
import { calculateScoresForRace } from '@/services/scoringService'
import { z } from 'zod'

const AdminPickSchema = z.object({
  userId: z.string().cuid(),
  raceId: z.string().cuid(),
  seatId: z.string().cuid(),
  chip: z.enum(['DOUBLE_POINTS', 'SAFETY_NET']).nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

// POST /api/leagues/[id]/admin/picks — enter or update any member's pick, bypassing deadline
export async function POST(request: Request, { params }: Params) {
  const { session, error } = await requireSession()
  if (error) return error

  const adminId = session!.user.id
  const { id: leagueId } = await params

  // Require admin role
  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: adminId } },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = AdminPickSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { userId, raceId, seatId, chip } = parsed.data

  // Verify target user is a league member
  const targetMembership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  })
  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not a member of this league' }, { status: 404 })
  }

  // Verify race exists
  const race = await prisma.race.findUnique({ where: { id: raceId } })
  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })

  // Verify seat belongs to the same season
  const seat = await prisma.seat.findUnique({ where: { id: seatId } })
  if (!seat || seat.seasonYear !== race.seasonYear) {
    return NextResponse.json({ error: 'Invalid seat for this race' }, { status: 400 })
  }

  // Upsert — no deadline or seat-availability check; admin can override
  const chipValue = chip ?? null
  const pick = await prisma.pick.upsert({
    where: { leagueId_userId_raceId: { leagueId, userId, raceId } },
    update: { seatId, chip: chipValue },
    create: { leagueId, userId, raceId, seatId, chip: chipValue },
    include: { seat: true, race: true },
  })

  // If results are already ingested for this race, recalculate scores immediately
  // so the new pick is reflected in standings without waiting for the next cron run.
  const resultsExist = await prisma.raceResult.count({ where: { raceId } })
  if (resultsExist > 0) {
    await calculateScoresForRace(raceId)
  }

  return NextResponse.json(pick, { status: 201 })
}
