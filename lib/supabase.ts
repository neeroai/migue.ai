import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Get Supabase server client with typed database schema
 * @returns Typed Supabase client for server-side operations
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY')
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
