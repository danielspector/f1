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

  const usedSeats = await prisma.pick.count({
    where: {
      leagueId,
      userId,
      race: { seasonYear },
    },
  })

  return usedSeats >= totalSeats
}

/**
 * Returns the seat IDs available for this user to pick for a given race in a given league.
 *
 * Rules:
 * 1. Fetch all seats for the season.
 * 2. Fetch all prior picks for this user in this league.
 * 3. If the user has used all seats → pool resets → all seats are available.
 * 4. Otherwise seats already picked (in previous races) are excluded.
 * 5. The seat already picked for THIS race (if any) is returned as the only option (already submitted).
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

  if (existingPick) {
    // Already submitted — return current seat as the only "selected" seat
    return { availableSeats: allSeats, currentPickSeatId: existingPick.seatId }
  }

  const allUsed = await hasUsedAllSeats(leagueId, userId, seasonYear)

  if (allUsed) {
    // Pool reset — all seats available
    return { availableSeats: allSeats, currentPickSeatId: null }
  }

  // Find seats used in previous races (excluding current race)
  const priorPicks = await prisma.pick.findMany({
    where: { leagueId, userId, NOT: { raceId } },
    select: { seatId: true },
  })
  const usedSeatIds = new Set(priorPicks.map((p) => p.seatId))
  const availableSeats = allSeats.filter((s) => !usedSeatIds.has(s.id))

  return { availableSeats, currentPickSeatId: null }
}
