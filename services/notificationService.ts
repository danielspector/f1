import { render } from '@react-email/render'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getLeaderboard } from './leagueService'
import PickReminder from '@/emails/PickReminder'
import RaceSummary from '@/emails/RaceSummary'
import React from 'react'

const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

/**
 * Sends pick reminder emails to all league members who haven't picked for the given race.
 * Processes all members regardless of individual failures.
 */
export async function sendPickReminders(raceId: string): Promise<void> {
  const race = await prisma.race.findUnique({ where: { id: raceId } })
  if (!race) return

  const activeLeagues = await prisma.league.findMany({
    where: { status: 'ACTIVE', seasonYear: race.seasonYear },
    include: { members: { include: { user: true } } },
  })

  const fp1DeadlineFormatted = new Date(race.fp1Deadline).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  })

  for (const league of activeLeagues) {
    for (const member of league.members) {
      // Skip if already picked
      const hasPick = await prisma.pick.findUnique({
        where: { leagueId_userId_raceId: { leagueId: league.id, userId: member.userId, raceId } },
      })
      if (hasPick) continue

      const pickUrl = `${APP_URL}/league/${league.id}/pick/${raceId}`
      const html = await render(
        React.createElement(PickReminder, {
          playerName: member.user.name || member.user.email,
          raceName: race.name,
          fp1Deadline: fp1DeadlineFormatted,
          leagueName: league.name,
          pickUrl,
        }),
      )

      try {
        await sendEmail({
          to: member.user.email,
          subject: `⏱️ Pick reminder: ${race.name} — deadline approaching`,
          html,
        })
        console.log(`[PickReminder] Sent to ${member.user.email} for ${race.name}`)
      } catch (err) {
        console.error(`[PickReminder] Failed for ${member.user.email}:`, err)
        // Continue — don't throw
      }
    }
  }
}

/**
 * Sends post-race summary emails to all members of all active leagues.
 * Call this after calculateScoresForRace() has run.
 */
export async function sendRaceSummaries(raceId: string): Promise<void> {
  const race = await prisma.race.findUnique({ where: { id: raceId } })
  if (!race) return

  const activeLeagues = await prisma.league.findMany({
    where: {
      status: 'ACTIVE',
      seasonYear: race.seasonYear,
      picks: { some: { raceId } }, // only leagues with at least one pick
    },
    include: { members: { include: { user: true } } },
  })

  for (const league of activeLeagues) {
    const leaderboard = await getLeaderboard(league.id)

    for (const member of league.members) {
      const myEntry = leaderboard.find((e) => e.userId === member.userId)
      const myRaceHistory = myEntry?.history.find((h) => h.raceId === raceId)

      const standings = leaderboard.map((e) => ({
        rank: e.rank,
        name: e.userName || e.userEmail,
        points: e.totalPoints,
        isCurrentUser: e.userId === member.userId,
      }))

      const html = await render(
        React.createElement(RaceSummary, {
          playerName: member.user.name || member.user.email,
          raceName: race.name,
          round: race.round,
          driverPicked: myRaceHistory?.driverName ?? null,
          teamName: myRaceHistory?.teamName ?? null,
          pointsEarned: myRaceHistory?.pointsEarned ?? 0,
          leagueName: league.name,
          leagueUrl: `${APP_URL}/league/${league.id}`,
          standings,
        }),
      )

      try {
        await sendEmail({
          to: member.user.email,
          subject: `🏁 ${race.name} results — ${league.name}`,
          html,
        })
        console.log(`[RaceSummary] Sent to ${member.user.email} for ${race.name}`)
      } catch (err) {
        console.error(`[RaceSummary] Failed for ${member.user.email}:`, err)
      }
    }
  }
}
