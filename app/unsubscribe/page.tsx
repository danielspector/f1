'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'

function UnsubscribeForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [pickReminders, setPickReminders] = useState(true)
  const [raceSummaries, setRaceSummaries] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Missing unsubscribe token.')
      setLoading(false)
      return
    }

    fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invalid or expired link.')
        return res.json()
      })
      .then((data) => {
        setEmail(data.email)
        setPickReminders(data.pickReminders)
        setRaceSummaries(data.raceSummaries)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSave() {
    if (!token) return
    setSaving(true)
    setSaved(false)

    const res = await fetch('/api/email/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, pickReminders, raceSummaries }),
    })

    if (res.ok) {
      setSaved(true)
    } else {
      const body = await res.json()
      setError(body.error || 'Failed to update preferences')
    }
    setSaving(false)
  }

  async function handleUnsubscribeAll() {
    if (!token) return
    setSaving(true)
    setSaved(false)

    const res = await fetch('/api/email/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, unsubscribeAll: true }),
    })

    if (res.ok) {
      setPickReminders(false)
      setRaceSummaries(false)
      setSaved(true)
    } else {
      const body = await res.json()
      setError(body.error || 'Failed to unsubscribe')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <p className="text-neutral-400">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-white mb-2">Email Preferences</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-1">F1 League</h1>
        <h2 className="text-lg font-semibold text-white mb-1">Email Preferences</h2>
        <p className="text-neutral-400 text-sm mb-6">{email}</p>

        {saved && (
          <div className="bg-green-900/30 border border-green-800 rounded-md p-3 mb-6">
            <p className="text-green-400 text-sm">Preferences saved successfully.</p>
          </div>
        )}

        <div className="space-y-4 mb-8">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={pickReminders}
              onChange={(e) => setPickReminders(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-red-600 focus:ring-red-600"
            />
            <div>
              <p className="text-white text-sm font-medium">Pick reminders</p>
              <p className="text-neutral-500 text-xs">
                Reminders before FP1 if you haven&apos;t submitted a pick
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={raceSummaries}
              onChange={(e) => setRaceSummaries(e.target.checked)}
              className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-red-600 focus:ring-red-600"
            />
            <div>
              <p className="text-white text-sm font-medium">Race summaries</p>
              <p className="text-neutral-500 text-xs">
                Post-race results with your points and league standings
              </p>
            </div>
          </label>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Saving...' : 'Save preferences'}
          </button>

          <button
            onClick={handleUnsubscribeAll}
            disabled={saving}
            className="w-full bg-transparent hover:bg-neutral-800 disabled:opacity-50 text-neutral-400 hover:text-white border border-neutral-700 font-medium py-2.5 px-4 rounded-lg text-sm transition-colors"
          >
            Unsubscribe from all emails
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
          <p className="text-neutral-400">Loading...</p>
        </div>
      }
    >
      <UnsubscribeForm />
    </Suspense>
  )
}
