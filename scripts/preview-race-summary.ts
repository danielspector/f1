/**
 * Renders the RaceSummary email with stub data and opens it in the browser.
 * No DB / no email send — purely visual preview.
 *
 *   npx tsx scripts/preview-race-summary.ts
 */
import { render } from '@react-email/render'
import { writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import React from 'react'
import RaceSummary from '../emails/RaceSummary'

// One league only — real emails are per-league, never combined.
// Stub: Spector Family League with 4 members.
const standings = [
  { rank: 1, name: 'Aryeh Spector',  points: 78, isCurrentUser: false },
  { rank: 2, name: 'Daniel Spector', points: 64, isCurrentUser: true  },
  { rank: 3, name: 'Ayelet Spector', points: 51, isCurrentUser: false },
  { rank: 4, name: 'Sara Spector',   points: 12, isCurrentUser: false },
]

const raceResults = [
  { name: 'Aryeh Spector',  driverName: 'Kimi Antonelli',  teamName: 'Mercedes', pointsEarned: 25, isCurrentUser: false },
  { name: 'Daniel Spector', driverName: 'Lando Norris',    teamName: 'McLaren',  pointsEarned: 18, isCurrentUser: true  },
  { name: 'Ayelet Spector', driverName: 'Charles Leclerc', teamName: 'Ferrari',  pointsEarned: 24, isCurrentUser: false }, // DOUBLE_POINTS chip on a P3 finish
  { name: 'Sara Spector',   driverName: null,              teamName: null,       pointsEarned: 0,  isCurrentUser: false }, // missed the deadline
].sort((a, b) => b.pointsEarned - a.pointsEarned || a.name.localeCompare(b.name))

async function main() {
  const html = await render(
    React.createElement(RaceSummary, {
      playerName: 'Daniel',
      raceName: 'Miami Grand Prix',
      round: 4,
      driverPicked: 'Lando Norris',
      teamName: 'McLaren',
      pointsEarned: 18,
      leagueName: 'Spector Family League',
      leagueUrl: 'http://localhost:3000/league/preview',
      standings,
      raceResults,
      unsubscribeUrl: 'http://localhost:3000/unsubscribe?token=preview',
    }),
  )

  const outPath = join(tmpdir(), 'race-summary-preview.html')
  writeFileSync(outPath, html, 'utf8')
  console.log(`Wrote ${outPath}`)

  if (process.platform === 'darwin') {
    execSync(`open "${outPath}"`)
  } else {
    console.log('Open this file in your browser to view.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
