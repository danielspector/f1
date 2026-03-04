/**
 * Tests for League Management API routes
 * Covers:
 *   FR-02: Any user can create a league and receive a shareable invite link
 *   FR-03: Users who click the invite link can join the league after authenticating
 *   FR-13: League admins can add/remove players, rename the league, and promote other members to admin
 *   FR-14: Leagues are archived at the end of the season and can be renewed for the next season
 *   FR-15: Players can be members of multiple leagues simultaneously
 *   FR-16: Players who join mid-season start with zero points and a full driver pool
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireSession } from '@/lib/auth-helpers'
import { db } from './prisma-mock'

const mockRequireSession = requireSession as any

function mockAuthenticatedUser(userId: string) {
  mockRequireSession.mockResolvedValue({
    session: { user: { id: userId, email: `${userId}@test.com` } } as any,
    error: null,
  })
}

describe('POST /api/leagues (Create League)', () => {
  let POST: (request: Request) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/leagues/route')
    POST = mod.POST
  })

  // FR-02: Any user can create a league and receive a shareable invite link
  it('creates a league with an invite code', async () => {
    mockAuthenticatedUser('user1')
    db.user.findUnique.mockResolvedValue({ id: 'user1' } as any)

    db.league.create.mockResolvedValue({
      id: 'league1',
      name: 'My League',
      inviteCode: 'uuid-invite-code',
      seasonYear: 2026,
      status: 'ACTIVE',
      createdById: 'user1',
    } as any)

    const request = new Request('http://localhost/api/leagues', {
      method: 'POST',
      body: JSON.stringify({ name: 'My League', seasonYear: 2026 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body.name).toBe('My League')
    expect(body.inviteCode).toBeDefined()
    expect(body.inviteCode.length).toBeGreaterThan(0)
  })

  it('creates the league creator as ADMIN member', async () => {
    mockAuthenticatedUser('user1')
    db.user.findUnique.mockResolvedValue({ id: 'user1' } as any)
    db.league.create.mockResolvedValue({ id: 'l1' } as any)

    const request = new Request('http://localhost/api/leagues', {
      method: 'POST',
      body: JSON.stringify({ name: 'League', seasonYear: 2026 }),
    })

    await POST(request)

    const createCall = db.league.create.mock.calls[0][0] as any
    expect(createCall.data.createdById).toBe('user1')
    expect(createCall.data.members.create.role).toBe('ADMIN')
    expect(createCall.data.members.create.userId).toBe('user1')
  })

  it('returns 401 for unauthenticated users', async () => {
    mockRequireSession.mockResolvedValue({
      session: null,
      error: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    } as any)

    const request = new Request('http://localhost/api/leagues', {
      method: 'POST',
      body: JSON.stringify({ name: 'League', seasonYear: 2026 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 401 when session user no longer exists in the database', async () => {
    mockAuthenticatedUser('deleted-user')
    db.user.findUnique.mockResolvedValue(null) // user was deleted but JWT still valid

    const request = new Request('http://localhost/api/leagues', {
      method: 'POST',
      body: JSON.stringify({ name: 'My League', seasonYear: 2026 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toContain('User not found')
    expect(db.league.create).not.toHaveBeenCalled()
  })

  it('rejects invalid league data', async () => {
    mockAuthenticatedUser('user1')

    const request = new Request('http://localhost/api/leagues', {
      method: 'POST',
      body: JSON.stringify({ name: '', seasonYear: 2026 }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })
})

describe('POST /api/leagues/join (Join League)', () => {
  let POST: (request: Request) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/leagues/join/route')
    POST = mod.POST
  })

  // FR-03: Users who click the invite link can join the league
  it('allows a user to join a league via invite code', async () => {
    mockAuthenticatedUser('user1')

    db.league.findUnique.mockResolvedValue({
      id: 'league1',
      name: 'Cool League',
      status: 'ACTIVE',
      inviteCode: 'invite123',
    } as any)
    db.leagueMember.findUnique.mockResolvedValue(null) // not already a member
    db.leagueMember.create.mockResolvedValue({} as any)

    const request = new Request('http://localhost/api/leagues/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'invite123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.leagueId).toBe('league1')
    expect(body.leagueName).toBe('Cool League')
  })

  it('joins as MEMBER role (not ADMIN)', async () => {
    mockAuthenticatedUser('user1')

    db.league.findUnique.mockResolvedValue({
      id: 'league1',
      name: 'L',
      status: 'ACTIVE',
    } as any)
    db.leagueMember.findUnique.mockResolvedValue(null)
    db.leagueMember.create.mockResolvedValue({} as any)

    const request = new Request('http://localhost/api/leagues/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'code' }),
    })

    await POST(request)

    const createCall = db.leagueMember.create.mock.calls[0][0] as any
    expect(createCall.data.role).toBe('MEMBER')
  })

  // FR-16: Players who join mid-season start with zero points and a full driver pool
  it('new members start with no existing picks or scores (full pool)', async () => {
    mockAuthenticatedUser('newuser')

    db.league.findUnique.mockResolvedValue({
      id: 'league1',
      name: 'L',
      status: 'ACTIVE',
    } as any)
    db.leagueMember.findUnique.mockResolvedValue(null)
    db.leagueMember.create.mockResolvedValue({} as any)

    const request = new Request('http://localhost/api/leagues/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'code' }),
    })

    await POST(request)

    // Joining only creates the membership record
    // No picks or scores are created — user starts with zero points
    expect(db.pick.create).not.toHaveBeenCalled()
    expect(db.playerScore.create).not.toHaveBeenCalled()
  })

  it('returns 404 for invalid invite code', async () => {
    mockAuthenticatedUser('user1')
    db.league.findUnique.mockResolvedValue(null)

    const request = new Request('http://localhost/api/leagues/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'nonexistent' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(404)
  })

  it('rejects joining an archived league', async () => {
    mockAuthenticatedUser('user1')
    db.league.findUnique.mockResolvedValue({
      id: 'league1',
      status: 'ARCHIVED',
    } as any)

    const request = new Request('http://localhost/api/leagues/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'code' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  // FR-15: Players can be members of multiple leagues simultaneously
  it('is idempotent — re-joining returns success without creating duplicate membership', async () => {
    mockAuthenticatedUser('user1')

    db.league.findUnique.mockResolvedValue({
      id: 'league1',
      name: 'L',
      status: 'ACTIVE',
    } as any)
    db.leagueMember.findUnique.mockResolvedValue({ id: 'existing' } as any)

    const request = new Request('http://localhost/api/leagues/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode: 'code' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(db.leagueMember.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/leagues/[id] (Rename League)', () => {
  let PATCH: (request: Request, context: any) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/leagues/[id]/route')
    PATCH = mod.PATCH
  })

  // FR-13: League admins can rename the league
  it('allows admin to rename the league', async () => {
    mockAuthenticatedUser('admin1')

    db.leagueMember.findUnique.mockResolvedValue({
      role: 'ADMIN',
      userId: 'admin1',
    } as any)
    db.league.update.mockResolvedValue({
      id: 'league1',
      name: 'New Name',
    } as any)

    const request = new Request('http://localhost/api/leagues/league1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'league1' }) })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.name).toBe('New Name')
  })

  it('rejects rename from non-admin member', async () => {
    mockAuthenticatedUser('member1')

    db.leagueMember.findUnique.mockResolvedValue({
      role: 'MEMBER',
    } as any)

    const request = new Request('http://localhost/api/leagues/league1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hack' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'league1' }) })
    expect(response.status).toBe(403)
  })

  it('rejects rename from non-member', async () => {
    mockAuthenticatedUser('outsider')
    db.leagueMember.findUnique.mockResolvedValue(null)

    const request = new Request('http://localhost/api/leagues/league1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Hack' }),
    })

    const response = await PATCH(request, { params: Promise.resolve({ id: 'league1' }) })
    expect(response.status).toBe(403)
  })
})

describe('Member Management - DELETE/PATCH /api/leagues/[id]/members/[userId]', () => {
  let DELETE: (request: Request, context: any) => Promise<Response>
  let PATCH: (request: Request, context: any) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/leagues/[id]/members/[userId]/route')
    DELETE = mod.DELETE
    PATCH = mod.PATCH
  })

  // FR-13: League admins can remove players
  it('allows admin to remove a member', async () => {
    mockAuthenticatedUser('admin1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' } as any)
    db.leagueMember.delete.mockResolvedValue({} as any)

    const request = new Request('http://localhost/api/leagues/l1/members/user2', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'l1', userId: 'user2' }),
    })
    expect(response.status).toBe(200)
  })

  it('prevents removing the last admin', async () => {
    mockAuthenticatedUser('admin1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' } as any)
    db.leagueMember.count.mockResolvedValue(1)

    const request = new Request('http://localhost/api/leagues/l1/members/admin1', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'l1', userId: 'admin1' }),
    })
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('last admin')
  })

  it('prevents non-admin from removing members', async () => {
    mockAuthenticatedUser('member1')
    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)

    const request = new Request('http://localhost/api/leagues/l1/members/user2', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'l1', userId: 'user2' }),
    })
    expect(response.status).toBe(403)
  })

  // FR-13: League admins can promote other members to admin
  it('allows admin to promote a member to admin', async () => {
    mockAuthenticatedUser('admin1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' } as any)
    db.leagueMember.update.mockResolvedValue({ role: 'ADMIN', userId: 'user2' } as any)

    const request = new Request('http://localhost/api/leagues/l1/members/user2', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'ADMIN' }),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'l1', userId: 'user2' }),
    })
    expect(response.status).toBe(200)
  })

  it('prevents demoting the last admin', async () => {
    mockAuthenticatedUser('admin1')

    // First call: verify requester is admin
    // Second call: find target member is admin too
    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' } as any) // requester check
      .mockResolvedValueOnce({ role: 'ADMIN' } as any) // target member check
    db.leagueMember.count.mockResolvedValue(1) // only 1 admin

    const request = new Request('http://localhost/api/leagues/l1/members/admin1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'MEMBER' }),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'l1', userId: 'admin1' }),
    })
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('last admin')
  })

  it('supports multiple admins per league', async () => {
    mockAuthenticatedUser('admin1')

    // Two admins exist — safe to demote one
    db.leagueMember.findUnique
      .mockResolvedValueOnce({ role: 'ADMIN' } as any)
      .mockResolvedValueOnce({ role: 'ADMIN' } as any)
    db.leagueMember.count.mockResolvedValue(2) // 2 admins
    db.leagueMember.update.mockResolvedValue({ role: 'MEMBER' } as any)

    const request = new Request('http://localhost/api/leagues/l1/members/admin2', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'MEMBER' }),
    })

    const response = await PATCH(request, {
      params: Promise.resolve({ id: 'l1', userId: 'admin2' }),
    })
    expect(response.status).toBe(200)
  })
})

describe('POST /api/leagues/[id]/archive', () => {
  let POST: (request: Request, context: any) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/leagues/[id]/archive/route')
    POST = mod.POST
  })

  // FR-14: Leagues are archived at the end of the season
  it('allows admin to archive a league', async () => {
    mockAuthenticatedUser('admin1')
    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' } as any)
    db.league.update.mockResolvedValue({
      id: 'l1',
      status: 'ARCHIVED',
    } as any)

    const request = new Request('http://localhost/api/leagues/l1/archive', {
      method: 'POST',
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.status).toBe('ARCHIVED')
  })

  it('rejects archive from non-admin', async () => {
    mockAuthenticatedUser('member1')
    db.leagueMember.findUnique.mockResolvedValue({ role: 'MEMBER' } as any)

    const request = new Request('http://localhost/api/leagues/l1/archive', {
      method: 'POST',
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(403)
  })
})

describe('POST /api/leagues/[id]/renew', () => {
  let POST: (request: Request, context: any) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/leagues/[id]/renew/route')
    POST = mod.POST
  })

  // FR-14: Leagues can be renewed for the next season
  it('creates a new league with same members from archived league', async () => {
    mockAuthenticatedUser('admin1')

    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' } as any)
    db.league.findUnique.mockResolvedValue({
      id: 'old_league',
      name: 'My League',
      status: 'ARCHIVED',
      createdById: 'admin1',
      members: [
        { userId: 'admin1', role: 'ADMIN' },
        { userId: 'user2', role: 'MEMBER' },
      ],
    } as any)

    db.league.findFirst.mockResolvedValue(null) // no existing renewal
    db.league.create.mockResolvedValue({
      id: 'new_league',
      name: 'My League',
      seasonYear: 2027,
      status: 'ACTIVE',
    } as any)

    const request = new Request('http://localhost/api/leagues/old_league/renew', {
      method: 'POST',
      body: JSON.stringify({ seasonYear: 2027 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'old_league' }) })
    expect(response.status).toBe(201)

    // Verify all members are carried over
    const createCall = db.league.create.mock.calls[0][0] as any
    expect(createCall.data.members.createMany.data).toHaveLength(2)
    expect(createCall.data.members.createMany.data).toContainEqual({
      userId: 'admin1',
      role: 'ADMIN',
    })
    expect(createCall.data.members.createMany.data).toContainEqual({
      userId: 'user2',
      role: 'MEMBER',
    })
  })

  it('rejects renewal of a league that is not archived', async () => {
    mockAuthenticatedUser('admin1')
    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' } as any)
    db.league.findUnique.mockResolvedValue({
      id: 'l1',
      status: 'ACTIVE',
      members: [],
    } as any)

    const request = new Request('http://localhost/api/leagues/l1/renew', {
      method: 'POST',
      body: JSON.stringify({ seasonYear: 2027 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    expect(response.status).toBe(400)
  })

  it('returns existing league if already renewed for that season', async () => {
    mockAuthenticatedUser('admin1')
    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' } as any)
    db.league.findUnique.mockResolvedValue({
      id: 'l1',
      name: 'League',
      status: 'ARCHIVED',
      createdById: 'admin1',
      members: [],
    } as any)
    db.league.findFirst.mockResolvedValue({ id: 'renewed_l1' } as any)

    const request = new Request('http://localhost/api/leagues/l1/renew', {
      method: 'POST',
      body: JSON.stringify({ seasonYear: 2027 }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: 'l1' }) })
    const body = await response.json()
    expect(body.leagueId).toBe('renewed_l1')
    expect(body.alreadyExists).toBe(true)
  })
})
