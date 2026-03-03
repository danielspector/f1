/**
 * Tests for Authentication API routes
 * Covers:
 *   FR-01: Users must create an account with an email address and password
 *   NFR-04: Email/password is the only authentication method (no social login)
 *   3.1: Email and password registration and login, password reset via email
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from './prisma-mock'

// We test the route handler logic by importing directly
// Registration route
describe('POST /api/auth/register', () => {
  let POST: (request: Request) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    // Dynamically import to get fresh module with mocks
    const mod = await import('@/app/api/auth/register/route')
    POST = mod.POST
  })

  // FR-01: Users must create an account with email and password
  it('creates a new user with valid data', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.create.mockResolvedValue({
      id: 'user1',
      email: 'new@test.com',
      name: 'New User',
    } as any)

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New User', email: 'new@test.com', password: 'password123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)

    const body = await response.json()
    expect(body.email).toBe('new@test.com')
    expect(body.id).toBe('user1')
  })

  it('rejects registration with duplicate email', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'existing', email: 'dup@test.com' } as any)

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', email: 'dup@test.com', password: 'password123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(409)

    const body = await response.json()
    expect(body.error).toBe('Email already in use')
  })

  it('rejects registration with invalid email', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', email: 'invalid', password: 'password123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('rejects registration with short password', async () => {
    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', email: 'test@test.com', password: 'short' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('hashes the password before storing', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.create.mockResolvedValue({ id: 'u1', email: 'e@t.com', name: 'N' } as any)

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'N', email: 'e@t.com', password: 'plaintext123' }),
    })

    await POST(request)

    const createCall = db.user.create.mock.calls[0][0] as any
    // Password should be hashed, not stored as plaintext
    expect(createCall.data.passwordHash).not.toBe('plaintext123')
    expect(createCall.data.passwordHash).toMatch(/^\$2[aby]\$/) // bcrypt hash format
  })

  // NFR-04: No social login — only email/password
  it('does not include any OAuth or social login fields', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.create.mockResolvedValue({ id: 'u1', email: 'e@t.com', name: 'N' } as any)

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'N', email: 'e@t.com', password: 'password123' }),
    })

    await POST(request)

    const createCall = db.user.create.mock.calls[0][0] as any
    // Only email, name, and passwordHash stored — no OAuth tokens
    expect(createCall.data).toHaveProperty('email')
    expect(createCall.data).toHaveProperty('name')
    expect(createCall.data).toHaveProperty('passwordHash')
    expect(createCall.data).not.toHaveProperty('googleId')
    expect(createCall.data).not.toHaveProperty('provider')
    expect(createCall.data).not.toHaveProperty('oauthToken')
  })
})

// Password reset flow
describe('POST /api/auth/forgot-password', () => {
  let POST: (request: Request) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/auth/forgot-password/route')
    POST = mod.POST
  })

  it('returns success message even for non-existent email (prevents enumeration)', async () => {
    db.user.findUnique.mockResolvedValue(null)

    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@test.com' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.message).toContain('reset link has been sent')
  })

  it('creates a password reset token for existing user', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user1', email: 'exists@test.com' } as any)
    db.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 })
    db.passwordResetToken.create.mockResolvedValue({} as any)

    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'exists@test.com' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    // Token should be created
    expect(db.passwordResetToken.create).toHaveBeenCalledTimes(1)

    // Should invalidate existing tokens first
    expect(db.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user1' },
    })
  })

  it('creates token with 1-hour expiry', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'user1' } as any)
    db.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 })
    db.passwordResetToken.create.mockResolvedValue({} as any)

    const now = Date.now()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const request = new Request('http://localhost/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    })

    await POST(request)

    const createCall = db.passwordResetToken.create.mock.calls[0][0] as any
    const expiry = new Date(createCall.data.expiresAt).getTime()
    const expectedExpiry = now + 1000 * 60 * 60 // 1 hour
    expect(Math.abs(expiry - expectedExpiry)).toBeLessThan(1000) // within 1 second

    vi.useRealTimers()
  })
})

describe('POST /api/auth/reset-password', () => {
  let POST: (request: Request) => Promise<Response>

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/api/auth/reset-password/route')
    POST = mod.POST
  })

  it('rejects invalid token', async () => {
    db.passwordResetToken.findUnique.mockResolvedValue(null)

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'invalid', password: 'newpassword123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('Invalid or expired')
  })

  it('rejects expired token', async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({
      token: 'expired',
      userId: 'user1',
      expiresAt: new Date('2020-01-01'), // expired
    } as any)

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'expired', password: 'newpassword123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it('resets password and deletes token in a transaction', async () => {
    const futureDate = new Date(Date.now() + 3600000)
    db.passwordResetToken.findUnique.mockResolvedValue({
      token: 'valid-token',
      userId: 'user1',
      expiresAt: futureDate,
    } as any)

    db.$transaction.mockImplementation(async (fns: any) => Promise.all(fns))
    db.user.update.mockResolvedValue({} as any)
    db.passwordResetToken.delete.mockResolvedValue({} as any)

    const request = new Request('http://localhost/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'valid-token', password: 'newpassword123' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.message).toBe('Password reset successful')

    // Password should be updated with hash
    expect(db.user.update).toHaveBeenCalled()
    // Token should be deleted
    expect(db.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { token: 'valid-token' },
    })
  })
})
