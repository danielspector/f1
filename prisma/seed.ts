import { PrismaClient } from '@prisma/client'
import { fetchSeasonSchedule, fetchDriverRoster } from '../services/f1DataService'

const prisma = new PrismaClient()

// ─── 2026 roster (hardcoded — update each season) ────────────────────────────
const ROSTER_2026 = [
  { teamName: 'McLaren',      driverName: 'Lando Norris',      driverCode: 'NOR' },
  { teamName: 'McLaren',      driverName: 'Oscar Piastri',     driverCode: 'PIA' },
  { teamName: 'Ferrari',      driverName: 'Charles Leclerc',   driverCode: 'LEC' },
  { teamName: 'Ferrari',      driverName: 'Lewis Hamilton',    driverCode: 'HAM' },
  { teamName: 'Red Bull',     driverName: 'Max Verstappen',    driverCode: 'VER' },
  { teamName: 'Red Bull',     driverName: 'Isack Hadjar',      driverCode: 'HAD' },
  { teamName: 'Mercedes',     driverName: 'George Russell',    driverCode: 'RUS' },
  { teamName: 'Mercedes',     driverName: 'Kimi Antonelli',    driverCode: 'ANT' },
  { teamName: 'Aston Martin', driverName: 'Fernando Alonso',   driverCode: 'ALO' },
  { teamName: 'Aston Martin', driverName: 'Lance Stroll',      driverCode: 'STR' },
  { teamName: 'Audi',         driverName: 'Nico Hülkenberg',   driverCode: 'HUL' },
  { teamName: 'Audi',         driverName: 'Gabriel Bortoleto', driverCode: 'BOR' },
  { teamName: 'Cadillac',     driverName: 'Sergio Pérez',      driverCode: 'PER' },
  { teamName: 'Cadillac',     driverName: 'Valtteri Bottas',   driverCode: 'BOT' },
  { teamName: 'Williams',     driverName: 'Alex Albon',        driverCode: 'ALB' },
  { teamName: 'Williams',     driverName: 'Carlos Sainz',      driverCode: 'SAI' },
  { teamName: 'Alpine',       driverName: 'Pierre Gasly',      driverCode: 'GAS' },
  { teamName: 'Alpine',       driverName: 'Franco Colapinto',  driverCode: 'COL' },
  { teamName: 'Haas',         driverName: 'Esteban Ocon',      driverCode: 'OCO' },
  { teamName: 'Haas',         driverName: 'Oliver Bearman',    driverCode: 'BEA' },
  { teamName: 'Racing Bulls', driverName: 'Liam Lawson',       driverCode: 'LAW' },
  { teamName: 'Racing Bulls', driverName: 'Arvid Lindblad',    driverCode: 'LIN' },
]

const HARDCODED_ROSTERS: Record<number, typeof ROSTER_2026> = {
  2026: ROSTER_2026,
}

async function main() {
  const year = new Date().getFullYear()
  console.log(`Seeding season ${year}...`)

  // Seed races
  const schedule = await fetchSeasonSchedule(year)
  console.log(`Found ${schedule.length} races`)

  for (const race of schedule) {
    await prisma.race.upsert({
      where: { seasonYear_round: { seasonYear: year, round: race.round } },
      update: {
        name: race.name,
        circuit: race.circuit,
        fp1Deadline: race.fp1Datetime,
        raceDatetime: race.raceDatetime,
      },
      create: {
        seasonYear: year,
        round: race.round,
        name: race.name,
        circuit: race.circuit,
        fp1Deadline: race.fp1Datetime,
        raceDatetime: race.raceDatetime,
      },
    })
  }
  console.log(`✓ Seeded ${schedule.length} races`)

  // Seed driver seats — use hardcoded roster if available, otherwise fetch from API
  const roster = HARDCODED_ROSTERS[year] ?? await fetchDriverRoster(year)
  const source = HARDCODED_ROSTERS[year] ? 'hardcoded roster' : 'API'
  console.log(`Found ${roster.length} drivers (${source})`)

  for (const driver of roster) {
    await prisma.seat.upsert({
      where: { seasonYear_driverCode: { seasonYear: year, driverCode: driver.driverCode } },
      update: {
        driverName: driver.driverName,
        teamName: driver.teamName,
      },
      create: {
        seasonYear: year,
        driverCode: driver.driverCode,
        driverName: driver.driverName,
        teamName: driver.teamName,
      },
    })
  }
  console.log(`✓ Seeded ${roster.length} driver seats`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
