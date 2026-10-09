/** Dry-run by default. Execute requires a new, absolute --backup path. */
import { PrismaClient } from '@prisma/client'
import { open, mkdir } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'
import { fetchSeasonSchedule } from '../services/f1DataService'
import { applySchedulePlan } from '../services/scheduleService'
import { planBahrainAddition } from '../services/bahrainScheduleService'

const prisma = new PrismaClient()
const execute = process.argv.includes('--execute')
const backupIndex = process.argv.indexOf('--backup')
const backupPath = backupIndex < 0 ? undefined : process.argv[backupIndex + 1]

async function main() {
  if (execute && (!backupPath || !isAbsolute(backupPath))) {
    throw new Error('Execute requires --backup /absolute/path/to/new-backup.json')
  }
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN (no database writes)'}`)
  const schedule = await fetchSeasonSchedule(2026)
  await prisma.$transaction(
    async (tx) => {
      // Freeze schedule and attached data for a consistent backup and verification.
      await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`
      await tx.$executeRaw`LOCK TABLE "Race", "Pick", "RaceResult", "PlayerScore" IN EXCLUSIVE MODE`
      const races = await tx.race.findMany({
        where: { seasonYear: 2026 },
        orderBy: { round: 'asc' },
      })
      const plan = planBahrainAddition(races, schedule)
      console.table([
        ...plan.creates.map((race) => ({
          action: 'insert',
          race: race.name,
          fromRound: '-',
          toRound: race.round,
        })),
        ...plan.updates.map((update) => ({
          action: 'renumber',
          race: update.before.name,
          fromRound: update.before.round,
          toRound: update.data.round,
        })),
      ])
      if (!plan.creates.length && !plan.updates.length) {
        console.log('Bahrain is already present; no changes needed.')
        return
      }
      const raceIds = races.map((race) => race.id)
      const attachedData = async () => ({
        picks: await tx.pick.findMany({
          where: { raceId: { in: raceIds } },
          orderBy: { id: 'asc' },
        }),
        results: await tx.raceResult.findMany({
          where: { raceId: { in: raceIds } },
          orderBy: { id: 'asc' },
        }),
        scores: await tx.playerScore.findMany({
          where: { raceId: { in: raceIds } },
          orderBy: { id: 'asc' },
        }),
      })
      const before = await attachedData()
      console.log(
        `Preserving ${races.length} race IDs, ${before.picks.length} picks, ${before.results.length} results, ${before.scores.length} scores.`,
      )
      if (!execute) return

      await mkdir(dirname(backupPath!), { recursive: true, mode: 0o700 })
      const file = await open(backupPath!, 'wx', 0o600)
      try {
        await file.writeFile(
          JSON.stringify(
            { createdAt: new Date(), seasonYear: 2026, races, ...before, plan },
            null,
            2,
          ),
        )
        await file.sync()
      } finally {
        await file.close()
      }
      console.log(`Backup saved: ${backupPath}`)
      await applySchedulePlan(tx, plan, races)
      const after = await attachedData()
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error('Attached data changed. Rolling back the entire schedule update.')
      }
      const finalRaces = await tx.race.findMany({
        where: { seasonYear: 2026 },
        orderBy: { round: 'asc' },
      })
      const verification = planBahrainAddition(finalRaces, schedule)
      if (verification.creates.length || verification.updates.length) {
        throw new Error('Final schedule verification failed. Rolling back.')
      }
      for (const race of races) {
        const final = finalRaces.find((candidate) => candidate.id === race.id)
        if (!final || JSON.stringify({ ...final, round: race.round }) !== JSON.stringify(race)) {
          throw new Error('An existing race changed beyond its round number. Rolling back.')
        }
      }
      console.log(
        'Verified: all original race IDs and metadata preserved; picks, results, and scores are identical.',
      )
    },
    { timeout: 60_000 },
  )
  console.log(
    execute ? 'Schedule transaction committed.' : 'Dry run complete. No database writes made.',
  )
}

main()
  .catch((error: unknown) => {
    // Do not print connection strings or raw database errors containing credentials.
    console.error(error instanceof Error ? error.message : 'Schedule update failed')
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
