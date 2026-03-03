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
  resetUrl: string
}

export default function PasswordReset({ playerName, resetUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#0f0f0f', fontFamily: 'Arial, sans-serif' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ color: '#e10600', fontSize: '24px', marginBottom: '4px' }}>
            F1 League
          </Heading>
          <Hr style={{ borderColor: '#2a2a2a', margin: '24px 0' }} />

          <Heading style={{ color: '#f5f5f5', fontSize: '20px' }}>Reset your password</Heading>

          <Text style={{ color: '#d4d4d4', fontSize: '16px', lineHeight: '1.6' }}>
            Hi {playerName},
          </Text>
          <Text style={{ color: '#d4d4d4', fontSize: '16px', lineHeight: '1.6' }}>
            We received a request to reset your password. Click the button below to choose a new
            one. This link expires in 1 hour.
          </Text>

          <Section style={{ textAlign: 'center', margin: '32px 0' }}>
            <Button
              href={resetUrl}
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
              Reset password
            </Button>
          </Section>

          <Text style={{ color: '#6b6b6b', fontSize: '14px', lineHeight: '1.6' }}>
            If you didn&apos;t request this, you can safely ignore this email. Your password will
            not be changed.
          </Text>

          <Hr style={{ borderColor: '#2a2a2a', margin: '24px 0' }} />
          <Text style={{ color: '#6b6b6b', fontSize: '12px' }}>
            This is an automated message from F1 League. Do not reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
