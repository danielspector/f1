/**
 * Tests for League Service (leaderboard)
 * Covers:
 *   FR-12: Standings are cumulative across all races in the season
 *   3.5: Leaderboard & Stats — cumulative leaderboard, per-race breakdown
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getLeaderboard } from '@/services/leagueService'
import { makeRace, makeSeat, makeMember, makeUser } from './helpers'
import { db } from './prisma-mock'

describe('getLeaderboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty array if league does not exist', async () => {
    db.league.findUnique.mockResolvedValue(null)
    const result = await getLeaderboard('nonexistent')
    expect(result).toEqual([])
  })

  // FR-12: Standings are cumulative across all races in the season
  it('returns leaderboard with cumulative total points', async () => {
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Max', email: 'max@test.com' })
    const user2 = makeUser({ id: 'user2', name: 'Lewis', email: 'lewis@test.com' })

    db.leagueMember.findMany.mockResolvedValue([
      { userId: 'user1', user: user1 } as any,
      { userId: 'user2', user: user2 } as any,
    ])

    const race1 = makeRace({
      id: 'r1',
      round: 1,
      name: 'Bahrain GP',
      raceDatetime: new Date('2026-03-16T15:00:00Z'),
    })
    const race2 = makeRace({
      id: 'r2',
      round: 2,
      name: 'Saudi GP',
      raceDatetime: new Date('2026-03-23T15:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([race1, race2])

    const seat1 = makeSeat({
      id: 's1',
      driverName: 'Verstappen',
      teamName: 'Red Bull',
      driverCode: 'VER',
    })
    const seat2 = makeSeat({
      id: 's2',
      driverName: 'Hamilton',
      teamName: 'Ferrari',
      driverCode: 'HAM',
    })

    // user1: 25 + 18 = 43 points (cumulative)
    // user2: 18 + 25 = 43 points (cumulative)
    db.playerScore.findMany.mockImplementation(({ where }: any) => {
      if (where.userId === 'user1') {
        return Promise.resolve([
          { raceId: 'r1', pointsEarned: 25, pick: { seat: seat1, race: race1 } },
          { raceId: 'r2', pointsEarned: 18, pick: { seat: seat2, race: race2 } },
        ]) as any
      }
      return Promise.resolve([
        { raceId: 'r1', pointsEarned: 18, pick: { seat: seat2, race: race1 } },
        { raceId: 'r2', pointsEarned: 25, pick: { seat: seat1, race: race2 } },
      ]) as any
    })

    // No additional picks beyond those scored
    db.pick.findMany.mockResolvedValue([])

    const leaderboard = await getLeaderboard('league1')

    expect(leaderboard).toHaveLength(2)
    // Both users tied at 43 points
    expect(leaderboard[0].totalPoints).toBe(43)
    expect(leaderboard[1].totalPoints).toBe(43)
    // Ranks assigned
    expect(leaderboard[0].rank).toBe(1)
    expect(leaderboard[1].rank).toBe(2)
  })

  it('ranks players by total points descending', async () => {
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Winner', email: 'w@test.com' })
    const user2 = makeUser({ id: 'user2', name: 'Loser', email: 'l@test.com' })

    db.leagueMember.findMany.mockResolvedValue([
      { userId: 'user1', user: user1 } as any,
      { userId: 'user2', user: user2 } as any,
    ])

    const race1 = makeRace({ id: 'r1', round: 1, raceDatetime: new Date('2026-03-16T15:00:00Z') })
    db.race.findMany.mockResolvedValue([race1])

    const seat = makeSeat({ id: 's1', driverCode: 'VER' })

    db.playerScore.findMany.mockImplementation(({ where }: any) => {
      if (where.userId === 'user1') {
        return Promise.resolve([
          { raceId: 'r1', pointsEarned: 25, pick: { seat, race: race1 } },
        ]) as any
      }
      return Promise.resolve([
        { raceId: 'r1', pointsEarned: 10, pick: { seat, race: race1 } },
      ]) as any
    })

    db.pick.findMany.mockResolvedValue([])

    const leaderboard = await getLeaderboard('league1')

    expect(leaderboard[0].userName).toBe('Winner')
    expect(leaderboard[0].totalPoints).toBe(25)
    expect(leaderboard[0].rank).toBe(1)
    expect(leaderboard[1].userName).toBe('Loser')
    expect(leaderboard[1].totalPoints).toBe(10)
    expect(leaderboard[1].rank).toBe(2)
  })

  // Per-race breakdown for every player
  it('includes race-by-race history in leaderboard entries', async () => {
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Player', email: 'p@test.com' })
    db.leagueMember.findMany.mockResolvedValue([{ userId: 'user1', user: user1 } as any])

    const race1 = makeRace({
      id: 'r1',
      round: 1,
      name: 'Bahrain GP',
      raceDatetime: new Date('2026-03-16T15:00:00Z'),
    })
    const race2 = makeRace({
      id: 'r2',
      round: 2,
      name: 'Saudi GP',
      raceDatetime: new Date('2026-03-23T15:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([race1, race2])

    const seatVER = makeSeat({
      driverName: 'Max Verstappen',
      teamName: 'Red Bull',
      driverCode: 'VER',
    })
    const seatNOR = makeSeat({ driverName: 'Lando Norris', teamName: 'McLaren', driverCode: 'NOR' })

    db.playerScore.findMany.mockResolvedValue([
      { raceId: 'r1', pointsEarned: 25, pick: { seat: seatVER, race: race1 } },
      { raceId: 'r2', pointsEarned: 18, pick: { seat: seatNOR, race: race2 } },
    ] as any)

    db.pick.findMany.mockResolvedValue([])

    const leaderboard = await getLeaderboard('league1')
    const player = leaderboard[0]

    expect(player.history).toHaveLength(2)
    expect(player.history[0]).toMatchObject({
      round: 1,
      raceName: 'Bahrain GP',
      driverName: 'Max Verstappen',
      teamName: 'Red Bull',
      pointsEarned: 25,
    })
    expect(player.history[1]).toMatchObject({
      round: 2,
      raceName: 'Saudi GP',
      driverName: 'Lando Norris',
      teamName: 'McLaren',
      pointsEarned: 18,
    })
  })

  // FR-06: Zero points for missed picks
  it('shows 0 points for races where player missed the pick', async () => {
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Lazy Player', email: 'lazy@test.com' })
    db.leagueMember.findMany.mockResolvedValue([{ userId: 'user1', user: user1 } as any])

    const race1 = makeRace({
      id: 'r1',
      round: 1,
      name: 'Bahrain GP',
      raceDatetime: new Date('2026-03-16T15:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([race1])

    // No scores — player didn't pick
    db.playerScore.findMany.mockResolvedValue([])
    db.pick.findMany.mockResolvedValue([])

    const leaderboard = await getLeaderboard('league1')
    const player = leaderboard[0]

    expect(player.totalPoints).toBe(0)
    expect(player.history).toHaveLength(1) // race is past, shows in history
    expect(player.history[0].pointsEarned).toBe(0)
    expect(player.history[0].driverName).toBeNull() // no driver picked
  })

  // hasCurrentPick — indicates whether a player has submitted a pick for the open race week
  it('sets hasCurrentPick to true for a player who has picked for the open race', async () => {
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Player', email: 'p@test.com' })
    db.leagueMember.findMany.mockResolvedValue([{ userId: 'user1', user: user1 }] as any)

    const openRace = makeRace({
      id: 'r_open',
      round: 10,
      fp1Deadline: new Date('2026-06-18T10:00:00Z'), // 3 days away — picking_open
      raceDatetime: new Date('2026-06-20T14:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([openRace])
    db.playerScore.findMany.mockResolvedValue([])

    // Player has submitted a pick for the open race
    db.pick.findMany.mockResolvedValue([
      { raceId: 'r_open', race: openRace, seat: makeSeat() },
    ] as any)

    const leaderboard = await getLeaderboard('league1')
    expect(leaderboard[0].hasCurrentPick).toBe(true)
  })

  it('sets hasCurrentPick to false for a player who has not picked for the open race', async () => {
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Player', email: 'p@test.com' })
    db.leagueMember.findMany.mockResolvedValue([{ userId: 'user1', user: user1 }] as any)

    const openRace = makeRace({
      id: 'r_open',
      round: 10,
      fp1Deadline: new Date('2026-06-18T10:00:00Z'),
      raceDatetime: new Date('2026-06-20T14:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([openRace])
    db.playerScore.findMany.mockResolvedValue([])
    db.pick.findMany.mockResolvedValue([]) // no picks submitted

    const leaderboard = await getLeaderboard('league1')
    expect(leaderboard[0].hasCurrentPick).toBe(false)
  })

  it('sets hasCurrentPick to false when no race is currently open for picking', async () => {
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Player', email: 'p@test.com' })
    db.leagueMember.findMany.mockResolvedValue([{ userId: 'user1', user: user1 }] as any)

    // Only a far-future race (more than 7 days away — "upcoming", not "picking_open")
    const upcomingRace = makeRace({
      id: 'r_far',
      round: 12,
      fp1Deadline: new Date('2026-07-10T10:00:00Z'), // 25 days away
      raceDatetime: new Date('2026-07-12T14:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([upcomingRace])
    db.playerScore.findMany.mockResolvedValue([])
    db.pick.findMany.mockResolvedValue([])

    const leaderboard = await getLeaderboard('league1')
    expect(leaderboard[0].hasCurrentPick).toBe(false)
  })

  it('correctly differentiates hasCurrentPick between players who have and have not picked', async () => {
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'))
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Has Picked', email: 'a@test.com' })
    const user2 = makeUser({ id: 'user2', name: 'Not Picked', email: 'b@test.com' })
    db.leagueMember.findMany.mockResolvedValue([
      { userId: 'user1', user: user1 },
      { userId: 'user2', user: user2 },
    ] as any)

    const openRace = makeRace({
      id: 'r_open',
      round: 10,
      fp1Deadline: new Date('2026-06-18T10:00:00Z'),
      raceDatetime: new Date('2026-06-20T14:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([openRace])
    db.playerScore.findMany.mockResolvedValue([])

    db.pick.findMany.mockImplementation(({ where }: any) => {
      if (where.userId === 'user1') {
        return Promise.resolve([{ raceId: 'r_open', race: openRace, seat: makeSeat() }])
      }
      return Promise.resolve([]) // user2 hasn't picked
    })

    const leaderboard = await getLeaderboard('league1')
    const entry1 = leaderboard.find((e) => e.userId === 'user1')!
    const entry2 = leaderboard.find((e) => e.userId === 'user2')!

    expect(entry1.hasCurrentPick).toBe(true)
    expect(entry2.hasCurrentPick).toBe(false)
  })

  it('does not include future races in history', async () => {
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Player', email: 'p@test.com' })
    db.leagueMember.findMany.mockResolvedValue([{ userId: 'user1', user: user1 } as any])

    const pastRace = makeRace({
      id: 'r1',
      round: 1,
      raceDatetime: new Date('2026-03-16T15:00:00Z'),
    })
    const futureRace = makeRace({
      id: 'r2',
      round: 2,
      raceDatetime: new Date('2026-12-20T15:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([pastRace, futureRace])

    db.playerScore.findMany.mockResolvedValue([])
    db.pick.findMany.mockResolvedValue([])

    const leaderboard = await getLeaderboard('league1')
    const player = leaderboard[0]

    // Only past races appear in history
    expect(player.history).toHaveLength(1)
    expect(player.history[0].raceId).toBe('r1')
  })

  it('shows past unscored races as missed picks in history (0 points)', async () => {
    db.league.findUnique.mockResolvedValue({ seasonYear: 2026 } as any)

    const user1 = makeUser({ id: 'user1', name: 'Player', email: 'p@test.com' })
    db.leagueMember.findMany.mockResolvedValue([{ userId: 'user1', user: user1 } as any])

    // Race 1 is scored, Race 2 is past but results not ingested
    const race1 = makeRace({
      id: 'r1',
      round: 1,
      name: 'Bahrain GP',
      raceDatetime: new Date('2026-03-16T15:00:00Z'),
    })
    const race2 = makeRace({
      id: 'r2',
      round: 2,
      name: 'Saudi GP',
      raceDatetime: new Date('2026-03-23T15:00:00Z'),
    })
    db.race.findMany.mockResolvedValue([race1, race2])

    const seatVER = makeSeat({ driverName: 'Verstappen', teamName: 'Red Bull', driverCode: 'VER' })

    // Only race1 has been scored
    db.playerScore.findMany.mockResolvedValue([
      { raceId: 'r1', pointsEarned: 25, pick: { seat: seatVER, race: race1 } },
    ] as any)

    // No additional picks returned
    db.pick.findMany.mockResolvedValue([])

    const leaderboard = await getLeaderboard('league1')
    const player = leaderboard[0]

    // Both past races appear in history
    expect(player.history).toHaveLength(2)

    // Race 1: scored with 25 points
    const r1Entry = player.history.find((h) => h.raceId === 'r1')
    expect(r1Entry!.pointsEarned).toBe(25)
    expect(r1Entry!.driverName).toBe('Verstappen')

    // Race 2: no score → shown as missed pick (0 points, null driver)
    const r2Entry = player.history.find((h) => h.raceId === 'r2')
    expect(r2Entry!.pointsEarned).toBe(0)
    expect(r2Entry!.driverName).toBeNull()
    expect(r2Entry!.resultsPending).toBe(false)
  })
})
