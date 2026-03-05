/**
 * Tests for route protection proxy (middleware)
 * Covers:
 *   Authenticated users can access /reset-password (email link)
 *   Authenticated users can access /unsubscribe (email link)
 *   Authenticated users are redirected away from /login and /register
 *   Unauthenticated users are redirected to /login for protected routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auth } from '@/auth'

const mockAuth = vi.mocked(auth)

// Capture the callback passed to auth() so we can invoke it directly
let proxyCallback: (req: any) => any

beforeEach(async () => {
  vi.clearAllMocks()
  // auth() is called at module level in proxy.ts with a callback.
  // Our mock captures that callback so we can test the routing logic.
  mockAuth.mockImplementation((cb: any) => {
    proxyCallback = cb
    return cb as any
  })
  // Re-import to trigger the mock capture
  await import('@/proxy')
})

function makeRequest(pathname: string, isLoggedIn: boolean) {
  const url = `http://localhost:3000${pathname}`
  return {
    nextUrl: { pathname },
    url,
    auth: isLoggedIn ? { user: { id: 'user1' } } : null,
  }
}

describe('proxy route protection', () => {
  it('allows authenticated users to access /reset-password', () => {
    const req = makeRequest('/reset-password?token=abc123', true)
    const response = proxyCallback(req)
    // Should NOT redirect to dashboard — let them through
    const location = response?.headers?.get('location')
    expect(location).toBeNull()
  })

  it('allows unauthenticated users to access /reset-password', () => {
    const req = makeRequest('/reset-password?token=abc123', false)
    const response = proxyCallback(req)
    const location = response?.headers?.get('location')
    expect(location).toBeNull()
  })

  it('allows authenticated users to access /unsubscribe', () => {
    const req = makeRequest('/unsubscribe?token=abc123', true)
    const response = proxyCallback(req)
    const location = response?.headers?.get('location')
    expect(location).toBeNull()
  })

  it('redirects authenticated users from /login to /dashboard', () => {
    const req = makeRequest('/login', true)
    const response = proxyCallback(req)
    expect(response?.status).toBe(307)
    expect(response?.headers?.get('location')).toContain('/dashboard')
  })

  it('redirects authenticated users from /register to /dashboard', () => {
    const req = makeRequest('/register', true)
    const response = proxyCallback(req)
    expect(response?.status).toBe(307)
    expect(response?.headers?.get('location')).toContain('/dashboard')
  })

  it('redirects unauthenticated users from /dashboard to /login', () => {
    const req = makeRequest('/dashboard', false)
    const response = proxyCallback(req)
    expect(response?.status).toBe(307)
    expect(response?.headers?.get('location')).toContain('/login')
  })

  it('redirects unauthenticated users from /league/x to /login', () => {
    const req = makeRequest('/league/some-id', false)
    const response = proxyCallback(req)
    expect(response?.status).toBe(307)
    expect(response?.headers?.get('location')).toContain('/login')
  })
})
