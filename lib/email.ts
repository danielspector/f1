import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  html,
  unsubscribeUrl,
}: {
  to: string
  subject: string
  html: string
  /** If provided, List-Unsubscribe headers are added (CAN-SPAM / GDPR compliance). */
  unsubscribeUrl?: string
}) {
  const from = process.env.RESEND_FROM_EMAIL || 'F1 League <noreply@f1league.app>'

  const headers: Record<string, string> = {}
  if (unsubscribeUrl) {
    // RFC 2369 List-Unsubscribe header — supported by Gmail, Yahoo, Apple Mail, etc.
    headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  })

  if (error) {
    console.error('[sendEmail] Resend error:', error)
    throw new Error(`Failed to send email: ${error.message}`)
  }
}
