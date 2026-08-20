/**
 * Tests for Pick Service (seat pool logic)
 * Covers:
 *   FR-04: Each player must select one driver seat per race weekend before FP1
 *   FR-07: A player cannot reuse a driver seat until they have used every seat on the grid
 *   FR-08: Once all 20 seats have been used, the player's pool resets completely
 *   FR-09: Selection is seat-based — if a driver is replaced mid-season, the seat is still considered used
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hasUsedAllSeats, getAvailableSeats } from '@/services/pickService'
import { makePick, makeFullGrid } from './helpers'
import { db } from './prisma-mock'

describe('hasUsedAllSeats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns false when no seats exist for the season', async () => {
    db.seat.count.mockResolvedValue(0)
    const result = await hasUsedAllSeats('league1', 'user1', 2026)
    expect(result).toBe(false)
  })

  it('returns false when user has used fewer seats than total', async () => {
    db.seat.count.mockResolvedValue(20)
    db.pick.findMany.mockResolvedValue(
      makeFullGrid().slice(0, 10).map((seat) => makePick({ seatId: seat.id })),
    )
    const result = await hasUsedAllSeats('league1', 'user1', 2026)
    expect(result).toBe(false)
  })

  // FR-08: Once all 20 seats have been used, the pool resets
  it('returns true when user has used exactly all 20 seats', async () => {
    db.seat.count.mockResolvedValue(20)
    db.pick.findMany.mockResolvedValue(
      makeFullGrid().map((seat) => makePick({ seatId: seat.id })),
    )
    const result = await hasUsedAllSeats('league1', 'user1', 2026)
    expect(result).toBe(true)
  })

  it('does not treat duplicate picks as using additional seats', async () => {
    db.seat.count.mockResolvedValue(20)
    const seats = makeFullGrid().slice(0, 19)
    db.pick.findMany.mockResolvedValue([
      ...seats.map((seat) => makePick({ seatId: seat.id })),
      makePick({ seatId: seats[0].id }),
      makePick({ seatId: seats[0].id }),
    ])
    const result = await hasUsedAllSeats('league1', 'user1', 2026)
    expect(result).toBe(false)
  })

  it('queries picks only for the specified league and user', async () => {
    db.seat.count.mockResolvedValue(20)
    db.pick.findMany.mockResolvedValue([])

    await hasUsedAllSeats('leagueA', 'userB', 2026)

    expect(db.pick.findMany).toHaveBeenCalledWith({
      where: {
        leagueId: 'leagueA',
        userId: 'userB',
        race: { seasonYear: 2026 },
      },
      select: { seatId: true },
      distinct: ['seatId'],
    })
  })
})

describe('getAvailableSeats', () => {
  const fullGrid = makeFullGrid(2026)
  const leagueId = 'league1'
  const userId = 'user1'
  const raceId = 'race1'

  beforeEach(() => {
    vi.clearAllMocks()
    db.seat.findMany.mockResolvedValue(fullGrid)
  })

  // FR-04: Player selects one driver seat per race weekend
  it('returns all 20 seats as available when no picks have been made', async () => {
    db.pick.findUnique.mockResolvedValue(null) // no existing pick for this race
    db.pick.findMany.mockResolvedValue([]) // no prior picks

    const { availableSeats, currentPickSeatId } = await getAvailableSeats(
      leagueId,
      userId,
      raceId,
      2026,
    )

    expect(availableSeats).toHaveLength(20)
    expect(currentPickSeatId).toBeNull()
  })

  // FR-07: A player cannot reuse a driver seat until they have used every seat on the grid
  it('excludes previously used seats from available options', async () => {
    const usedSeat = fullGrid[0]
    db.pick.findUnique.mockResolvedValue(null) // no pick for current race
    db.pick.findMany.mockResolvedValue([makePick({ seatId: usedSeat.id, raceId: 'otherRace' })])

    const { availableSeats, currentPickSeatId } = await getAvailableSeats(
      leagueId,
      userId,
      raceId,
      2026,
    )

    expect(availableSeats).toHaveLength(19)
    expect(availableSeats.find((s) => s.id === usedSeat.id)).toBeUndefined()
    expect(currentPickSeatId).toBeNull()
  })

  it('keeps the current pick available but still excludes seats used in prior races', async () => {
    const pickedSeat = fullGrid[5]
    const previouslyUsedSeat = fullGrid[0]
    db.pick.findUnique.mockResolvedValue(
      makePick({ seatId: pickedSeat.id, raceId, leagueId, userId }),
    )
    db.pick.findMany.mockResolvedValue([
      makePick({ seatId: previouslyUsedSeat.id, raceId: 'otherRace' }),
    ])

    const { availableSeats, currentPickSeatId } = await getAvailableSeats(
      leagueId,
      userId,
      raceId,
      2026,
    )

    expect(availableSeats).toHaveLength(19)
    expect(availableSeats).toContainEqual(pickedSeat)
    expect(availableSeats).not.toContainEqual(previouslyUsedSeat)
    expect(currentPickSeatId).toBe(pickedSeat.id)
  })

  // FR-08: Once all 20 seats have been used, the player's pool resets completely
  it('resets pool and returns all seats when all 20 have been used', async () => {
    db.pick.findUnique.mockResolvedValue(null) // no pick for current race
    db.pick.findMany.mockResolvedValue(
      fullGrid.map((seat) => makePick({ seatId: seat.id, raceId: `race-${seat.id}` })),
    )

    const { availableSeats, currentPickSeatId } = await getAvailableSeats(
      leagueId,
      userId,
      raceId,
      2026,
    )

    expect(availableSeats).toHaveLength(20) // full reset — all available
    expect(currentPickSeatId).toBeNull()
  })

  it('starts tracking used seats again after a completed pool cycle', async () => {
    db.pick.findUnique.mockResolvedValue(null)
    db.pick.findMany.mockResolvedValue([
      ...fullGrid.map((seat) => makePick({ seatId: seat.id, raceId: `race-${seat.id}` })),
      makePick({ seatId: fullGrid[3].id, raceId: 'next-cycle-race' }),
    ])

    const { availableSeats } = await getAvailableSeats(leagueId, userId, raceId, 2026)

    expect(availableSeats).toHaveLength(19)
    expect(availableSeats).not.toContainEqual(fullGrid[3])
  })

  // FR-09: Selection is seat-based — if a driver is replaced mid-season, the seat is still used
  it('tracks seats by seat ID not by driver name (seat-based selection)', async () => {
    // If seatId is what's tracked in picks, changing the driver on that seat
    // doesn't affect pool logic. The same seatId remains used.
    const seat = fullGrid[0] // e.g., McLaren seat 1
    db.pick.findUnique.mockResolvedValue(null)
    db.pick.findMany.mockResolvedValue([
      makePick({ seatId: seat.id }), // Used by seatId, not driverName
    ])

    const { availableSeats } = await getAvailableSeats(leagueId, userId, raceId, 2026)
    expect(availableSeats.find((s) => s.id === seat.id)).toBeUndefined()
    expect(availableSeats).toHaveLength(19)
  })

  it('excludes only prior race picks, not the current race pick', async () => {
    db.pick.findUnique.mockResolvedValue(null) // no current pick
    db.pick.findMany.mockResolvedValue([
      makePick({ seatId: fullGrid[0].id, raceId: 'otherRace1' }),
      makePick({ seatId: fullGrid[1].id, raceId: 'otherRace2' }),
    ])

    const { availableSeats } = await getAvailableSeats(leagueId, userId, raceId, 2026)
    expect(availableSeats).toHaveLength(18)
  })

  it('queries with correct parameters for the specified league', async () => {
    db.pick.findUnique.mockResolvedValue(null)
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(0)
    db.pick.findMany.mockResolvedValue([])

    await getAvailableSeats('leagueX', 'userY', 'raceZ', 2026)

    expect(db.pick.findUnique).toHaveBeenCalledWith({
      where: { leagueId_userId_raceId: { leagueId: 'leagueX', userId: 'userY', raceId: 'raceZ' } },
    })
  })
})
