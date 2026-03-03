import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: Request, { params }: Params) {
  const { session, error } = await requireSession()
  if (error) return error

  const userId = session!.user.id
  const { id } = await params

  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: id, userId } },
  })
  if (!membership || membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.league.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  })

  return NextResponse.json(updated)
}
