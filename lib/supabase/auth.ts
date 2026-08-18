import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileId } from '@/lib/types'

export async function requireTeamProfile(client: SupabaseClient) {
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) throw new Error('UNAUTHENTICATED')
  const { data, error } = await client
    .from('team_profiles')
    .select('profile_id, display_name, active')
    .eq('auth_user_id', userData.user.id)
    .eq('active', true)
    .single()
  if (error || !data) throw new Error('FORBIDDEN')
  return {
    userId: userData.user.id,
    profileId: data.profile_id as ProfileId,
    displayName: data.display_name as string,
  }
}
