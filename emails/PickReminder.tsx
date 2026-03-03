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
} from '@react-email/components'

interface Props {
  playerName: string
  raceName: string
  fp1Deadline: string
  leagueName: string
  pickUrl: string
}

export default function PickReminder({
  playerName,
  raceName,
  fp1Deadline,
  leagueName,
  pickUrl,
}: Props) {
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
            ⏱️ Submit your pick before FP1
          </Heading>

          <Text style={{ color: '#d4d4d4', fontSize: '16px', lineHeight: '1.6' }}>
            Hi {playerName},
          </Text>
          <Text style={{ color: '#d4d4d4', fontSize: '16px', lineHeight: '1.6' }}>
            You haven&apos;t submitted your driver pick for the{' '}
            <strong style={{ color: '#ffffff' }}>{raceName}</strong> yet.
            The deadline is <strong style={{ color: '#f59e0b' }}>{fp1Deadline}</strong>.
          </Text>
          <Text style={{ color: '#d4d4d4', fontSize: '16px', lineHeight: '1.6' }}>
            If you miss the FP1 start, you&apos;ll receive 0 points for this race.
          </Text>

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={pickUrl}
              style={{
                backgroundColor: '#e10600',
                color: '#ffffff',
                padding: '14px 32px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 'bold',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Make my pick →
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
