'use client'

import { useState } from 'react'

interface InviteLinkProps {
  inviteCode: string
}

export default function InviteLink({ inviteCode }: InviteLinkProps) {
  const [copied, setCopied] = useState(false)
  const inviteUrl = `${window.location.origin}/join/${inviteCode}`

  async function handleCopy() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={inviteUrl}
        className="flex-1 bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-300 truncate"
      />
      <button
        onClick={handleCopy}
        className="shrink-0 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white text-sm px-4 py-2 rounded-lg transition-colors"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}
