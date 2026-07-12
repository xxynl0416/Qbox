import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let client: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(`Supabase env missing: URL=${url ? 'OK' : 'MISSING'}, KEY=${key ? 'OK' : 'MISSING'}`)
  }
  client = createSupabaseClient(url, key)
  return client
}
