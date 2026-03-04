'use client'

import { useState } from 'react'
import type { Seat } from '@prisma/client'

interface SeatWithAvailability extends Seat {
  available: boolean
}

type ChipType = 'DOUBLE_POINTS' | 'SAFETY_NET'

interface Props {
  seats: SeatWithAvailability[]
  currentPickSeatId?: string | null
  isLocked: boolean
  raceName: string
  leagueId: string
  raceId: string
  chipsEnabled?: boolean
  usedChips?: ChipType[]
  currentChip?: ChipType | null
  onPickSubmitted: (seatId: string, chip?: ChipType | null) => void
}

// Team color accents
const TEAM_COLORS: Record<string, string> = {
  'Red Bull': '#3671C6',
  Ferrari: '#E8002D',
  Mercedes: '#27F4D2',
  McLaren: '#FF8000',
  'Aston Martin': '#229971',
  Alpine: '#FF87BC',
  Williams: '#64C4FF',
  'Kick Sauber': '#52E252',
  'RB F1 Team': '#6692FF',
  Haas: '#B6BABD',
}

function teamColor(teamName: string): string {
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (teamName.includes(key)) return color
  }
  return '#6b6b6b'
}

export default function DriverSelector({
  seats,
  currentPickSeatId,
  isLocked,
  raceName,
  leagueId,
  raceId,
  chipsEnabled = false,
  usedChips = [],
  currentChip = null,
  onPickSubmitted,
}: Props) {
  const [confirming, setConfirming] = useState<Seat | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [selectedChip, setSelectedChip] = useState<ChipType | null>(currentChip)

  // Group by team
  const byTeam = seats.reduce<Record<string, SeatWithAvailability[]>>((acc, seat) => {
    if (!acc[seat.teamName]) acc[seat.teamName] = []
    acc[seat.teamName].push(seat)
    return acc
  }, {})

  function handleSeatClick(seat: SeatWithAvailability) {
    if (isLocked || !seat.available || seat.id === currentPickSeatId) return
    setConfirming(seat)
  }

  async function handleConfirm() {
    if (!confirming) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/leagues/${leagueId}/picks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raceId, seatId: confirming.id, chip: selectedChip }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit pick')
        setConfirming(null)
        return
      }

      setToast(`✓ ${confirming.driverName} confirmed for ${raceName}!`)
      setTimeout(() => setToast(''), 4000)
      onPickSubmitted(confirming.id, selectedChip)
      setConfirming(null)
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-800 text-green-100 px-5 py-3 rounded-xl text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {isLocked && (
        <div className="bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-4 py-3 mb-4 text-sm text-gray-400 text-center">
          Picks are locked — FP1 has started.
        </div>
      )}

      {/* Chip selector */}
      {chipsEnabled && !isLocked && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Activate a chip</p>
          <div className="flex gap-2">
            {([
              { key: 'DOUBLE_POINTS' as ChipType, label: 'Double Points (2x)', shortLabel: '2x' },
              { key: 'SAFETY_NET' as ChipType, label: 'Safety Net', shortLabel: 'SN' },
            ]).map(({ key, label }) => {
              const isUsed = usedChips.includes(key)
              const isActive = selectedChip === key
              return (
                <button
                  key={key}
                  onClick={() => setSelectedChip(isActive ? null : key)}
                  disabled={isUsed}
                  className={[
                    'text-sm px-3 py-2 rounded-lg border transition-colors',
                    isActive
                      ? 'border-[#e10600] bg-[#e10600]/20 text-white'
                      : isUsed
                        ? 'border-[#2a2a2a] bg-[#1a1a1a] text-gray-600 cursor-not-allowed opacity-40'
                        : 'border-[#2a2a2a] bg-[#1a1a1a] text-gray-300 hover:border-gray-400 cursor-pointer',
                  ].join(' ')}
                >
                  {label}{isUsed ? ' (used)' : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(byTeam).map(([teamName, teamSeats]) => (
          <div key={teamName}>
            <div
              className="flex items-center gap-2 mb-2"
              style={{ color: teamColor(teamName) }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: teamColor(teamName) }}
              />
              <span className="text-sm font-medium">{teamName}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {teamSeats.map((seat) => {
                const isSelected = seat.id === currentPickSeatId
                const isUnavailable = !seat.available && !isSelected
                const isClickable = !isLocked && seat.available && !isSelected

                return (
                  <button
                    key={seat.id}
                    onClick={() => handleSeatClick(seat)}
                    disabled={!isClickable}
                    className={[
                      'text-left rounded-lg border p-3 transition-all text-sm',
                      isSelected
                        ? 'border-[#e10600] bg-[#e10600]/10 text-white'
                        : isUnavailable
                          ? 'border-[#2a2a2a] bg-[#1a1a1a] text-gray-600 cursor-not-allowed opacity-40'
                          : isClickable
                            ? 'border-[#2a2a2a] bg-[#1a1a1a] text-white hover:border-gray-400 cursor-pointer'
                            : 'border-[#2a2a2a] bg-[#1a1a1a] text-gray-400 cursor-not-allowed',
                    ].join(' ')}
                  >
                    <div className="font-semibold truncate">{seat.driverName}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{seat.driverCode}</div>
                    {isSelected && (
                      <div className="text-xs text-[#e10600] mt-1 font-medium">✓ Your pick</div>
                    )}
                    {isUnavailable && (
                      <div className="text-xs text-gray-600 mt-1">Already used</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 px-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold text-lg mb-1">Confirm your pick</h3>
            <p className="text-gray-400 text-sm mb-4">
              {currentPickSeatId ? 'Change your pick to ' : 'Pick '}
              <span className="text-white font-medium">{confirming.driverName}</span> for{' '}
              <span className="text-white font-medium">{raceName}</span>
              {selectedChip && (
                <> with <span className="text-[#e10600] font-medium">{selectedChip === 'DOUBLE_POINTS' ? 'Double Points (2x)' : 'Safety Net'}</span></>
              )}?
              <br />
              <span className="text-gray-500 text-xs mt-1 block">You can change your pick any time before the deadline.</span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirming(null)}
                disabled={submitting}
                className="flex-1 border border-[#2a2a2a] text-gray-300 hover:text-white rounded-lg py-2.5 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 bg-[#e10600] hover:bg-[#b00500] disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
              >
                {submitting ? 'Saving…' : currentPickSeatId ? 'Change pick' : 'Confirm pick'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
