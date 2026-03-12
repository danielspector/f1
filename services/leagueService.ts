import { prisma } from '@/lib/prisma'

export interface RaceHistoryEntry {
  raceId: string
  round: number
  raceName: string
  driverName: string | null
  teamName: string | null
  driverCode: string | null
  pointsEarned: number
  resultsPending: boolean
}

export interface LeaderboardEntry {
  userId: string
  userName: string | null
  userEmail: string
  totalPoints: number
  rank: number
  history: RaceHistoryEntry[]
  hasCurrentPick: boolean
}

export async function getLeaderboard(leagueId: string): Promise<LeaderboardEntry[]> {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { seasonYear: true },
  })
  if (!league) return []

  const members = await prisma.leagueMember.findMany({
    where: { leagueId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  const races = await prisma.race.findMany({
    where: { seasonYear: league.seasonYear },
    orderBy: { round: 'asc' },
  })

  // Find the next race still open for picking (FP1 deadline in the future)
  const now = new Date()
  const openRace = races.find((r) => {
    const fp1 = new Date(r.fp1Deadline)
    return fp1 > now
  }) ?? null

  const entries: Omit<LeaderboardEntry, 'rank'>[] = await Promise.all(
    members.map(async (member) => {
      const scores = await prisma.playerScore.findMany({
        where: { leagueId, userId: member.userId },
        include: {
          pick: {
            include: {
              seat: true,
              race: true,
            },
          },
        },
      })

      const scoreByRaceId = new Map(scores.map((s) => [s.raceId, s]))

      // Fetch all picks for this user in this league (needed for pending results)
      const picks = await prisma.pick.findMany({
        where: { leagueId, userId: member.userId },
        include: { seat: true, race: true },
      })
      const pickByRaceId = new Map(picks.map((p) => [p.raceId, p]))

      // Check which races have RaceResult records (scoring has been run)
      const racesWithResults = await prisma.raceResult.groupBy({
        by: ['raceId'],
        where: { raceId: { in: races.map((r) => r.id) } },
      })
      const scoredRaceIds = new Set(racesWithResults.map((r) => r.raceId))

      const history: RaceHistoryEntry[] = races
        .filter((race) => new Date(race.raceDatetime) < new Date()) // only past races
        .map((race) => {
          const score = scoreByRaceId.get(race.id)
          if (score) {
            return {
              raceId: race.id,
              round: race.round,
              raceName: race.name,
              driverName: score.pick.seat.driverName,
              teamName: score.pick.seat.teamName,
              driverCode: score.pick.seat.driverCode,
              pointsEarned: score.pointsEarned,
              resultsPending: false,
            }
          }

          // No PlayerScore — check if user made a pick
          const pick = pickByRaceId.get(race.id)
          if (pick) {
            // User picked but results haven't been scored yet
            const hasResults = scoredRaceIds.has(race.id)
            return {
              raceId: race.id,
              round: race.round,
              raceName: race.name,
              driverName: pick.seat.driverName,
              teamName: pick.seat.teamName,
              driverCode: pick.seat.driverCode,
              pointsEarned: 0,
              resultsPending: !hasResults,
            }
          }

          // No pick — missed deadline
          return {
            raceId: race.id,
            round: race.round,
            raceName: race.name,
            driverName: null,
            teamName: null,
            driverCode: null,
            pointsEarned: 0,
            resultsPending: false,
          }
        })

      history.sort((a, b) => a.round - b.round)

      const totalPoints = scores.reduce((sum, s) => sum + s.pointsEarned, 0)
      const hasCurrentPick = openRace ? picks.some((p) => p.raceId === openRace.id) : false

      return {
        userId: member.userId,
        userName: member.user.name,
        userEmail: member.user.email,
        totalPoints,
        history,
        hasCurrentPick,
      }
    }),
  )

  // Sort by total points descending, assign ranks
  entries.sort((a, b) => b.totalPoints - a.totalPoints)
  return entries.map((e, i) => ({ ...e, rank: i + 1 }))
}
