import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTeamProfile } from '@/lib/supabase/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const schema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
})

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Ungültiges Push-Abonnement.' }, { status: 400 })
  try {
    const client = await createSupabaseServerClient()
    const profile = await requireTeamProfile(client)
    const { error } = await client.from('push_subscriptions').upsert({
      profile_id: profile.profileId,
      endpoint: parsed.data.endpoint,
      subscription: parsed.data,
      user_agent: request.headers.get('user-agent'),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Push konnte nicht aktiviert werden.' }, { status: 401 })
  }
}
