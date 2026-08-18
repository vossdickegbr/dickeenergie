'use client'

import { useState } from 'react'
import { AppDataProvider } from '@/components/app/app-provider'
import { AppShell } from '@/components/app/app-shell'
import { AuthFlow } from '@/components/auth/auth-flow'
import type { ProfileId } from '@/lib/types'

export default function Page() {
  const [profileId, setProfileId] = useState<ProfileId | null>(null)

  if (!profileId) return <AuthFlow onAuthenticated={setProfileId} />

  return (
    <AppDataProvider>
      <AppShell profileId={profileId} onLocked={() => setProfileId(null)} />
    </AppDataProvider>
  )
}
