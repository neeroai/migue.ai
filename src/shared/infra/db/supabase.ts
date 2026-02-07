/**
 * @file Supabase Client Factory
 * @description Server-side Supabase client factory with typed database schema, auto-generated types, and session management for Edge Runtime
 * @module lib/supabase
 * @exports getSupabaseServerClient
 * @runtime edge
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:15
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Get Supabase server client with typed database schema
 * Creates Edge Runtime compatible client with auto-generated Database types from Supabase CLI.
 * Prefers SERVICE_ROLE_KEY (bypasses RLS) over SUPABASE_KEY (respects RLS).
 * Session persistence disabled for stateless Edge Functions.
 *
 * @returns {SupabaseClient<Database>} Typed Supabase client for server-side operations
 * @throws {Error} When SUPABASE_URL or both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_KEY are missing
 * @example
 * const supabase = getSupabaseServerClient();
 * const { data, error } = await supabase.from('conversations').select('*');
 */
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY')
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
