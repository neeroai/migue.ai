# Auditoría de Base de Datos - migue.ai
**Fecha**: 2025-10-11
**Proyecto**: pdliixrgdvunoymxaxmw
**Fase**: FASE 0.4 - Verificación de Base de Datos

---

## 1. Resumen Ejecutivo

### Estado General
- **Total de tablas**: 18 tablas en schema `public`
- **RLS habilitado**: ✅ 100% de tablas (18/18)
- **Políticas RLS activas**: ✅ 27 políticas definidas
- **Datos activos**: 244 registros distribuidos en 5 tablas

### Hallazgos Críticos

**✅ CONFIRMADO - Tabla reminders EXISTE**
- **Estructura**: 8 columnas con tipos correctos
- **Datos**: 5 recordatorios registrados
- **RLS**: 2 políticas activas (allow_all + select_own)
- **Estado**: ✅ 100% funcional

**❌ CONFIRMADO - Tabla expenses NO EXISTE**
- **Impacto**: Gemini promete "✅ Registré tu gasto" pero no guarda nada
- **UX crítico**: Usuario cree que el gasto fue guardado
- **Severidad**: P0 CRÍTICO - Mentira activa a usuarios

**❌ CONFIRMADO - Tabla meetings NO EXISTE**
- **Impacto**: scheduleMeetingFromIntent() confirma "✅ Agendé tu reunión" sin persistir
- **UX crítico**: Usuario pierde información de reuniones
- **Severidad**: P0 CRÍTICO - Confirmación falsa

### Métricas de Implementación
- **Funcionalidades prometidas**: 3 (recordatorios, meetings, gastos)
- **Funcionalidades implementadas en DB**: 1 (recordatorios)
- **Tasa de implementación**: 33% (1/3)
- **Gap de documentación**: 67%

---

## 2. Análisis de Tablas Existentes

### 2.1 Tabla `reminders` ✅
**Estado**: COMPLETA y FUNCIONAL

```sql
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status reminder_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  send_token UUID
);
```

**Enum `reminder_status`**: `pending | sent | cancelled | failed`

**Datos actuales**: 5 recordatorios registrados

**RLS Policies (2)**:
1. `allow_all_reminders` - Permite todas las operaciones (qual=true)
2. `reminders_select_own` - Los usuarios solo ven sus propios recordatorios (user_id = auth.uid())

**Análisis de diseño**:
- ✅ Columnas necesarias presentes
- ✅ Validación de estados (enum)
- ✅ Relación con users mediante FK
- ✅ Timestamps para auditoría
- ⚠️ `send_token` presente pero sin documentación de uso
- ❌ Falta soporte para:
  - Recordatorios recurrentes (daily, weekly, monthly)
  - Prioridad/urgencia
  - Categorías
  - Snooze/reprogramación
  - Adjuntos o metadata

**Recomendación**: Agregar columnas `recurrence_pattern JSONB` y `metadata JSONB` para funcionalidad avanzada

---

### 2.2 Tabla `messaging_windows` ✅
**Estado**: COMPLETA y ACTIVA

```sql
CREATE TABLE messaging_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  phone_number TEXT UNIQUE NOT NULL,
  window_opened_at TIMESTAMPTZ NOT NULL,
  window_expires_at TIMESTAMPTZ NOT NULL,
  last_user_message_id TEXT,
  proactive_messages_sent_today INTEGER DEFAULT 0 CHECK (proactive_messages_sent_today >= 0),
  last_proactive_sent_at TIMESTAMPTZ,
  free_entry_point_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Datos actuales**: 3 ventanas de mensajería activas

**RLS Policy (1)**:
- `users_own_messaging_windows` - Solo acceso a propias ventanas (user_id = auth.uid())

**Análisis de diseño**:
- ✅ Implementa sistema de ventanas de 24h de WhatsApp
- ✅ Rastrea mensajes proactivos (límite 4/día)
- ✅ Soporte para free entry point (72h para nuevos usuarios)
- ✅ Constraints para validar contadores
- ✅ Política RLS restrictiva (más segura que reminders)

**Implementación relacionada**:
- `lib/messaging-windows.ts` - 450 LOC (implementación completa)
- `app/api/cron/maintain-windows/route.ts` - Mantenimiento automático

**Recomendación**: ✅ Bien diseñado, no requiere cambios

---

### 2.3 Tabla `conversations` ✅
**Estado**: ACTIVA

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  wa_conversation_id VARCHAR,
  status conv_status DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Enum `conv_status`**: `active | archived | closed`

**Datos actuales**: 5 conversaciones activas

**RLS Policies (2)**:
1. `allow_all_conversations` - Todas las operaciones permitidas
2. `conversations_select_own` - SELECT solo propias conversaciones

**Análisis**:
- ✅ Estructura básica correcta
- ✅ Integración con WhatsApp (wa_conversation_id)
- ⚠️ No tiene información de última actividad
- ⚠️ No rastrea si la conversación está dentro de ventana de 24h

**Recomendación**: Agregar `last_activity_at TIMESTAMPTZ` para mejor manejo de ventanas

---

### 2.4 Tabla `messages_v2` ✅
**Estado**: ACTIVA (226 mensajes)

```sql
CREATE TABLE messages_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  direction msg_direction NOT NULL,
  type msg_type NOT NULL,
  content TEXT,
  media_url TEXT,
  wa_message_id VARCHAR,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Enum `msg_direction`**: `inbound | outbound`

