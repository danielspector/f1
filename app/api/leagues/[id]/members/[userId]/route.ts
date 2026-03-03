import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSession } from '@/lib/auth-helpers'
import { UpdateMemberSchema } from '@/lib/validators'

type Params = { params: Promise<{ id: string; userId: string }> }

async function verifyAdmin(leagueId: string, requestingUserId: string) {
  const membership = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId, userId: requestingUserId } },
  })
  return membership?.role === 'ADMIN'
}

// DELETE /api/leagues/[id]/members/[userId] — remove member
export async function DELETE(_req: Request, { params }: Params) {
  const { session, error } = await requireSession()
  if (error) return error

  const requestingUserId = session!.user.id
  const { id: leagueId, userId: targetUserId } = await params

  const isAdmin = await verifyAdmin(leagueId, requestingUserId)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Prevent removing the last admin
  if (requestingUserId === targetUserId) {
    const adminCount = await prisma.leagueMember.count({
      where: { leagueId, role: 'ADMIN' },
    })
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last admin from a league' },
        { status: 400 },
      )
    }
  }

  await prisma.leagueMember.delete({
    where: { leagueId_userId: { leagueId, userId: targetUserId } },
  })

  return NextResponse.json({ success: true })
}

// PATCH /api/leagues/[id]/members/[userId] — promote/demote member
export async function PATCH(request: Request, { params }: Params) {
  const { session, error } = await requireSession()
  if (error) return error

  const requestingUserId = session!.user.id
  const { id: leagueId, userId: targetUserId } = await params

  const isAdmin = await verifyAdmin(leagueId, requestingUserId)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const parsed = UpdateMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  // Prevent demoting the last admin
  if (parsed.data.role === 'MEMBER') {
    const adminCount = await prisma.leagueMember.count({
      where: { leagueId, role: 'ADMIN' },
    })
    const targetMember = await prisma.leagueMember.findUnique({
      where: { leagueId_userId: { leagueId, userId: targetUserId } },
    })
    if (targetMember?.role === 'ADMIN' && adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot demote the last admin' },
        { status: 400 },
      )
    }
  }

  const updated = await prisma.leagueMember.update({
    where: { leagueId_userId: { leagueId, userId: targetUserId } },
    data: { role: parsed.data.role },
  })

  return NextResponse.json(updated)
}
