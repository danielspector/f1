import { vi } from 'vitest'

// Mock Prisma client — use a plain object with vi.fn() mocks.
// We cast to `any` in test files to avoid Prisma's complex generic types
// conflicting with vi.fn() mock types.
vi.mock('@/lib/prisma', () => {
  const createModelMock = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    createMany: vi.fn(),
  })

  return {
    prisma: {
      user: createModelMock(),
      passwordResetToken: createModelMock(),
      league: createModelMock(),
      leagueMember: createModelMock(),
      race: createModelMock(),
      seat: createModelMock(),
      pick: createModelMock(),
      raceResult: createModelMock(),
      playerScore: createModelMock(),
      $transaction: vi.fn((fns: unknown[]) => Promise.all(fns)),
    },
  }
})

// Mock auth helpers
vi.mock('@/lib/auth-helpers', () => ({
  requireSession: vi.fn(),
  requireSuperAdmin: vi.fn(),
}))

// Mock auth
vi.mock('@/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}))

// Mock email
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

// Mock react-email render
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>mock email</html>'),
}))

// Mock rate limiter — always allow in tests
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ limited: false, remaining: 10, retryAfterMs: 0 }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

// Mock F1 data service
vi.mock('@/services/f1DataService', () => ({
  fetchSeasonSchedule: vi.fn(),
  fetchDriverRoster: vi.fn(),
  fetchRaceResults: vi.fn(),
  F1ApiError: class F1ApiError extends Error {
    status?: number
    constructor(message: string, status?: number) {
      super(message)
      this.name = 'F1ApiError'
      this.status = status
    }
  },
}))