**Enum `msg_type`**: `text | image | audio | video | document | sticker | location | interactive | button | reaction | order | contacts | system | unknown`

**Datos actuales**: 226 mensajes almacenados

**RLS Policies (2)**:
1. `allow_all_messages_v2` - Todas las operaciones
2. `messages_v2_select_own` - SELECT solo mensajes de propias conversaciones

**Análisis**:
- ✅ Soporte completo para tipos de WhatsApp v23.0
- ✅ Diferencia entre dirección (inbound/outbound) y tipo
- ✅ Campo `media_url` para adjuntos
- ✅ Timestamp separado de created_at (timestamp = cuando usuario envió, created_at = cuando guardamos)
- ✅ Relación con conversations

**Implementación relacionada**:
- `lib/persist.ts` - Validación de tipos y persistencia
- Migration `002_add_whatsapp_v23_message_types.sql` - Actualización de enum (Oct 7, 2025)

**Recomendación**: ✅ Bien implementado, funcional

---

### 2.5 Tabla `users` ✅
**Estado**: ACTIVA (5 usuarios)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL CHECK (phone_number ~ '^[+][1-9][0-9]{7,14}$'),
  name TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Datos actuales**: 5 usuarios registrados

**RLS Policies (2)**:
1. `allow_all_users` - Todas las operaciones
2. `users_select_own` - SELECT solo propio usuario

**Análisis**:
- ✅ Validación de formato E.164 para phone_number
- ✅ Campo preferences flexible (JSONB)
- ✅ Unique constraint en phone_number
- ✅ Relaciones FK con 11 tablas hijas
- ⚠️ No tiene campo para timezone (asume America/Bogota)
- ⚠️ No rastrea última interacción

**Recomendación**: Agregar `timezone TEXT DEFAULT 'America/Bogota'` para internacionalización futura

---

### 2.6 Tabla `gemini_usage` ✅
**Estado**: ACTIVA (tracking de free tier)

