import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function requireSuperAdmin() {
  const { session, error } = await requireSession()
  if (error) return { session: null, error }

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { isSuperAdmin: true },
  })

  if (!user?.isSuperAdmin) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { session, error: null }
}
