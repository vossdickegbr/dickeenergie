import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { snapshotFromRows } from '@/lib/records'

export async function readAdminSnapshot() {
  const client = createSupabaseAdminClient()
  const { data, error } = await client.from('app_records').select('record_type,payload').order('updated_at', { ascending: false })
  if (error) throw error
  return snapshotFromRows(data ?? [])
}
