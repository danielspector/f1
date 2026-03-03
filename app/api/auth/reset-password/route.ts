import { NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { ResetPasswordSchema } from '@/lib/validators'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

// 5 reset attempts per IP per 15 minutes
const RATE_LIMIT_COUNT = 5
const RATE_WINDOW_MS = 15 * 60 * 1000

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const { limited, retryAfterMs } = rateLimit(`reset:${ip}`, RATE_LIMIT_COUNT, RATE_WINDOW_MS)

    if (limited) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
        },
      )
    }

    const body = await request.json()
    const parsed = ResetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { token, password } = parsed.data

    const resetToken = await prisma.passwordResetToken.findUnique({ where: { token } })

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 })
    }

    const passwordHash = await hash(password, 12)

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    })

    await prisma.passwordResetToken.delete({ where: { token } })

    return NextResponse.json({ message: 'Password reset successful' })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
