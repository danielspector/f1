/**
 * Tests for Pick submission and retrieval API routes
 * Covers:
 *   FR-04: Each player must select one driver seat per race weekend before FP1 begins
 *   FR-05: Picks are hidden from other league members until the FP1 deadline passes
 *   FR-06: Players who miss the FP1 deadline receive zero points for that race week
 *   FR-07: A player cannot reuse a driver seat until they have used every seat on the grid
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requireSession } from '@/lib/auth-helpers'
import { makeRace, makeSeat, makePick, makeFullGrid } from './helpers'
import { db } from './prisma-mock'

const mockRequireSession = requireSession as any

// Mock pickService
vi.mock('@/services/pickService', () => ({
  getAvailableSeats: vi.fn(),
}))
import { getAvailableSeats } from '@/services/pickService'
const mockGetAvailableSeats = vi.mocked(getAvailableSeats)

// Valid CUID-like IDs that pass z.string().cuid() validation
const RACE_ID = 'cm5abc123def456ghi789'
const SEAT_ID = 'cm5xyz789abc123def456'
const NEW_SEAT_ID = 'cm5new789abc123def999'

function mockAuthenticatedUser(userId: string) {
  mockRequireSession.mockResolvedValue({
    session: { user: { id: userId } } as any,
    error: null,
  })
}

describe('POST /api/leagues/[id]/picks (Submit Pick)', () => {
  let POST: (request: Request, context: any) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const mod = await import('@/app/api/leagues/[id]/picks/route')
    POST = mod.POST
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // FR-04: Player must select one driver seat per race weekend before FP1
  it('allows pick submission before FP1 deadline', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z')) // 1.5 hours before FP1
    mockAuthenticatedUser('user1')

    // Create a seat with a valid CUID-format ID
    const seatWithValidId = makeSeat({
      id: SEAT_ID,
      driverName: 'Norris',
      driverCode: 'NOR',
      teamName: 'McLaren',
    })
    const fullGrid = [seatWithValidId, ...makeFullGrid().slice(1)]

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    )
    db.pick.findUnique.mockResolvedValue(null) // no existing pick

    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: fullGrid,
      currentPickSeatId: null,
    })

    db.pick.upsert.mockResolvedValue({
      id: 'pick1',
      seatId: SEAT_ID,
      raceId: RACE_ID,
      seat: seatWithValidId,
      race: makeRace({ id: RACE_ID }),
    } as any)

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(201)
  })

  // FR-04: Picks locked at FP1 deadline
  it('rejects pick submission after FP1 deadline', async () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z')) // 30 minutes after FP1
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    )

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('deadline has passed')
  })

  it('rejects pick at exactly FP1 deadline time', async () => {
    vi.setSystemTime(new Date('2026-03-14T11:30:00Z')) // exactly at FP1
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    )

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(400)
  })

  // Changing a pick before deadline
  it('allows changing an existing pick to a different driver before the deadline', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    const originalSeat = makeSeat({ id: SEAT_ID, driverName: 'Norris', driverCode: 'NOR', teamName: 'McLaren' })
    const newSeat = makeSeat({ id: NEW_SEAT_ID, driverName: 'Piastri', driverCode: 'PIA', teamName: 'McLaren' })
    const fullGrid = [originalSeat, newSeat, ...makeFullGrid().slice(2)]

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    )
    // User already has a pick for this race — all seats available for changing
    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: fullGrid,
      currentPickSeatId: SEAT_ID,
    })
    db.pick.upsert.mockResolvedValue({
      id: 'pick1',
      seatId: NEW_SEAT_ID,
      raceId: RACE_ID,
      seat: newSeat,
      race: makeRace({ id: RACE_ID }),
    } as any)

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: NEW_SEAT_ID }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body.seatId).toBe(NEW_SEAT_ID)
    expect(db.pick.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { leagueId_userId_raceId: { leagueId: 'l1', userId: 'user1', raceId: RACE_ID } },
        update: { seatId: NEW_SEAT_ID, chip: null },
      }),
    )
  })

  it('rejects changing a pick to a seat used in a prior race', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    )
    // SEAT_ID was used in a prior race — not in available list
    const otherSeat = makeSeat({ id: NEW_SEAT_ID })
    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: [otherSeat],
      currentPickSeatId: NEW_SEAT_ID,
    })

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID }), // SEAT_ID not available
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('not available')
  })

  // FR-07: A player cannot reuse a driver seat
  it('rejects pick for a seat that has already been used', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    )
    db.pick.findUnique.mockResolvedValue(null)

    // Seat not in available list (already used)
    const availableSeat = makeSeat({ id: 'cm5availableseatid00000' })
    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: [availableSeat],
      currentPickSeatId: null,
    })

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID }), // SEAT_ID not in available list
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('not available')
  })

  it('rejects pick from non-member', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('outsider')

    db.leagueMember.findUnique.mockResolvedValue(null) // not a member

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(403)
  })

  it('rejects pick for non-existent race', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(null)

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(404)
  })

  // Chip validation tests
  it('rejects chip when league has chips disabled', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    )
    db.league.findUnique.mockResolvedValue({ id: 'l1', chipsEnabled: false } as any)

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID, chip: 'DOUBLE_POINTS' }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('not enabled')
  })

  it('rejects chip already used in another race this season', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z'), seasonYear: 2026 }),
    )
    db.league.findUnique.mockResolvedValue({ id: 'l1', chipsEnabled: true } as any)
    // Chip was already used on a different race
    db.pick.findFirst.mockResolvedValue({ id: 'old-pick', chip: 'DOUBLE_POINTS' } as any)

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID, chip: 'DOUBLE_POINTS' }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('already used')
  })

  it('allows chip submission when league has chips enabled and chip not yet used', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    const seatWithValidId = makeSeat({ id: SEAT_ID, driverName: 'Norris', driverCode: 'NOR', teamName: 'McLaren' })
    const fullGrid = [seatWithValidId, ...makeFullGrid().slice(1)]

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z'), seasonYear: 2026 }),
    )
    db.league.findUnique.mockResolvedValue({ id: 'l1', chipsEnabled: true } as any)
    db.pick.findFirst.mockResolvedValue(null) // chip not yet used

    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: fullGrid,
      currentPickSeatId: null,
    })

    db.pick.upsert.mockResolvedValue({
      id: 'pick1', seatId: SEAT_ID, raceId: RACE_ID, chip: 'DOUBLE_POINTS',
      seat: seatWithValidId, race: makeRace({ id: RACE_ID }),
    } as any)

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID, chip: 'DOUBLE_POINTS' }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(201)

    expect(db.pick.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ chip: 'DOUBLE_POINTS' }),
        update: expect.objectContaining({ chip: 'DOUBLE_POINTS' }),
      }),
    )
  })

  it('saves chip on an existing pick without changing driver', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    const seatWithValidId = makeSeat({ id: SEAT_ID, driverName: 'Norris', driverCode: 'NOR', teamName: 'McLaren' })
    const fullGrid = [seatWithValidId, ...makeFullGrid().slice(1)]

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z'), seasonYear: 2026 }),
    )
    db.league.findUnique.mockResolvedValue({ id: 'l1', chipsEnabled: true } as any)
    db.pick.findFirst.mockResolvedValue(null) // chip not yet used

    // User already has a pick with this seat — re-submitting same seat with a chip
    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: fullGrid,
      currentPickSeatId: SEAT_ID,
    })

    db.pick.upsert.mockResolvedValue({
      id: 'pick1', seatId: SEAT_ID, raceId: RACE_ID, chip: 'DOUBLE_POINTS',
      seat: seatWithValidId, race: makeRace({ id: RACE_ID }),
    } as any)

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID, chip: 'DOUBLE_POINTS' }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(201)

    expect(db.pick.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ seatId: SEAT_ID, chip: 'DOUBLE_POINTS' }),
        create: expect.objectContaining({ seatId: SEAT_ID, chip: 'DOUBLE_POINTS' }),
      }),
    )
  })

  it('allows pick with null chip (clears chip)', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    const seatWithValidId = makeSeat({ id: SEAT_ID })
    const fullGrid = [seatWithValidId, ...makeFullGrid().slice(1)]

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: RACE_ID, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    )

    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: fullGrid,
      currentPickSeatId: null,
    })

    db.pick.upsert.mockResolvedValue({
      id: 'pick1', seatId: SEAT_ID, raceId: RACE_ID, chip: null,
      seat: seatWithValidId, race: makeRace({ id: RACE_ID }),
    } as any)

    const request = new Request('http://localhost/api/leagues/l1/picks', {
      method: 'POST',
      body: JSON.stringify({ raceId: RACE_ID, seatId: SEAT_ID, chip: null }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(201)

    expect(db.pick.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ chip: null }),
        update: expect.objectContaining({ chip: null }),
      }),
    )
  })
})

describe('GET /api/leagues/[id]/picks (Retrieve Picks)', () => {
  let GET: (request: Request, context: any) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const mod = await import('@/app/api/leagues/[id]/picks/route')
    GET = mod.GET
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // FR-05: Picks are hidden from other league members until the FP1 deadline passes
  it('hides other members picks before FP1 deadline', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z')) // before deadline
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.league.findUnique.mockResolvedValue({ id: 'l1', chipsEnabled: false } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: 'race1', fp1Deadline: new Date('2026-03-14T11:30:00Z'), seasonYear: 2026 }),
    )

    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: makeFullGrid(),
      currentPickSeatId: null,
    })

    const fullGrid = makeFullGrid()
    db.seat.findMany.mockResolvedValue(fullGrid)

    const request = new Request('http://localhost/api/leagues/l1/picks?raceId=race1', {
      method: 'GET',
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.deadlinePassed).toBe(false)
    expect(body.allPicks).toBeNull() // other picks hidden
  })

  // FR-05: Picks revealed after FP1
  it('reveals all picks after FP1 deadline', async () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z')) // after deadline
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.league.findUnique.mockResolvedValue({ id: 'l1', chipsEnabled: false } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: 'race1', fp1Deadline: new Date('2026-03-14T11:30:00Z'), seasonYear: 2026 }),
    )

    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: makeFullGrid(),
      currentPickSeatId: 'seat1',
    })

    const fullGrid = makeFullGrid()
    db.seat.findMany.mockResolvedValue(fullGrid)

    const allPicks = [
      {
        ...makePick({ userId: 'user1', seatId: 'seat1' }),
        user: { id: 'user1', name: 'P1', email: 'p1@test.com' },
        seat: fullGrid[0],
        score: null,
      },
      {
        ...makePick({ userId: 'user2', seatId: 'seat2' }),
        user: { id: 'user2', name: 'P2', email: 'p2@test.com' },
        seat: fullGrid[1],
        score: null,
      },
    ]
    db.pick.findMany.mockResolvedValue(allPicks as any)

    const request = new Request('http://localhost/api/leagues/l1/picks?raceId=race1', {
      method: 'GET',
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.deadlinePassed).toBe(true)
    expect(body.allPicks).toBeDefined()
    expect(body.allPicks).toHaveLength(2) // all picks revealed
  })

  it('returns chipsEnabled in response', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('user1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)
    db.league.findUnique.mockResolvedValue({ id: 'l1', chipsEnabled: true } as any)
    db.race.findUnique.mockResolvedValue(
      makeRace({ id: 'race1', fp1Deadline: new Date('2026-03-14T11:30:00Z'), seasonYear: 2026 }),
    )

    mockGetAvailableSeats.mockResolvedValue({
      availableSeats: makeFullGrid(),
      currentPickSeatId: null,
    })

    db.seat.findMany.mockResolvedValue(makeFullGrid())

    const request = new Request('http://localhost/api/leagues/l1/picks?raceId=race1')

    const response = await GET(request, { params: Promise.resolve({ id: 'l1' }) })
    const body = await response.json()
    expect(body.chipsEnabled).toBe(true)
  })

  it('returns 403 for non-members', async () => {
    vi.setSystemTime(new Date('2026-03-14T10:00:00Z'))
    mockAuthenticatedUser('outsider')
    db.leagueMember.findUnique.mockResolvedValue(null)

    const request = new Request('http://localhost/api/leagues/l1/picks?raceId=race1', {
      method: 'GET',
    })

    const response = await GET(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(403)
  })
})