```sql
CREATE TABLE gemini_usage (
  date DATE PRIMARY KEY,
  requests INTEGER DEFAULT 0 CHECK (requests >= 0),
  tokens BIGINT DEFAULT 0 CHECK (tokens >= 0),
  cost NUMERIC(10,8) DEFAULT 0.00 CHECK (cost >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Datos actuales**: 0 registros (recién migrado)

**RLS Policy (1)**:
- `service_role_full_access` - Solo service_role y authenticated

**Análisis**:
- ✅ Diseño correcto para monitorear límite de 1,500 req/día
- ✅ Campos de validación (constraints)
- ✅ Primary key en date (una fila por día)
- ✅ Implementado en `lib/metrics.ts`

**Implementación relacionada**:
- `supabase/migrations/004_gemini_usage_tracking.sql` (Oct 11, 2025)
- Función `trackGeminiUsage()` en lib/metrics.ts

**Recomendación**: ✅ Bien diseñado

---

### 2.7 Otras Tablas de Soporte

#### `user_memory` (0 registros)
- **Propósito**: Almacenar hechos, preferencias, snippets de conversación con embeddings
- **Estado**: Implementada pero sin uso activo
- **Columnas clave**: `type`, `content`, `embedding vector(1536)`, `relevance`
- **RLS**: Políticas granulares (INSERT, UPDATE, DELETE, SELECT por separado)
- **Recomendación**: Activar para personalización de prompts

#### `ai_usage_tracking` (0 registros)
- **Propósito**: Monitoreo de uso de todos los proveedores AI (Claude, OpenAI, Groq, Gemini)
- **Estado**: Implementada
- **Campos**: `provider`, `task_type`, `model`, `tokens_input/output`, `cost_usd`
- **RLS**: Service role full access, users view own

#### `scheduled_messages` (0 registros)
- **Propósito**: Mensajes programados para entrega futura por AI agents
- **Estado**: Implementada pero sin uso
- **Campos**: `phone_number`, `message`, `scheduled_at`, `status`
- **RLS**: Users manage own, service role manage all

#### `webhook_failures` (0 registros)
- **Propósito**: Dead letter queue para webhooks fallidos
- **Estado**: Implementada
- **Campos**: `raw_payload`, `error_message`, `retry_count`, `status`

#### `flow_sessions` (0 registros)
- **Propósito**: WhatsApp Flows (formularios interactivos)
- **Estado**: Implementada pero sin flujos activos
- **Campos**: `flow_id`, `flow_token`, `flow_type`, `session_data`, `response_data`

#### `user_locations` (0 registros)
- **Propósito**: Locaciones compartidas por usuarios
- **Estado**: Implementada
- **Campos**: `latitude`, `longitude`, `name`, `address`

#### `call_logs` (0 registros)
- **Propósito**: Registro de llamadas de WhatsApp
- **Estado**: Implementada
- **Campos**: `call_id`, `direction`, `status`, `duration_seconds`

#### `user_interactions` (0 registros)
- **Propósito**: Tracking de interacciones con botones/CTAs
- **Estado**: Implementada
- **Campos**: `interaction_type`, `button_title`, `button_url`

#### `sessions` (0 registros)
- **Propósito**: Sistema antiguo de sesiones (reemplazado por conversations)
- **Estado**: Deprecado
- **Recomendación**: Considerar eliminar si no se usa

#### `messages` (0 registros)
- **Propósito**: Sistema antiguo de mensajes (reemplazado por messages_v2)
- **Estado**: Deprecado
- **Recomendación**: Considerar eliminar si no se usa

#### `documents` (0 registros)
- **Propósito**: Documentos subidos por usuarios
- **Estado**: Implementada
- **Campos**: `bucket`, `path`, `metadata`

#### `embeddings` (0 registros)
- **Propósito**: Vectores de embeddings para documentos
- **Estado**: Implementada
- **Relación**: FK a documents

---

## 3. Tablas Faltantes (Críticas)

### 3.1 Tabla `expenses` ❌
**Estado**: NO EXISTE

**Impacto en código**:

**Gemini (`lib/gemini-agents.ts:250-263`)**:
```typescript
case 'track_expense': {
  // TODO: Implement expense tracking when database table is ready
  logger.info('[gemini-agent] Expense tracking called', {...});
  // For now, just acknowledge the request
  return `✅ Registré tu gasto de ${amount} en ${category}`;  // ❌ MENTIRA
}
```

**Claude (`lib/claude-tools.ts:243-265`)**:
```typescript
export async function executeTrackExpense(input: unknown): Promise<string> {
  const validated = TrackExpenseInputSchema.parse(input)
  // TODO: Create 'expenses' table in Supabase
  logger.info('[trackExpenseTool] Expense tracked (in-memory only - pending DB table)', {...})
  return `💰 Gasto registrado: ${currency} ${amount} en ${category}
⚠️ Nota: El seguimiento de gastos está en desarrollo`  // ✅ HONESTO
}
```

**Severidad**: 🔴 P0 CRÍTICO - Gemini miente a usuarios activamente

**Diseño propuesto**:
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'COP' CHECK (currency ~ '^[A-Z]{3}$'),
  category TEXT NOT NULL CHECK (category IN (
    'comida', 'transporte', 'servicios', 'entretenimiento',
    'salud', 'educacion', 'compras', 'otros'
  )),
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT CHECK (payment_method IN ('efectivo', 'tarjeta', 'transferencia', 'otro')),
  location TEXT,
  receipt_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category);

-- RLS Policies
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expenses"
  ON expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON expenses FOR ALL
  USING (auth.role() = 'service_role');
```

