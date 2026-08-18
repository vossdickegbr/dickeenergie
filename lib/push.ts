import webpush from 'web-push'
import type { ProfileId } from '@/lib/types'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

function configure() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

export async function pushToAudience(audience: 'both' | ProfileId, payload: { title: string; body: string; tag: string; url?: string }) {
  if (!configure()) return { sent: 0 }
  const client = createSupabaseAdminClient()
  let query = client.from('push_subscriptions').select('id,profile_id,subscription')
  if (audience !== 'both') query = query.eq('profile_id', audience)
  const { data, error } = await query
  if (error) throw error
  let sent = 0
  for (const item of data ?? []) {
    try {
      await webpush.sendNotification(item.subscription as webpush.PushSubscription, JSON.stringify(payload), { TTL: 60 * 60 })
      sent += 1
    } catch (caught) {
      const status = (caught as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await client.from('push_subscriptions').delete().eq('id', item.id)
    }
  }
  return { sent }
}
