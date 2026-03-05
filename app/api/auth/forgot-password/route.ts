import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { render } from '@react-email/render'
import React from 'react'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { ForgotPasswordSchema } from '@/lib/validators'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import PasswordReset from '@/emails/PasswordReset'

// 3 password reset requests per IP per 15 minutes
const RATE_LIMIT = 3
const RATE_WINDOW_MS = 15 * 60 * 1000

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const { limited, retryAfterMs } = rateLimit(`forgot:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)

    if (limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
        },
      )
    }

    const body = await request.json()
    const parsed = ForgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { email } = parsed.data
    const user = await prisma.user.findUnique({ where: { email } })

    // Always return 200 to avoid email enumeration
    if (!user) {
      return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' })
    }

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60) // 1 hour

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    })

    const baseUrl = process.env.NEXTAUTH_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    // Send password reset email
    const html = await render(
      React.createElement(PasswordReset, {
        playerName: user.name || user.email,
        resetUrl,
      }),
    )

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your F1 League password',
        html,
      })
    } catch (err) {
      console.error(`[PasswordReset] Failed to send to ${email}:`, err)
      // Don't fail the request — user can try again
    }

    return NextResponse.json({ message: 'If that email exists, a reset link has been sent.' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