**Estimación de implementación**: 2-3 horas
- Crear migración SQL (30 min)
- Actualizar `lib/gemini-agents.ts` y `lib/claude-tools.ts` (1h)
- Agregar queries básicas (`getExpensesByUser`, `getExpensesByCategory`) (30 min)
- Crear tests unitarios (1h)

**Prioridad**: P0 URGENTE - Fix Gemini response primero (5 min), implementar tabla después

---

### 3.2 Tabla `meetings` ❌
**Estado**: NO EXISTE

**Impacto en código**:

**`lib/scheduling.ts:120-152`**:
```typescript
export async function scheduleMeetingFromIntent(
  options: SchedulingRequestOptions
): Promise<SchedulingOutcome> {
  const extraction = await extractSchedulingDetails(...)
  const times = ensureTimes(extraction, options.fallbackTimeZone)
  const meetingDetails = buildMeetingDetails(extraction, times)
  const reply = formatConfirmation(...)

  // ❌ NO DATABASE PERSISTENCE
  return {
    status: 'scheduled',  // Dice "scheduled" pero no hay nada en DB
    reply,
    start: meetingDetails.startIso,
    end: meetingDetails.endIso,
  }
}
```

**Severidad**: 🔴 P0 CRÍTICO - Usuario pierde información de reuniones

**Casos de uso perdidos**:
- Usuario: "Recuérdame mi reunión de mañana" → No hay registro
- Bot: "¿Qué reuniones tengo esta semana?" → No puede responder
- Confirmación: "✅ Agendé tu reunión" → Usuario confía pero no existe

**Diseño propuesto**:
```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL CHECK (end_time > start_time),
  location TEXT,
  attendees TEXT[],
  meeting_url TEXT,
  status meeting_status DEFAULT 'scheduled',
  reminder_sent BOOLEAN DEFAULT false,
  reminder_before_minutes INTEGER DEFAULT 15 CHECK (reminder_before_minutes > 0),
  google_calendar_event_id TEXT,
  recurrence_pattern JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE meeting_status AS ENUM (
  'scheduled',
  'confirmed',
  'cancelled',
  'completed',
  'no_show'
);

-- Indexes
CREATE INDEX idx_meetings_user_id ON meetings(user_id);
CREATE INDEX idx_meetings_start_time ON meetings(start_time);
CREATE INDEX idx_meetings_status ON meetings(status);

-- RLS Policies
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meetings"
  ON meetings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON meetings FOR ALL
  USING (auth.role() = 'service_role');
```

**Features adicionales propuestas**:
- Integración con Google Calendar (`google_calendar_event_id`)
- Recordatorios automáticos pre-reunión
- Soporte para reuniones recurrentes (`recurrence_pattern JSONB`)
- Estados de reunión (scheduled → confirmed → completed)

**Estimación de implementación**: 4-5 horas
- Crear migración SQL con enum (45 min)
- Modificar `lib/scheduling.ts` para persistir (1.5h)
- Agregar queries (`getMeetingsByUser`, `getUpcomingMeetings`) (1h)
- Implementar recordatorios pre-reunión (1h)
- Tests unitarios (1h)

**Prioridad**: P0 URGENTE - Modificar confirmación mensaje primero, implementar tabla después

---

## 4. Análisis de RLS Policies

### 4.1 Resumen de Políticas Activas

**Total de políticas**: 27 distribuidas en 17 tablas

**Patrones identificados**:

#### Patrón 1: "Allow All" (Permisivo)
- **Tablas**: reminders, messages_v2, conversations, users, documents, embeddings, etc.
- **Política**: `allow_all_*` con `qual=true` y `with_check=true`
- **Significado**: Cualquier usuario autenticado puede realizar todas las operaciones
- **Riesgo**: ⚠️ MEDIO - Usuario podría acceder a datos de otros usuarios si API no valida
- **Tablas afectadas**: 12 de 17

**Ejemplo**:
```sql
CREATE POLICY "allow_all_reminders"
  ON reminders FOR ALL
  USING (true)
  WITH CHECK (true);
```

#### Patrón 2: "Own Data Only" (Restrictivo)
- **Tablas**: messaging_windows, user_memory, scheduled_messages, ai_usage_tracking
- **Política**: Valida `user_id = auth.uid()` o `auth.role() = 'service_role'`
- **Significado**: Solo acceso a datos propios o service role
- **Riesgo**: ✅ BAJO - Seguro por diseño
- **Tablas afectadas**: 4 de 17

