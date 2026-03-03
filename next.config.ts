import type { NextConfig } from 'next'

const securityHeaders = [
  // Prevent clickjacking — only allow same-origin framing
  { key: 'X-Frame-Options', value: 'DENY' },
  // Block MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control Referer header — only send origin on cross-origin requests
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Enforce HTTPS via HSTS (1 year, include subdomains, allow preload list)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  // Opt out of Google FLoC / Topics API
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires inline scripts
      "style-src 'self' 'unsafe-inline'", // Tailwind + inline styles
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.jolpi.ca",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  // Prevent XSS attacks in older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
]

const nextConfig: NextConfig = {
  headers: async () => [
    {
      // Apply security headers to all routes
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
}

export default nextConfig
