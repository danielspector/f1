import type { Pick as PickRow, Race, Seat } from '@prisma/client'
import { after } from 'next/server'
import { render } from '@react-email/render'
import React from 'react'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import PickConfirmation from '@/emails/PickConfirmation'

type SavedPick = PickRow & { seat: Seat; race: Race }
type PreviousPick = Pick<PickRow, 'seatId' | 'chip'> | null

const APP_URL =
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null) ||
  'http://localhost:3000'

/** Receipts go to the picker, independently of reminder/summary preferences. */
export async function sendPickConfirmation(
  pick: SavedPick,
  recordedByAdmin = false,
): Promise<void> {
  try {
    const [user, league] = await Promise.all([
      prisma.user.findUnique({ where: { id: pick.userId }, select: { name: true, email: true } }),
      prisma.league.findUnique({ where: { id: pick.leagueId }, select: { name: true } }),
    ])
    if (!user || !league) return
    const chipName =
      pick.chip === 'DOUBLE_POINTS'
        ? 'Double Points'
        : pick.chip === 'SAFETY_NET'
          ? 'Safety Net'
          : 'None'
    const html = await render(
      React.createElement(PickConfirmation, {
        playerName: user.name || user.email,
        leagueName: league.name,
        raceName: pick.race.name,
        round: pick.race.round,
        seasonYear: pick.race.seasonYear,
        driverName: pick.seat.driverName,
        teamName: pick.seat.teamName,
        chipName,
        fp1Deadline: pick.race.fp1Deadline.toLocaleString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
          timeZoneName: 'short',
        }),
        pickUrl: `${APP_URL}/league/${pick.leagueId}/pick/${pick.raceId}`,
        recordedByAdmin,
      }),
    )
    await sendEmail({
      to: user.email,
      subject: `Pick confirmed: ${pick.seat.driverName} — ${pick.race.name} — ${league.name}`,
      html,
    })
  } catch (error) {
    console.error(`[PickConfirmation] Failed for pick ${pick.id}:`, error)
  }
}

/** Run after the response, so sending mail cannot delay or fail the pick save. */
export function queuePickConfirmation(
  pick: SavedPick,
  previous: PreviousPick,
  recordedByAdmin = false,
): void {
  if (previous && previous.seatId === pick.seatId && previous.chip === pick.chip) return
  // Capture the saved selection rather than reloading a potentially newer pick.
  const saved = { ...pick, seat: { ...pick.seat }, race: { ...pick.race } }
  try {
    after(() => sendPickConfirmation(saved, recordedByAdmin))
  } catch (error) {
    console.error(`[PickConfirmation] Could not schedule pick ${pick.id}:`, error)
  }
}
