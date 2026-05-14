import { notFound } from 'next/navigation'
import RaceWeekendCard from '@/components/RaceWeekendCard'

export const dynamic = 'force-dynamic'

const CURRENT_USER_ID = 'me'

const baseRows = [
  { userId: 'me',     userName: 'Daniel Spector', userEmail: 'me@example.com',
    driverName: 'Lando Norris',    driverCode: 'NOR', teamName: 'McLaren',  chip: null as null | 'DOUBLE_POINTS' | 'SAFETY_NET' },
  { userId: 'aryeh',  userName: 'Aryeh Spector', userEmail: 'aryeh@example.com',
    driverName: 'Kimi Antonelli',  driverCode: 'ANT', teamName: 'Mercedes', chip: null as null | 'DOUBLE_POINTS' | 'SAFETY_NET' },
  { userId: 'ayelet', userName: 'Ayelet Spector', userEmail: 'ayelet@example.com',
    driverName: 'Charles Leclerc', driverCode: 'LEC', teamName: 'Ferrari',  chip: 'DOUBLE_POINTS' as const },
  { userId: 'sara',   userName: 'Sara Spector', userEmail: 'sara@example.com',
    driverName: null, driverCode: null, teamName: null, chip: null as null | 'DOUBLE_POINTS' | 'SAFETY_NET' },
]

const dayMs = 24 * 60 * 60 * 1000

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const lockedRows = baseRows.map((r) => ({ ...r, pointsEarned: null }))
  const resultsRows = baseRows.map((r) => {
    const pts: Record<string, number> = { me: 18, aryeh: 25, ayelet: 24, sara: 0 }
    return { ...r, pointsEarned: pts[r.userId] ?? 0 }
  })

  const futureRace = new Date(Date.now() + 1 * dayMs).toISOString()
  const todayRace = new Date().toISOString()
  const pastRace = new Date(Date.now() - 2 * dayMs).toISOString()

  return (
    <div className="min-h-screen bg-[#0f0f0f] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <h1 className="text-white text-2xl font-bold">RaceWeekendCard preview</h1>
          <p className="text-gray-500 text-sm mt-1">
            Stub data. Dev-only — returns 404 in production.
          </p>
        </div>

        <Section title="State A — Picks locked, race tomorrow">
          <RaceWeekendCard
            raceName="Canadian Grand Prix"
            round={5}
            raceDatetime={futureRace}
            resultsIn={false}
            rows={lockedRows}
            currentUserId={CURRENT_USER_ID}
          />
        </Section>

        <Section title="State B — Race day">
          <RaceWeekendCard
            raceName="Canadian Grand Prix"
            round={5}
            raceDatetime={todayRace}
            resultsIn={false}
            rows={lockedRows}
            currentUserId={CURRENT_USER_ID}
          />
        </Section>

        <Section title="State C — Results in (sorted by points, top score highlighted)">
          <RaceWeekendCard
            raceName="Miami Grand Prix"
            round={4}
            raceDatetime={pastRace}
            resultsIn={true}
            rows={resultsRows}
            currentUserId={CURRENT_USER_ID}
          />
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}
