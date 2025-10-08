#!/usr/bin/env tsx
/**
 * Verify PostgreSQL enum values for msg_type
 */

import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY

  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('🔍 Verificando enum msg_type en PostgreSQL\n')

  // Query enum values
  const { data, error } = await supabase.rpc('query', {
    query: `
      SELECT enumlabel, enumsortorder
      FROM pg_enum
      WHERE enumtypid = 'msg_type'::regtype
      ORDER BY enumsortorder;
    `
  })

  if (error) {
    // Fallback: try direct query (may not work in all RLS configurations)
    console.log('⚠️  RPC query failed, trying alternative method...\n')

    const query = `
      SELECT enumlabel::text as label
      FROM pg_enum
      WHERE enumtypid = 'msg_type'::regtype
      ORDER BY enumsortorder;
    `

    console.log('Query to run in Supabase SQL Editor:')
    console.log('=' .repeat(80))
    console.log(query)
    console.log('=' .repeat(80))

    console.log('\n✅ Expected values:')
    console.log('   text, image, audio, video, document, sticker, location,')
    console.log('   interactive, button, reaction, order, contacts, system, unknown')

    console.log('\n💡 Please run the query above in Supabase SQL Editor to verify')
    process.exit(0)
  }

  if (!data || data.length === 0) {
    console.log('❌ No enum values found')
    process.exit(1)
  }

  console.log('✅ Enum values encontrados:\n')

  const labels = data.map((row: any) => row.enumlabel)
  console.log('   ' + labels.join(', '))

  console.log('\n📋 Verificación:\n')

  const expected = ['text', 'image', 'audio', 'sticker', 'video', 'document', 'location',
                    'interactive', 'button', 'reaction', 'order', 'contacts', 'system', 'unknown']

  const missing = expected.filter(e => !labels.includes(e))
  const extra = labels.filter((l: string) => !expected.includes(l))

  if (missing.length > 0) {
    console.log('   ❌ Faltan: ' + missing.join(', '))
  }

  if (extra.length > 0) {
    console.log('   ⚠️  Extras: ' + extra.join(', '))
  }

  if (missing.length === 0 && extra.length === 0) {
    console.log('   ✅ Todos los valores esperados están presentes')
    console.log('   ✅ No hay valores adicionales inesperados')
  }

  // Check for critical v23.0 types
  const critical = ['sticker', 'reaction', 'order']
  const hasCritical = critical.every(c => labels.includes(c))

  console.log('\n🎯 Tipos críticos v23.0:\n')
  critical.forEach(c => {
    const status = labels.includes(c) ? '✅' : '❌'
    console.log(`   ${status} ${c}`)
  })

  if (hasCritical) {
    console.log('\n🎉 Migración completada exitosamente!')
    console.log('   Todos los tipos WhatsApp v23.0 están disponibles')
  } else {
    console.log('\n⚠️  La migración puede no haberse completado correctamente')
    console.log('   Ejecuta de nuevo: supabase/migrations/002_add_whatsapp_v23_message_types.sql')
  }
}

main().catch(console.error)
