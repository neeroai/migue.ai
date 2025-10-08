# Supabase Access Guide

## ✅ Estado de la Configuración

**Supabase está completamente configurado y funcionando:**

- ✅ Variables de entorno en `.env.local`
- ✅ Cliente TypeScript en `lib/supabase.ts`
- ✅ Tipos generados en `types/database.types.ts`
- ✅ CLI de Supabase instalado y autenticado
- ✅ 14 tablas activas con datos

## 📊 Datos Actuales (2025-10-06)

```
Usuarios: 4
Conversaciones: 4
Recordatorios: 0
Tablas totales: 14
```

## 🚀 Comandos Disponibles

### 1. MCP Server (Recomendado) 🤖

**Acceso directo desde Claude Code con 20+ herramientas de IA:**

El proyecto está configurado con el [Supabase MCP Server](https://supabase.com/blog/mcp-server) que permite interactuar con Supabase directamente desde Claude Code:

**Herramientas disponibles:**
- 🗄️ **Database**: Diseñar tablas, ejecutar SQL, generar migraciones
- ⚡ **Edge Functions**: Listar, ver código, desplegar functions
- 📦 **Storage**: Gestión de archivos y buckets
- 🐛 **Debugging**: Ver logs y troubleshooting
- 📚 **Docs**: Consultar documentación de Supabase
- 🔧 **Development**: Generar tipos TypeScript, configurar proyecto

**Ejemplos de uso con Claude Code:**
```
"Muéstrame todas las tablas de la base de datos"
"Crea una migración para agregar índice a la tabla messages_v2"
"Cuántos usuarios hay registrados?"
"Despliega la edge function para procesar webhooks"
"Genera los tipos TypeScript actualizados"
```

**Configuración:**
- ✅ Ya configurado en `.mcp.json`
- ✅ Autenticación OAuth automática
- ✅ Scope limitado al proyecto: `pdliixrgdvunoymxaxmw`
- ✅ Features habilitadas: database, functions, debugging, development, docs, storage

**Seguridad:**
- ⚠️ Configurado para desarrollo (`read_only=false`)
- ⚠️ Para producción, cambiar a `read_only=true`

---

### 2. CLI de Supabase

#### Verificar Conexión a Supabase
```bash
npm run db:verify
```
Este comando:
- Verifica la conexión a Supabase
- Muestra usuarios, conversaciones y recordatorios
- Lista todas las tablas disponibles

#### Usar CLI de Supabase
```bash
npm run db:cli -- projects list
npm run db:cli -- db dump --linked
```

O directamente:
```bash
./scripts/supabase-cli.sh projects list
./scripts/supabase-cli.sh db dump --linked
```

---

### 3. API TypeScript

#### Consultas Manuales con TypeScript
```typescript
import { getSupabaseServerClient } from '@/lib/supabase'

const supabase = getSupabaseServerClient()

// Consultar usuarios
const { data: users } = await supabase
  .from('users')
  .select('*')
  .limit(10)

// Crear recordatorio
const { data: reminder } = await supabase
  .from('reminders')
  .insert({
    user_id: 'uuid-here',
    title: 'Test',
    scheduled_time: new Date().toISOString()
  })
```

---

### 📊 Comparación de Métodos

| Método | Uso Principal | Ventaja |
|--------|---------------|---------|
| **MCP Server** | Desarrollo con IA, queries rápidas | Asistencia IA, lenguaje natural |
| **CLI** | Scripts, dumps, migraciones | Comandos avanzados, CI/CD |
| **API TypeScript** | Código de aplicación | Type-safety, integración app |

## 📚 Tablas Disponibles

1. **users** - Usuarios del sistema
2. **conversations** - Conversaciones de WhatsApp
3. **messages_v2** - Mensajes (nueva arquitectura)
4. **reminders** - Recordatorios programados
5. **flow_sessions** - Sesiones de WhatsApp Flows
6. **call_logs** - Registro de llamadas
7. **user_interactions** - Interacciones del usuario (CTA, etc.)
8. **user_locations** - Ubicaciones compartidas
9. **documents** - Documentos subidos
10. **embeddings** - Vectores para búsqueda semántica
11. **calendar_credentials** - Credenciales de calendario
12. **calendar_events** - Eventos de calendario
13. **conversation_actions** - Acciones en conversaciones
14. **follow_up_jobs** - Trabajos de seguimiento programados

## 🔧 Configuración

### Variables de Entorno (.env.local)
```bash
SUPABASE_URL=https://pdliixrgdvunoymxaxmw.supabase.co
SUPABASE_KEY=eyJhbG...  # Anon key
SUPABASE_ACCESS_TOKEN=sbp_fd67...  # CLI token
```

### Cliente TypeScript
```typescript
// lib/supabase.ts
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
```

## 🔍 Solución de Problemas

### Error: Missing SUPABASE_URL or SUPABASE_KEY
- Verifica que `.env.local` existe y tiene las variables
- Para scripts, usa: `source .env.local` o exporta manualmente

### Error: Access token not provided
- Usa el script helper: `npm run db:cli`
- O exporta: `export SUPABASE_ACCESS_TOKEN=sbp_...`

### Error: Migration history mismatch
- Normal durante desarrollo
- No afecta el acceso a datos
- Usa consultas directas en lugar de migraciones

## 📖 Referencias

- [Supabase Docs](https://supabase.com/docs)
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- [PostgreSQL REST API](https://postgrest.org/)
- Schema completo: `supabase/schema.sql`
- Tipos TypeScript: `types/database.types.ts`

---

## 🔗 Enlaces Útiles

- [Supabase MCP Server](https://supabase.com/blog/mcp-server) - Documentación oficial
- [Model Context Protocol](https://modelcontextprotocol.io/) - Especificación MCP
- [Supabase Dashboard](https://supabase.com/dashboard/project/pdliixrgdvunoymxaxmw)
- [Supabase Docs](https://supabase.com/docs)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

---

**Última actualización**: 2025-10-07
**Proyecto**: migue.ai (pdliixrgdvunoymxaxmw)
**Región**: us-east-2
**MCP Server**: ✅ Configurado y activo
