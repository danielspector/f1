import type { Prisma, PrismaClient, Race } from '@prisma/client'
import type { RaceScheduleItem } from './f1DataService'
import { raceIdentity } from '../lib/raceIdentity'
export { raceIdentity } from '../lib/raceIdentity'

export class ScheduleConflictError extends Error {}

function raceData(seasonYear: number, race: RaceScheduleItem) {
  return {
    seasonYear,
    round: race.round,
    name: race.name,
    circuit: race.circuit,
    fp1Deadline: race.fp1Datetime,
    raceDatetime: race.raceDatetime,
  }
}

/** Match by event identity, never by its mutable position in the calendar. */
export function planSeasonSchedule(
  seasonYear: number,
  existing: Race[],
  schedule: RaceScheduleItem[],
) {
  const sorted = [...schedule].sort((a, b) => a.round - b.round)
  const identities = new Set<string>()
  for (const [index, race] of sorted.entries()) {
    const identity = raceIdentity(race)
    if (
      race.round !== index + 1 ||
      !race.name.trim() ||
      !race.circuit.trim() ||
      !Number.isFinite(race.fp1Datetime.getTime()) ||
      !Number.isFinite(race.raceDatetime.getTime()) ||
      race.fp1Datetime >= race.raceDatetime ||
      identities.has(identity)
    ) {
      throw new ScheduleConflictError(
        'Schedule is incomplete, invalid, or contains duplicate events',
      )
    }
    identities.add(identity)
  }
  if (!sorted.length) throw new ScheduleConflictError('Refusing to sync an empty schedule')

  const byIdentity = new Map<string, Race>()
  for (const race of existing) {
    const identity = raceIdentity(race)
    if (race.seasonYear !== seasonYear || byIdentity.has(identity) || !identities.has(identity)) {
      throw new ScheduleConflictError(
        `Cannot safely match existing race ${race.id} (${race.name}, ${race.circuit}). No races or picks were removed.`,
      )
    }
    byIdentity.set(identity, race)
  }

  const creates: ReturnType<typeof raceData>[] = []
  const updates: { id: string; before: Race; data: ReturnType<typeof raceData> }[] = []
  for (const race of sorted) {
    const data = raceData(seasonYear, race)
    const before = byIdentity.get(raceIdentity(race))
    if (!before) {
      creates.push(data)
    } else if (
      before.round !== data.round ||
      before.name !== data.name ||
      before.circuit !== data.circuit ||
      before.fp1Deadline.getTime() !== data.fp1Deadline.getTime() ||
      before.raceDatetime.getTime() !== data.raceDatetime.getTime()
    ) {
      updates.push({ id: before.id, before, data })
    }
  }
  return { creates, updates }
}

export type SchedulePlan = ReturnType<typeof planSeasonSchedule>

/** The caller must hold the Race table lock until this transaction commits. */
export async function applySchedulePlan(
  tx: Prisma.TransactionClient,
  plan: SchedulePlan,
  existing: Race[],
) {
  // Vacate changing round numbers before assigning final rounds (unique season/round).
  const moving = plan.updates.filter((update) => update.before.round !== update.data.round)
  const maxRound = Math.max(
    0,
    ...existing.map((race) => race.round),
    ...plan.creates.map((race) => race.round),
    ...plan.updates.map((update) => update.data.round),
  )
  for (const [index, update] of moving.entries()) {
    await tx.race.update({ where: { id: update.id }, data: { round: maxRound + index + 1 } })
  }
  for (const update of plan.updates) {
    await tx.race.update({ where: { id: update.id }, data: update.data })
  }
  for (const data of plan.creates) await tx.race.create({ data })
}

export async function syncSeasonSchedule(
  client: PrismaClient,
  seasonYear: number,
  schedule: RaceScheduleItem[],
) {
  return client.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`
      await tx.$executeRaw`LOCK TABLE "Race" IN SHARE ROW EXCLUSIVE MODE`
      const existing = await tx.race.findMany({ where: { seasonYear }, orderBy: { round: 'asc' } })
      const plan = planSeasonSchedule(seasonYear, existing, schedule)
      await applySchedulePlan(tx, plan, existing)
      return {
        racesUpserted: schedule.length,
        racesCreated: plan.creates.length,
        racesUpdated: plan.updates.length,
      }
    },
    { timeout: 30_000 },
  )
}
