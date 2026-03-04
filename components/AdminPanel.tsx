'use client'

import { useState } from 'react'
import InviteLink from './InviteLink'

interface Member {
  userId: string
  userName: string | null
  userEmail: string
  role: 'ADMIN' | 'MEMBER'
}

interface Race {
  id: string
  round: number
  name: string
}

interface Seat {
  id: string
  driverName: string
  teamName: string
}

interface Props {
  leagueId: string
  leagueName: string
  inviteCode: string
  members: Member[]
  races: Race[]
  currentUserId: string
  chipsEnabled: boolean
  onLeagueRenamed: (name: string) => void
  onMemberRemoved: (userId: string) => void
  onRoleUpdated: (userId: string, role: 'ADMIN' | 'MEMBER') => void
  onChipsToggled: (enabled: boolean) => void
}

export default function AdminPanel({
  leagueId,
  leagueName,
  inviteCode,
  members,
  races,
  currentUserId,
  chipsEnabled,
  onLeagueRenamed,
  onMemberRemoved,
  onRoleUpdated,
  onChipsToggled,
}: Props) {
  const [nameInput, setNameInput] = useState(leagueName)
  const [renaming, setRenaming] = useState(false)
  const [nameError, setNameError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Admin pick entry state
  const [adminPick, setAdminPick] = useState({ userId: '', raceId: '', seatId: '' })
  const [adminPickSeats, setAdminPickSeats] = useState<Seat[]>([])
  const [adminPickLoading, setAdminPickLoading] = useState(false)
  const [adminPickError, setAdminPickError] = useState('')
  const [adminPickSuccess, setAdminPickSuccess] = useState('')

  async function loadSeats(raceId: string) {
    setAdminPickSeats([])
    setAdminPick((p) => ({ ...p, raceId, seatId: '' }))
    if (!raceId) return
    const res = await fetch(`/api/leagues/${leagueId}/picks?raceId=${raceId}`)
    if (res.ok) {
      const data = await res.json()
      const sorted = [...(data.seats ?? [])].sort((a: Seat, b: Seat) =>
        a.teamName.localeCompare(b.teamName) || a.driverName.localeCompare(b.driverName),
      )
      setAdminPickSeats(sorted)
    }
  }

  async function handleAdminPick(e: React.FormEvent) {
    e.preventDefault()
    if (!adminPick.userId || !adminPick.raceId || !adminPick.seatId) return
    setAdminPickLoading(true)
    setAdminPickError('')
    setAdminPickSuccess('')

    const res = await fetch(`/api/leagues/${leagueId}/admin/picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adminPick),
    })
    const data = await res.json()
    setAdminPickLoading(false)

    if (!res.ok) return setAdminPickError(data.error || 'Failed to save pick')
    setAdminPickSuccess(`Saved: ${data.seat.driverName} for ${data.race.name}`)
    setAdminPick((p) => ({ ...p, seatId: '' }))
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!nameInput.trim() || nameInput.trim() === leagueName) return
    setRenaming(true)
    setNameError('')

    const res = await fetch(`/api/leagues/${leagueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim() }),
    })
    const data = await res.json()
    setRenaming(false)

    if (!res.ok) return setNameError(data.error || 'Failed to rename')
    onLeagueRenamed(data.name)
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remove this member from the league?')) return
    setActionLoading(userId + ':remove')

    const res = await fetch(`/api/leagues/${leagueId}/members/${userId}`, {
      method: 'DELETE',
    })
    setActionLoading(null)
    if (res.ok) onMemberRemoved(userId)
  }

  async function handleRoleToggle(member: Member) {
    const newRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'
    setActionLoading(member.userId + ':role')

    const res = await fetch(`/api/leagues/${leagueId}/members/${member.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    setActionLoading(null)
    if (res.ok) onRoleUpdated(member.userId, newRole)
  }

  return (
    <div className="space-y-6">
      {/* Rename */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">League name</h3>
        <form onSubmit={handleRename} className="flex gap-2">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={50}
            className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#e10600] transition-colors"
          />
          <button
            type="submit"
            disabled={renaming || nameInput.trim() === leagueName || !nameInput.trim()}
            className="bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {renaming ? 'Saving…' : 'Save'}
          </button>
        </form>
        {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
      </div>

      {/* Invite link */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Invite link</h3>
        <InviteLink inviteCode={inviteCode} />
      </div>

      {/* Chips toggle */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Chips (points boosts)</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={chipsEnabled}
            onClick={async () => {
              const next = !chipsEnabled
              const res = await fetch(`/api/leagues/${leagueId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chipsEnabled: next }),
              })
              if (res.ok) onChipsToggled(next)
            }}
            className={[
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              chipsEnabled ? 'bg-[#e10600]' : 'bg-[#2a2a2a]',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                chipsEnabled ? 'translate-x-6' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
          <span className="text-sm text-gray-300">
            {chipsEnabled ? 'Chips enabled' : 'Chips disabled'}
          </span>
        </label>
        <p className="text-xs text-gray-500 mt-1">Double Points and Safety Net — one of each per season, one per race week.</p>
      </div>

      {/* Enter pick for member */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Enter pick for member</h3>
        <form onSubmit={handleAdminPick} className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={adminPick.userId}
              onChange={(e) => setAdminPick((p) => ({ ...p, userId: e.target.value }))}
              className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e10600] transition-colors"
            >
              <option value="">Select player…</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userName || m.userEmail}
                </option>
              ))}
            </select>

            <select
              value={adminPick.raceId}
              onChange={(e) => loadSeats(e.target.value)}
              className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e10600] transition-colors"
            >
              <option value="">Select race…</option>
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  R{r.round} — {r.name}
                </option>
              ))}
            </select>

            <select
              value={adminPick.seatId}
              onChange={(e) => setAdminPick((p) => ({ ...p, seatId: e.target.value }))}
              disabled={adminPickSeats.length === 0}
              className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e10600] transition-colors disabled:opacity-40"
            >
              <option value="">Select driver…</option>
              {adminPickSeats.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.driverName} ({s.teamName})
                </option>
              ))}
            </select>
          </div>

          {adminPickError && <p className="text-red-400 text-xs">{adminPickError}</p>}
          {adminPickSuccess && <p className="text-green-400 text-xs">{adminPickSuccess}</p>}

          <button
            type="submit"
            disabled={!adminPick.userId || !adminPick.raceId || !adminPick.seatId || adminPickLoading}
            className="bg-[#2a2a2a] hover:bg-[#3a3a3a] disabled:opacity-40 text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {adminPickLoading ? 'Saving…' : 'Save pick'}
          </button>
        </form>
      </div>

      {/* Members */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">Members</h3>
        <div className="space-y-2">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId
            return (
              <div
                key={member.userId}
                className="flex items-center justify-between bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm text-white">
                    {member.userName || member.userEmail}
                    {isCurrentUser && <span className="text-gray-500 text-xs ml-2">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-500">{member.userEmail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      member.role === 'ADMIN'
                        ? 'bg-[#e10600]/20 text-[#e10600]'
                        : 'bg-[#2a2a2a] text-gray-400'
                    }`}
                  >
                    {member.role}
                  </span>
                  <button
                    onClick={() => handleRoleToggle(member)}
                    disabled={!!actionLoading}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-40"
                    title={member.role === 'ADMIN' ? 'Demote to member' : 'Promote to admin'}
                  >
                    {actionLoading === member.userId + ':role' ? '…' : '⇅'}
                  </button>
                  {!isCurrentUser && (
                    <button
                      onClick={() => handleRemove(member.userId)}
                      disabled={!!actionLoading}
                      className="text-xs text-red-600 hover:text-red-400 transition-colors disabled:opacity-40"
                      title="Remove from league"
                    >
                      {actionLoading === member.userId + ':remove' ? '…' : '✕'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
