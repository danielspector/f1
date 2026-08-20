import { prisma } from '@/lib/prisma'
import type { Seat } from '@prisma/client'

/**
 * Returns true if the user has used all seats in the current season for this league.
 */
export async function hasUsedAllSeats(
  leagueId: string,
  userId: string,
  seasonYear: number,
): Promise<boolean> {
  const totalSeats = await prisma.seat.count({ where: { seasonYear } })
  if (totalSeats === 0) return false

  const usedSeats = await prisma.pick.findMany({
    where: {
      leagueId,
      userId,
      race: { seasonYear },
    },
    select: { seatId: true },
    distinct: ['seatId'],
  })

  return new Set(usedSeats.map((pick) => pick.seatId)).size >= totalSeats
}

/**
 * Returns the seat IDs available for this user to pick for a given race in a given league.
 *
 * Rules:
 * 1. Fetch all seats for the season.
 * 2. Fetch all other picks for this user in this league and season, in race order.
 * 3. Rebuild the current pool cycle, clearing it each time every seat has been used.
 * 4. Seats used in the current cycle are excluded.
 * 5. The seat already picked for THIS race remains available so the pick/chip can be updated.
 */
export async function getAvailableSeats(
  leagueId: string,
  userId: string,
  raceId: string,
  seasonYear: number,
): Promise<{ availableSeats: Seat[]; currentPickSeatId: string | null }> {
  const allSeats = await prisma.seat.findMany({ where: { seasonYear } })

  // Check if user already has a pick for this race
  const existingPick = await prisma.pick.findUnique({
    where: { leagueId_userId_raceId: { leagueId, userId, raceId } },
  })

  // Rebuild the active cycle from all other picks. Clearing the set when it
  // reaches the grid size allows a new cycle to begin without leaving the pool
  // permanently reset after the first completed cycle.
  const priorPicks = await prisma.pick.findMany({
    where: {
      leagueId,
      userId,
      race: { seasonYear },
      NOT: { raceId },
    },
    select: { seatId: true },
    orderBy: [{ race: { round: 'asc' } }, { submittedAt: 'asc' }],
  })

  const seatIds = new Set(allSeats.map((seat) => seat.id))
  const usedSeatIds = new Set<string>()

  for (const pick of priorPicks) {
    // Ignore stale/cross-season seat IDs if production data contains any.
    if (!seatIds.has(pick.seatId)) continue

    usedSeatIds.add(pick.seatId)
    if (usedSeatIds.size === allSeats.length) usedSeatIds.clear()
  }

  const currentPickSeatId = existingPick?.seatId ?? null
  const availableSeats = allSeats.filter(
    (seat) => !usedSeatIds.has(seat.id) || seat.id === currentPickSeatId,
  )

  return { availableSeats, currentPickSeatId }
}
