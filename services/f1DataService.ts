/**
 * F1 Data Service — wraps the Jolpica API (https://api.jolpi.ca/ergast/f1/)
 *
 * Key endpoints used:
 *
 * GET /{season}/races.json
 *   Returns the full race schedule. Each race includes session times under
 *   FirstPractice, SecondPractice, ThirdPractice, Qualifying, Sprint, Race.
 *   Session times are returned as separate date + time strings in UTC.
 *   Example race object:
 *   {
 *     season: "2025", round: "1", raceName: "Bahrain Grand Prix",
 *     Circuit: { circuitName: "Bahrain International Circuit", ... },
 *     date: "2025-03-02", time: "15:00:00Z",
 *     FirstPractice: { date: "2025-02-28", time: "11:30:00Z" },
 *     ...
 *   }
 *
 * GET /{season}/drivers.json
 *   Returns all drivers for the season. Each entry includes driverId, code,
 *   givenName, familyName, and a Constructors array nested in the standing.
 *   Note: to get team info per driver use /{season}/driverStandings.json
 *   which includes Constructor data.
 *
 * GET /{season}/{round}/results.json
 *   Returns race results. Each result includes position, points, Driver (driverId, code),
 *   Constructor (constructorId, name), status (Finished / +1 Lap / Retired / etc.).
 */

const BASE_URL = process.env.JOLPICA_BASE_URL || 'https://api.jolpi.ca/ergast/f1'

export class F1ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = 'F1ApiError'
  }
}

async function jolpicaFetch<T>(path: string, revalidate = 3600): Promise<T> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, { next: { revalidate } })

  if (!res.ok) {
    throw new F1ApiError(`Jolpica API error: ${res.status} ${res.statusText}`, res.status)
  }

  const data = await res.json()
  return data as T
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RaceScheduleItem {
  round: number
  name: string
  circuit: string
  fp1Datetime: Date
  raceDatetime: Date
}

export interface DriverRosterItem {
  driverCode: string
  driverName: string
  teamName: string
}

export interface RaceResultItem {
  driverCode: string
  position: number | null
  points: number
}

// ─── API response shapes ──────────────────────────────────────────────────────

interface JolpicaRace {
  round: string
  raceName: string
  Circuit: { circuitName: string }
  date: string
  time: string
  FirstPractice?: { date: string; time: string }
}

interface JolpicaDriverStanding {
  Driver: { code: string; givenName: string; familyName: string }
  Constructors: Array<{ name: string }>
}

interface JolpicaResult {
  position: string
  points: string
  status: string
  Driver: { code: string }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchSeasonSchedule(year: number): Promise<RaceScheduleItem[]> {
  const data = await jolpicaFetch<{
    MRData: { RaceTable: { Races: JolpicaRace[] } }
  }>(`/${year}/races.json`, 3600)

  const races = data.MRData.RaceTable.Races
  return races.map((r) => {
    const raceDateTime = new Date(`${r.date}T${r.time}`)

    // FP1 deadline = the exact start of FP1; if missing, default to race day - 2 days at 10:00 UTC
    let fp1Datetime: Date
    if (r.FirstPractice?.date && r.FirstPractice?.time) {
      fp1Datetime = new Date(`${r.FirstPractice.date}T${r.FirstPractice.time}`)
    } else {
      fp1Datetime = new Date(raceDateTime.getTime() - 2 * 24 * 60 * 60 * 1000)
      fp1Datetime.setUTCHours(10, 0, 0, 0)
    }

    return {
      round: parseInt(r.round, 10),
      name: r.raceName,
      circuit: r.Circuit.circuitName,
      fp1Datetime,
      raceDatetime: raceDateTime,
    }
  })
}

export async function fetchDriverRoster(year: number): Promise<DriverRosterItem[]> {
  // Primary: use driver standings (includes team info, works once season has started)
  const data = await jolpicaFetch<{
    MRData: { StandingsTable: { StandingsLists: Array<{ DriverStandings: JolpicaDriverStanding[] }> } }
  }>(`/${year}/driverStandings.json`, 3600)

  const lists = data.MRData.StandingsTable.StandingsLists
  if (lists.length && lists[0].DriverStandings.length) {
    return lists[0].DriverStandings.map((s) => ({
      driverCode: s.Driver.code,
      driverName: `${s.Driver.givenName} ${s.Driver.familyName}`,
      teamName: s.Constructors[0]?.name ?? 'Unknown',
    }))
  }

  // Fallback: season hasn't started yet — try last year's standings with this year's driver list
  console.log(`[F1DataService] No standings for ${year}, falling back to ${year - 1}`)
  const fallback = await jolpicaFetch<{
    MRData: { StandingsTable: { StandingsLists: Array<{ DriverStandings: JolpicaDriverStanding[] }> } }
  }>(`/${year - 1}/driverStandings.json`, 3600)

  const fallbackLists = fallback.MRData.StandingsTable.StandingsLists
  if (!fallbackLists.length) return []

  // Get the current year's driver list to filter to only active drivers
  const currentDriversData = await jolpicaFetch<{
    MRData: { DriverTable: { Drivers: Array<{ code: string; givenName: string; familyName: string }> } }
  }>(`/${year}/drivers.json`, 3600)
  const currentDriverCodes = new Set(
    currentDriversData.MRData.DriverTable.Drivers.map((d) => d.code),
  )

  // Keep last year's team assignments for drivers who are still on the grid
  const lastYearRoster = fallbackLists[0].DriverStandings
    .filter((s) => currentDriverCodes.has(s.Driver.code))
    .map((s) => ({
      driverCode: s.Driver.code,
      driverName: `${s.Driver.givenName} ${s.Driver.familyName}`,
      teamName: s.Constructors[0]?.name ?? 'Unknown',
    }))

  // Add new drivers (in current year but not in last year) with Unknown team
  const lastYearCodes = new Set(lastYearRoster.map((d) => d.driverCode))
  const newDrivers = currentDriversData.MRData.DriverTable.Drivers
    .filter((d) => !lastYearCodes.has(d.code))
    .map((d) => ({
      driverCode: d.code,
      driverName: `${d.givenName} ${d.familyName}`,
      teamName: 'Unknown',
    }))

  return [...lastYearRoster, ...newDrivers]
}

export async function fetchRaceResults(year: number, round: number): Promise<RaceResultItem[]> {
  const data = await jolpicaFetch<{
    MRData: { RaceTable: { Races: Array<{ Results: JolpicaResult[] }> } }
  }>(`/${year}/${round}/results.json`, 600)

  const races = data.MRData.RaceTable.Races
  if (!races.length) return []

  return races[0].Results.map((r) => {
    const pos = parseInt(r.position, 10)
    return {
      driverCode: r.Driver.code,
      position: isNaN(pos) ? null : pos,
      points: parseFloat(r.points) || 0,
    }
  })
}
