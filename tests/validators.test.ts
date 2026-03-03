/**
 * Tests for validation schemas
 * Covers: FR-01 (user account creation), league creation, pick submission, etc.
 */
import { describe, it, expect } from 'vitest'
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  CreateLeagueSchema,
  JoinLeagueSchema,
  UpdateLeagueSchema,
  UpdateMemberSchema,
  SubmitPickSchema,
  IngestResultsSchema,
  RenewLeagueSchema,
} from '@/lib/validators'

describe('RegisterSchema', () => {
  // FR-01: Users must create an account with email and password
  it('accepts valid registration data', () => {
    const result = RegisterSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = RegisterSchema.safeParse({
      name: '',
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 100 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'a'.repeat(101),
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = RegisterSchema.safeParse({
      name: 'John',
      email: 'not-an-email',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password shorter than 8 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'John',
      email: 'john@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
  })

  it('accepts password of exactly 8 characters', () => {
    const result = RegisterSchema.safeParse({
      name: 'John',
      email: 'john@example.com',
      password: '12345678',
    })
    expect(result.success).toBe(true)
  })
})

describe('LoginSchema', () => {
  // NFR-04: Email/password is the only authentication method
  it('accepts valid login data', () => {
    const result = LoginSchema.safeParse({
      email: 'john@example.com',
      password: 'password123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = LoginSchema.safeParse({
      email: 'invalid',
      password: 'password123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = LoginSchema.safeParse({
      email: 'john@example.com',
      password: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('ForgotPasswordSchema', () => {
  it('accepts valid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'john@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = ForgotPasswordSchema.safeParse({ email: 'bad' })
    expect(result.success).toBe(false)
  })
})

describe('ResetPasswordSchema', () => {
  it('accepts valid token and password', () => {
    const result = ResetPasswordSchema.safeParse({
      token: 'abc123def456',
      password: 'newpassword123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty token', () => {
    const result = ResetPasswordSchema.safeParse({
      token: '',
      password: 'newpassword123',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password on reset', () => {
    const result = ResetPasswordSchema.safeParse({
      token: 'abc123',
      password: 'short',
    })
    expect(result.success).toBe(false)
  })
})

describe('CreateLeagueSchema', () => {
  // FR-02: Any user can create a league
  it('accepts valid league creation data', () => {
    const result = CreateLeagueSchema.safeParse({
      name: 'My F1 League',
      seasonYear: 2026,
    })
    expect(result.success).toBe(true)
  })

  it('trims whitespace from league name', () => {
    const result = CreateLeagueSchema.safeParse({
      name: '  My League  ',
      seasonYear: 2026,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('My League')
    }
  })

  it('rejects empty league name', () => {
    const result = CreateLeagueSchema.safeParse({
      name: '',
      seasonYear: 2026,
    })
    expect(result.success).toBe(false)
  })

  it('rejects league name over 50 characters', () => {
    const result = CreateLeagueSchema.safeParse({
      name: 'a'.repeat(51),
      seasonYear: 2026,
    })
    expect(result.success).toBe(false)
  })

  it('rejects season year before 2024', () => {
    const result = CreateLeagueSchema.safeParse({
      name: 'League',
      seasonYear: 2023,
    })
    expect(result.success).toBe(false)
  })

  it('rejects season year after 2100', () => {
    const result = CreateLeagueSchema.safeParse({
      name: 'League',
      seasonYear: 2101,
    })
    expect(result.success).toBe(false)
  })
})

describe('JoinLeagueSchema', () => {
  // FR-03: Users can join via invite link
  it('accepts valid invite code', () => {
    const result = JoinLeagueSchema.safeParse({ inviteCode: 'abc123' })
    expect(result.success).toBe(true)
  })

  it('rejects empty invite code', () => {
    const result = JoinLeagueSchema.safeParse({ inviteCode: '' })
    expect(result.success).toBe(false)
  })
})

describe('UpdateLeagueSchema', () => {
  // FR-13: League admins can rename the league
  it('accepts valid name update', () => {
    const result = UpdateLeagueSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (no updates)', () => {
    const result = UpdateLeagueSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('trims whitespace from updated name', () => {
    const result = UpdateLeagueSchema.safeParse({ name: '  Trimmed  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Trimmed')
    }
  })
})

describe('UpdateMemberSchema', () => {
  // FR-13: Promote other members to admin
  it('accepts ADMIN role', () => {
    const result = UpdateMemberSchema.safeParse({ role: 'ADMIN' })
    expect(result.success).toBe(true)
  })

  it('accepts MEMBER role', () => {
    const result = UpdateMemberSchema.safeParse({ role: 'MEMBER' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid role', () => {
    const result = UpdateMemberSchema.safeParse({ role: 'OWNER' })
    expect(result.success).toBe(false)
  })
})

describe('SubmitPickSchema', () => {
  // FR-04: Each player must select one driver seat per race weekend
  it('accepts valid pick data with CUID format', () => {
    // CUIDs start with 'c' followed by alphanumeric characters
    const result = SubmitPickSchema.safeParse({
      raceId: 'cm5abc123def456ghi789',
      seatId: 'cm5xyz789abc123def456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid raceId format', () => {
    const result = SubmitPickSchema.safeParse({
      raceId: 'not-a-cuid',
      seatId: 'cm5xyz789abc123def456',
    })
    expect(result.success).toBe(false)
  })
})

describe('IngestResultsSchema', () => {
  it('accepts valid ingest params', () => {
    const result = IngestResultsSchema.safeParse({ seasonYear: 2026, round: 1 })
    expect(result.success).toBe(true)
  })

  it('rejects year before 2024', () => {
    const result = IngestResultsSchema.safeParse({ seasonYear: 2020, round: 1 })
    expect(result.success).toBe(false)
  })

  it('rejects round less than 1', () => {
    const result = IngestResultsSchema.safeParse({ seasonYear: 2026, round: 0 })
    expect(result.success).toBe(false)
  })
})

describe('RenewLeagueSchema', () => {
  // FR-14: Leagues can be renewed for the next season
  it('accepts valid season year', () => {
    const result = RenewLeagueSchema.safeParse({ seasonYear: 2027 })
    expect(result.success).toBe(true)
  })

  it('rejects year before 2024', () => {
    const result = RenewLeagueSchema.safeParse({ seasonYear: 2023 })
    expect(result.success).toBe(false)
  })

  it('rejects year after 2100', () => {
    const result = RenewLeagueSchema.safeParse({ seasonYear: 2101 })
    expect(result.success).toBe(false)
  })
})