**Ejemplo**:
```sql
CREATE POLICY "users_own_messaging_windows"
  ON messaging_windows FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

#### Patrón 3: "Service Role Only" (Sistema)
- **Tablas**: gemini_usage, webhook_failures
- **Política**: Solo `auth.role() = 'service_role'`
- **Significado**: Acceso exclusivo para sistema
- **Riesgo**: ✅ BAJO - Datos de sistema, no de usuarios
- **Tablas afectadas**: 2 de 17

**Ejemplo**:
```sql
CREATE POLICY "service_role_full_access"
  ON gemini_usage FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
```

#### Patrón 4: "Granular CRUD" (Restrictivo por operación)
- **Tablas**: user_memory (única con este patrón)
- **Políticas separadas**: INSERT, UPDATE, DELETE, SELECT cada una con su política
- **Significado**: Control fino sobre cada tipo de operación
- **Riesgo**: ✅ BAJO - Máxima seguridad
- **Tablas afectadas**: 1 de 17

**Ejemplo**:
```sql
CREATE POLICY "Users can read own memory"
  ON user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory"
  ON user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory"
  ON user_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory"
  ON user_memory FOR DELETE
  USING (auth.uid() = user_id);
```

---

### 4.2 Análisis de Riesgos de Seguridad

#### 🔴 CRÍTICO - Tablas con "allow_all" sin validación de user_id

**Tablas afectadas**:
1. `reminders` - Tiene `allow_all_reminders` (qual=true)
2. `conversations` - Tiene `allow_all_conversations` (qual=true)
3. `messages_v2` - Tiene `allow_all_messages_v2` (qual=true)
4. `users` - Tiene `allow_all_users` (qual=true)

**Riesgo**: Usuario malicioso podría:
- Leer recordatorios de otros usuarios
- Modificar conversaciones ajenas
- Ver mensajes de otros usuarios
- Acceder a datos de otros users

**Mitigación actual**:
- Validación a nivel de API (`lib/reminders.ts` valida `userId`)
- Segunda política restrictiva (e.g., `reminders_select_own`)

**Problema**: Si API falla o se bypasea, RLS no protege

**Recomendación**: 🚨 URGENTE
```sql
-- Eliminar políticas "allow_all"
DROP POLICY "allow_all_reminders" ON reminders;
DROP POLICY "allow_all_conversations" ON conversations;
DROP POLICY "allow_all_messages_v2" ON messages_v2;
DROP POLICY "allow_all_users" ON users;

-- Reemplazar con políticas restrictivas
CREATE POLICY "Users manage own reminders"
  ON reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to reminders"
  ON reminders FOR ALL
  USING (auth.role() = 'service_role');
