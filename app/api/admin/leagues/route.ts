import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth-helpers'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const leagues = await prisma.league.findMany({
    select: {
      id: true,
      name: true,
      seasonYear: true,
      status: true,
      createdAt: true,
      chipsEnabled: true,
      createdById: true,
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const creatorIds = [...new Set(leagues.map((l) => l.createdById))]
  const creators = await prisma.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, name: true, email: true },
  })
  const creatorMap = new Map(creators.map((c) => [c.id, c]))

  const result = leagues.map((l) => {
    const creator = creatorMap.get(l.createdById)
    return {
      id: l.id,
      name: l.name,
      seasonYear: l.seasonYear,
      status: l.status,
      createdAt: l.createdAt,
      chipsEnabled: l.chipsEnabled,
      memberCount: l._count.members,
      createdBy: creator ? (creator.name || creator.email) : 'Unknown',
    }
  })

  return NextResponse.json(result)
}
