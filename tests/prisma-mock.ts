/**
 * Helper to get a properly typed mock of the Prisma client.
 * Cast to `any` to avoid Prisma's complex generic types
 * conflicting with vi.fn() mock method types.
 */
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = prisma as any
