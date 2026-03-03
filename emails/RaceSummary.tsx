import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
  Row,
  Column,
} from '@react-email/components'

interface StandingRow {
  rank: number
  name: string
  points: number
  isCurrentUser: boolean
}

interface Props {
  playerName: string
  raceName: string
  round: number
  driverPicked: string | null
  teamName: string | null
  pointsEarned: number
  leagueName: string
  leagueUrl: string
  standings: StandingRow[]
}

export default function RaceSummary({
  playerName,
  raceName,
  round,
  driverPicked,
  teamName,
  pointsEarned,
  leagueName,
  leagueUrl,
  standings,
}: Props) {
  const topStandings = standings.slice(0, 10)

  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#0f0f0f', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ color: '#e10600', fontSize: '24px', marginBottom: '4px' }}>
            F1 League
          </Heading>
          <Text style={{ color: '#6b6b6b', fontSize: '14px', marginTop: '0' }}>
            {leagueName}
          </Text>
          <Hr style={{ borderColor: '#2a2a2a', margin: '24px 0' }} />

          <Heading style={{ color: '#f5f5f5', fontSize: '20px' }}>
            🏁 Round {round} — {raceName}
          </Heading>

          <Text style={{ color: '#d4d4d4', fontSize: '16px' }}>Hi {playerName},</Text>

          {/* Player result */}
          <Section
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              padding: '16px',
              margin: '16px 0',
            }}
          >
            <Text style={{ color: '#6b6b6b', fontSize: '12px', margin: '0 0 4px' }}>YOUR PICK</Text>
            {driverPicked ? (
              <>
                <Text style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold', margin: '0' }}>
                  {driverPicked}
                </Text>
                <Text style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 12px' }}>
                  {teamName}
                </Text>
                <Text style={{ color: '#ffffff', fontSize: '32px', fontWeight: 'bold', margin: '0' }}>
                  {pointsEarned}
                  <span style={{ fontSize: '16px', color: '#6b6b6b', marginLeft: '6px' }}>pts</span>
                </Text>
              </>
            ) : (
              <Text style={{ color: '#6b6b6b', fontSize: '15px', margin: '0' }}>
                No pick submitted — 0 pts
              </Text>
            )}
          </Section>

          {/* Standings */}
          <Heading style={{ color: '#f5f5f5', fontSize: '16px', marginTop: '24px' }}>
            League standings
          </Heading>

          <Section
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            {topStandings.map((row, i) => (
              <Row
                key={row.rank}
                style={{
                  padding: '10px 16px',
                  borderBottom: i < topStandings.length - 1 ? '1px solid #2a2a2a' : 'none',
                  backgroundColor: row.isCurrentUser ? 'rgba(225, 6, 0, 0.08)' : 'transparent',
                }}
              >
                <Column style={{ width: '30px', color: '#6b6b6b', fontSize: '13px' }}>
                  {row.rank}
                </Column>
                <Column style={{ color: row.isCurrentUser ? '#ffffff' : '#d4d4d4', fontSize: '14px' }}>
                  {row.name}{row.isCurrentUser ? ' (you)' : ''}
                </Column>
                <Column
                  style={{
                    textAlign: 'right',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  {row.points} pts
                </Column>
              </Row>
            ))}
          </Section>

          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button
              href={leagueUrl}
              style={{
                backgroundColor: '#e10600',
                color: '#ffffff',
                padding: '12px 28px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              View full standings →
            </Button>
          </Section>

          <Hr style={{ borderColor: '#2a2a2a', margin: '24px 0' }} />
          <Text style={{ color: '#6b6b6b', fontSize: '12px' }}>
            You&apos;re receiving this because you&apos;re a member of {leagueName} on F1 League.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
