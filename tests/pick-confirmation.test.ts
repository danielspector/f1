import { after } from 'next/server'
import { render } from '@react-email/render'
import type { ReactElement } from 'react'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { sendEmail } from '@/lib/email'
import { requireSession } from '@/lib/auth-helpers'
import { queuePickConfirmation, sendPickConfirmation } from '@/services/pickConfirmationService'
import type { PickConfirmationProps } from '@/emails/PickConfirmation'
import { makePick, makeRace, makeSeat, makeUser } from './helpers'
import { db } from './prisma-mock'

vi.mock('@/services/pickService', () => ({ getAvailableSeats: vi.fn() }))
vi.mock('@/services/scoringService', () => ({ calculateScoresForRace: vi.fn() }))
import { getAvailableSeats } from '@/services/pickService'
import { calculateScoresForRace } from '@/services/scoringService'
import { POST as submit } from '@/app/api/leagues/[id]/picks/route'
import { POST as adminSubmit } from '@/app/api/leagues/[id]/admin/picks/route'

const USER_ID = 'cm5member123def456ghi7'
const RACE_ID = 'cm5abc123def456ghi789'
const SEAT_ID = 'cm5xyz789abc123def456'

function savedPick() {
  return {
    ...makePick({
      id: 'pick1',
      leagueId: 'league1',
      userId: USER_ID,
      raceId: RACE_ID,
      seatId: SEAT_ID,
    }),
    chip: null,
    race: makeRace({
      id: RACE_ID,
      name: 'Singapore Grand Prix',
      round: 17,
      fp1Deadline: new Date('2026-10-23T08:30:00Z'),
    }),
    seat: makeSeat({
      id: SEAT_ID,
      driverCode: 'BEA',
      driverName: 'Oliver Bearman',
      teamName: 'Haas',
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
  vi.mocked(sendEmail).mockReset().mockResolvedValue(undefined)
  vi.mocked(render).mockReset().mockResolvedValue('<html>receipt</html>')
  db.user.findUnique.mockResolvedValue(
    makeUser({ id: USER_ID, name: 'Jeremy', email: 'jeremy@example.test' }),
  )
  db.league.findUnique.mockResolvedValue({ id: 'league1', name: 'Fair Mu Lawn 1' })
})
afterEach(() => vi.useRealTimers())

async function runQueuedEmail() {
  const callback = vi.mocked(after).mock.calls[0]?.[0]
  expect(typeof callback).toBe('function')
  if (typeof callback === 'function') await callback()
}

describe('pick confirmation delivery', () => {
  it.each([
    [null, 'None'],
    ['DOUBLE_POINTS', 'Double Points'],
    ['SAFETY_NET', 'Safety Net'],
  ] as const)(
    'confirms the saved driver, race, league and %s chip to the picker only',
    async (chip, label) => {
      const pick = { ...savedPick(), chip }
      await sendPickConfirmation(pick)
      expect(sendEmail).toHaveBeenCalledExactlyOnceWith({
        to: 'jeremy@example.test',
        subject: 'Pick confirmed: Oliver Bearman — Singapore Grand Prix — Fair Mu Lawn 1',
        html: '<html>receipt</html>',
      })
      const element = vi.mocked(render).mock.calls[0][0] as ReactElement<PickConfirmationProps>
      expect(element.props).toMatchObject({
        playerName: 'Jeremy',
        leagueName: 'Fair Mu Lawn 1',
        raceName: 'Singapore Grand Prix',
        round: 17,
        seasonYear: 2026,
        driverName: 'Oliver Bearman',
        teamName: 'Haas',
        chipName: label,
        recordedByAdmin: false,
      })
      expect(element.props.fp1Deadline).toContain('08:30')
      expect(element.props.fp1Deadline).toContain('UTC')
      expect(element.props.pickUrl).toContain(`/league/league1/pick/${RACE_ID}`)
    },
  )

  it('sends receipts even when reminder and summary emails are disabled', async () => {
    db.user.findUnique.mockResolvedValue(
      makeUser({
        email: 'jeremy@example.test',
        emailPickReminders: false,
        emailRaceSummaries: false,
      }),
    )
    await sendPickConfirmation(savedPick())
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it.each(['database', 'render', 'provider'])(
    'logs a %s failure without rejecting the saved pick confirmation',
    async (failure) => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      if (failure === 'database')
        db.user.findUnique.mockRejectedValueOnce(new Error('database failed'))
      if (failure === 'render') vi.mocked(render).mockRejectedValueOnce(new Error('render failed'))
      if (failure === 'provider')
        vi.mocked(sendEmail).mockRejectedValueOnce(new Error('provider failed'))
      await expect(sendPickConfirmation(savedPick())).resolves.toBeUndefined()
      expect(log).toHaveBeenCalledWith(expect.stringContaining('pick1'), expect.any(Error))
      log.mockRestore()
    },
  )

  it('does not send if the picker no longer exists', async () => {
    db.user.findUnique.mockResolvedValueOnce(null)
    await sendPickConfirmation(savedPick())
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('confirmation scheduling', () => {
  it('waits until after the response before sending email', async () => {
    queuePickConfirmation(savedPick(), null)
    expect(after).toHaveBeenCalledOnce()
    expect(sendEmail).not.toHaveBeenCalled()
    await runQueuedEmail()
    expect(sendEmail).toHaveBeenCalledOnce()
  })

  it('does not email on an unchanged repeated save', () => {
    const pick = savedPick()
    queuePickConfirmation(pick, { seatId: pick.seatId, chip: null })
    expect(after).not.toHaveBeenCalled()
  })

  it.each([
    { seatId: 'other-seat', chip: null },
    { seatId: SEAT_ID, chip: 'DOUBLE_POINTS' as const },
  ])('sends when a driver or chip changes, including chip removal', (previous) => {
    queuePickConfirmation(savedPick(), previous)
    expect(after).toHaveBeenCalledOnce()
  })

  it('uses the saved snapshot even if the original selection changes before delivery', async () => {
    const pick = savedPick()
    queuePickConfirmation(pick, null, true)
    pick.seat.driverName = 'Fernando Alonso'
    await runQueuedEmail()
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('Oliver Bearman') }),
    )
    const element = vi.mocked(render).mock.calls[0][0] as ReactElement<PickConfirmationProps>
    expect(element.props.recordedByAdmin).toBe(true)
  })

  it('does not fail the response if scheduling itself fails', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(after).mockImplementationOnce(() => {
      throw new Error('schedule failed')
    })
    expect(() => queuePickConfirmation(savedPick(), null)).not.toThrow()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})

describe('pick submission routes', () => {
  function prepare() {
    const pick = savedPick()
    vi.mocked(requireSession).mockResolvedValue({
      session: { user: { id: USER_ID, email: 'jeremy@example.test' }, expires: '2099-01-01' },
      error: null,
    })
    db.leagueMember.findUnique.mockResolvedValue({ role: 'ADMIN' })
    db.race.findUnique.mockResolvedValue(pick.race)
    db.seat.findUnique.mockResolvedValue(pick.seat)
    db.pick.findUnique.mockResolvedValue(null)
    db.pick.upsert.mockResolvedValue(pick)
    db.raceResult.count.mockResolvedValue(0)
    vi.mocked(getAvailableSeats).mockResolvedValue({
      availableSeats: [pick.seat],
      currentPickSeatId: null,
    })
    return pick
  }

  function request() {
    return new Request('http://localhost/api/leagues/league1/picks', {
      method: 'POST',
      body: JSON.stringify({ userId: USER_ID, raceId: RACE_ID, seatId: SEAT_ID }),
    })
  }
  const context = { params: Promise.resolve({ id: 'league1' }) }

  it.each([
    ['member', submit],
    ['admin', adminSubmit],
  ] as const)(
    'schedules a %s confirmation only after the pick has been saved',
    async (_name, route) => {
      prepare()
      const response = await route(request(), context)
      expect(response.status).toBe(201)
      expect(after).toHaveBeenCalledOnce()
      expect(db.pick.upsert.mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(after).mock.invocationCallOrder[0],
      )
      await runQueuedEmail()
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'jeremy@example.test' }))
    },
  )

  it('sends an admin-entered pick to the target member rather than the admin', async () => {
    prepare()
    vi.mocked(requireSession).mockResolvedValue({
      session: {
        user: { id: 'different-admin', email: 'admin@example.test' },
        expires: '2099-01-01',
      },
      error: null,
    })
    const response = await adminSubmit(request(), context)
    expect(response.status).toBe(201)
    await runQueuedEmail()
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID } }),
    )
    const element = vi.mocked(render).mock.calls[0][0] as ReactElement<PickConfirmationProps>
    expect(element.props.recordedByAdmin).toBe(true)
  })

  it.each([
    ['member', submit],
    ['admin', adminSubmit],
  ] as const)('does not schedule a %s email when saving the pick fails', async (_name, route) => {
    prepare()
    db.pick.upsert.mockRejectedValueOnce(new Error('save failed'))
    await expect(route(request(), context)).rejects.toThrow('save failed')
    expect(after).not.toHaveBeenCalled()
  })

  it('does not email a rejected pick after the deadline', async () => {
    const pick = prepare()
    db.race.findUnique.mockResolvedValue({
      ...pick.race,
      fp1Deadline: new Date('2026-10-19T08:30:00Z'),
    })
    expect((await submit(request(), context)).status).toBe(400)
    expect(after).not.toHaveBeenCalled()
  })

  it('still returns a saved pick when the email provider subsequently fails', async () => {
    prepare()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error('delivery failed'))
    const response = await submit(request(), context)
    expect(response.status).toBe(201)
    await expect(runQueuedEmail()).resolves.toBeUndefined()
    expect(db.pick.upsert).toHaveBeenCalledOnce()
    log.mockRestore()
  })

  it('continues recalculating scores for admin changes to scored races', async () => {
    prepare()
    db.raceResult.count.mockResolvedValue(22)
    expect((await adminSubmit(request(), context)).status).toBe(201)
    expect(calculateScoresForRace).toHaveBeenCalledWith(RACE_ID)
    expect(after).toHaveBeenCalledOnce()
  })
})
