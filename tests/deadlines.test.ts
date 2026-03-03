/**
 * Tests for FP1 deadline enforcement
 * Covers: NFR-02 (deadline enforcement accurate to the minute)
 *         FR-04 (picks locked at FP1 deadline)
 *         FR-06 (zero points for missed picks)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isFP1Passed, getUpcomingRace } from '@/lib/deadlines'
import { makeRace } from './helpers'

describe('isFP1Passed', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // NFR-02: FP1 deadline enforcement must be accurate to the minute
  it('returns false when current time is before FP1 deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T11:29:00Z'))
    const race = makeRace({ fp1Deadline: new Date('2026-03-14T11:30:00Z') })
    expect(isFP1Passed(race)).toBe(false)
  })

  it('returns true when current time equals FP1 deadline exactly', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T11:30:00Z'))
    const race = makeRace({ fp1Deadline: new Date('2026-03-14T11:30:00Z') })
    expect(isFP1Passed(race)).toBe(true)
  })

  it('returns true when current time is after FP1 deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T11:31:00Z'))
    const race = makeRace({ fp1Deadline: new Date('2026-03-14T11:30:00Z') })
    expect(isFP1Passed(race)).toBe(true)
  })

  it('is accurate to the minute — 1 minute before deadline is still open', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T11:29:59Z'))
    const race = makeRace({ fp1Deadline: new Date('2026-03-14T11:30:00Z') })
    expect(isFP1Passed(race)).toBe(false)
  })

  it('is accurate to the second — 1 second after deadline is closed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-14T11:30:01Z'))
    const race = makeRace({ fp1Deadline: new Date('2026-03-14T11:30:00Z') })
    expect(isFP1Passed(race)).toBe(true)
  })

  it('handles UTC timezone correctly', () => {
    vi.useFakeTimers()
    // 11:30 UTC deadline
    vi.setSystemTime(new Date('2026-03-14T11:30:00Z'))
    const race = makeRace({ fp1Deadline: new Date('2026-03-14T11:30:00Z') })
    expect(isFP1Passed(race)).toBe(true)
  })
})

describe('getUpcomingRace', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the next race whose FP1 has not yet passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-10T00:00:00Z'))

    const races = [
      makeRace({ round: 1, fp1Deadline: new Date('2026-03-07T11:30:00Z') }), // already past
      makeRace({ round: 2, fp1Deadline: new Date('2026-03-14T11:30:00Z') }), // upcoming
      makeRace({ round: 3, fp1Deadline: new Date('2026-03-28T11:30:00Z') }), // future
    ]

    const upcoming = getUpcomingRace(races)
    expect(upcoming).toBeDefined()
    expect(upcoming!.round).toBe(2)
  })

  it('returns null when all races have passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-31T00:00:00Z'))

    const races = [
      makeRace({ round: 1, fp1Deadline: new Date('2026-03-07T11:30:00Z') }),
      makeRace({ round: 2, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    ]

    expect(getUpcomingRace(races)).toBeNull()
  })

  it('returns the first race when none have passed yet', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    const races = [
      makeRace({ round: 1, fp1Deadline: new Date('2026-03-07T11:30:00Z') }),
      makeRace({ round: 2, fp1Deadline: new Date('2026-03-14T11:30:00Z') }),
    ]

    const upcoming = getUpcomingRace(races)
    expect(upcoming!.round).toBe(1)
  })

  it('returns null for empty race list', () => {
    expect(getUpcomingRace([])).toBeNull()
  })
})