```

**Impacto**: Sin cambios en funcionalidad (API ya valida), pero defense-in-depth mejorada

---

#### ⚠️ MEDIO - Políticas "SELECT own" sin política de INSERT/UPDATE

**Tablas afectadas**:
1. `reminders` - Tiene `reminders_select_own` pero `allow_all_reminders` permite INSERT/UPDATE de cualquiera
2. `conversations` - Tiene `conversations_select_own` pero `allow_all_conversations` permite INSERT/UPDATE
3. `messages_v2` - Tiene `messages_v2_select_own` pero `allow_all_messages_v2` permite INSERT/UPDATE

**Problema**: Inconsistencia entre SELECT (restrictivo) y INSERT/UPDATE (permisivo)

**Recomendación**: Separar políticas por operación como en `user_memory`

---

#### ✅ BAJO - Tablas con buena seguridad

**Tablas bien protegidas**:
1. `messaging_windows` - Solo own data (user_id = auth.uid())
2. `user_memory` - Granular CRUD por operación
3. `gemini_usage` - Service role only
4. `ai_usage_tracking` - Service role + view own
5. `scheduled_messages` - Service role + manage own

**Patrón recomendado**: Seguir modelo de `messaging_windows` y `user_memory`

---

### 4.3 Recomendaciones de Seguridad RLS

**Prioridad P0 (Implementar antes de FASE 1)**:
1. ✅ Eliminar todas las políticas `allow_all_*` con `qual=true`
2. ✅ Reemplazar con políticas restrictivas (`user_id = auth.uid()`)
3. ✅ Agregar política de service_role para operaciones de sistema
4. ✅ Separar políticas por operación (INSERT, UPDATE, DELETE, SELECT)

**Prioridad P1 (Implementar en FASE 2)**:
1. ✅ Auditar todas las llamadas API para verificar validación de `userId`
2. ✅ Agregar tests de RLS (intentar acceder a datos de otro usuario)
3. ✅ Documentar matriz de permisos por tabla

**Prioridad P2 (Mejora continua)**:
1. ✅ Implementar políticas basadas en roles (admin, user, guest)
2. ✅ Agregar logging de violaciones de RLS
3. ✅ Monitorear intentos de acceso no autorizado

**Script de migración propuesto**: `supabase/migrations/010_fix_rls_policies.sql`

---

## 5. Comparación: Documentación vs Realidad

### 5.1 Funcionalidades en Documentación

**AGENTS.md líneas 250-280** promete:
- ✅ Recordatorios (reminders)
- ❌ Agendamiento de reuniones (meetings)
- ❌ Tracking de gastos (expenses)

**CLAUDE.md líneas 15-25** lista capacidades:
- ✅ create_reminder - Guardas recordatorios en base de datos
- ❌ schedule_meeting - Creas eventos en Google Calendar
- ❌ track_expense - Registras gastos para control financiero

**Prompts (`lib/gemini-agents.ts:28-34`, `lib/claude-agents.ts:49-52`)** dicen:
```
TUS CAPACIDADES REALES (Herramientas Integradas):
1. create_reminder - Guardas recordatorios en base de datos ✅
2. schedule_meeting - Creas eventos en Google Calendar ❌
3. track_expense - Registras gastos para control financiero ❌
```

### 5.2 Funcionalidades en Base de Datos

**Tablas implementadas**:
- ✅ `reminders` - 8 columnas, 5 registros, 2 RLS policies
- ❌ `meetings` - NO EXISTE
- ❌ `expenses` - NO EXISTE

**Gap de implementación**: 67% (2 de 3 features prometidas no existen)

### 5.3 Comparación con Audit de Código (FASE 0.3)

**Scores de funcionalidad** (docs/audit/functionality-audit.md):
- Reminders: 95/100 ✅ (funcional, falta recurrencia)
- Meetings: 70/100 ⚠️ (parsing funciona, NO persiste a DB)
- Expenses: 10/100 ❌ (stub only, Gemini miente)

**Confirmación con DB Audit**:
- Reminders: ✅ Tabla existe, estructura correcta, datos presentes
- Meetings: ❌ NO HAY TABLA - Confirma score 70/100 (procesa pero no guarda)
- Expenses: ❌ NO HAY TABLA - Confirma score 10/100 (solo log, no persiste)

**Conclusión**: Audit de código y DB están 100% alineados

---

## 6. Impacto en UX de Usuario

### 6.1 Experiencia Actual del Usuario

**Caso 1: Usuario crea recordatorio** ✅
```
Usuario: "Recuérdame comprar leche mañana a las 8am"
Bot: "✅ Listo! Guardé tu recordatorio 'comprar leche' para mañana 11 oct a las 8:00 AM"
REALIDAD: ✅ Recordatorio guardado en DB (tabla reminders)
RESULTADO: ✅ Usuario recibe recordatorio al día siguiente
```

**Caso 2: Usuario agenda reunión** ❌
```
Usuario: "Agenda reunión con Sofía mañana a las 3pm"
Bot: "✅ Agendé tu reunión 'Reunión con Sofía' para mañana 11 oct a las 3:00 PM"
REALIDAD: ❌ NO SE GUARDA EN DB (tabla meetings no existe)
RESULTADO: ❌ Usuario pierde información, no puede consultar reuniones
```

**Caso 3: Usuario registra gasto (Gemini)** ❌
```
Usuario: "Gasté 50 lucas en almuerzo"
Bot (Gemini): "✅ Registré tu gasto de 50000 COP en comida"
REALIDAD: ❌ NO SE GUARDA EN DB (tabla expenses no existe)
RESULTADO: ❌ Usuario cree que gasto fue registrado, pero no existe
```

**Caso 4: Usuario registra gasto (Claude)** ⚠️
```
Usuario: "Gasté 50 lucas en almuerzo"
Bot (Claude): "💰 Gasto registrado: 50000 COP en comida
⚠️ Nota: El seguimiento de gastos está en desarrollo"
REALIDAD: ❌ NO SE GUARDA EN DB (tabla expenses no existe)
RESULTADO: ⚠️ Usuario informado de que es beta, expectativa correcta
```

### 6.2 Severidad de Impactos

**P0 CRÍTICO** - Gemini miente sobre expenses
- **Impacto**: Pérdida de confianza del usuario
- **Frecuencia**: Cada vez que usuario registra gasto con Gemini activo
- **Fix urgente**: Cambiar mensaje a honesto (5 minutos)
- **Fix completo**: Implementar tabla expenses (2-3 horas)

**P0 CRÍTICO** - Meetings confirma pero no persiste
- **Impacto**: Pérdida de información de reuniones
- **Frecuencia**: Cada vez que usuario agenda reunión
- **Fix urgente**: Cambiar mensaje de confirmación (5 minutos)
- **Fix completo**: Implementar tabla meetings (4-5 horas)

**P1 ALTO** - Recordatorios sin recurrencia
- **Impacto**: Usuario debe crear recordatorio manualmente cada vez
- **Frecuencia**: Casos de uso "todos los días", "cada semana"
- **Fix**: Agregar `recurrence_pattern JSONB` (2 horas)

---

## 7. Recomendaciones Priorizadas

### 7.1 URGENTE (P0) - Fixes de 5 minutos

**1. Fix mensaje de expense en Gemini** (5 min)
```typescript
// lib/gemini-agents.ts:263
// ANTES:
return `✅ Registré tu gasto de ${amount} en ${category}`;

