/**
 * Tests for Notification Service
 * Covers:
 *   FR-17: The app sends email reminders before FP1 if a player has not yet submitted a pick
 *   FR-18: The app sends a post-race summary email with results and updated standings
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendEmail } from '@/lib/email'
import { sendPickReminders, sendRaceSummaries } from '@/services/notificationService'
import { makeRace, makeUser, makeLeague, makeMember, makePick } from './helpers'
import { db } from './prisma-mock'
const mockSendEmail = vi.mocked(sendEmail)

// We need to mock the leagueService used by sendRaceSummaries
vi.mock('@/services/leagueService', () => ({
  getLeaderboard: vi.fn(),
}))
import { getLeaderboard } from '@/services/leagueService'
const mockGetLeaderboard = vi.mocked(getLeaderboard)

describe('sendPickReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // FR-17: Pick reminder sent to players who have not submitted a pick
  it('does nothing if race does not exist', async () => {
    db.race.findUnique.mockResolvedValue(null)
    await sendPickReminders('nonexistent')
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('sends reminders to members who have not yet picked', async () => {
    const race = makeRace({ id: 'race1', seasonYear: 2026, name: 'Bahrain GP' })
    db.race.findUnique.mockResolvedValue(race)

    const user1 = makeUser({ id: 'user1', email: 'hasnt-picked@test.com', name: 'Lazy' })
    const user2 = makeUser({ id: 'user2', email: 'already-picked@test.com', name: 'Diligent' })

    const league = {
      ...makeLeague({ id: 'league1', seasonYear: 2026, status: 'ACTIVE' }),
      members: [
        { ...makeMember({ userId: 'user1', leagueId: 'league1' }), user: user1 },
        { ...makeMember({ userId: 'user2', leagueId: 'league1' }), user: user2 },
      ],
    }

    db.league.findMany.mockResolvedValue([league] as any)

    // user1 has no pick, user2 has a pick
    db.pick.findUnique.mockImplementation(({ where }: any) => {
      const { userId } = where.leagueId_userId_raceId
      if (userId === 'user2') return Promise.resolve(makePick()) as any
      return Promise.resolve(null) as any
    })

    await sendPickReminders('race1')

    // Only user1 should receive an email
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'hasnt-picked@test.com',
        subject: expect.stringContaining('Bahrain GP'),
      }),
    )
  })

  it('does not send reminders to members who already picked', async () => {
    const race = makeRace({ id: 'race1', seasonYear: 2026 })
    db.race.findUnique.mockResolvedValue(race)

    const user = makeUser({ id: 'user1', email: 'done@test.com' })
    const league = {
      ...makeLeague({ id: 'league1', seasonYear: 2026, status: 'ACTIVE' }),
      members: [{ ...makeMember({ userId: 'user1' }), user }],
    }

    db.league.findMany.mockResolvedValue([league] as any)
    db.pick.findUnique.mockResolvedValue(makePick() as any)

    await sendPickReminders('race1')
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('processes all active leagues for the season', async () => {
    const race = makeRace({ id: 'race1', seasonYear: 2026 })
    db.race.findUnique.mockResolvedValue(race)

    const user = makeUser({ id: 'user1', email: 'player@test.com' })

    const league1 = {
      ...makeLeague({ id: 'l1', seasonYear: 2026, status: 'ACTIVE' }),
      members: [{ ...makeMember({ userId: 'user1', leagueId: 'l1' }), user }],
    }
    const league2 = {
      ...makeLeague({ id: 'l2', seasonYear: 2026, status: 'ACTIVE' }),
      members: [{ ...makeMember({ userId: 'user1', leagueId: 'l2' }), user }],
    }

    db.league.findMany.mockResolvedValue([league1, league2] as any)
    db.pick.findUnique.mockResolvedValue(null) // no picks in either league

    await sendPickReminders('race1')

    // Should send 2 emails — one per league membership
    expect(mockSendEmail).toHaveBeenCalledTimes(2)
  })

  it('continues sending even if one email fails', async () => {
    const race = makeRace({ id: 'race1', seasonYear: 2026 })
    db.race.findUnique.mockResolvedValue(race)

    const user1 = makeUser({ id: 'user1', email: 'fail@test.com' })
    const user2 = makeUser({ id: 'user2', email: 'success@test.com' })

    const league = {
      ...makeLeague({ id: 'l1', seasonYear: 2026, status: 'ACTIVE' }),
      members: [
        { ...makeMember({ userId: 'user1' }), user: user1 },
        { ...makeMember({ userId: 'user2' }), user: user2 },
      ],
    }

    db.league.findMany.mockResolvedValue([league] as any)
    db.pick.findUnique.mockResolvedValue(null)

    // First call fails, second succeeds
    mockSendEmail
      .mockRejectedValueOnce(new Error('Email delivery failed'))
      .mockResolvedValueOnce(undefined)

    // Should not throw
    await expect(sendPickReminders('race1')).resolves.not.toThrow()
    expect(mockSendEmail).toHaveBeenCalledTimes(2)
  })
})

describe('sendRaceSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // FR-18: Post-race summary email with results and updated standings
  it('does nothing if race does not exist', async () => {
    db.race.findUnique.mockResolvedValue(null)
    await sendRaceSummaries('nonexistent')
    expect(mockSendEmail).not.toHaveBeenCalled()
  })

  it('sends summary emails to all members of leagues with picks', async () => {
    const race = makeRace({ id: 'race1', seasonYear: 2026, name: 'Bahrain GP', round: 1 })
    db.race.findUnique.mockResolvedValue(race)

    const user1 = makeUser({ id: 'user1', email: 'p1@test.com', name: 'Player One' })
    const user2 = makeUser({ id: 'user2', email: 'p2@test.com', name: 'Player Two' })

    const league = {
      ...makeLeague({ id: 'l1', seasonYear: 2026, status: 'ACTIVE' }),
      members: [
        { ...makeMember({ userId: 'user1' }), user: user1 },
        { ...makeMember({ userId: 'user2' }), user: user2 },
      ],
    }

    db.league.findMany.mockResolvedValue([league] as any)

    mockGetLeaderboard.mockResolvedValue([
      {
        userId: 'user1',
        userName: 'Player One',
        userEmail: 'p1@test.com',
        totalPoints: 25,
        rank: 1,
        history: [
          {
            raceId: 'race1',
            round: 1,
            raceName: 'Bahrain GP',
            driverName: 'Verstappen',
            teamName: 'Red Bull',
            driverCode: 'VER',
            pointsEarned: 25,
            resultsPending: false,
          },
        ],
      },
      {
        userId: 'user2',
        userName: 'Player Two',
        userEmail: 'p2@test.com',
        totalPoints: 18,
        rank: 2,
        history: [
          {
            raceId: 'race1',
            round: 1,
            raceName: 'Bahrain GP',
            driverName: 'Hamilton',
            teamName: 'Ferrari',
            driverCode: 'HAM',
            pointsEarned: 18,
            resultsPending: false,
          },
        ],
      },
    ])

    await sendRaceSummaries('race1')

    // Should send email to both members
    expect(mockSendEmail).toHaveBeenCalledTimes(2)

    // Check that emails include the race name
    const call1 = mockSendEmail.mock.calls[0][0]
    expect(call1.subject).toContain('Bahrain GP')
    expect(call1.to).toBe('p1@test.com')

    const call2 = mockSendEmail.mock.calls[1][0]
    expect(call2.to).toBe('p2@test.com')
  })

  it('only sends to leagues that have at least one pick for the race', async () => {
    const race = makeRace({ id: 'race1', seasonYear: 2026 })
    db.race.findUnique.mockResolvedValue(race)

    // findMany is called with a filter for picks: { some: { raceId } }
    // So if no leagues are returned, no emails are sent
    db.league.findMany.mockResolvedValue([])

    await sendRaceSummaries('race1')
    expect(mockSendEmail).not.toHaveBeenCalled()
  })
})
