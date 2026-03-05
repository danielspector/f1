/**
 * Tests for super admin functionality:
 *   - requireSuperAdmin() auth helper
 *   - GET /api/admin/users
 *   - GET /api/admin/leagues
 *   - GET /api/admin/leagues/[id]
 *   - GET /api/dashboard returns isSuperAdmin flag
 *   - Proxy protects /admin routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireSession, requireSuperAdmin } from '@/lib/auth-helpers'
import { db } from './prisma-mock'
import { makeUser, makeLeague, makeMember, makeRace, makeSeat, makePick } from './helpers'

const mockRequireSession = requireSession as any
const mockRequireSuperAdmin = requireSuperAdmin as any

function mockAuthenticatedUser(userId: string) {
  mockRequireSession.mockResolvedValue({
    session: { user: { id: userId } } as any,
    error: null,
  })
}

function mockSuperAdmin(userId: string) {
  mockRequireSuperAdmin.mockResolvedValue({
    session: { user: { id: userId } } as any,
    error: null,
  })
}

function mock403() {
  const { NextResponse } = require('next/server')
  mockRequireSuperAdmin.mockResolvedValue({
    session: null,
    error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
  })
}

function mock401() {
  const { NextResponse } = require('next/server')
  mockRequireSuperAdmin.mockResolvedValue({
    session: null,
    error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
  })
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/admin/users/route')
    GET = mod.GET
  })

  it('returns 403 for non-super-admin', async () => {
    mock403()

    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 401 for unauthenticated user', async () => {
    mock401()

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns all users for super admin', async () => {
    mockSuperAdmin('admin1')

    const user1 = makeUser({ id: 'u1', email: 'alice@test.com', name: 'Alice' })
    const user2 = makeUser({ id: 'u2', email: 'bob@test.com', name: 'Bob' })

    db.user.findMany.mockResolvedValue([
      { ...user1, isSuperAdmin: true, _count: { leagueMembers: 2 } },
      { ...user2, isSuperAdmin: false, _count: { leagueMembers: 1 } },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveLength(2)
    expect(body[0]).toMatchObject({
      id: 'u1',
      email: 'alice@test.com',
      name: 'Alice',
      isSuperAdmin: true,
      leagueCount: 2,
    })
    expect(body[1]).toMatchObject({
      id: 'u2',
      email: 'bob@test.com',
      isSuperAdmin: false,
      leagueCount: 1,
    })
  })

  it('returns empty array when no users exist', async () => {
    mockSuperAdmin('admin1')
    db.user.findMany.mockResolvedValue([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })
})

// ─── GET /api/admin/leagues ───────────────────────────────────────────────────

describe('GET /api/admin/leagues', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/admin/leagues/route')
    GET = mod.GET
  })

  it('returns 403 for non-super-admin', async () => {
    mock403()

    const res = await GET()
    expect(res.status).toBe(403)
  })

  it('returns all leagues with member counts and creator info', async () => {
    mockSuperAdmin('admin1')

    const league = makeLeague({ id: 'lg1', name: 'My League', createdById: 'creator1' })
    db.league.findMany.mockResolvedValue([
      { ...league, chipsEnabled: true, _count: { members: 5 } },
    ])
    db.user.findMany.mockResolvedValue([
      { id: 'creator1', name: 'Creator Name', email: 'creator@test.com' },
    ])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: 'lg1',
      name: 'My League',
      memberCount: 5,
      createdBy: 'Creator Name',
      chipsEnabled: true,
    })
  })

  it('falls back to email when creator has no name', async () => {
    mockSuperAdmin('admin1')

    const league = makeLeague({ id: 'lg1', createdById: 'creator1' })
    db.league.findMany.mockResolvedValue([
      { ...league, chipsEnabled: false, _count: { members: 1 } },
    ])
    db.user.findMany.mockResolvedValue([
      { id: 'creator1', name: null, email: 'noname@test.com' },
    ])

    const res = await GET()
    const body = await res.json()
    expect(body[0].createdBy).toBe('noname@test.com')
  })

  it('shows Unknown when creator not found', async () => {
    mockSuperAdmin('admin1')

    const league = makeLeague({ id: 'lg1', createdById: 'deleted-user' })
    db.league.findMany.mockResolvedValue([
      { ...league, chipsEnabled: false, _count: { members: 0 } },
    ])
    db.user.findMany.mockResolvedValue([])

    const res = await GET()
    const body = await res.json()
    expect(body[0].createdBy).toBe('Unknown')
  })
})

// ─── GET /api/admin/leagues/[id] ─────────────────────────────────────────────

describe('GET /api/admin/leagues/[id]', () => {
  let GET: (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/admin/leagues/[id]/route')
    GET = mod.GET
  })

  const makeRequest = () => new Request('http://localhost/api/admin/leagues/lg1')

  it('returns 403 for non-super-admin', async () => {
    mock403()

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'lg1' }) })
    expect(res.status).toBe(403)
  })

  it('returns 404 when league not found', async () => {
    mockSuperAdmin('admin1')
    db.league.findUnique.mockResolvedValue(null)

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('League not found')
  })

  it('returns league detail with members and picks', async () => {
    mockSuperAdmin('admin1')

    const user1 = makeUser({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
    const user2 = makeUser({ id: 'u2', name: 'Bob', email: 'bob@test.com' })
    const race = makeRace({ id: 'r1', round: 1, name: 'Bahrain GP' })
    const seat = makeSeat({ driverName: 'Max Verstappen', driverCode: 'VER', teamName: 'Red Bull' })

    db.league.findUnique.mockResolvedValue({
      id: 'lg1',
      name: 'Test League',
      seasonYear: 2026,
      status: 'ACTIVE',
      chipsEnabled: false,
      members: [
        {
          user: { id: 'u1', name: user1.name, email: user1.email },
          role: 'ADMIN',
        },
        {
          user: { id: 'u2', name: user2.name, email: user2.email },
          role: 'MEMBER',
        },
      ],
      scores: [
        { userId: 'u1', pointsEarned: 25, raceId: 'r1' },
        { userId: 'u1', pointsEarned: 18, raceId: 'r2' },
        { userId: 'u2', pointsEarned: 10, raceId: 'r1' },
      ],
      picks: [
        {
          userId: 'u1',
          race: { id: race.id, name: race.name, round: race.round },
          seat: { driverName: seat.driverName, driverCode: seat.driverCode, teamName: seat.teamName },
          score: { pointsEarned: 25 },
        },
        {
          userId: 'u2',
          race: { id: race.id, name: race.name, round: race.round },
          seat: { driverName: seat.driverName, driverCode: seat.driverCode, teamName: seat.teamName },
          score: { pointsEarned: 10 },
        },
      ],
    })

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'lg1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.id).toBe('lg1')
    expect(body.name).toBe('Test League')
    expect(body.members).toHaveLength(2)

    // Alice: 25 + 18 = 43
    const alice = body.members.find((m: any) => m.id === 'u1')
    expect(alice.totalPoints).toBe(43)
    expect(alice.role).toBe('ADMIN')

    // Bob: 10
    const bob = body.members.find((m: any) => m.id === 'u2')
    expect(bob.totalPoints).toBe(10)

    // Picks grouped by user
    expect(body.picks['u1']).toHaveLength(1)
    expect(body.picks['u1'][0].driver.code).toBe('VER')
    expect(body.picks['u1'][0].points).toBe(25)
    expect(body.picks['u2']).toHaveLength(1)
  })

  it('handles league with no picks', async () => {
    mockSuperAdmin('admin1')

    db.league.findUnique.mockResolvedValue({
      id: 'lg1',
      name: 'Empty League',
      seasonYear: 2026,
      status: 'ACTIVE',
      chipsEnabled: false,
      members: [
        { user: { id: 'u1', name: 'Alice', email: 'alice@test.com' }, role: 'ADMIN' },
      ],
      scores: [],
      picks: [],
    })

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'lg1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.members[0].totalPoints).toBe(0)
    expect(Object.keys(body.picks)).toHaveLength(0)
  })
})

// ─── GET /api/dashboard — isSuperAdmin flag ──────────────────────────────────

describe('GET /api/dashboard — isSuperAdmin flag', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()

    // Mock getUpcomingRace
    vi.doMock('@/lib/deadlines', () => ({
      getUpcomingRace: vi.fn().mockReturnValue(null),
    }))

    const mod = await import('@/app/api/dashboard/route')
    GET = mod.GET
  })

  it('returns isSuperAdmin: true for super admin users', async () => {
    mockAuthenticatedUser('admin1')

    db.user.findUnique.mockResolvedValue({ isSuperAdmin: true })
    db.leagueMember.findMany.mockResolvedValue([])
    db.race.findMany.mockResolvedValue([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.isSuperAdmin).toBe(true)
    expect(body.leagues).toEqual([])
  })

  it('returns isSuperAdmin: false for regular users', async () => {
    mockAuthenticatedUser('user1')

    db.user.findUnique.mockResolvedValue({ isSuperAdmin: false })
    db.leagueMember.findMany.mockResolvedValue([])
    db.race.findMany.mockResolvedValue([])

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.isSuperAdmin).toBe(false)
  })

  it('defaults isSuperAdmin to false when user not found', async () => {
    mockAuthenticatedUser('ghost')

    db.user.findUnique.mockResolvedValue(null)
    db.leagueMember.findMany.mockResolvedValue([])
    db.race.findMany.mockResolvedValue([])

    const res = await GET()
    const body = await res.json()

    expect(body.isSuperAdmin).toBe(false)
  })
})

// ─── Proxy: /admin route protection ──────────────────────────────────────────

describe('proxy /admin route protection', () => {
  let proxyCallback: (req: any) => any

  beforeEach(async () => {
    vi.clearAllMocks()
    const { auth } = await import('@/auth')
    const mockAuth = vi.mocked(auth)
    mockAuth.mockImplementation((cb: any) => {
      proxyCallback = cb
      return cb as any
    })
    await import('@/proxy')
  })

  function makeProxyRequest(pathname: string, isLoggedIn: boolean) {
    return {
      nextUrl: { pathname },
      url: `http://localhost:3000${pathname}`,
      auth: isLoggedIn ? { user: { id: 'user1' } } : null,
    }
  }

  it('redirects unauthenticated users from /admin to /login', () => {
    const req = makeProxyRequest('/admin', false)
    const response = proxyCallback(req)
    expect(response?.status).toBe(307)
    expect(response?.headers?.get('location')).toContain('/login')
  })

  it('redirects unauthenticated users from /admin/league/x to /login', () => {
    const req = makeProxyRequest('/admin/league/some-id', false)
    const response = proxyCallback(req)
    expect(response?.status).toBe(307)
    expect(response?.headers?.get('location')).toContain('/login')
  })

  it('allows authenticated users to access /admin', () => {
    const req = makeProxyRequest('/admin', true)
    const response = proxyCallback(req)
    // NextResponse.next() — no redirect
    const location = response?.headers?.get('location')
    expect(location).toBeNull()
  })
})