// DESPUÉS:
return `📝 Anoté tu gasto de ${amount} en ${category}
⚠️ Seguimiento de gastos en desarrollo - pronto disponible`;
```

**2. Fix mensaje de meeting** (5 min)
```typescript
// lib/scheduling.ts:150
// ANTES:
status: 'scheduled',

// DESPUÉS:
status: 'processed',  // NO decir "scheduled" hasta que persista en DB

// CAMBIAR MENSAJE:
reply: `📅 Procesé tu reunión "${title}"
⚠️ Calendario en desarrollo - por ahora solo te confirmo los detalles`
```

**Total tiempo**: 10 minutos
**Impacto**: Elimina mentiras activas a usuarios

---

### 7.2 CRÍTICO (P0) - Implementación de tablas faltantes

**1. Tabla `expenses`** (2-3 horas)
- Crear migración SQL con diseño propuesto (30 min)
- Modificar `lib/gemini-agents.ts` y `lib/claude-tools.ts` (1h)
- Agregar `lib/expenses.ts` con queries básicas (30 min)
- Tests unitarios (1h)

**2. Tabla `meetings`** (4-5 horas)
- Crear migración SQL con enum (45 min)
- Modificar `lib/scheduling.ts` para persistir (1.5h)
- Agregar queries y recordatorios pre-reunión (1h)
- Integración con Google Calendar (1h - opcional)
- Tests unitarios (1h)

**Total tiempo**: 6-8 horas
**Impacto**: Completa funcionalidad prometida

---

### 7.3 ALTO (P1) - Seguridad RLS

**1. Eliminar políticas "allow_all"** (1-2 horas)
- Crear migración `010_fix_rls_policies.sql`
- Reemplazar con políticas restrictivas
- Testing de acceso cross-user
- Deploy a producción

**Total tiempo**: 1-2 horas
**Impacto**: Defense-in-depth mejorada

---

### 7.4 MEDIO (P2) - Mejoras de features

**1. Recordatorios recurrentes** (2 horas)
- Agregar `recurrence_pattern JSONB` a tabla reminders
- Modificar `lib/reminders.ts` para manejar recurrencia
- Actualizar prompts para entender "todos los días"
- Tests

**2. Snooze de recordatorios** (1 hora)
- Agregar `snoozed_until TIMESTAMPTZ` a reminders
- Implementar función `snoozeReminder()`
- Actualizar cron para respetar snooze

**3. Edición/eliminación de recordatorios** (1 hora)
- Implementar `updateReminder()` y `deleteReminder()`
- Agregar prompts para entender "cancela mi recordatorio de..."
- Tests

**Total tiempo**: 4 horas
**Impacto**: UX completa para recordatorios

---

## 8. Plan de Acción Propuesto

### Fase 0.5: Fixes Urgentes (1 día)
**Objetivo**: Eliminar mentiras activas a usuarios

✅ **Mañana (2 horas)**:
1. Fix mensaje expense en Gemini (5 min)
2. Fix mensaje meeting (5 min)
3. Commit + deploy a producción
4. Verificar en logs que nuevos mensajes se envíen

✅ **Tarde (2 horas)**:
1. Fix RLS policies "allow_all" (1-2h)
2. Testing de seguridad cross-user
3. Deploy a producción

**Resultado**: Sistema honesto + seguridad mejorada

---

### Fase 0.6: Implementación de Tablas (3 días)
**Objetivo**: Completar funcionalidad prometida

✅ **Día 1 (3 horas)**: Tabla expenses
1. Crear migración SQL
2. Modificar tool execution
3. Agregar queries básicas
4. Tests unitarios
5. Deploy a producción

✅ **Día 2 (5 horas)**: Tabla meetings
1. Crear migración SQL con enum
2. Modificar lib/scheduling.ts
3. Agregar queries y recordatorios
4. Tests unitarios
5. Deploy a producción

✅ **Día 3 (2 horas)**: Testing integrado
1. Test end-to-end de 3 features
2. Verificar persistencia en DB
3. Validar mensajes a usuarios
4. Actualizar documentación

**Resultado**: 100% de funcionalidades implementadas

---

### Después: Continuar FASE 1 (Prompts)
- Una vez DB completo y honesto
- Proceder con optimización de prompts
- Incluir nuevas capacidades en ejemplos

---

## 9. Conclusión

### Estado Actual
- **Implementación DB**: 33% (1 de 3 features)
- **Seguridad RLS**: 70% (policies permisivas en 12/17 tablas)
- **Honestidad con usuario**: 50% (Gemini miente, Claude honesto)

### Decisión Requerida

**Opción A**: Continuar FASE 1 (Prompts) sin arreglar DB
- ❌ Prompts mejorados pero features no funcionan
- ❌ Usuario sigue recibiendo confirmaciones falsas
- ❌ Gap entre documentación y realidad sigue en 67%

**Opción B**: Pausar FASE 1, fix DB primero (Recomendado)
- ✅ Sistema honesto en 1 día (fixes urgentes)
- ✅ Features completas en 3 días (tablas faltantes)
- ✅ Seguridad mejorada (RLS restrictivo)
- ✅ Base sólida para optimizar prompts después

**Recomendación**: Opción B - No tiene sentido optimizar prompts para features que no existen en DB

---

## 10. Anexos

### A. Script de Verificación Rápida

```sql
-- Verificar tablas de features
SELECT
  table_name,
  CASE
    WHEN table_name = 'reminders' THEN '✅ EXISTE'
    WHEN table_name = 'meetings' THEN '❌ FALTA'
    WHEN table_name = 'expenses' THEN '❌ FALTA'
    ELSE '⚠️ OTRA'
  END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('reminders', 'meetings', 'expenses');

