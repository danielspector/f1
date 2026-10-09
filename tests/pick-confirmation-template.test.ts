import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import PickConfirmation, { type PickConfirmationProps } from '@/emails/PickConfirmation'

const { render } =
  await vi.importActual<typeof import('@react-email/render')>('@react-email/render')
const props: PickConfirmationProps = {
  playerName: 'Jeremy',
  leagueName: 'Fair Mu Lawn 1',
  raceName: 'Singapore Grand Prix',
  round: 17,
  seasonYear: 2026,
  driverName: 'Oliver Bearman',
  teamName: 'Haas',
  chipName: 'None',
  fp1Deadline: '9 October 2026, 08:30 UTC',
  pickUrl: 'https://example.test/league/l1/pick/r1',
  recordedByAdmin: false,
}

describe('pick confirmation email template', () => {
  it('renders the selection, chip, deadline and link in the actual HTML', async () => {
    const html = await render(React.createElement(PickConfirmation, props))
    for (const text of [
      'Jeremy',
      'Fair Mu Lawn 1',
      'Singapore Grand Prix',
      'Oliver Bearman',
      'Haas',
      'None',
      '08:30 UTC',
      props.pickUrl,
    ])
      expect(html).toContain(text)
    expect(html).not.toContain('A league admin saved your pick.')
  })
  it('identifies picks entered by an admin and displays the selected chip', async () => {
    const html = await render(
      React.createElement(PickConfirmation, {
        ...props,
        recordedByAdmin: true,
        chipName: 'Safety Net',
      }),
    )
    expect(html).toContain('A league admin saved your pick.')
    expect(html).toContain('Safety Net')
  })
  it('escapes names rather than treating them as HTML', async () => {
    const html = await render(
      React.createElement(PickConfirmation, { ...props, playerName: '<script>bad()</script>' }),
    )
    expect(html).not.toContain('<script>bad()</script>')
    expect(html).toContain('&lt;script&gt;bad()&lt;/script&gt;')
  })
})
