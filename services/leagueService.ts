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

      const history: RaceHistoryEntry[] = races
        .filter((race) => new Date(race.raceDatetime) < new Date()) // only past races
        .map((race) => {
          const score = scoreByRaceId.get(race.id)
          if (!score) {
            // Missed pick
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
          }
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
        })

      // Also include picks for races not yet scored (results pending)
      const picks = await prisma.pick.findMany({
        where: { leagueId, userId: member.userId },
        include: { seat: true, race: true },
      })
      for (const pick of picks) {
        const alreadyInHistory = history.some((h) => h.raceId === pick.raceId)
        const raceHasPassed = new Date(pick.race.raceDatetime) < new Date()
        if (!alreadyInHistory && raceHasPassed) {
          history.push({
            raceId: pick.race.id,
            round: pick.race.round,
            raceName: pick.race.name,
            driverName: pick.seat.driverName,
            teamName: pick.seat.teamName,
            driverCode: pick.seat.driverCode,
            pointsEarned: 0,
            resultsPending: true,
          })
        }
      }

      history.sort((a, b) => a.round - b.round)

      const totalPoints = scores.reduce((sum, s) => sum + s.pointsEarned, 0)

      return {
        userId: member.userId,
        userName: member.user.name,
        userEmail: member.user.email,
        totalPoints,
        history,
      }
    }),
  )

  // Sort by total points descending, assign ranks
  entries.sort((a, b) => b.totalPoints - a.totalPoints)
  return entries.map((e, i) => ({ ...e, rank: i + 1 }))
}
