import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
} from '@react-email/components'

export interface PickConfirmationProps {
  playerName: string
  leagueName: string
  raceName: string
  round: number
  seasonYear: number
  driverName: string
  teamName: string
  chipName: string
  fp1Deadline: string
  pickUrl: string
  recordedByAdmin: boolean
}

export default function PickConfirmation({
  playerName,
  leagueName,
  raceName,
  round,
  seasonYear,
  driverName,
  teamName,
  chipName,
  fp1Deadline,
  pickUrl,
  recordedByAdmin,
}: PickConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {driverName} is your confirmed pick for {raceName} in {leagueName}.
      </Preview>
      <Body style={{ backgroundColor: '#0f0f0f', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ color: '#e10600', fontSize: '24px', marginBottom: '4px' }}>
            F1 League
          </Heading>
          <Text style={{ color: '#9ca3af', fontSize: '14px', marginTop: '0' }}>{leagueName}</Text>
          <Hr style={{ borderColor: '#2a2a2a', margin: '24px 0' }} />
          <Heading style={{ color: '#f5f5f5', fontSize: '20px' }}>Your pick is confirmed</Heading>
          <Text style={{ color: '#d4d4d4', fontSize: '16px' }}>Hi {playerName},</Text>
          <Text style={{ color: '#d4d4d4', fontSize: '16px', lineHeight: '1.6' }}>
            {recordedByAdmin ? 'A league admin saved your pick.' : 'Your pick has been saved.'}
          </Text>
          <Section
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              padding: '16px',
            }}
          >
            <Text style={{ color: '#d4d4d4', fontSize: '14px', margin: '0 0 12px' }}>
              {seasonYear} · Round {round} · {raceName}
            </Text>
            <Text style={{ color: '#ffffff', fontSize: '22px', fontWeight: 'bold', margin: '0' }}>
              {driverName}
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: '15px', margin: '4px 0 12px' }}>
              {teamName}
            </Text>
            <Text style={{ color: '#d4d4d4', fontSize: '14px', margin: '0' }}>
              Chip: {chipName}
            </Text>
          </Section>
          <Text style={{ color: '#9ca3af', fontSize: '14px', lineHeight: '1.6' }}>
            Pick deadline: {fp1Deadline}
          </Text>
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button
              href={pickUrl}
              style={{
                backgroundColor: '#e10600',
                color: '#ffffff',
                padding: '12px 28px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                textDecoration: 'none',
              }}
            >
              View my pick
            </Button>
          </Section>
          <Hr style={{ borderColor: '#2a2a2a', margin: '24px 0' }} />
          <Text style={{ color: '#9ca3af', fontSize: '12px', lineHeight: '1.5' }}>
            This confirmation was sent because your pick was saved for {leagueName}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
