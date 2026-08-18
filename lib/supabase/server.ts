import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Supabase public configuration is missing.')
  return { url, key }
}

export async function createSupabaseServerClient() {
  const { url, key } = publicConfig()
  const store = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll()
      },
      setAll(values) {
        try {
          for (const { name, value, options } of values) store.set(name, value, options)
        } catch {
          // Server Components may be read-only. Route handlers can set cookies.
        }
      },
    },
  })
}

export function createSupabasePublicServerClient() {
  const { url, key } = publicConfig()
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Supabase nennt den neuen Schlüssel meist "Secret key". Ältere Projekte
  // verwenden weiterhin den Service-Role-Key. Beide Variablennamen werden
  // akzeptiert, damit Datenschutz-PDFs und Dokumente nicht an einer bloßen
  // Umbenennung scheitern.
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase-Serverzugriff fehlt. In Vercel SUPABASE_SECRET_KEY oder SUPABASE_SERVICE_ROLE_KEY hinterlegen.')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
