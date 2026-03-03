import type { Race } from '@prisma/client'

/**
 * Returns true if the FP1 deadline for this race has already passed.
 * All comparisons are in UTC to avoid timezone bugs.
 */
export function isFP1Passed(race: Race): boolean {
  return new Date() >= new Date(race.fp1Deadline)
}

/**
 * Returns the next race whose FP1 deadline has not yet passed.
 * Races must be passed in ascending round order.
 */
export function getUpcomingRace(races: Race[]): Race | null {
  const now = new Date()
  return races.find((r) => new Date(r.fp1Deadline) > now) ?? null
}