-- Contar registros en reminders
SELECT COUNT(*) as total_reminders FROM reminders;

-- Verificar RLS habilitado
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Listar políticas "allow_all"
SELECT
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'allow_all%'
ORDER BY tablename;
```

### B. Migración Propuesta (Expenses)

Ver diseño completo en sección 3.1

### C. Migración Propuesta (Meetings)

Ver diseño completo en sección 3.2

### D. Migración Propuesta (RLS Fix)

```sql
-- supabase/migrations/010_fix_rls_policies.sql
-- Drop permissive policies
DROP POLICY IF EXISTS "allow_all_reminders" ON reminders;
DROP POLICY IF EXISTS "allow_all_conversations" ON conversations;
DROP POLICY IF EXISTS "allow_all_messages_v2" ON messages_v2;
DROP POLICY IF EXISTS "allow_all_users" ON users;

-- Create restrictive policies for reminders
CREATE POLICY "Users manage own reminders"
  ON reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to reminders"
  ON reminders FOR ALL
  USING (auth.role() = 'service_role');

-- Similar for conversations, messages_v2, users...
```

---

**Documento generado**: 2025-10-11
**Autor**: @agent-claude-master
**Fase**: FASE 0.4 - Auditoría de Base de Datos
**Estado**: ✅ COMPLETO

**Próximo paso**: Presentar hallazgos para aprobación y decidir:
- ¿Fix DB primero (Opción B recomendada)?
- ¿O continuar FASE 1 prompts con DB incompleto (Opción A)?
