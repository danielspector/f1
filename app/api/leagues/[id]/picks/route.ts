import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'
import { SubmitPickSchema } from '@/lib/validators'
import { isFP1Passed } from '@/lib/deadlines'
import { getAvailableSeats } from '@/services/pickService'

type Params = { params: Promise<{ id: string }> }

// GET /api/leagues/[id]/picks?raceId=
export async function GET(request: Request, { params }: Params) {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id
  const { id: leagueId } = await params
  const { searchParams } = new URL(request.url)
  const raceId = searchParams.get('raceId')

  // Verify membership
  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (raceId) {
    const race = await prisma.race.findUnique({ where: { id: raceId } })
    if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })

    const deadlinePassed = isFP1Passed(race)

    const { availableSeats, currentPickSeatId } = await getAvailableSeats(
      leagueId,
      userId,
      raceId,
      race.seasonYear,
    )

    // All seats (for display), tagged with available status
    const allSeats = await prisma.seat.findMany({
      where: { seasonYear: race.seasonYear },
      orderBy: [{ teamName: 'asc' }, { driverName: 'asc' }],
    })

    const availableSeatIds = new Set(availableSeats.map((s) => s.id))

    if (!deadlinePassed) {
      // Only show the current user's own pick; hide others
      const myPick = currentPickSeatId
        ? await prisma.pick.findUnique({
            where: { leagueId_userId_raceId: { leagueId, userId, raceId } },
            include: { seat: true },
          })
        : null

      return NextResponse.json({
        race,
        deadlinePassed: false,
        seats: allSeats.map((s) => ({
          ...s,
          available: availableSeatIds.has(s.id),
        })),
        currentPickSeatId,
        myPick,
        allPicks: null, // hidden before deadline
      })
    }

    // Deadline passed — reveal all picks
    const allPicks = await prisma.pick.findMany({
      where: { leagueId, raceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        seat: true,
        score: true,
      },
    })

    return NextResponse.json({
      race,
      deadlinePassed: true,
      seats: allSeats.map((s) => ({
        ...s,
        available: availableSeatIds.has(s.id),
      })),
      currentPickSeatId,
      myPick: allPicks.find((p) => p.userId === userId) ?? null,
      allPicks,
    })
  }

  // No raceId — return all picks for this league (for the current user)
  const picks = await prisma.pick.findMany({
    where: { leagueId, userId },
    include: { seat: true, race: true, score: true },
    orderBy: { race: { round: 'asc' } },
  })

  return NextResponse.json(picks)
}

// POST /api/leagues/[id]/picks
export async function POST(request: Request, { params }: Params) {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id
  const { id: leagueId } = await params

  // Verify membership
  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  })
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const parsed = SubmitPickSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { raceId, seatId } = parsed.data

  // 1. Verify race exists
  const race = await prisma.race.findUnique({ where: { id: raceId } })
  if (!race) return NextResponse.json({ error: 'Race not found' }, { status: 404 })

  // 2. Enforce FP1 deadline — server-side check
  if (isFP1Passed(race)) {
    return NextResponse.json(
      { error: 'FP1 has started — the pick deadline has passed' },
      { status: 400 },
    )
  }

  // 3. Verify seat is available (prior picks excluding current race, so changing is allowed)
  const { availableSeats } = await getAvailableSeats(leagueId, userId, raceId, race.seasonYear)
  const isAvailable = availableSeats.some((s) => s.id === seatId)
  if (!isAvailable) {
    return NextResponse.json(
      { error: 'This driver seat is not available. You have already used it this cycle.' },
      { status: 400 },
    )
  }

  const pick = await prisma.pick.upsert({
    where: { leagueId_userId_raceId: { leagueId, userId, raceId } },
    update: { seatId },
    create: { leagueId, userId, raceId, seatId },
    include: { seat: true, race: true },
  })

  return NextResponse.json(pick, { status: 201 })
}
