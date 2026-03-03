/**
 * Shared test helpers and factory functions for creating test data.
 */

let counter = 0
function nextId() {
  return `cuid_${++counter}`
}

export function resetIdCounter() {
  counter = 0
}

export function makeUser(
  overrides: Partial<{
    id: string
    email: string
    name: string | null
    passwordHash: string
    createdAt: Date
    updatedAt: Date
  }> = {},
) {
  return {
    id: overrides.id ?? nextId(),
    email: overrides.email ?? `user${counter}@test.com`,
    name: overrides.name ?? `User ${counter}`,
    passwordHash: overrides.passwordHash ?? '$2a$12$hashedpassword',
    createdAt: overrides.createdAt ?? new Date('2026-01-01'),
    updatedAt: overrides.updatedAt ?? new Date('2026-01-01'),
  }
}

export function makeLeague(
  overrides: Partial<{
    id: string
    name: string
    inviteCode: string
    seasonYear: number
    status: 'ACTIVE' | 'ARCHIVED'
    createdById: string
    createdAt: Date
    updatedAt: Date
  }> = {},
) {
  return {
    id: overrides.id ?? nextId(),
    name: overrides.name ?? `Test League ${counter}`,
    inviteCode: overrides.inviteCode ?? `invite_${counter}`,
    seasonYear: overrides.seasonYear ?? 2026,
    status: overrides.status ?? 'ACTIVE',
    createdById: overrides.createdById ?? nextId(),
    createdAt: overrides.createdAt ?? new Date('2026-01-01'),
    updatedAt: overrides.updatedAt ?? new Date('2026-01-01'),
  }
}

export function makeMember(
  overrides: Partial<{
    id: string
    leagueId: string
    userId: string
    role: 'MEMBER' | 'ADMIN'
    joinedAt: Date
  }> = {},
) {
  return {
    id: overrides.id ?? nextId(),
    leagueId: overrides.leagueId ?? nextId(),
    userId: overrides.userId ?? nextId(),
    role: overrides.role ?? 'MEMBER',
    joinedAt: overrides.joinedAt ?? new Date('2026-01-01'),
  }
}

export function makeRace(
  overrides: Partial<{
    id: string
    seasonYear: number
    round: number
    name: string
    circuit: string
    fp1Deadline: Date
    raceDatetime: Date
  }> = {},
) {
  return {
    id: overrides.id ?? nextId(),
    seasonYear: overrides.seasonYear ?? 2026,
    round: overrides.round ?? 1,
    name: overrides.name ?? `Grand Prix ${counter}`,
    circuit: overrides.circuit ?? `Circuit ${counter}`,
    fp1Deadline: overrides.fp1Deadline ?? new Date('2026-03-14T11:30:00Z'),
    raceDatetime: overrides.raceDatetime ?? new Date('2026-03-16T15:00:00Z'),
  }
}

export function makeSeat(
  overrides: Partial<{
    id: string
    seasonYear: number
    teamName: string
    driverName: string
    driverCode: string
  }> = {},
) {
  return {
    id: overrides.id ?? nextId(),
    seasonYear: overrides.seasonYear ?? 2026,
    teamName: overrides.teamName ?? `Team ${counter}`,
    driverName: overrides.driverName ?? `Driver ${counter}`,
    driverCode: overrides.driverCode ?? `D${counter}`,
  }
}

export function makePick(
  overrides: Partial<{
    id: string
    leagueId: string
    userId: string
    raceId: string
    seatId: string
    submittedAt: Date
  }> = {},
) {
  return {
    id: overrides.id ?? nextId(),
    leagueId: overrides.leagueId ?? nextId(),
    userId: overrides.userId ?? nextId(),
    raceId: overrides.raceId ?? nextId(),
    seatId: overrides.seatId ?? nextId(),
    submittedAt: overrides.submittedAt ?? new Date('2026-03-13'),
  }
}

export function makeRaceResult(
  overrides: Partial<{
    id: string
    raceId: string
    seatId: string
    position: number | null
    points: number
  }> = {},
) {
  return {
    id: overrides.id ?? nextId(),
    raceId: overrides.raceId ?? nextId(),
    seatId: overrides.seatId ?? nextId(),
    position: overrides.position ?? 1,
    points: overrides.points ?? 25,
  }
}

export function makePlayerScore(
  overrides: Partial<{
    id: string
    leagueId: string
    userId: string
    raceId: string
    pickId: string
    pointsEarned: number
  }> = {},
) {
  return {
    id: overrides.id ?? nextId(),
    leagueId: overrides.leagueId ?? nextId(),
    userId: overrides.userId ?? nextId(),
    raceId: overrides.raceId ?? nextId(),
    pickId: overrides.pickId ?? nextId(),
    pointsEarned: overrides.pointsEarned ?? 0,
  }
}

/**
 * Generate a full 20-seat grid for a season
 */
export function makeFullGrid(seasonYear = 2026) {
  const teams = [
    {
      team: 'McLaren',
      drivers: [
        { name: 'Lando Norris', code: 'NOR' },
        { name: 'Oscar Piastri', code: 'PIA' },
      ],
    },
    {
      team: 'Ferrari',
      drivers: [
        { name: 'Charles Leclerc', code: 'LEC' },
        { name: 'Lewis Hamilton', code: 'HAM' },
      ],
    },
    {
      team: 'Red Bull',
      drivers: [
        { name: 'Max Verstappen', code: 'VER' },
        { name: 'Liam Lawson', code: 'LAW' },
      ],
    },
    {
      team: 'Mercedes',
      drivers: [
        { name: 'George Russell', code: 'RUS' },
        { name: 'Andrea Kimi Antonelli', code: 'ANT' },
      ],
    },
    {
      team: 'Aston Martin',
      drivers: [
        { name: 'Fernando Alonso', code: 'ALO' },
        { name: 'Lance Stroll', code: 'STR' },
      ],
    },
    {
      team: 'Alpine',
      drivers: [
        { name: 'Pierre Gasly', code: 'GAS' },
        { name: 'Jack Doohan', code: 'DOO' },
      ],
    },
    {
      team: 'Williams',
      drivers: [
        { name: 'Carlos Sainz', code: 'SAI' },
        { name: 'Alexander Albon', code: 'ALB' },
      ],
    },
    {
      team: 'Audi',
      drivers: [
        { name: 'Nico Hulkenberg', code: 'HUL' },
        { name: 'Gabriel Bortoleto', code: 'BOR' },
      ],
    },
    {
      team: 'Haas',
      drivers: [
        { name: 'Esteban Ocon', code: 'OCO' },
        { name: 'Oliver Bearman', code: 'BEA' },
      ],
    },
    {
      team: 'Cadillac',
      drivers: [
        { name: 'Yuki Tsunoda', code: 'TSU' },
        { name: 'Isack Hadjar', code: 'HAD' },
      ],
    },
  ]

  const seats = teams.flatMap(({ team, drivers }) =>
    drivers.map((d) =>
      makeSeat({
        seasonYear,
        teamName: team,
        driverName: d.name,
        driverCode: d.code,
      }),
    ),
  )

  return seats
}

/**
 * F1 standard points system mapping
 */
export const F1_POINTS: Record<number, number> = {
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
