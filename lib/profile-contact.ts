import type { ProfileId } from '@/lib/types'

export function profileEmail(profileId: ProfileId) {
  const value = profileId === 'voss' ? process.env.VOSS_EMAIL : process.env.DICKE_EMAIL
  if (!value) throw new Error(`Für ${profileId} ist keine E-Mail-Adresse konfiguriert.`)
  return value
}
