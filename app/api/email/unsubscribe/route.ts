import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const UnsubscribeSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  pickReminders: z.boolean().optional(),
  raceSummaries: z.boolean().optional(),
  unsubscribeAll: z.boolean().optional(),
})

/**
 * GET: Fetch current email preferences for a user via unsubscribe token.
 * Used by the unsubscribe page to show current state.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { email: true, emailPickReminders: true, emailRaceSummaries: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  return NextResponse.json({
    email: user.email,
    pickReminders: user.emailPickReminders,
    raceSummaries: user.emailRaceSummaries,
  })
}

/**
 * POST: Update email preferences or unsubscribe.
 * No authentication required — the unsubscribe token serves as proof of identity
 * (per CAN-SPAM / GDPR requirements, unsubscribe must work without login).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = UnsubscribeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const { token, pickReminders, raceSummaries, unsubscribeAll } = parsed.data

    const user = await prisma.user.findUnique({
      where: { unsubscribeToken: token },
    })

    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    const data: Record<string, boolean> = {}

    if (unsubscribeAll) {
      data.emailPickReminders = false
      data.emailRaceSummaries = false
    } else {
      if (pickReminders !== undefined) data.emailPickReminders = pickReminders
      if (raceSummaries !== undefined) data.emailRaceSummaries = raceSummaries
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No preferences to update' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data,
    })

    return NextResponse.json({
      message: 'Email preferences updated',
      pickReminders: data.emailPickReminders ?? user.emailPickReminders,
      raceSummaries: data.emailRaceSummaries ?? user.emailRaceSummaries,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
