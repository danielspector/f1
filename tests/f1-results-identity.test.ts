import { afterEach, describe, it, expect, vi } from 'vitest'

const actualService = await vi.importActual<typeof import('@/services/f1DataService')>(
  '@/services/f1DataService',
)
const expected = {
  name: 'Singapore Grand Prix',
  circuit: 'Marina Bay Street Circuit',
  raceDatetime: new Date('2026-10-11T12:00:00Z'),
}
const result = { position: '1', points: '25', status: 'Finished', Driver: { code: 'VER' } }

function apiRace(overrides = {}) {
  return {
    raceName: expected.name,
    Circuit: { circuitName: expected.circuit },
    date: '2026-10-11',
    Results: [result],
    ...overrides,
  }
}
function respond(races: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ MRData: { RaceTable: { Races: races } } }),
    }),
  )
}
afterEach(() => vi.unstubAllGlobals())

describe('result event identity', () => {
  it('rejects Bahrain results for a stale round-16 Singapore row', async () => {
    respond([
      apiRace({
        raceName: 'Bahrain Grand Prix in Malaysia',
        Circuit: { circuitName: 'Sepang International Circuit' },
        date: '2026-10-04',
      }),
    ])
    await expect(actualService.fetchRaceResults(2026, 16, expected)).rejects.toThrow(
      'Sync the schedule',
    )
  })
  it('accepts results for the matching event', async () => {
    respond([apiRace()])
    await expect(actualService.fetchRaceResults(2026, 17, expected)).resolves.toEqual([
      { driverCode: 'VER', position: 1, points: 25, status: 'Finished' },
    ])
  })
  it('rejects a matching name at a different venue', async () => {
    respond([apiRace({ Circuit: { circuitName: 'Sepang International Circuit' } })])
    await expect(actualService.fetchRaceResults(2026, 17, expected)).rejects.toThrow(
      'Sync the schedule',
    )
  })

  it('accepts the Losail/Lusail spelling change for the same Qatar venue', async () => {
    respond([
      apiRace({
        raceName: 'Qatar Grand Prix',
        Circuit: { circuitName: 'Lusail International Circuit' },
        date: '2026-11-29',
      }),
    ])
    await expect(
      actualService.fetchRaceResults(2026, 22, {
        name: 'Qatar Grand Prix',
        circuit: 'Losail International Circuit',
        raceDatetime: new Date('2026-11-29T16:00:00Z'),
      }),
    ).resolves.toHaveLength(1)
  })
  it('rejects results from a different race date', async () => {
    respond([apiRace({ date: '2026-10-04' })])
    await expect(actualService.fetchRaceResults(2026, 17, expected)).rejects.toThrow(
      'Sync the schedule',
    )
  })
  it('returns no results when the event has not happened', async () => {
    respond([])
    await expect(actualService.fetchRaceResults(2026, 17, expected)).resolves.toEqual([])
  })
})
