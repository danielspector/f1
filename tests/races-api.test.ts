/**
 * Tests for Races API route
 * Covers:
 *   - Race status determination (picking_open, locked, results_in)
 *   - All future races before FP1 deadline are open for picking
 *   - Races with results show results_in status
 *   - Races past FP1 deadline show locked status
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { requireSession } from '@/lib/auth-helpers'
import { db } from './prisma-mock'

const mockRequireSession = requireSession as any

function mockAuthenticatedUser(userId: string) {
  mockRequireSession.mockResolvedValue({
    session: { user: { id: userId } } as any,
    error: null,
  })
}

describe('GET /api/races (Race Status)', () => {
  let GET: (request: Request) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    const mod = await import('@/app/api/races/route')
    GET = mod.GET
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks a race as picking_open when FP1 is in the future (even > 7 days away)', async () => {
    vi.setSystemTime(new Date('2026-03-01T00:00:00Z'))
    mockAuthenticatedUser('user1')

    db.race.findMany.mockResolvedValue([
      {
        id: 'r1',
        seasonYear: 2026,
        round: 1,
        name: 'Bahrain GP',
        circuit: 'Bahrain International Circuit',
        fp1Deadline: new Date('2026-03-14T11:30:00Z'), // 13 days away
        raceDatetime: new Date('2026-03-16T15:00:00Z'),
        results: [],
      },
    ])

    const request = new Request('http://localhost/api/races')
    const response = await GET(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body).toHaveLength(1)
    expect(body[0].status).toBe('picking_open')
  })

  it('marks a race as picking_open when FP1 is within 7 days', async () => {
    vi.setSystemTime(new Date('2026-03-10T00:00:00Z'))
    mockAuthenticatedUser('user1')

    db.race.findMany.mockResolvedValue([
      {
        id: 'r1',
        seasonYear: 2026,
        round: 1,
        name: 'Bahrain GP',
        circuit: 'Bahrain International Circuit',
        fp1Deadline: new Date('2026-03-14T11:30:00Z'), // 4 days away
        raceDatetime: new Date('2026-03-16T15:00:00Z'),
        results: [],
      },
    ])

    const request = new Request('http://localhost/api/races')
    const response = await GET(request)
    const body = await response.json()
    expect(body[0].status).toBe('picking_open')
  })

  it('marks a race as locked when FP1 has passed but no results yet', async () => {
    vi.setSystemTime(new Date('2026-03-14T12:00:00Z'))
    mockAuthenticatedUser('user1')

    db.race.findMany.mockResolvedValue([
      {
        id: 'r1',
        seasonYear: 2026,
        round: 1,
        name: 'Bahrain GP',
        circuit: 'Bahrain International Circuit',
        fp1Deadline: new Date('2026-03-14T11:30:00Z'), // 30 min ago
        raceDatetime: new Date('2026-03-16T15:00:00Z'),
        results: [],
      },
    ])

    const request = new Request('http://localhost/api/races')
    const response = await GET(request)
    const body = await response.json()
    expect(body[0].status).toBe('locked')
  })

  it('marks a race as locked at exactly FP1 deadline time', async () => {
    vi.setSystemTime(new Date('2026-03-14T11:30:00Z'))
    mockAuthenticatedUser('user1')

    db.race.findMany.mockResolvedValue([
      {
        id: 'r1',
        seasonYear: 2026,
        round: 1,
        name: 'Bahrain GP',
        circuit: 'Bahrain International Circuit',
        fp1Deadline: new Date('2026-03-14T11:30:00Z'),
        raceDatetime: new Date('2026-03-16T15:00:00Z'),
        results: [],
      },
    ])

    const request = new Request('http://localhost/api/races')
    const response = await GET(request)
    const body = await response.json()
    expect(body[0].status).toBe('locked')
  })

  it('marks a race as results_in when results exist', async () => {
    vi.setSystemTime(new Date('2026-03-17T00:00:00Z'))
    mockAuthenticatedUser('user1')

    db.race.findMany.mockResolvedValue([
      {
        id: 'r1',
        seasonYear: 2026,
        round: 1,
        name: 'Bahrain GP',
        circuit: 'Bahrain International Circuit',
        fp1Deadline: new Date('2026-03-14T11:30:00Z'),
        raceDatetime: new Date('2026-03-16T15:00:00Z'),
        results: [{ id: 'result1' }],
      },
    ])

    const request = new Request('http://localhost/api/races')
    const response = await GET(request)
    const body = await response.json()
    expect(body[0].status).toBe('results_in')
  })

  it('results_in takes priority over locked (results exist even though FP1 passed)', async () => {
    vi.setSystemTime(new Date('2026-03-16T20:00:00Z'))
    mockAuthenticatedUser('user1')

    db.race.findMany.mockResolvedValue([
      {
        id: 'r1',
        seasonYear: 2026,
        round: 1,
        name: 'Bahrain GP',
        circuit: 'Bahrain International Circuit',
        fp1Deadline: new Date('2026-03-14T11:30:00Z'),
        raceDatetime: new Date('2026-03-16T15:00:00Z'),
        results: [{ id: 'result1' }],
      },
    ])

    const request = new Request('http://localhost/api/races')
    const response = await GET(request)
    const body = await response.json()
    expect(body[0].status).toBe('results_in')
  })

  it('correctly assigns statuses across multiple races in different states', async () => {
    vi.setSystemTime(new Date('2026-03-17T00:00:00Z'))
    mockAuthenticatedUser('user1')

    db.race.findMany.mockResolvedValue([
      {
        id: 'r1',
        seasonYear: 2026,
        round: 1,
        name: 'Bahrain GP',
        circuit: 'Bahrain International Circuit',
        fp1Deadline: new Date('2026-03-14T11:30:00Z'),
        raceDatetime: new Date('2026-03-16T15:00:00Z'),
        results: [{ id: 'result1' }],
      },
      {
        id: 'r2',
        seasonYear: 2026,
        round: 2,
        name: 'Saudi GP',
        circuit: 'Jeddah Corniche Circuit',
        fp1Deadline: new Date('2026-03-21T13:30:00Z'), // 4 days away
        raceDatetime: new Date('2026-03-23T17:00:00Z'),
        results: [],
      },
      {
        id: 'r3',
        seasonYear: 2026,
        round: 3,
        name: 'Australian GP',
        circuit: 'Albert Park',
        fp1Deadline: new Date('2026-04-11T01:30:00Z'), // 25 days away
        raceDatetime: new Date('2026-04-13T05:00:00Z'),
        results: [],
      },
    ])

    const request = new Request('http://localhost/api/races')
    const response = await GET(request)
    const body = await response.json()

    expect(body[0].status).toBe('results_in')    // r1: past with results
    expect(body[1].status).toBe('picking_open')   // r2: FP1 4 days away
    expect(body[2].status).toBe('picking_open')   // r3: FP1 25 days away — still open
  })

  it('does not include the upcoming status for any race', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    mockAuthenticatedUser('user1')

    db.race.findMany.mockResolvedValue([
      {
        id: 'r1',
        seasonYear: 2026,
        round: 1,
        name: 'Bahrain GP',
        circuit: 'Bahrain International Circuit',
        fp1Deadline: new Date('2026-03-14T11:30:00Z'), // 72 days away
        raceDatetime: new Date('2026-03-16T15:00:00Z'),
        results: [],
      },
    ])

    const request = new Request('http://localhost/api/races')
    const response = await GET(request)
    const body = await response.json()
    expect(body[0].status).toBe('picking_open')
    expect(body[0].status).not.toBe('upcoming')
  })
})
