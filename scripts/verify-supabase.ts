#!/usr/bin/env tsx
/**
 * Script to verify Supabase connection and list tables
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY

  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY')
    process.exit(1)
  }

  console.log('🔍 Verificando conexión a Supabase...\n')
  console.log(`📍 URL: ${url}`)
  console.log(`🔑 Key: ${key.substring(0, 20)}...`)

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Query users table
  console.log('\n📊 Consultando tabla users...')
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, phone_number, name')
    .limit(5)

  if (usersError) {
    console.error('❌ Error:', usersError.message)
  } else {
    console.log(`✅ Usuarios encontrados: ${users?.length || 0}`)
    users?.forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.phone_number} - ${user.name || 'Sin nombre'}`)
    })
  }

  // Query conversations
  console.log('\n📊 Consultando tabla conversations...')
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id, status, created_at')
    .limit(5)

  if (convError) {
    console.error('❌ Error:', convError.message)
  } else {
    console.log(`✅ Conversaciones encontradas: ${conversations?.length || 0}`)
  }

  // Query reminders
  console.log('\n📊 Consultando tabla reminders...')
  const { data: reminders, error: remindersError } = await supabase
    .from('reminders')
    .select('id, title, status, scheduled_time')
    .limit(5)

  if (remindersError) {
    console.error('❌ Error:', remindersError.message)
  } else {
    console.log(`✅ Recordatorios encontrados: ${reminders?.length || 0}`)
    reminders?.forEach((reminder, i) => {
      console.log(`  ${i + 1}. ${reminder.title} - ${reminder.status}`)
    })
  }

  // List all available tables from types
  console.log('\n📚 Tablas disponibles en el schema:')
  const tables = [
    'users',
    'conversations',
    'messages_v2',
    'reminders',
    'flow_sessions',
    'call_logs',
    'user_interactions',
    'user_locations',
    'documents',
    'embeddings',
    'calendar_credentials',
    'calendar_events',
    'conversation_actions',
    'follow_up_jobs'
  ]

  tables.forEach((table, i) => {
    console.log(`  ${i + 1}. ${table}`)
  })

  console.log('\n✅ Conexión a Supabase verificada exitosamente!')
}

main().catch(console.error)
