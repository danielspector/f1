import { z } from 'zod'

export const RegisterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const CreateLeagueSchema = z.object({
  name: z
    .string()
    .min(1, 'League name is required')
    .max(50, 'League name must be 50 characters or less')
    .transform((s) => s.trim()),
  seasonYear: z.number().int().min(2024).max(2100),
  chipsEnabled: z.boolean().optional(),
})

export const JoinLeagueSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required'),
})

export const UpdateLeagueSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .transform((s) => s.trim())
    .optional(),
  chipsEnabled: z.boolean().optional(),
})

export const UpdateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
})

export const SubmitPickSchema = z.object({
  raceId: z.string().cuid(),
  seatId: z.string().cuid(),
  chip: z.enum(['DOUBLE_POINTS', 'SAFETY_NET']).nullable().optional(),
})

export const IngestResultsSchema = z.object({
  seasonYear: z.number().int().min(2024),
  round: z.number().int().min(1),
})

export const RenewLeagueSchema = z.object({
  seasonYear: z.number().int().min(2024).max(2100),
})
