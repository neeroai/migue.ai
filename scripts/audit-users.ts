#!/usr/bin/env tsx
/**
 * Auditoría de Interacciones de Usuarios
 * Diagnostica por qué algunos usuarios no reciben respuestas
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/database.types'
import { writeFileSync } from 'fs'

type UserMetrics = {
  userId: string
  phoneNumber: string
  name: string | null
  conversationId: string | null
  totalInbound: number
  totalOutbound: number
  responseRate: number
  lastInboundAt: string | null
  lastOutboundAt: string | null
  timeSinceLastInbound: string | null
  status: 'working' | 'failing' | 'no_data'
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_KEY

  if (!url || !key) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY')
    console.error('💡 Ejecuta: source .env.local && npx tsx scripts/audit-users.ts')
    process.exit(1)
  }

  console.log('🔍 Auditoría de Interacciones - migue.ai\n')
  console.log('=' .repeat(80))

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Obtener todos los usuarios
  console.log('\n📊 1. USUARIOS REGISTRADOS\n')
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, phone_number, name, created_at')
    .order('created_at', { ascending: true })

  if (usersError) {
    console.error('❌ Error obteniendo usuarios:', usersError.message)
    process.exit(1)
  }

  if (!users || users.length === 0) {
    console.log('⚠️  No se encontraron usuarios')
    process.exit(0)
  }

  console.log(`Total usuarios: ${users.length}\n`)
  users.forEach((user, i) => {
    console.log(`  ${i + 1}. ${user.phone_number} ${user.name ? `(${user.name})` : ''}`)
    console.log(`     ID: ${user.id}`)
    console.log(`     Creado: ${new Date(user.created_at).toLocaleString('es-CO')}`)
  })

  // 2. Analizar métricas por usuario
  console.log('\n\n📈 2. MÉTRICAS DE INTERACCIÓN POR USUARIO\n')
  console.log('=' .repeat(80))

  const userMetrics: UserMetrics[] = []

  for (const user of users) {
    // Obtener conversación del usuario
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    const conversationId = conversations?.id || null

    // Contar mensajes inbound (del usuario)
    const { count: inboundCount } = await supabase
      .from('messages_v2')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId || '')
      .eq('direction', 'inbound')

    // Contar mensajes outbound (del bot)
    const { count: outboundCount } = await supabase
      .from('messages_v2')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId || '')
      .eq('direction', 'outbound')

    // Último mensaje inbound
    const { data: lastInbound } = await supabase
      .from('messages_v2')
      .select('timestamp, content')
      .eq('conversation_id', conversationId || '')
      .eq('direction', 'inbound')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Último mensaje outbound
    const { data: lastOutbound } = await supabase
      .from('messages_v2')
      .select('timestamp, content')
      .eq('conversation_id', conversationId || '')
      .eq('direction', 'outbound')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    const totalInbound = inboundCount || 0
    const totalOutbound = outboundCount || 0
    const responseRate = totalInbound > 0 ? (totalOutbound / totalInbound) * 100 : 0

    // Calcular tiempo desde último mensaje
    let timeSinceLastInbound: string | null = null
    if (lastInbound?.timestamp) {
      const diff = Date.now() - new Date(lastInbound.timestamp).getTime()
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)

      if (days > 0) {
        timeSinceLastInbound = `${days}d ${hours % 24}h`
      } else if (hours > 0) {
        timeSinceLastInbound = `${hours}h ${minutes % 60}m`
      } else {
        timeSinceLastInbound = `${minutes}m`
      }
    }

    // Determinar status
    let status: 'working' | 'failing' | 'no_data' = 'no_data'
    if (totalInbound > 0) {
      status = responseRate >= 50 ? 'working' : 'failing'
    }

    userMetrics.push({
      userId: user.id,
      phoneNumber: user.phone_number,
      name: user.name,
      conversationId,
      totalInbound,
      totalOutbound,
      responseRate,
      lastInboundAt: lastInbound?.timestamp || null,
      lastOutboundAt: lastOutbound?.timestamp || null,
      timeSinceLastInbound,
      status,
    })
  }

  // 3. Mostrar resultados
  userMetrics.forEach((metrics, i) => {
    const statusEmoji = metrics.status === 'working' ? '✅' : metrics.status === 'failing' ? '❌' : '⚪'

    console.log(`\n${statusEmoji} Usuario ${i + 1}: ${metrics.phoneNumber}`)
    console.log(`   Conversación ID: ${metrics.conversationId || 'N/A'}`)
    console.log(`   Mensajes recibidos (inbound): ${metrics.totalInbound}`)
    console.log(`   Mensajes enviados (outbound): ${metrics.totalOutbound}`)
    console.log(`   Tasa de respuesta: ${metrics.responseRate.toFixed(1)}%`)

    if (metrics.lastInboundAt) {
      console.log(`   Último mensaje del usuario: ${new Date(metrics.lastInboundAt).toLocaleString('es-CO')} (hace ${metrics.timeSinceLastInbound})`)
    }

    if (metrics.lastOutboundAt) {
      console.log(`   Última respuesta del bot: ${new Date(metrics.lastOutboundAt).toLocaleString('es-CO')}`)
    }

    console.log(`   Estado: ${metrics.status.toUpperCase()}`)
  })

  // 4. Análisis de mensajes recientes (últimas 24h) para usuarios con problemas
  console.log('\n\n🔬 3. ANÁLISIS DETALLADO DE MENSAJES (Últimas 24h)\n')
  console.log('=' .repeat(80))

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const failingUsers = userMetrics.filter(m => m.status === 'failing')

  if (failingUsers.length === 0) {
    console.log('\n✅ No hay usuarios con problemas de respuesta')
  } else {
    console.log(`\n⚠️  Usuarios con problemas: ${failingUsers.length}`)

    for (const user of failingUsers) {
      console.log(`\n--- ${user.phoneNumber} ---`)

      const { data: recentMessages } = await supabase
        .from('messages_v2')
        .select('direction, type, content, timestamp, wa_message_id')
        .eq('conversation_id', user.conversationId || '')
        .gte('timestamp', yesterday)
        .order('timestamp', { ascending: true })

      if (!recentMessages || recentMessages.length === 0) {
        console.log('   (No hay mensajes en las últimas 24h)')
        continue
      }

      console.log(`   Total mensajes (24h): ${recentMessages.length}`)

      recentMessages.forEach((msg, i) => {
        const direction = msg.direction === 'inbound' ? '📥 IN ' : '📤 OUT'
        const time = new Date(msg.timestamp).toLocaleTimeString('es-CO')
        const preview = msg.content?.substring(0, 50) || `[${msg.type}]`
        console.log(`   ${i + 1}. ${direction} ${time} - ${preview}${msg.content && msg.content.length > 50 ? '...' : ''}`)
      })
    }
  }

  // 5. Verificar conversaciones sin mensajes (posible problema de persistencia)
  console.log('\n\n🔍 4. DIAGNÓSTICO DE PROBLEMAS\n')
  console.log('=' .repeat(80))

  const { data: emptyConversations } = await supabase
    .from('conversations')
    .select('id, user_id, users!inner(phone_number)')
    .eq('status', 'active')

  if (emptyConversations) {
    for (const conv of emptyConversations) {
      const { count } = await supabase
        .from('messages_v2')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)

      if (count === 0) {
        console.log(`\n⚠️  Conversación vacía detectada:`)
        console.log(`   Conversation ID: ${conv.id}`)
        console.log(`   Usuario: ${(conv.users as any).phone_number}`)
        console.log(`   🐛 Posible problema: Mensajes no se están persistiendo`)
      }
    }
  }

  // 6. Resumen y recomendaciones
  console.log('\n\n📋 5. RESUMEN Y DIAGNÓSTICO\n')
  console.log('=' .repeat(80))

  const workingUsers = userMetrics.filter(m => m.status === 'working')
  const failingUsersCount = userMetrics.filter(m => m.status === 'failing')

  console.log(`\n✅ Usuarios funcionando: ${workingUsers.length}`)
  workingUsers.forEach(u => console.log(`   - ${u.phoneNumber} (${u.responseRate.toFixed(0)}% respuestas)`))

  console.log(`\n❌ Usuarios con problemas: ${failingUsersCount.length}`)
  failingUsersCount.forEach(u => console.log(`   - ${u.phoneNumber} (${u.responseRate.toFixed(0)}% respuestas)`))

  if (failingUsersCount.length > 0) {
    console.log('\n🔧 POSIBLES CAUSAS:')
    console.log('   1. Error en procesamiento AI (ProactiveAgent)')
    console.log('   2. Timeout en tool calling loop')
    console.log('   3. Error de persistencia (wa_message_id duplicado)')
    console.log('   4. Error en envío WhatsApp API')
    console.log('   5. Rate limiting (250 msg/sec)')

    console.log('\n💡 SIGUIENTE PASO:')
    console.log('   Revisar logs de Vercel filtrados por:')
    failingUsersCount.forEach(u => {
      console.log(`   - vercel logs --filter="${u.phoneNumber}"`)
    })
    console.log(`   - Buscar: "[background] AI processing failed"`)
    console.log(`   - Buscar: "[background] Persist failed"`)
    console.log(`   - Buscar: "WhatsApp API error"`)
  }

  // 7. Exportar JSON
  console.log('\n\n💾 6. EXPORTANDO RESULTADOS JSON\n')
  console.log('=' .repeat(80))

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalUsers: userMetrics.length,
      workingUsers: workingUsers.length,
      failingUsers: failingUsersCount.length,
    },
    users: userMetrics,
  }

  const reportPath = './audit-report.json'
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`\n✅ Reporte exportado: ${reportPath}`)

  console.log('\n' + '=' .repeat(80))
  console.log('✅ Auditoría completada\n')
}

main().catch((error) => {
  console.error('\n❌ Error en auditoría:', error.message)
  console.error(error)
  process.exit(1)
})
