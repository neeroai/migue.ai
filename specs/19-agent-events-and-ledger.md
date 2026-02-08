# 19 - Agent Events And Run Ledger

## Estado
- Semaforo: `YELLOW`
- Fecha: `2026-02-08`
- Owner tecnico: `src/shared/infra/db/*`

## Objetivo funcional
Crear el backbone durable para ejecucion agéntica, trazabilidad y recuperacion:
- cola de eventos
- ledger de runs
- pasos de ejecucion
- tool calls/results
- checkpoints de reanudacion

## Modelo de datos (Supabase)
### Tabla `agent_events`
Campos minimos:
- `id uuid pk`
- `conversation_id uuid not null`
- `user_id uuid not null`
- `source text not null` (`whatsapp_webhook`)
- `input_type text not null`
- `payload jsonb not null`
- `idempotency_key text not null unique`
- `status text not null default 'pending'` (`pending|processing|done|failed`)
- `attempt_count int not null default 0`
- `available_at timestamptz not null default now()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indices:
- `(status, available_at)`
- `(conversation_id, created_at desc)`
- `(user_id, created_at desc)`

### Tabla `agent_runs`
- `id uuid pk`
- `event_id uuid fk -> agent_events(id)`
- `conversation_id uuid not null`
- `user_id uuid not null`
- `status text not null`
- `graph_version text not null default 'v1'`
- `input_class text not null`
- `started_at timestamptz`
- `ended_at timestamptz`
- `failure_reason text`
- `created_at timestamptz not null default now()`

### Tabla `agent_steps`
- `id uuid pk`
- `run_id uuid fk -> agent_runs(id)`
- `node text not null`
- `status text not null` (`started|ok|error|skipped`)
- `input_snapshot jsonb`
- `output_snapshot jsonb`
- `latency_ms int`
- `created_at timestamptz not null default now()`

### Tabla `agent_tool_calls`
- `id uuid pk`
- `run_id uuid fk -> agent_runs(id)`
- `tool_name text not null`
- `risk_level text not null` (`low|medium|high`)
- `input jsonb not null`
- `output jsonb`
- `status text not null` (`started|ok|error|timeout|blocked`)
- `error text`
- `started_at timestamptz`
- `ended_at timestamptz`

### Tabla `agent_checkpoints`
- `id uuid pk`
- `run_id uuid fk -> agent_runs(id)`
- `node text not null`
- `state jsonb not null`
- `created_at timestamptz not null default now()`

## Contratos TypeScript
Tipos a crear:
- `AgentEvent`
- `AgentRun`
- `AgentStep`
- `AgentToolCall`
- `AgentCheckpoint`

Archivo sugerido:
- `src/modules/agent/domain/contracts.ts`

## Semantica de consumo
- FIFO por `conversation_id`.
- Un solo worker activo por conversacion (advisory lock o claim transaccional).
- Reintentos con backoff exponencial por `available_at`.

## Idempotencia
- `idempotency_key` = `wa_message_id` (o hash payload cuando no exista).
- Side effects externos deben incluir `external_idempotency_key`.

## Evidencia requerida
- Migracion SQL + pruebas de integridad.
- Prueba de doble entrega webhook sin duplicar run efectivo.

## Progreso implementado (2026-02-08)
- Migracion creada: `supabase/migrations/023_add_agent_events_ledger.sql`.
- Contratos TypeScript creados: `src/modules/agent/domain/contracts.ts`.
- Encolado no bloqueante integrado en background pipeline:
  - `src/modules/agent/infra/ledger.ts`
  - `src/modules/webhook/application/background-processor.ts`
- Feature flag de rollout:
  - `AGENT_EVENT_LEDGER_ENABLED`
  - `src/modules/agent/application/feature-flags.ts`

## Gaps abiertos para GREEN
- Falta worker consumer de `agent_events` con locking por `conversation_id`.
- Falta `agent_runs/agent_steps/agent_tool_calls/agent_checkpoints` en uso runtime (tablas ya creadas).
- Falta test de integracion DB real para dedupe por `idempotency_key`.

## Criterio de salida a YELLOW
1. Tablas/migraciones en produccion.
2. Cola consumida por worker con locking por conversacion.
3. Trazabilidad de run/step/tool consultable.
