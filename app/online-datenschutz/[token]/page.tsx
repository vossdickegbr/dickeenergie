import type { Metadata } from 'next'
import { OnlinePrivacyForm } from '@/components/public/online-privacy-form'

export const metadata: Metadata = {
  title: 'Datenschutzinformation bestätigen | Voss & Dicke GbR',
  description: 'Persönliche Datenschutzinformation lesen, bestätigen und elektronisch unterschreiben.',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function OnlinePrivacyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <OnlinePrivacyForm token={token} />
}
