import { Text, Link } from '@react-email/components'

interface Props {
  leagueName: string
  unsubscribeUrl: string
}

export default function UnsubscribeFooter({ leagueName, unsubscribeUrl }: Props) {
  return (
    <>
      <Text style={{ color: '#6b6b6b', fontSize: '12px', lineHeight: '1.5' }}>
        You&apos;re receiving this because you&apos;re a member of {leagueName} on F1 League.
      </Text>
      <Text style={{ color: '#6b6b6b', fontSize: '12px', lineHeight: '1.5', marginTop: '4px' }}>
        <Link href={unsubscribeUrl} style={{ color: '#6b6b6b', textDecoration: 'underline' }}>
          Manage email preferences or unsubscribe
        </Link>
      </Text>
    </>
  )
}
