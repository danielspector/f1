import type { Race } from '@prisma/client'
import type { RaceScheduleItem } from './f1DataService'
import { planSeasonSchedule, raceIdentity, ScheduleConflictError } from './scheduleService'

export const BAHRAIN_MALAYSIA = {
  round: 16,
  name: 'Bahrain Grand Prix in Malaysia',
  circuit: 'Sepang International Circuit',
  fp1Datetime: new Date('2026-10-02T04:30:00Z'),
  raceDatetime: new Date('2026-10-04T07:00:00Z'),
}

/** Only insert Bahrain and renumber later races; preserve all existing metadata. */
export function planBahrainAddition(existing: Race[], schedule: RaceScheduleItem[]) {
  const bahrain = schedule.find((race) => raceIdentity(race) === raceIdentity(BAHRAIN_MALAYSIA))
  if (
    schedule.length !== 23 ||
    !bahrain ||
    bahrain.round !== 16 ||
    bahrain.fp1Datetime.getTime() !== BAHRAIN_MALAYSIA.fp1Datetime.getTime() ||
    bahrain.raceDatetime.getTime() !== BAHRAIN_MALAYSIA.raceDatetime.getTime() ||
    schedule.find((race) => race.round === 15)?.name !== 'Azerbaijan Grand Prix' ||
    schedule.find((race) => race.round === 17)?.name !== 'Singapore Grand Prix'
  ) {
    throw new ScheduleConflictError(
      'The API calendar differs from the verified 2026 Bahrain-in-Malaysia schedule. Review before applying.',
    )
  }
  const alreadyAdded = existing.some((race) => raceIdentity(race) === raceIdentity(bahrain))
  if (existing.length !== (alreadyAdded ? 23 : 22)) {
    throw new ScheduleConflictError(
      'Expected the complete 22-race calendar, or the already updated 23-race calendar',
    )
  }
  const byIdentity = new Map(existing.map((race) => [raceIdentity(race), race]))
  const target = schedule.map((race) => {
    const before = byIdentity.get(raceIdentity(race))
    if (!before) {
      if (race !== bahrain) throw new ScheduleConflictError(`Missing existing race: ${race.name}`)
      return race
    }
    const expectedRound = !alreadyAdded && race.round > 16 ? race.round - 1 : race.round
    if (before.round !== expectedRound) {
      throw new ScheduleConflictError(
        `Unexpected round for ${before.name}: ${before.round}; expected ${expectedRound}`,
      )
    }
    if (
      race === bahrain &&
      (before.fp1Deadline.getTime() !== bahrain.fp1Datetime.getTime() ||
        before.raceDatetime.getTime() !== bahrain.raceDatetime.getTime())
    ) {
      throw new ScheduleConflictError(
        'Existing Bahrain race has unexpected session times. Review before applying.',
      )
    }
    return {
      ...race,
      name: before.name,
      circuit: before.circuit,
      fp1Datetime: before.fp1Deadline,
      raceDatetime: before.raceDatetime,
    }
  })
  return planSeasonSchedule(2026, existing, target)
}
