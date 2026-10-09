import { describe, it, expect, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
import fixture from './fixtures/2026-schedule.json'
import { planSeasonSchedule, applySchedulePlan } from '@/services/scheduleService'
import { planBahrainAddition } from '@/services/bahrainScheduleService'

const schedule = fixture.map((race) => ({
  ...race,
  fp1Datetime: new Date(race.fp1Datetime),
  raceDatetime: new Date(race.raceDatetime),
}))
const oldRaces = () =>
  schedule
    .filter((race) => race.round !== 16)
    .map((race) => ({
      id: `race-${race.name}`,
      seasonYear: 2026,
      round: race.round > 16 ? race.round - 1 : race.round,
      name: race.name,
      circuit: race.circuit,
      fp1Deadline: race.fp1Datetime,
      raceDatetime: race.raceDatetime,
    }))

describe('safe calendar insertion', () => {
  it('adds Bahrain at round 16 and preserves the IDs of all seven later races', () => {
    const existing = oldRaces()
    const plan = planBahrainAddition(existing, schedule)
    expect(plan.creates).toEqual([
      {
        seasonYear: 2026,
        round: 16,
        name: 'Bahrain Grand Prix in Malaysia',
        circuit: 'Sepang International Circuit',
        fp1Deadline: new Date('2026-10-02T04:30:00Z'),
        raceDatetime: new Date('2026-10-04T07:00:00Z'),
      },
    ])
    expect(plan.updates).toHaveLength(7)
    for (const update of plan.updates) {
      expect(update.id).toBe(update.before.id)
      expect(update.data).toEqual({
        ...update.before,
        id: undefined,
        round: update.before.round + 1,
      })
    }
    expect(plan.updates[0].before.name).toBe('Singapore Grand Prix')
    expect(plan.updates[6].data.round).toBe(23)
  })

  it('preserves existing session times even if the upstream API changed them', () => {
    const existing = oldRaces()
    existing[15].fp1Deadline = new Date('2026-10-09T08:00:00Z')
    const update = planBahrainAddition(existing, schedule).updates[0]
    expect(update.data.fp1Deadline).toEqual(existing[15].fp1Deadline)
  })

  it('accepts the production Losail spelling without changing Qatar metadata or its race ID', () => {
    const existing = oldRaces()
    const qatar = existing.find((race) => race.name === 'Qatar Grand Prix')!
    qatar.circuit = 'Losail International Circuit'
    const plan = planBahrainAddition(existing, schedule)
    expect(plan.creates).toHaveLength(1)
    const update = plan.updates.find((candidate) => candidate.id === qatar.id)!
    expect(update.data.circuit).toBe('Losail International Circuit')
    expect(update.data.round).toBe(22)
    expect(update.before.id).toBe(qatar.id)
  })

  it('is a no-op when run again', () => {
    const existing = schedule.map((race) => ({
      id: `race-${race.name}`,
      seasonYear: 2026,
      round: race.round,
      name: race.name,
      circuit: race.circuit,
      fp1Deadline: race.fp1Datetime,
      raceDatetime: race.raceDatetime,
    }))
    expect(planBahrainAddition(existing, schedule)).toEqual({ creates: [], updates: [] })
  })

  it('refuses a partial or previously corrupted schedule', () => {
    const partial = oldRaces().slice(1)
    expect(() => planBahrainAddition(partial, schedule)).toThrow('complete 22-race calendar')
    const corrupted = oldRaces()
    corrupted[15].name = 'Bahrain Grand Prix'
    expect(() => planBahrainAddition(corrupted, schedule)).toThrow('Missing existing race')
  })

  it('refuses an unexpected source round', () => {
    const existing = oldRaces()
    existing[15].round = 17
    expect(() => planBahrainAddition(existing, schedule)).toThrow('Unexpected round')
  })

  it('refuses changed Bahrain timing instead of guessing', () => {
    const changed = schedule.map((race) =>
      race.round === 16 ? { ...race, fp1Datetime: new Date('2026-10-02T05:00:00Z') } : race,
    )
    expect(() => planBahrainAddition(oldRaces(), changed)).toThrow('differs from the verified')
  })

  it('handles round uniqueness while leaving all attached data untouched', async () => {
    const original = oldRaces()
    const stored = new Map(original.map((race) => [race.id, { ...race }]))
    const attached = {
      pick: { raceId: original[15].id, chip: 'DOUBLE_POINTS' },
      result: { raceId: original[15].id, points: 25 },
      score: { raceId: original[15].id, pointsEarned: 50 },
    }
    const snapshot = JSON.stringify(attached)
    const update = vi.fn(async ({ where, data }) => {
      if ([...stored.values()].some((race) => race.id !== where.id && race.round === data.round))
        throw new Error('Duplicate round')
      stored.set(where.id, { ...stored.get(where.id)!, ...data })
    })
    const create = vi.fn(async ({ data }) => {
      if ([...stored.values()].some((race) => race.round === data.round))
        throw new Error('Duplicate round')
      stored.set('new-bahrain', { id: 'new-bahrain', ...data })
    })
    await applySchedulePlan(
      { race: { update, create } } as unknown as Prisma.TransactionClient,
      planBahrainAddition(original, schedule),
      original,
    )
    expect(stored.size).toBe(23)
    expect(stored.get(original[15].id)?.name).toBe('Singapore Grand Prix')
    expect(stored.get(original[15].id)?.round).toBe(17)
    expect(JSON.stringify(attached)).toBe(snapshot)
    expect(planBahrainAddition([...stored.values()], schedule)).toEqual({
      creates: [],
      updates: [],
    })
  })
})

describe('season sync safety', () => {
  it('never repurposes a race row when its round is occupied by a different event', () => {
    const plan = planSeasonSchedule(2026, oldRaces(), schedule)
    expect(plan.creates[0].name).toBe('Bahrain Grand Prix in Malaysia')
    expect(plan.updates[0].id).toBe('race-Singapore Grand Prix')
    expect(plan.updates[0].data.name).toBe('Singapore Grand Prix')
  })

  it('refuses to discard a cancelled race even if the replacement has the same name', () => {
    const existing = oldRaces()
    existing.push({
      ...existing[0],
      id: 'old-bahrain',
      round: 24,
      name: 'Bahrain Grand Prix in Malaysia',
      circuit: 'Bahrain International Circuit',
    })
    expect(() => planSeasonSchedule(2026, existing, schedule)).toThrow('Cannot safely match')
  })

  it.each([
    ['empty', []],
    ['missing round', schedule.filter((race) => race.round !== 10)],
    ['duplicate round', [...schedule, schedule[0]]],
    [
      'duplicate identity',
      schedule.map((race) => (race.round === 2 ? { ...schedule[0], round: 2 } : race)),
    ],
    [
      'invalid date',
      schedule.map((race) =>
        race.round === 2 ? { ...race, fp1Datetime: new Date('invalid') } : race,
      ),
    ],
  ])('rejects an %s API calendar before any writes', (_label, invalid) => {
    expect(() => planSeasonSchedule(2026, oldRaces(), invalid)).toThrow()
  })
})
