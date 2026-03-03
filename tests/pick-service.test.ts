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
import { makeSeat, makePick, makeFullGrid } from './helpers'
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
    db.pick.count.mockResolvedValue(10)
    const result = await hasUsedAllSeats('league1', 'user1', 2026)
    expect(result).toBe(false)
  })

  // FR-08: Once all 20 seats have been used, the pool resets
  it('returns true when user has used exactly all 20 seats', async () => {
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(20)
    const result = await hasUsedAllSeats('league1', 'user1', 2026)
    expect(result).toBe(true)
  })

  it('returns true when user has used more than 20 seats (edge case after reset picks counted)', async () => {
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(21)
    const result = await hasUsedAllSeats('league1', 'user1', 2026)
    expect(result).toBe(true)
  })

  it('queries picks only for the specified league and user', async () => {
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(5)

    await hasUsedAllSeats('leagueA', 'userB', 2026)

    expect(db.pick.count).toHaveBeenCalledWith({
      where: {
        leagueId: 'leagueA',
        userId: 'userB',
        race: { seasonYear: 2026 },
      },
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
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(0) // no picks at all
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
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(1) // 1 pick made
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

  it('returns current pick seat when user has already submitted for this race', async () => {
    const pickedSeat = fullGrid[5]
    db.pick.findUnique.mockResolvedValue(
      makePick({ seatId: pickedSeat.id, raceId, leagueId, userId }),
    )

    const { availableSeats, currentPickSeatId } = await getAvailableSeats(
      leagueId,
      userId,
      raceId,
      2026,
    )

    // When already picked, all seats are returned (for display) with currentPickSeatId set
    expect(availableSeats).toHaveLength(20)
    expect(currentPickSeatId).toBe(pickedSeat.id)
  })

  // FR-08: Once all 20 seats have been used, the player's pool resets completely
  it('resets pool and returns all seats when all 20 have been used', async () => {
    db.pick.findUnique.mockResolvedValue(null) // no pick for current race
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(20) // all seats used

    const { availableSeats, currentPickSeatId } = await getAvailableSeats(
      leagueId,
      userId,
      raceId,
      2026,
    )

    expect(availableSeats).toHaveLength(20) // full reset — all available
    expect(currentPickSeatId).toBeNull()
  })

  // FR-09: Selection is seat-based — if a driver is replaced mid-season, the seat is still used
  it('tracks seats by seat ID not by driver name (seat-based selection)', async () => {
    // If seatId is what's tracked in picks, changing the driver on that seat
    // doesn't affect pool logic. The same seatId remains used.
    const seat = fullGrid[0] // e.g., McLaren seat 1
    db.pick.findUnique.mockResolvedValue(null)
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(1)
    db.pick.findMany.mockResolvedValue([
      makePick({ seatId: seat.id }), // Used by seatId, not driverName
    ])

    const { availableSeats } = await getAvailableSeats(leagueId, userId, raceId, 2026)
    expect(availableSeats.find((s) => s.id === seat.id)).toBeUndefined()
    expect(availableSeats).toHaveLength(19)
  })

  it('excludes only prior race picks, not the current race pick', async () => {
    db.pick.findUnique.mockResolvedValue(null) // no current pick
    db.seat.count.mockResolvedValue(20)
    db.pick.count.mockResolvedValue(2)
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
