import { auth } from '@/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/unsubscribe']
const JOIN_PATH_PREFIX = '/join/'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Allow public auth pages
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // Redirect authenticated users away from auth pages (except reset-password
    // and unsubscribe, which should always be accessible via email links)
    if (isLoggedIn && !pathname.startsWith('/reset-password') && !pathname.startsWith('/unsubscribe')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return NextResponse.next()
  }

  // Allow join pages (redirect to login with callbackUrl if not logged in)
  if (pathname.startsWith(JOIN_PATH_PREFIX)) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', req.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // Protect dashboard and league routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/league')) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', req.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
