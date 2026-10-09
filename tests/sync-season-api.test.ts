import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { db } from './prisma-mock'
import { fetchSeasonSchedule, fetchDriverRoster } from '@/services/f1DataService'
import { ScheduleConflictError, syncSeasonSchedule } from '@/services/scheduleService'
import { POST } from '@/app/api/admin/sync-season/route'

vi.mock('@/services/scheduleService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/scheduleService')>()),
  syncSeasonSchedule: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('ADMIN_API_KEY', 'test-admin-key')
  vi.mocked(fetchSeasonSchedule).mockResolvedValue([])
  vi.mocked(fetchDriverRoster).mockResolvedValue([
    { driverCode: 'VER', driverName: 'Max Verstappen', teamName: 'Red Bull' },
  ])
})
afterEach(() => vi.unstubAllEnvs())

function request(key = 'test-admin-key') {
  return new Request('http://localhost/api/admin/sync-season', {
    method: 'POST',
    headers: { 'x-admin-key': key },
    body: JSON.stringify({ seasonYear: 2026 }),
  })
}

describe('season sync API', () => {
  it('uses the safe schedule service rather than round-based upserts', async () => {
    vi.mocked(syncSeasonSchedule).mockResolvedValue({
      racesUpserted: 23,
      racesCreated: 1,
      racesUpdated: 7,
    })
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      racesUpserted: 23,
      racesCreated: 1,
      racesUpdated: 7,
      seatsUpserted: 1,
    })
    expect(syncSeasonSchedule).toHaveBeenCalledWith(db, 2026, [])
    expect(db.race.upsert).not.toHaveBeenCalled()
  })
  it('reports schedule conflicts without mutating driver seats', async () => {
    vi.mocked(syncSeasonSchedule).mockRejectedValue(
      new ScheduleConflictError('Unexpected existing race'),
    )
    const response = await POST(request())
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'Unexpected existing race' })
    expect(db.seat.upsert).not.toHaveBeenCalled()
  })
  it('requires a configured matching admin key', async () => {
    expect((await POST(request('wrong'))).status).toBe(401)
    vi.stubEnv('ADMIN_API_KEY', '')
    expect((await POST(request(''))).status).toBe(401)
    expect(syncSeasonSchedule).not.toHaveBeenCalled()
  })
})
