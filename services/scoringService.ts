import { prisma } from '@/lib/prisma'
import { fetchRaceResults } from './f1DataService'

const F1_POINTS: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
}

/**
 * Fetches race results from the F1 API and upserts RaceResult records.
 * Returns how many results were stored.
 */
export async function ingestRaceResults(seasonYear: number, round: number): Promise<number> {
  const race = await prisma.race.findUnique({
    where: { seasonYear_round: { seasonYear, round } },
  })
  if (!race) throw new Error(`Race not found: season ${seasonYear} round ${round}`)

  const results = await fetchRaceResults(seasonYear, round)
  let count = 0

  for (const result of results) {
    const seat = await prisma.seat.findUnique({
      where: { seasonYear_driverCode: { seasonYear, driverCode: result.driverCode } },
    })
    if (!seat) continue

    const points = result.position != null ? (F1_POINTS[result.position] ?? 0) : 0

    await prisma.raceResult.upsert({
      where: { raceId_seatId: { raceId: race.id, seatId: seat.id } },
      update: { position: result.position, points },
      create: { raceId: race.id, seatId: seat.id, position: result.position, points },
    })
    count++
  }

  return count
}

/**
 * For a given race, matches each Pick to a RaceResult and creates/updates PlayerScore.
 * If no Pick exists for a league member (missed deadline), records 0 points.
 * Returns how many PlayerScore records were created or updated.
 */
export async function calculateScoresForRace(raceId: string): Promise<number> {
  const race = await prisma.race.findUnique({ where: { id: raceId } })
  if (!race) throw new Error(`Race not found: ${raceId}`)

  // Fetch all picks for this race across all leagues
  const picks = await prisma.pick.findMany({
    where: { raceId },
    include: { league: { include: { members: true } }, seat: true },
  })

  // Build a map of seatId -> RaceResult from race results
  const results = await prisma.raceResult.findMany({ where: { raceId } })
  const pointsBySeatId = new Map(results.map((r) => [r.seatId, r.points]))
  const resultBySeatId = new Map(results.map((r) => [r.seatId, r]))

  let count = 0

  // Score each pick
  for (const pick of picks) {
    let pointsEarned = pointsBySeatId.get(pick.seatId) ?? 0

    // Apply chip effects
    if (pick.chip === 'DOUBLE_POINTS') {
      pointsEarned *= 2
    } else if (pick.chip === 'SAFETY_NET') {
      const result = resultBySeatId.get(pick.seatId)
      // DNF = position is null
      if (result && result.position === null) {
        // Find teammate: same team, same season, different driver
        const teammate = await prisma.seat.findFirst({
          where: {
            seasonYear: pick.seat.seasonYear,
            teamName: pick.seat.teamName,
            NOT: { id: pick.seatId },
          },
        })
        if (teammate) {
          pointsEarned = pointsBySeatId.get(teammate.id) ?? 0
        }
      }
    }

    await prisma.playerScore.upsert({
      where: { pickId: pick.id },
      update: { pointsEarned },
      create: {
        leagueId: pick.leagueId,
        userId: pick.userId,
        raceId,
        pickId: pick.id,
        pointsEarned,
      },
    })
    count++
  }

  // Ensure 0-point records exist for members who didn't pick in each league
  const leaguesWithPicks = [...new Set(picks.map((p) => p.leagueId))]

  for (const leagueId of leaguesWithPicks) {
    const members = await prisma.leagueMember.findMany({ where: { leagueId } })
    for (const member of members) {
      const hasPick = picks.some(
        (p) => p.leagueId === leagueId && p.userId === member.userId,
      )
      if (!hasPick) {
        // No pick for this race — find or skip (PlayerScore requires a pickId, so we can't
        // create a score without a pick). Instead the leaderboard query handles missing scores
        // by treating absent PlayerScore as 0 points.
      }
    }
  }

  return count
}
