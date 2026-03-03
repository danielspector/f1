import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'
import { RenewLeagueSchema } from '@/lib/validators'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
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

  const sourceLeague = await prisma.league.findUnique({
    where: { id },
    include: { members: true },
  })
  if (!sourceLeague) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (sourceLeague.status !== 'ARCHIVED') {
    return NextResponse.json({ error: 'League must be archived before renewal' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const parsed = RenewLeagueSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { seasonYear } = parsed.data

  // Check if already renewed for this season
  const existingRenewal = await prisma.league.findFirst({
    where: { name: sourceLeague.name, seasonYear, createdById: sourceLeague.createdById },
  })
  if (existingRenewal) {
    return NextResponse.json({ leagueId: existingRenewal.id, alreadyExists: true })
  }

  const newLeague = await prisma.league.create({
    data: {
      name: sourceLeague.name,
      seasonYear,
      inviteCode: crypto.randomUUID(),
      createdById: sourceLeague.createdById,
      members: {
        createMany: {
          data: sourceLeague.members.map((m) => ({ userId: m.userId, role: m.role })),
        },
      },
    },
  })

  return NextResponse.json(newLeague, { status: 201 })
}
