/**
 * Tests for the pick-reminder cron route.
 * Covers:
 *   FR-17: Pick reminders are sent to players who have not yet submitted a pick.
 *
 * Enhanced behavior: reminders fire at 8pm New York time on Wednesday and
 * Thursday only, regardless of when the race is. The cron fires at both 00:00
 * and 01:00 UTC; the handler gates on the NY local time so exactly one firing
 * does work across the EST/EDT daylight-saving boundary.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from './prisma-mock'
import { makeRace } from './helpers'

// Mock the notification service so we assert which race is reminded without
// exercising the full email-rendering pipeline.
vi.mock('@/services/notificationService', () => ({
  sendPickReminders: vi.fn().mockResolvedValue(undefined),
}))
import { sendPickReminders } from '@/services/notificationService'
const mockSendPickReminders = vi.mocked(sendPickReminders)

const CRON_SECRET = 'test-cron-secret'

function authedRequest(secret = CRON_SECRET): Request {
  return new Request('https://example.com/api/cron/pick-reminder', {
    headers: { authorization: `Bearer ${secret}` },
  })
}

describe('GET /api/cron/pick-reminder', () => {
  let GET: (request: Request) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    process.env.CRON_SECRET = CRON_SECRET
    const mod = await import('@/app/api/cron/pick-reminder/route')
    GET = mod.GET
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects requests without the cron secret', async () => {
    // 8pm NY (EDT) Wednesday — a valid reminder window, so only auth blocks it.
    vi.setSystemTime(new Date('2026-07-16T00:00:00Z'))

    const res = await GET(new Request('https://example.com/api/cron/pick-reminder'))

    expect(res.status).toBe(401)
    expect(mockSendPickReminders).not.toHaveBeenCalled()
  })

  it('rejects requests with the wrong cron secret', async () => {
    vi.setSystemTime(new Date('2026-07-16T00:00:00Z'))

    const res = await GET(authedRequest('wrong-secret'))

    expect(res.status).toBe(401)
    expect(mockSendPickReminders).not.toHaveBeenCalled()
  })

  it('sends reminders for the next upcoming race at 8pm NY on Wednesday (EDT)', async () => {
    // 2026-07-16T00:00:00Z == Wed 8pm in New York during EDT (UTC-4).
    vi.setSystemTime(new Date('2026-07-16T00:00:00Z'))

    const race = makeRace({ id: 'race-next', fp1Deadline: new Date('2026-07-24T11:30:00Z') })
    db.race.findFirst.mockResolvedValue(race)

    const res = await GET(authedRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ racesProcessed: 1, raceId: 'race-next' })
    expect(mockSendPickReminders).toHaveBeenCalledTimes(1)
    expect(mockSendPickReminders).toHaveBeenCalledWith('race-next')

    // Only the next un-passed race is selected, in FP1 order.
    expect(db.race.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fp1Deadline: { gt: new Date('2026-07-16T00:00:00Z') } },
        orderBy: { fp1Deadline: 'asc' },
      }),
    )
  })

  it('sends reminders at 8pm NY on Thursday (EDT)', async () => {
    // 2026-07-17T00:00:00Z == Thu 8pm in New York during EDT.
    vi.setSystemTime(new Date('2026-07-17T00:00:00Z'))
    db.race.findFirst.mockResolvedValue(makeRace({ id: 'race-thu' }))

    const res = await GET(authedRequest())

    expect(res.status).toBe(200)
    expect(mockSendPickReminders).toHaveBeenCalledWith('race-thu')
  })

  it('sends reminders at 8pm NY in winter (EST, fires at 01:00 UTC)', async () => {
    // During EST (UTC-5), 8pm NY Wednesday == 01:00 UTC Thursday in absolute time.
    vi.setSystemTime(new Date('2026-01-15T01:00:00Z'))
    db.race.findFirst.mockResolvedValue(makeRace({ id: 'race-winter' }))

    const res = await GET(authedRequest())

    expect(res.status).toBe(200)
    expect(mockSendPickReminders).toHaveBeenCalledWith('race-winter')
  })

  it('skips the 00:00 UTC firing in winter (that is only 7pm NY)', async () => {
    // In EST, the 00:00 UTC firing maps to 7pm NY — must not send.
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'))

    const res = await GET(authedRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ skipped: true })
    expect(mockSendPickReminders).not.toHaveBeenCalled()
  })

  it('skips the 01:00 UTC firing in summer (that is only 9pm NY)', async () => {
    // In EDT, the 01:00 UTC firing maps to 9pm NY — must not send.
    vi.setSystemTime(new Date('2026-07-16T01:00:00Z'))

    const res = await GET(authedRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ skipped: true })
    expect(mockSendPickReminders).not.toHaveBeenCalled()
  })

  it('does not send on days other than Wednesday or Thursday', async () => {
    // 2026-07-18T00:00:00Z == Friday 8pm NY.
    vi.setSystemTime(new Date('2026-07-18T00:00:00Z'))

    const res = await GET(authedRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ skipped: true })
    expect(mockSendPickReminders).not.toHaveBeenCalled()
  })

  it('does nothing when there is no upcoming race in the reminder window', async () => {
    vi.setSystemTime(new Date('2026-07-16T00:00:00Z'))
    db.race.findFirst.mockResolvedValue(null)

    const res = await GET(authedRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ racesProcessed: 0 })
    expect(mockSendPickReminders).not.toHaveBeenCalled()
  })
})
