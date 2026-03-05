import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/auth-helpers'

export async function GET() {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      isSuperAdmin: true,
      _count: { select: { leagueMembers: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt,
    isSuperAdmin: u.isSuperAdmin,
    leagueCount: u._count.leagueMembers,
  }))

  return NextResponse.json(result)
}
