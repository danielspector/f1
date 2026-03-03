/**
 * Tests for Admin Pick entry API route
 * Covers:
 *   Admin can enter a pick for any league member, bypassing the FP1 deadline
 *   Admin can override an existing pick after the deadline
 *   Non-admins and non-members are rejected
 *   Input validation for unknown members, races, and mismatched seats
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireSession } from '@/lib/auth-helpers'
import { makeRace, makeSeat } from './helpers'
import { db } from './prisma-mock'

const mockRequireSession = requireSession as any

vi.mock('@/services/scoringService', () => ({
  calculateScoresForRace: vi.fn().mockResolvedValue(1),
}))
import { calculateScoresForRace } from '@/services/scoringService'
const mockCalculateScores = vi.mocked(calculateScoresForRace)

// Valid CUID-like IDs
const LEAGUE_ID = 'l1'
const ADMIN_ID = 'cm5admin123def456ghi7'
const MEMBER_ID = 'cm5member123def456ghi7'
const RACE_ID = 'cm5abc123def456ghi789'
const SEAT_ID = 'cm5xyz789abc123def456'
const NEW_SEAT_ID = 'cm5new789abc123def999'

function mockAsAdmin() {
  mockRequireSession.mockResolvedValue({
    session: { user: { id: ADMIN_ID } } as any,
    error: null,
  })
}

function mockAsUser(userId: string) {
  mockRequireSession.mockResolvedValue({
    session: { user: { id: userId } } as any,
    error: null,
  })
}

function makeRequest(body: object) {
  return new Request(`http://localhost/api/leagues/${LEAGUE_ID}/admin/picks`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/leagues/[id]/admin/picks', () => {
  let POST: (request: Request, context: any) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/leagues/[id]/admin/picks/route')
    POST = mod.POST
  })

  it('allows admin to enter a pick for another member', async () => {
    mockAsAdmin()
    const race = makeRace({ id: RACE_ID, seasonYear: 2026 })
    const seat = makeSeat({ id: SEAT_ID, seasonYear: 2026 })

    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })  // admin membership check
      .mockResolvedValueOnce({ role: 'MEMBER' }) // target member check
    db.race.findUnique.mockResolvedValue(race)
    db.seat.findUnique.mockResolvedValue(seat)
    db.pick.upsert.mockResolvedValue({
      id: 'pick1', userId: MEMBER_ID, seatId: SEAT_ID, raceId: RACE_ID, seat, race,
    } as any)

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.seatId).toBe(SEAT_ID)
    expect(db.pick.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leagueId_userId_raceId: { leagueId: LEAGUE_ID, userId: MEMBER_ID, raceId: RACE_ID } },
        create: expect.objectContaining({ userId: MEMBER_ID, seatId: SEAT_ID }),
      }),
    )
  })

  it('allows admin to enter a pick after the FP1 deadline has passed', async () => {
    mockAsAdmin()
    // Deadline in the past — regular picks endpoint would reject this
    const race = makeRace({ id: RACE_ID, seasonYear: 2026, fp1Deadline: new Date('2026-01-01T11:30:00Z') })
    const seat = makeSeat({ id: SEAT_ID, seasonYear: 2026 })

    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ role: 'MEMBER' })
    db.race.findUnique.mockResolvedValue(race)
    db.seat.findUnique.mockResolvedValue(seat)
    db.pick.upsert.mockResolvedValue({
      id: 'pick1', userId: MEMBER_ID, seatId: SEAT_ID, raceId: RACE_ID, seat, race,
    } as any)

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    // Would be rejected with 400 for a regular member; admin succeeds
    expect(response.status).toBe(201)
    expect(db.pick.upsert).toHaveBeenCalledOnce()
  })

  it('allows admin to override an existing pick with a different driver', async () => {
    mockAsAdmin()
    const race = makeRace({ id: RACE_ID, seasonYear: 2026 })
    const newSeat = makeSeat({ id: NEW_SEAT_ID, driverName: 'Piastri', seasonYear: 2026 })

    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ role: 'MEMBER' })
    db.race.findUnique.mockResolvedValue(race)
    db.seat.findUnique.mockResolvedValue(newSeat)
    db.pick.upsert.mockResolvedValue({
      id: 'pick1', userId: MEMBER_ID, seatId: NEW_SEAT_ID, raceId: RACE_ID,
      seat: newSeat, race,
    } as any)

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: NEW_SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(response.status).toBe(201)
    expect(db.pick.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leagueId_userId_raceId: { leagueId: LEAGUE_ID, userId: MEMBER_ID, raceId: RACE_ID } },
        update: { seatId: NEW_SEAT_ID },
      }),
    )
  })

  it('returns 403 for a league member without admin role', async () => {
    mockAsUser('regular-user')
    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' })

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(response.status).toBe(403)
    expect(db.pick.upsert).not.toHaveBeenCalled()
  })

  it('returns 403 for a user who is not in the league at all', async () => {
    mockAsUser('outsider')
    db.leagueMember.findUnique.mockResolvedValue(null)

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(response.status).toBe(403)
    expect(db.pick.upsert).not.toHaveBeenCalled()
  })

  it('returns 404 when the target user is not a member of the league', async () => {
    mockAsAdmin()
    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' }) // admin is valid
      .mockResolvedValueOnce(null)              // target is not a member
    db.race.findUnique.mockResolvedValue(makeRace({ id: RACE_ID }))

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toContain('not a member')
  })

  it('returns 404 for a non-existent race', async () => {
    mockAsAdmin()
    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ role: 'MEMBER' })
    db.race.findUnique.mockResolvedValue(null)

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toContain('Race not found')
  })

  it('returns 400 when the seat belongs to a different season than the race', async () => {
    mockAsAdmin()
    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ role: 'MEMBER' })
    db.race.findUnique.mockResolvedValue(makeRace({ id: RACE_ID, seasonYear: 2026 }))
    db.seat.findUnique.mockResolvedValue(makeSeat({ id: SEAT_ID, seasonYear: 2025 })) // wrong season

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid seat')
  })

  it('returns 400 when a required field is missing', async () => {
    mockAsAdmin()
    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' })

    const response = await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID }), // seatId missing
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(response.status).toBe(400)
    expect(db.pick.upsert).not.toHaveBeenCalled()
  })

  it('recalculates scores immediately when results are already ingested for the race', async () => {
    mockAsAdmin()
    const race = makeRace({ id: RACE_ID, seasonYear: 2026 })
    const seat = makeSeat({ id: SEAT_ID, seasonYear: 2026 })

    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ role: 'MEMBER' })
    db.race.findUnique.mockResolvedValue(race)
    db.seat.findUnique.mockResolvedValue(seat)
    db.pick.upsert.mockResolvedValue({
      id: 'pick1', userId: MEMBER_ID, seatId: SEAT_ID, raceId: RACE_ID, seat, race,
    } as any)
    db.raceResult.count.mockResolvedValue(20) // results already exist

    await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(mockCalculateScores).toHaveBeenCalledWith(RACE_ID)
  })

  it('skips recalculation when no results have been ingested yet', async () => {
    mockAsAdmin()
    const race = makeRace({ id: RACE_ID, seasonYear: 2026 })
    const seat = makeSeat({ id: SEAT_ID, seasonYear: 2026 })

    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' })
      .mockResolvedValueOnce({ role: 'MEMBER' })
    db.race.findUnique.mockResolvedValue(race)
    db.seat.findUnique.mockResolvedValue(seat)
    db.pick.upsert.mockResolvedValue({
      id: 'pick1', userId: MEMBER_ID, seatId: SEAT_ID, raceId: RACE_ID, seat, race,
    } as any)
    db.raceResult.count.mockResolvedValue(0) // no results yet

    await POST(
      makeRequest({ userId: MEMBER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
      { params: Promise.resolve({ id: LEAGUE_ID }) },
    )

    expect(mockCalculateScores).not.toHaveBeenCalled()
  })
})
